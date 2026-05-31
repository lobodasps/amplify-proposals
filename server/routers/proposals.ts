import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { proposals, proposalSections, tailoredResumes } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

export const proposalsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(100);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(proposals).where(eq(proposals.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  getSections: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(proposalSections).where(eq(proposalSections.proposalId, input.proposalId)).orderBy(proposalSections.sectionOrder);
    }),

  create: protectedProcedure
    .input(z.object({
      pursuitId: z.string().uuid().optional(),
      title: z.string().min(1),
      clientName: z.string().optional(),
      rfpNumber: z.string().optional(),
      serviceLines: z.array(z.string()).optional(),
      dueDate: z.date().optional(),
      estimatedValue: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db.insert(proposals).values({
        title: input.title,
        pursuitId: input.pursuitId,
        clientName: input.clientName,
        rfpNumber: input.rfpNumber,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        dueDate: input.dueDate,
        status: "draft",
        coordinatorId: ctx.user.id,
      }).returning({ id: proposals.id });
      const proposalId = rows[0]?.id ?? null;
      return { success: true, proposalId };
    }),

  /** Find the proposal linked to a pursuit (returns null if none exists yet) */
  getByPursuitId: protectedProcedure
    .input(z.object({ pursuitId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(proposals)
        .where(eq(proposals.pursuitId, input.pursuitId))
        .orderBy(desc(proposals.createdAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Generate a proposal section — uses the proposal_writer skill */
  generateSection: protectedProcedure
    .input(z.object({
      sectionTitle: z.string(),
      rfpContext: z.string(),
      firmContext: z.string().optional(),
      serviceLines: z.array(z.string()).optional(),
      agency: z.string().optional(),
      wordLimit: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "proposal_writer",
        variables: {
          sectionType: input.sectionTitle,
          agency: input.agency ?? "the client agency",
          rfpRequirements: input.rfpContext,
          firmExperience: input.firmContext ?? "Our firm has extensive experience in AEC services across NJ/NY/NYC public-agency markets.",
          wordLimit: input.wordLimit ?? "400-600 words",
        },
      });
      const content = result.choices[0]?.message?.content ?? "";
      return { content, _provider: result._provider, _model: result._model };
    }),

  /** Shred an RFP — uses the rfp_shredder skill */
  shredRfp: protectedProcedure
    .input(z.object({
      rfpText: z.string(),
      proposalTitle: z.string().optional(),
      firmProfile: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "rfp_shredder",
        variables: {
          rfpText: input.rfpText.slice(0, 12000),
          firmProfile: input.firmProfile ?? "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY/NYC.",
        },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "rfp_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                keyRequirements: { type: "array", items: { type: "string" } },
                evaluationCriteria: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { criterion: { type: "string" }, weight: { type: "string" } },
                    required: ["criterion", "weight"],
                    additionalProperties: false,
                  },
                },
                requiredSections: { type: "array", items: { type: "string" } },
                keyDates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { event: { type: "string" }, date: { type: "string" } },
                    required: ["event", "date"],
                    additionalProperties: false,
                  },
                },
                qualifications: { type: "array", items: { type: "string" } },
                dbeRequirements: { type: "string" },
                complianceScore: { type: "number" },
              },
              required: ["summary", "keyRequirements", "evaluationCriteria", "requiredSections", "keyDates", "qualifications", "dbeRequirements", "complianceScore"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content ?? "{}";
      try {
        return { ...JSON.parse(content), _provider: result._provider, _model: result._model };
      } catch {
        return { summary: content, keyRequirements: [], evaluationCriteria: [], requiredSections: [], keyDates: [], qualifications: [], dbeRequirements: "", complianceScore: 0, _provider: result._provider, _model: result._model };
      }
    }),

  /** Tailor a resume — uses the resume_tailor skill */
  tailorResume: protectedProcedure
    .input(z.object({
      personnelId: z.string().uuid(),
      personnelName: z.string(),
      currentResume: z.string(),
      rfpRequirements: z.string(),
      targetRole: z.string(),
      proposalId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "resume_tailor",
        variables: {
          personnelName: input.personnelName,
          targetRole: input.targetRole,
          rfpRequirements: input.rfpRequirements,
          resumeText: input.currentResume,
        },
      });
      const tailoredContent = result.choices[0]?.message?.content ?? "";

      const db = await getDb();
      if (db) {
        await db.insert(tailoredResumes).values({
          proposalId: input.proposalId,
          personnelId: input.personnelId,
          rfpRole: input.targetRole,
          tailoredContent,
          aiGenerated: true,
        });
      }
      return { tailoredContent, _provider: result._provider, _model: result._model };
    }),

  /** Score a pursuit for Go/No-Go — uses the go_no_go_advisor skill */
  scoreGoNoGo: protectedProcedure
    .input(z.object({
      pursuitTitle: z.string(),
      clientAgency: z.string(),
      serviceLines: z.array(z.string()),
      estimatedValue: z.number().optional(),
      dueDate: z.string().optional(),
      rfpSummary: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "go_no_go_advisor",
        variables: {
          pursuitTitle: input.pursuitTitle,
          agency: input.clientAgency,
          serviceLines: input.serviceLines.join(", "),
          value: input.estimatedValue ? `$${input.estimatedValue.toLocaleString()}` : "Unknown",
          dueDate: input.dueDate ?? "TBD",
          rfpSummary: input.rfpSummary ?? "",
        },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "go_no_go",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "number" },
                recommendation: { type: "string", enum: ["GO", "NO-GO", "CONDITIONAL GO"] },
                rationale: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
                winThemes: { type: "array", items: { type: "string" } },
              },
              required: ["score", "recommendation", "rationale", "strengths", "risks", "winThemes"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content ?? "{}";
      try {
        return { ...JSON.parse(content), _provider: result._provider, _model: result._model };
      } catch {
        return { score: 50, recommendation: "CONDITIONAL GO", rationale: content, strengths: [], risks: [], winThemes: [], _provider: result._provider, _model: result._model };
      }
    }),

  /**
   * Score a proposal or individual section against RFP evaluation criteria.
   * Uses the proposal_scorer skill.
   */
  scoreProposal: protectedProcedure
    .input(z.object({
      /** "full proposal" | "Technical Approach" | "Project Experience" | etc. */
      scoreTarget: z.string(),
      agency: z.string(),
      rfpTitle: z.string(),
      /** Evaluation criteria extracted from the RFP (from shredRfp) */
      evaluationCriteria: z.string(),
      /** The proposal content or section text to score */
      contentToScore: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "proposal_scorer",
        variables: {
          scoreTarget: input.scoreTarget,
          agency: input.agency,
          rfpTitle: input.rfpTitle,
          evaluationCriteria: input.evaluationCriteria,
          contentToScore: input.contentToScore.slice(0, 12000),
        },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "proposal_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overallScore: { type: "number" },
                overallSummary: { type: "string" },
                criteriaScores: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      criterion: { type: "string" },
                      score: { type: "number" },
                      addressed: { type: "string" },
                      gaps: { type: "array", items: { type: "string" } },
                      improvements: { type: "array", items: { type: "string" } },
                    },
                    required: ["criterion", "score", "addressed", "gaps", "improvements"],
                    additionalProperties: false,
                  },
                },
                topGaps: { type: "array", items: { type: "string" } },
                readyToSubmit: { type: "boolean" },
              },
              required: ["overallScore", "overallSummary", "criteriaScores", "topGaps", "readyToSubmit"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content ?? "{}";
      try {
        return { ...JSON.parse(content), _provider: result._provider, _model: result._model };
      } catch {
        return {
          overallScore: 0,
          overallSummary: content,
          criteriaScores: [],
          topGaps: [],
          readyToSubmit: false,
          _provider: result._provider,
          _model: result._model,
        };
      }
    }),
});
