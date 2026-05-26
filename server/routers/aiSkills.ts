import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiSkills } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SKILLS, invokeLLMWithSkill, type SkillType } from "../_core/llmSkill";

export const aiSkillsRouter = router({
  /** List all skill configs (creates defaults if table is empty) */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return Object.entries(DEFAULT_SKILLS).map(([skillType, def]) => ({
      id: 0,
      skillType,
      displayName: def.displayName,
      description: def.description,
      provider: "manus_builtin",
      model: "gemini-2.5-flash",
      apiKey: null,
      baseUrl: null,
      systemPrompt: def.systemPrompt,
      userPromptTemplate: def.userPromptTemplate,
      templateVariables: JSON.stringify(def.templateVariables),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const rows = await db.select().from(aiSkills).orderBy(aiSkills.skillType);

    // If table is empty, seed defaults and return them
    if (rows.length === 0) {
      const toInsert = Object.entries(DEFAULT_SKILLS).map(([skillType, def]) => ({
        skillType,
        displayName: def.displayName,
        description: def.description,
        provider: "manus_builtin",
        model: "gemini-2.5-flash",
        systemPrompt: def.systemPrompt,
        userPromptTemplate: def.userPromptTemplate,
        templateVariables: JSON.stringify(def.templateVariables),
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
          provider: "manus_builtin",
          model: "gemini-2.5-flash",
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
          templateVariables: JSON.stringify(def.templateVariables),
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
        provider: z.enum(["manus_builtin", "openai", "anthropic", "google_gemini", "azure_openai"]),
        model: z.string().optional(),
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
});
