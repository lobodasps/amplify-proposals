import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiSkills, llmUsageLogs, providerApiKeys } from "../../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { DEFAULT_SKILLS, invokeLLMWithSkill, invalidateProviderKeysCache, type SkillType } from "../_core/llmSkill";

// ─── Provider API Keys sub-router ───────────────────────────────────────────

export const providerApiKeysRouter = router({
  /** List all configured provider API keys (API key value is masked) */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(providerApiKeys).orderBy(providerApiKeys.createdAt);
    // Mask the actual key value — only show last 4 chars
    return rows.map((r) => ({
      ...r,
      apiKey: r.apiKey ? `sk-...${r.apiKey.slice(-4)}` : "",
    }));
  }),

  /** Create or update a provider API key */
  upsert: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        provider: z.enum(["openai", "anthropic", "google_gemini", "azure_openai", "custom"]),
        // Use "__KEEP_EXISTING__" to preserve the current API key when editing
        apiKey: z.string().min(1),
        baseUrl: z.string().nullable().optional(),
        defaultModel: z.string().nullable().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // If setting as default, clear all other defaults first
      if (input.isDefault) {
        await db.update(providerApiKeys).set({ isDefault: false });
      }

      if (input.id) {
        // Update existing — only update apiKey if a new one was explicitly provided
        const updatePayload: Record<string, unknown> = {
          name: input.name,
          provider: input.provider,
          baseUrl: input.baseUrl ?? null,
          defaultModel: input.defaultModel ?? null,
          isDefault: input.isDefault ?? false,
          updatedAt: new Date(),
        };
        if (input.apiKey && input.apiKey !== "__KEEP_EXISTING__") {
          updatePayload.apiKey = input.apiKey;
        }
        await db
          .update(providerApiKeys)
          .set(updatePayload as any)
          .where(eq(providerApiKeys.id, input.id));
      } else {
        // Insert new
        if (!input.apiKey || input.apiKey === "__KEEP_EXISTING__") {
          throw new Error("API key is required when creating a new provider key.");
        }
        await db.insert(providerApiKeys).values({
          name: input.name,
          provider: input.provider,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl ?? null,
          defaultModel: input.defaultModel ?? null,
          isDefault: input.isDefault ?? false,
        });
      }

      invalidateProviderKeysCache();
      return { success: true };
    }),

  /** Delete a provider API key */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(providerApiKeys).where(eq(providerApiKeys.id, input.id));
      invalidateProviderKeysCache();
      return { success: true };
    }),

  /** Set a provider API key as the system default */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Clear all defaults, then set the specified one
      await db.update(providerApiKeys).set({ isDefault: false });
      await db.update(providerApiKeys).set({ isDefault: true }).where(eq(providerApiKeys.id, input.id));
      invalidateProviderKeysCache();
      return { success: true };
    }),
});

// ─── AI Skills router ─────────────────────────────────────────────────────────

export const aiSkillsRouter = router({
  /** Provider API Keys sub-procedures (nested) */
  providerKeys: providerApiKeysRouter,
  /** List all skill configs (creates defaults if table is empty) */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return Object.entries(DEFAULT_SKILLS).map(([skillType, def]) => ({
      id: 0,
      skillType,
      displayName: def.displayName,
      description: def.description,
      provider: def.defaultProvider,
      model: def.defaultModel,
      apiKey: null,
      baseUrl: null,
      systemPrompt: def.systemPrompt,
      userPromptTemplate: def.userPromptTemplate,
      templateVariables: JSON.stringify(def.templateVariables),
      outputType: def.outputType ?? "prose",
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const rows = await db.select().from(aiSkills).orderBy(aiSkills.skillType);

    // If table is empty, seed defaults and return them
    // Do NOT hardcode provider/model — leave null so Settings → AI Skills UI controls selection
    if (rows.length === 0) {
      const toInsert = Object.entries(DEFAULT_SKILLS).map(([skillType, def]) => ({
        skillType,
        displayName: def.displayName,
        description: def.description,
        systemPrompt: def.systemPrompt,
        userPromptTemplate: def.userPromptTemplate,
        templateVariables: JSON.stringify(def.templateVariables),
        outputType: def.outputType ?? "prose",
        enabled: true,
      }));
      await db.insert(aiSkills).values(toInsert);
      return db.select().from(aiSkills).orderBy(aiSkills.skillType);
    }

    // Ensure any new skill types added in code are also in DB
    const existingTypes = new Set(rows.map((r) => r.skillType));
    for (const [skillType, def] of Object.entries(DEFAULT_SKILLS)) {
      if (!existingTypes.has(skillType)) {
        await db.insert(aiSkills).values({
          skillType,
          displayName: def.displayName,
          description: def.description,
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
          templateVariables: JSON.stringify(def.templateVariables),
          outputType: def.outputType ?? "prose",
          enabled: true,
        });
      }
    }

    return db.select().from(aiSkills).orderBy(aiSkills.skillType);
  }),

  /** Get a single skill config by skillType */
  getByType: protectedProcedure
    .input(z.object({ skillType: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(aiSkills)
        .where(eq(aiSkills.skillType, input.skillType))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Create or update a skill config */
  upsert: protectedProcedure
    .input(
      z.object({
        skillType: z.string(),
        // null means "use system default provider"
        provider: z.string().nullable().optional(),
        model: z.string().nullable().optional(),
        /** Pass null to clear the key, omit to leave unchanged */
        apiKey: z.string().nullable().optional(),
        baseUrl: z.string().nullable().optional(),
        systemPrompt: z.string().min(1),
        userPromptTemplate: z.string().min(1),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const existing = await db
        .select({ id: aiSkills.id })
        .from(aiSkills)
        .where(eq(aiSkills.skillType, input.skillType))
        .limit(1);

      const def = DEFAULT_SKILLS[input.skillType as SkillType];

      if (existing.length > 0) {
        const updateData: Record<string, unknown> = {
          provider: input.provider,
          systemPrompt: input.systemPrompt,
          userPromptTemplate: input.userPromptTemplate,
        };
        if (input.model !== undefined) updateData.model = input.model;
        if (input.apiKey !== undefined) updateData.apiKey = input.apiKey;
        if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
        if (input.enabled !== undefined) updateData.enabled = input.enabled;

        await db.update(aiSkills).set(updateData).where(eq(aiSkills.skillType, input.skillType));
      } else {
        await db.insert(aiSkills).values({
          skillType: input.skillType,
          displayName: def?.displayName ?? input.skillType,
          description: def?.description ?? "",
          provider: input.provider,
          model: input.model ?? null,
          apiKey: input.apiKey ?? null,
          baseUrl: input.baseUrl ?? null,
          systemPrompt: input.systemPrompt,
          userPromptTemplate: input.userPromptTemplate,
          templateVariables: def ? JSON.stringify(def.templateVariables) : "[]",
          enabled: input.enabled ?? true,
        });
      }

      return { success: true };
    }),

  /** Reset a skill's prompts to the built-in defaults */
  resetToDefaults: protectedProcedure
    .input(z.object({ skillType: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const def = DEFAULT_SKILLS[input.skillType as SkillType];
      if (!def) throw new Error(`Unknown skill type: ${input.skillType}`);

      await db
        .update(aiSkills)
        .set({
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
        })
        .where(eq(aiSkills.skillType, input.skillType));

      return { success: true };
    }),

  /** Test a skill with sample variables — returns the raw LLM response */
  test: protectedProcedure
    .input(
      z.object({
        skillType: z.string(),
        /** Sample variable values to interpolate */
        sampleVariables: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const skillType = input.skillType as SkillType;
      const def = DEFAULT_SKILLS[skillType];
      if (!def) throw new Error(`Unknown skill type: ${skillType}`);

      // Build sample variables from defaults if not provided
      const sampleVars: Record<string, string> = {};
      for (const v of def.templateVariables) {
        sampleVars[v] = (input.sampleVariables?.[v] as string | undefined) ?? `[sample ${v}]`;
      }

      try {
        const result = await invokeLLMWithSkill({
          skillType,
          variables: sampleVars,
        });
        return {
          success: true,
          provider: result._provider,
          model: result._model,
          response: result.choices[0]?.message?.content ?? "(no content)",
        };
      } catch (err: any) {
        return {
          success: false,
          provider: "unknown",
          model: "unknown",
          response: err.message ?? "Unknown error",
        };
      }
    }),

  // ─── Token Usage Stats ──────────────────────────────────────────────────────

  /** Get usage stats for the current month (or a specified month) */
  usageStats: protectedProcedure
    .input(
      z.object({
        /** ISO date string for the start of the month, e.g. "2026-05-01" */
        monthStart: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { bySkill: [], byProvider: [], totals: { calls: 0, tokensIn: 0, tokensOut: 0, estimatedCost: 0 } };

      // Default to current month start
      const now = new Date();
      const monthStartStr = input?.monthStart ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monthStart = new Date(monthStartStr);

      const rows = await db
        .select({
          skillType: llmUsageLogs.skillType,
          provider: llmUsageLogs.provider,
          model: llmUsageLogs.model,
          calls: sql<number>`count(*)`,
          tokensIn: sql<number>`COALESCE(sum(${llmUsageLogs.tokensIn}), 0)`,
          tokensOut: sql<number>`COALESCE(sum(${llmUsageLogs.tokensOut}), 0)`,
          estimatedCost: sql<string>`COALESCE(sum(CAST(${llmUsageLogs.estimatedCost} AS DECIMAL(10,6))), 0)`,
          avgDurationMs: sql<number>`COALESCE(avg(${llmUsageLogs.durationMs}), 0)`,
          successCount: sql<number>`sum(CASE WHEN ${llmUsageLogs.success} = true THEN 1 ELSE 0 END)`,
          failCount: sql<number>`sum(CASE WHEN ${llmUsageLogs.success} = false THEN 1 ELSE 0 END)`,
        })
        .from(llmUsageLogs)
        .where(gte(llmUsageLogs.createdAt, monthStart))
        .groupBy(llmUsageLogs.skillType, llmUsageLogs.provider, llmUsageLogs.model);

      // Aggregate by skill
      const bySkillMap = new Map<string, { calls: number; tokensIn: number; tokensOut: number; estimatedCost: number; avgDurationMs: number; successRate: number }>();
      const byProviderMap = new Map<string, { calls: number; tokensIn: number; tokensOut: number; estimatedCost: number }>();
      let totalCalls = 0, totalTokensIn = 0, totalTokensOut = 0, totalCost = 0;

      for (const row of rows) {
        const calls = Number(row.calls);
        const tokensIn = Number(row.tokensIn);
        const tokensOut = Number(row.tokensOut);
        const cost = Number(row.estimatedCost);
        const avgMs = Number(row.avgDurationMs);
        const successCount = Number(row.successCount);

        totalCalls += calls;
        totalTokensIn += tokensIn;
        totalTokensOut += tokensOut;
        totalCost += cost;

        // By skill
        const existing = bySkillMap.get(row.skillType) ?? { calls: 0, tokensIn: 0, tokensOut: 0, estimatedCost: 0, avgDurationMs: 0, successRate: 0 };
        existing.calls += calls;
        existing.tokensIn += tokensIn;
        existing.tokensOut += tokensOut;
        existing.estimatedCost += cost;
        existing.avgDurationMs = avgMs; // last wins is fine for display
        existing.successRate = calls > 0 ? (successCount / calls) * 100 : 100;
        bySkillMap.set(row.skillType, existing);

        // By provider
        const provKey = `${row.provider}/${row.model}`;
        const existingProv = byProviderMap.get(provKey) ?? { calls: 0, tokensIn: 0, tokensOut: 0, estimatedCost: 0 };
        existingProv.calls += calls;
        existingProv.tokensIn += tokensIn;
        existingProv.tokensOut += tokensOut;
        existingProv.estimatedCost += cost;
        byProviderMap.set(provKey, existingProv);
      }

      const bySkill = Array.from(bySkillMap.entries()).map(([skillType, stats]) => ({
        skillType,
        displayName: DEFAULT_SKILLS[skillType as SkillType]?.displayName ?? skillType,
        ...stats,
      })).sort((a, b) => b.estimatedCost - a.estimatedCost);

      const byProvider = Array.from(byProviderMap.entries()).map(([key, stats]) => {
        const [provider, model] = key.split("/");
        return { provider, model, ...stats };
      }).sort((a, b) => b.estimatedCost - a.estimatedCost);

      return {
        bySkill,
        byProvider,
        totals: { calls: totalCalls, tokensIn: totalTokensIn, tokensOut: totalTokensOut, estimatedCost: totalCost },
      };
    }),

  /** Get recent usage log entries (for debugging / detail view) */
  usageLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        skillType: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const limit = input?.limit ?? 50;
      const conditions = [];
      if (input?.skillType) {
        conditions.push(eq(llmUsageLogs.skillType, input.skillType));
      }

      const rows = await db
        .select()
        .from(llmUsageLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${llmUsageLogs.createdAt} DESC`)
        .limit(limit);

      return rows;
    }),

  /**
   * DEPRECATED: One-time migration utility to fix providers that were seeded as manus_builtin.
   * Provider/model selection is now managed exclusively through Settings → AI Configuration UI.
   * This mutation exists only for legacy DB rows that need a one-time correction.
   */
  fixProviders: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const GEMINI_FLASH_SKILLS = [
      "rfp_shredder", "asset_tagger", "autoExtract", "dam_image_caption",
      "opportunity_ingestion", "wiki_compiler", "xml_shredder"
    ];
    const GEMINI_PRO_SKILLS = ["triggerExtract"];
    const ANTHROPIC_SKILLS = [
      "agent_guidelines", "conflict_detector", "contract_analyzer",
      "go_no_go_advisor", "opportunity_scorer", "proposal_scorer",
      "proposal_writer", "resume_tailor"
    ];

    // Update Gemini Flash
    for (const skill of GEMINI_FLASH_SKILLS) {
      await db.update(aiSkills).set({ provider: "google_gemini", model: "gemini-2.5-flash-preview-05-20" }).where(eq(aiSkills.skillType, skill));
    }
    // Update Gemini Pro
    for (const skill of GEMINI_PRO_SKILLS) {
      await db.update(aiSkills).set({ provider: "google_gemini", model: "gemini-2.5-pro-preview-05-06" }).where(eq(aiSkills.skillType, skill));
    }
    // Update Anthropic
    for (const skill of ANTHROPIC_SKILLS) {
      await db.update(aiSkills).set({ provider: "anthropic", model: "claude-sonnet-4-20250514" }).where(eq(aiSkills.skillType, skill));
    }

    return { success: true, updated: GEMINI_FLASH_SKILLS.length + GEMINI_PRO_SKILLS.length + ANTHROPIC_SKILLS.length };
  }),
});
