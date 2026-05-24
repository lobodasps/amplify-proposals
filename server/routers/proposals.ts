import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { proposals, proposalSections, tailoredResumes } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const proposalsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(100);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(proposals).where(eq(proposals.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  getSections: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(proposalSections).where(eq(proposalSections.proposalId, input.proposalId)).orderBy(proposalSections.sectionOrder);
    }),

  create: protectedProcedure
    .input(z.object({
      pursuitId: z.number().optional(),
      title: z.string().min(1),
      clientName: z.string().optional(),
      rfpNumber: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(proposals).values({
        title: input.title,
        pursuitId: input.pursuitId,
        clientName: input.clientName,
        rfpNumber: input.rfpNumber,
        status: "draft",
        coordinatorId: ctx.user.id,
      });
      return { success: true };
    }),

  generateSection: protectedProcedure
    .input(z.object({
      sectionTitle: z.string(),
      rfpContext: z.string(),
      firmContext: z.string().optional(),
      serviceLines: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert AEC proposal writer specializing in public-agency proposals for NJ, NY, and NYC government clients. 
You write compelling, compliant, and technically accurate proposal sections for firms providing: Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services.
Always write in a professional, first-person plural voice ("Our team...", "We have..."). 
Reference specific agency names, standards (NJDOT, AASHTO, NYCDOT, NJDEP), and technical terminology appropriate to the service line.
Keep content factual, specific, and directly responsive to the RFP requirements.`;

      const userPrompt = `Write a compelling proposal section titled "${input.sectionTitle}" for the following RFP context:

RFP CONTEXT:
${input.rfpContext}

${input.firmContext ? `FIRM CONTEXT:\n${input.firmContext}\n` : ""}
${input.serviceLines?.length ? `SERVICE LINES: ${input.serviceLines.join(", ")}\n` : ""}

Write 3-4 paragraphs that are specific, compelling, and directly address the RFP requirements. Include relevant technical details, agency experience, and differentiators.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = (response.choices?.[0]?.message?.content as string) ?? "";
      return { content };
    }),

  shredRfp: protectedProcedure
    .input(z.object({
      rfpText: z.string(),
      proposalTitle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert AEC proposal analyst. Extract and structure all key requirements from RFP/RFQ documents for AEC firms in NJ/NY/NYC public-agency markets.`,
          },
          {
            role: "user",
            content: `Analyze this RFP and extract all key information. Return structured JSON.

RFP TEXT:
${input.rfpText.slice(0, 8000)}`,
          },
        ],
        response_format: {
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

      const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try {
        return JSON.parse(content);
      } catch {
        return { summary: content, keyRequirements: [], evaluationCriteria: [], requiredSections: [], keyDates: [], qualifications: [], dbeRequirements: "", complianceScore: 0 };
      }
    }),

  tailorResume: protectedProcedure
    .input(z.object({
      personnelId: z.number(),
      personnelName: z.string(),
      currentResume: z.string(),
      rfpRequirements: z.string(),
      targetRole: z.string(),
      proposalId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert AEC proposal resume writer. You reformat and tailor professional resumes to match specific RFP requirements for public-agency AEC proposals in NJ, NY, and NYC. 
You maintain factual accuracy while highlighting the most relevant experience, certifications, and project history for the specific pursuit.
Format resumes in a clean, professional proposal style with: Name/Title, Education, Registrations/Certifications, Years of Experience, Relevant Project Experience (5-7 projects), and a brief professional summary.`,
          },
          {
            role: "user",
            content: `Tailor this resume for the following RFP:

PERSONNEL: ${input.personnelName}
TARGET ROLE IN PROPOSAL: ${input.targetRole}

RFP REQUIREMENTS:
${input.rfpRequirements}

CURRENT RESUME:
${input.currentResume}

Rewrite the resume to:
1. Lead with the most relevant experience for this specific pursuit
2. Highlight certifications and licenses required by the RFP
3. Select and reorder project experience to best match the scope
4. Use language that mirrors the RFP's evaluation criteria
5. Format for a professional AEC proposal submission`,
          },
        ],
      });

      const tailoredContent = (response.choices?.[0]?.message?.content as string) ?? "";

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

      return { tailoredContent };
    }),

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
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a strategic AEC business development advisor. Score go/no-go decisions for public-agency proposals in NJ/NY/NYC markets. Consider: firm capabilities, market position, competition, strategic value, resource availability, and win probability.`,
          },
          {
            role: "user",
            content: `Score this pursuit for go/no-go decision:

PURSUIT: ${input.pursuitTitle}
CLIENT: ${input.clientAgency}
SERVICES: ${input.serviceLines.join(", ")}
VALUE: ${input.estimatedValue ? `$${input.estimatedValue.toLocaleString()}` : "Unknown"}
DUE: ${input.dueDate ?? "TBD"}
${input.rfpSummary ? `SUMMARY: ${input.rfpSummary}` : ""}

Score 0-100 and provide recommendation.`,
          },
        ],
        response_format: {
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

      const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try {
        return JSON.parse(content);
      } catch {
        return { score: 50, recommendation: "CONDITIONAL GO", rationale: content, strengths: [], risks: [], winThemes: [] };
      }
    }),
});
