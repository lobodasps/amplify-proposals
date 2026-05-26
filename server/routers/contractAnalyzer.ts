import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contractAnalyses } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

const CONTRACT_ANALYSIS_SCHEMA = {
  type: "object" as const,
  properties: {
    parties: { type: "array", items: { type: "object", properties: { role: { type: "string" }, name: { type: "string" }, address: { type: "string" } }, required: ["role", "name", "address"], additionalProperties: false } },
    dates: { type: "object", properties: { executionDate: { type: ["string", "null"] }, startDate: { type: ["string", "null"] }, endDate: { type: ["string", "null"] }, noticeToProceedException: { type: ["string", "null"] } }, required: ["executionDate", "startDate", "endDate", "noticeToProceedException"], additionalProperties: false },
    values: { type: "object", properties: { baseContractValue: { type: ["number", "null"] }, nteCeiling: { type: ["number", "null"] }, retainagePercent: { type: ["number", "null"] }, currency: { type: "string" } }, required: ["baseContractValue", "nteCeiling", "retainagePercent", "currency"], additionalProperties: false },
    contractType: { type: "string" },
    billingMethod: { type: "string" },
    keyClauseSummaries: { type: "array", items: { type: "object", properties: { clause: { type: "string" }, summary: { type: "string" } }, required: ["clause", "summary"], additionalProperties: false } },
    riskFlags: { type: "array", items: { type: "object", properties: { severity: { type: "string" }, description: { type: "string" } }, required: ["severity", "description"], additionalProperties: false } },
    complianceFlags: { type: "array", items: { type: "object", properties: { type: { type: "string" }, description: { type: "string" }, required: { type: "boolean" } }, required: ["type", "description", "required"], additionalProperties: false } },
    summary: { type: "string" },
  },
  required: ["parties", "dates", "values", "contractType", "billingMethod", "keyClauseSummaries", "riskFlags", "complianceFlags", "summary"],
  additionalProperties: false,
};

export const contractAnalyzerRouter = router({
  // List all analyses
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contractAnalyses).orderBy(desc(contractAnalyses.createdAt));
  }),

  // Get a specific analysis
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(contractAnalyses).where(eq(contractAnalyses.id, input.id));
      return rows[0] ?? null;
    }),

  // Analyze a contract document via URL (PDF or text) — uses the contract_analyzer skill
  analyze: protectedProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      fileName: z.string(),
      fileKey: z.string().optional(),
      contractId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Create a pending record
      const [created] = await db.insert(contractAnalyses).values({
        contractId: input.contractId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        status: "processing",
        createdBy: ctx.user?.id,
      }).$returningId();

      try {
        // Dispatch to the contract_analyzer skill (provider/model/prompts from Settings → AI Skills)
        const response = await invokeLLMWithSkill({
          skillType: "contract_analyzer",
          variables: { fileName: input.fileName, fileUrl: input.fileUrl },
          // Attach the PDF as a file_url content part so the model can read it
          extraUserContent: [
            { type: "file_url", file_url: { url: input.fileUrl, mime_type: "application/pdf" } },
          ],
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "contract_analysis",
              strict: true,
              schema: CONTRACT_ANALYSIS_SCHEMA,
            },
          },
        });

        const content = response.choices[0]?.message?.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : content;

        await db.update(contractAnalyses).set({
          status: "complete",
          extractedParties: parsed.parties,
          extractedDates: parsed.dates,
          extractedValues: parsed.values,
          extractedClauses: parsed.keyClauseSummaries,
          riskFlags: parsed.riskFlags,
          complianceFlags: parsed.complianceFlags,
          summary: parsed.summary,
          rawAnalysis: JSON.stringify(parsed),
        }).where(eq(contractAnalyses.id, created.id));

      } catch (err) {
        await db.update(contractAnalyses).set({
          status: "error",
          summary: `Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        }).where(eq(contractAnalyses.id, created.id));
      }

      const rows = await db.select().from(contractAnalyses).where(eq(contractAnalyses.id, created.id));
      return rows[0];
    }),

  // Delete an analysis
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(contractAnalyses).where(eq(contractAnalyses.id, input.id));
      return { success: true };
    }),

  // Link analysis to a contract record
  linkToContract: protectedProcedure
    .input(z.object({ analysisId: z.number(), contractId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contractAnalyses).set({ contractId: input.contractId }).where(eq(contractAnalyses.id, input.analysisId));
      return { success: true };
    }),
});
