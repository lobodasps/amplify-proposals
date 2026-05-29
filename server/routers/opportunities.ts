import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { opportunities, opportunityCompetitors, opportunityDebriefs } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

export const opportunitiesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(opportunities).orderBy(desc(opportunities.publishedDate)).limit(200);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(opportunities).set({ status: input.status as any }).where(eq(opportunities.id, input.id));
      return { success: true };
    }),

  /** Score an opportunity for fit — uses the opportunity_scorer skill */
  scoreOpportunity: protectedProcedure
    .input(z.object({
      title: z.string(),
      agency: z.string(),
      description: z.string(),
      estimatedValue: z.number().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "opportunity_scorer",
        variables: {
          title: input.title,
          agency: input.agency,
          description: input.description.slice(0, 2000),
          value: input.estimatedValue ? `$${input.estimatedValue.toLocaleString()}` : "Unknown",
          serviceLines: "Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, Environmental",
          source: "manual",
        },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "opportunity_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "number" },
                recommendation: { type: "string", enum: ["Pursue", "Monitor", "Pass"] },
                serviceLineMatch: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["score", "recommendation", "serviceLineMatch", "rationale"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = (result.choices[0]?.message?.content as string) ?? "{}";
      try {
        return { ...JSON.parse(content), _provider: result._provider, _model: result._model };
      } catch {
        return { score: 50, recommendation: "Monitor", serviceLineMatch: "Unknown", rationale: "", _provider: result._provider, _model: result._model };
      }
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      agencyName: z.string().optional(),
      clientName: z.string().optional(),
      description: z.string().optional(),
      estimatedValue: z.number().optional(),
      dueDate: z.date().optional(),
      source: z.string().optional(),
      sourceUrl: z.string().optional(),
      aiScore: z.number().optional(),
      aiScoreReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(opportunities).values({
        title: input.title,
        clientName: input.clientName ?? input.agencyName,
        description: input.description,
        estimatedValue: input.estimatedValue?.toString(),
        dueDate: input.dueDate,
        source: (input.source as any) ?? "manual",
        sourceUrl: input.sourceUrl,
        aiScore: input.aiScore?.toString(),
        aiScoreReason: input.aiScoreReason,
        status: "new",
      });
      return { success: true };
    }),

  // ─── Competitors ────────────────────────────────────────────────────────────
  listCompetitors: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(opportunityCompetitors)
        .where(eq(opportunityCompetitors.opportunityId, input.opportunityId))
        .orderBy(desc(opportunityCompetitors.createdAt));
    }),

  addCompetitor: protectedProcedure
    .input(z.object({
      opportunityId: z.string().uuid(),
      firmName: z.string().min(1),
      role: z.string().optional(),
      isWinner: z.boolean().optional(),
      winningFee: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(opportunityCompetitors).values({
        opportunityId: input.opportunityId,
        firmName: input.firmName,
        role: input.role,
        isWinner: input.isWinner ?? false,
        winningFee: input.winningFee?.toString(),
        notes: input.notes,
      });
      return { success: true };
    }),

  removeCompetitor: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(opportunityCompetitors).where(eq(opportunityCompetitors.id, input.id));
      return { success: true };
    }),

  // ─── Debrief ────────────────────────────────────────────────────────────────
  getDebrief: protectedProcedure
    .input(z.object({ opportunityId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(opportunityDebriefs)
        .where(eq(opportunityDebriefs.opportunityId, input.opportunityId)).limit(1);
      return rows[0] ?? null;
    }),

  upsertDebrief: protectedProcedure
    .input(z.object({
      opportunityId: z.string().uuid(),
      outcome: z.string().optional(),
      winningFirm: z.string().optional(),
      winningFee: z.number().optional(),
      ourFee: z.number().optional(),
      lowestBidder: z.string().optional(),
      debriefNotes: z.string().optional(),
      lessonsLearned: z.string().optional(),
      debriefDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { opportunityId, ...data } = input;
      const existing = await db.select().from(opportunityDebriefs)
        .where(eq(opportunityDebriefs.opportunityId, opportunityId)).limit(1);
      if (existing.length) {
        await db.update(opportunityDebriefs).set(data as any)
          .where(eq(opportunityDebriefs.opportunityId, opportunityId));
      } else {
        await db.insert(opportunityDebriefs).values({ opportunityId, ...data as any });
      }
      return { success: true };
    }),
});
