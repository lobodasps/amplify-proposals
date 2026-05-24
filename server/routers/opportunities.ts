import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { opportunities } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const opportunitiesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(opportunities).orderBy(desc(opportunities.publishedDate)).limit(200);
  }),

  scoreOpportunity: protectedProcedure
    .input(z.object({
      title: z.string(),
      agency: z.string(),
      description: z.string(),
      estimatedValue: z.number().optional(),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a strategic AEC business development advisor for a firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ, NY, and NYC public-agency markets.`,
          },
          {
            role: "user",
            content: `Score this opportunity for our firm:

TITLE: ${input.title}
AGENCY: ${input.agency}
DESCRIPTION: ${input.description.slice(0, 2000)}
VALUE: ${input.estimatedValue ? `$${input.estimatedValue.toLocaleString()}` : "Unknown"}
DUE: ${input.dueDate ?? "TBD"}

Score 0-100 based on: alignment with our services, agency relationship potential, competition level, strategic value, and win probability. Return JSON.`,
          },
        ],
        response_format: {
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
      const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try { return JSON.parse(content); } catch { return { score: 50, recommendation: "Monitor", serviceLineMatch: "Unknown", rationale: "" }; }
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
        estimatedValue: input.estimatedValue,
        dueDate: input.dueDate,
        source: (input.source as any) ?? "manual",
        sourceUrl: input.sourceUrl,
        aiScore: input.aiScore,
        aiScoreReason: input.aiScoreReason,
        status: "new",
      });
      return { success: true };
    }),
});
