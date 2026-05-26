/**
 * Agent Guidelines — Karpathy Pattern 3
 *
 * CLAUDE.md-style framework for structured AI task execution:
 *
 * 1. Success Criteria: Instead of "write this section", define measurable
 *    criteria the output must meet. The LLM iterates until criteria are met.
 *
 * 2. Multi-Approach Advisor: Before generating, ask the LLM to outline
 *    3 different approaches with pros/cons. User picks one, then generates.
 *    This prevents the model from defaulting to its first instinct.
 *
 * 3. Structured Iteration: Track which approach was chosen and why,
 *    building institutional knowledge about what works for each client/agency.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentGuidelines } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Approach {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
  rationale: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const agentGuidelinesRouter = router({
  /** Get guidelines for a specific skill + optional proposal/section scope */
  get: protectedProcedure
    .input(z.object({
      skillType: z.string(),
      proposalId: z.number().optional(),
      sectionName: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const conditions = [eq(agentGuidelines.skillType, input.skillType)];
      if (input.proposalId) conditions.push(eq(agentGuidelines.proposalId, input.proposalId));
      if (input.sectionName) conditions.push(eq(agentGuidelines.sectionName, input.sectionName));
      const rows = await db
        .select()
        .from(agentGuidelines)
        .where(and(...conditions))
        .orderBy(desc(agentGuidelines.updatedAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Save or update guidelines for a skill/proposal/section */
  upsert: protectedProcedure
    .input(z.object({
      skillType: z.string(),
      proposalId: z.number().optional(),
      pursuitId: z.number().optional(),
      sectionName: z.string().optional(),
      successCriteria: z.array(z.string()),
      chosenApproachIndex: z.number().optional(),
      choiceRationale: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const conditions = [eq(agentGuidelines.skillType, input.skillType)];
      if (input.proposalId) conditions.push(eq(agentGuidelines.proposalId, input.proposalId));
      if (input.sectionName) conditions.push(eq(agentGuidelines.sectionName, input.sectionName));

      const existing = await db
        .select()
        .from(agentGuidelines)
        .where(and(...conditions))
        .limit(1);

      const data = {
        successCriteria: JSON.stringify(input.successCriteria),
        chosenApproachIndex: input.chosenApproachIndex ?? null,
        choiceRationale: input.choiceRationale ?? null,
      };

      if (existing.length > 0) {
        await db
          .update(agentGuidelines)
          .set(data)
          .where(eq(agentGuidelines.id, existing[0].id));
        return { id: existing[0].id };
      } else {
        await db.insert(agentGuidelines).values({
          skillType: input.skillType,
          proposalId: input.proposalId,
          pursuitId: input.pursuitId,
          sectionName: input.sectionName,
          ...data,
          createdBy: ctx.user.id,
        });
        const newRows = await db
          .select()
          .from(agentGuidelines)
          .where(and(...conditions))
          .orderBy(desc(agentGuidelines.createdAt))
          .limit(1);
        return { id: newRows[0]?.id ?? 0 };
      }
    }),

  /**
   * Multi-Approach Advisor
   *
   * Given a task description and optional context (wiki, criteria), the LLM
   * generates 3 distinct approaches with pros, cons, and a recommendation.
   * The user reviews and picks one before any content is generated.
   *
   * This is the "ask for approaches first" pattern Karpathy advocates.
   */
  suggestApproaches: protectedProcedure
    .input(z.object({
      taskDescription: z.string().min(10),
      sectionType: z.string().optional(),
      rfpContext: z.string().optional(),       // wiki content or key criteria
      firmContext: z.string().optional(),       // relevant firm experience
      successCriteria: z.array(z.string()).optional(),
      /** Optional: previous approaches that did NOT work well */
      avoidApproaches: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const criteriaText = input.successCriteria?.length
        ? `\n\nSuccess Criteria (the chosen approach MUST satisfy all of these):\n${input.successCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
        : "";

      const avoidText = input.avoidApproaches?.length
        ? `\n\nDo NOT suggest these approaches (they have been tried and failed):\n${input.avoidApproaches.join("\n")}`
        : "";

      const result = await invokeLLMWithSkill({
        skillType: "agent_guidelines",
        variables: {
          taskDescription: input.taskDescription,
          sectionType: input.sectionType ?? "proposal section",
          rfpContext: (input.rfpContext ?? "No RFP context provided").slice(0, 8000),
          firmContext: (input.firmContext ?? "AEC firm with expertise in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services.").slice(0, 3000),
          successCriteria: criteriaText,
          avoidApproaches: avoidText,
        },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "approaches",
            strict: true,
            schema: {
              type: "object",
              properties: {
                approaches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      pros: { type: "array", items: { type: "string" } },
                      cons: { type: "array", items: { type: "string" } },
                      recommended: { type: "boolean" },
                      rationale: { type: "string" },
                    },
                    required: ["title", "description", "pros", "cons", "recommended", "rationale"],
                    additionalProperties: false,
                  },
                },
                overallRecommendation: { type: "string" },
              },
              required: ["approaches", "overallRecommendation"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = (result.choices[0]?.message?.content as string) ?? "{}";
      try {
        const parsed = JSON.parse(content) as { approaches: Approach[]; overallRecommendation: string };
        return {
          ...parsed,
          _provider: result._provider,
          _model: result._model,
        };
      } catch {
        return {
          approaches: [] as Approach[],
          overallRecommendation: "Could not parse approaches — try again.",
          _provider: result._provider,
          _model: result._model,
        };
      }
    }),

  /**
   * Save the chosen approach to the guidelines record.
   * Call this after the user picks an approach from suggestApproaches.
   */
  saveApproachChoice: protectedProcedure
    .input(z.object({
      guidelineId: z.number(),
      chosenApproachIndex: z.number(),
      choiceRationale: z.string().optional(),
      approaches: z.string(), // JSON stringified approaches array
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(agentGuidelines)
        .set({
          chosenApproachIndex: input.chosenApproachIndex,
          choiceRationale: input.choiceRationale ?? null,
          approaches: input.approaches,
        })
        .where(eq(agentGuidelines.id, input.guidelineId));
      return { success: true };
    }),

  /**
   * Score a generated output against its success criteria.
   * Returns a score per criterion and an overall pass/fail.
   */
  scoreOutput: protectedProcedure
    .input(z.object({
      output: z.string(),
      successCriteria: z.array(z.string()),
      rfpContext: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "proposal_scorer",
        variables: {
          proposalContent: input.output.slice(0, 8000),
          rfpRequirements: input.rfpContext?.slice(0, 4000) ?? "No RFP context provided",
          evaluationCriteria: input.successCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n"),
        },
        extraUserContent: [{ type: "text" as const, text: `
In addition to the per-criterion scores, you MUST return an "annotations" array.
Each annotation identifies a SPECIFIC verbatim passage in the proposal text that fails to meet a criterion or needs improvement.
Rules for annotations:
- "exactText" must be a verbatim substring of the proposal text (copy it exactly, including punctuation)
- "exactText" should be 10-120 characters — a phrase or sentence, not a single word or an entire paragraph
- "severity" must be exactly one of: "critical", "warning", or "suggestion"
  - critical = missing required element or directly contradicts an evaluation criterion
  - warning = present but weak, vague, or lacking specificity
  - suggestion = could be strengthened or made more compelling
- "criterion" is the short name of the criterion this annotation relates to
- "suggestion" is a specific, actionable fix for this exact passage (1-2 sentences)
- Include 3-12 annotations covering the most important issues across the text
- Only annotate passages that genuinely need improvement — do not annotate strong passages` }],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "scored_proposal",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overallScore: { type: "number" },
                overallPassed: { type: "boolean" },
                criteriaScores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      criterion: { type: "string" },
                      score: { type: "number" },
                      passed: { type: "boolean" },
                      feedback: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: ["criterion", "score", "passed", "feedback", "suggestion"],
                    additionalProperties: false,
                  },
                },
                annotations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      exactText: { type: "string" },
                      criterion: { type: "string" },
                      severity: { type: "string" },
                      suggestion: { type: "string" },
                    },
                    required: ["exactText", "criterion", "severity", "suggestion"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string" },
                topImprovements: { type: "array", items: { type: "string" } },
              },
              required: ["overallScore", "overallPassed", "criteriaScores", "annotations", "summary", "topImprovements"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = (result.choices[0]?.message?.content as string) ?? "{}";
      try {
        return {
          ...JSON.parse(content),
          _provider: result._provider,
          _model: result._model,
        };
      } catch {
        return {
          overallScore: 0,
          overallPassed: false,
          criteriaScores: [],
          annotations: [] as Array<{ exactText: string; criterion: string; severity: string; suggestion: string }>,
          summary: "Could not parse scores.",
          topImprovements: [],
          _provider: result._provider,
          _model: result._model,
        };
      }
    }),
});
