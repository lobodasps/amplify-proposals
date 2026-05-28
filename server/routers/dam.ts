/**
 * server/routers/dam.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DAM (Knowledge Hub) tRPC router.
 *
 * Procedures:
 *   list          — paginated/filtered list of dam_documents
 *   getById       — single document with fresh signed URL
 *   create        — insert metadata record after file upload via /api/upload
 *   updateMeta    — update title, description, tags, links, etc.
 *   delete        — soft-delete (sets processingStatus = 'error') or hard delete
 *   getStats      — counts by docType and company for the library header
 *   triggerExtract — kick off LLM text extraction for a document
 */

import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { damDocuments } from "../../drizzle/schema";
import { storageGet } from "../storage";
import { invokeLLM, type Message } from "../_core/llm";
import { TRPCError } from "@trpc/server";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const DOC_TYPES = [
  "past_proposal",
  "project_sheet",
  "resume",
  "certification",
  "rfp",
  "contract",
  "boilerplate",
  "other",
] as const;

const COMPANY_TAGS = ["JPCL", "Strans", "Both"] as const;

const docTypeEnum = z.enum(DOC_TYPES);
const companyTagEnum = z.enum(COMPANY_TAGS);

const createInput = z.object({
  // File info (returned by /api/upload)
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().optional(),

  // Document metadata
  docType: docTypeEnum.default("other"),
  title: z.string().min(1).max(512),
  description: z.string().optional(),
  companyTag: companyTagEnum.optional(),

  // Staff link (for resumes & certifications)
  staffName: z.string().optional(),
  staffId: z.number().optional(),

  // Project / pursuit link
  projectName: z.string().optional(),
  projectNumber: z.string().optional(),
  pursuitId: z.number().optional(),
  proposalId: z.number().optional(),

  // Client / contract
  clientName: z.string().optional(),
  contractValue: z.string().optional(),
  awardYear: z.number().optional(),

  // Tags
  tags: z.string().optional(), // comma-separated
});

const updateMetaInput = z.object({
  id: z.number(),
  title: z.string().min(1).max(512).optional(),
  description: z.string().optional(),
  docType: docTypeEnum.optional(),
  companyTag: companyTagEnum.optional(),
  staffName: z.string().optional(),
  staffId: z.number().optional(),
  projectName: z.string().optional(),
  projectNumber: z.string().optional(),
  pursuitId: z.number().optional(),
  proposalId: z.number().optional(),
  clientName: z.string().optional(),
  contractValue: z.string().optional(),
  awardYear: z.number().optional(),
  tags: z.string().optional(),
});

const listInput = z.object({
  docType: docTypeEnum.optional(),
  companyTag: companyTagEnum.optional(),
  search: z.string().optional(),
  processingStatus: z.enum(["uploaded", "processing", "indexed", "error"]).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// ─── Helper: refresh signed URL ───────────────────────────────────────────────

async function withFreshUrl<T extends { fileKey: string; fileUrl: string }>(
  doc: T,
): Promise<T> {
  try {
    const { url } = await storageGet(doc.fileKey);
    return { ...doc, fileUrl: url };
  } catch {
    return doc; // return stale URL rather than throwing
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const damRouter = router({
  // ── List ──────────────────────────────────────────────────────────────────
  list: protectedProcedure.input(listInput).query(async ({ input }) => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const conditions = [];

    if (input.docType) {
      conditions.push(eq(damDocuments.docType, input.docType));
    }
    if (input.companyTag) {
      conditions.push(eq(damDocuments.companyTag, input.companyTag));
    }
    if (input.processingStatus) {
      conditions.push(eq(damDocuments.processingStatus, input.processingStatus));
    }
    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        sql`(${damDocuments.title} LIKE ${term} OR ${damDocuments.clientName} LIKE ${term} OR ${damDocuments.projectName} LIKE ${term} OR ${damDocuments.staffName} LIKE ${term} OR ${damDocuments.tags} LIKE ${term})`
      );
    }

    const rows = await db
      .select()
      .from(damDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(damDocuments.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    // Count total (for pagination)
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(damDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count ?? 0);

    return { docs: rows, total, limit: input.limit, offset: input.offset };
  }),

  // ── Get by ID (with fresh signed URL) ─────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [doc] = await db
        .select()
        .from(damDocuments)
        .where(eq(damDocuments.id, input.id))
        .limit(1);

      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      return withFreshUrl(doc);
    }),

  // ── Create (after /api/upload completes) ──────────────────────────────────
  create: protectedProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const [inserted] = await db
      .insert(damDocuments)
      .values({
        ...input,
        uploadedBy: ctx.user.id,
        processingStatus: "uploaded",
      })
      .$returningId();

    const [doc] = await db
      .select()
      .from(damDocuments)
      .where(eq(damDocuments.id, inserted.id))
      .limit(1);

    return doc;
  }),

  // ── Update metadata ────────────────────────────────────────────────────────
  updateMeta: protectedProcedure.input(updateMetaInput).mutation(async ({ input }) => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const { id, ...updates } = input;

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
    }

    await db
      .update(damDocuments)
      .set(cleanUpdates)
      .where(eq(damDocuments.id, id));

    const [doc] = await db
      .select()
      .from(damDocuments)
      .where(eq(damDocuments.id, id))
      .limit(1);

    return doc;
  }),

  // ── Delete ────────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [doc] = await db
        .select()
        .from(damDocuments)
        .where(eq(damDocuments.id, input.id))
        .limit(1);

      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      await db.delete(damDocuments).where(eq(damDocuments.id, input.id));

      return { success: true, id: input.id };
    }),

  // ── Stats (counts by type and company) ────────────────────────────────────
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const byType = await db
      .select({
        docType: damDocuments.docType,
        count: sql<number>`count(*)`,
      })
      .from(damDocuments)
      .groupBy(damDocuments.docType);

    const byCompany = await db
      .select({
        companyTag: damDocuments.companyTag,
        count: sql<number>`count(*)`,
      })
      .from(damDocuments)
      .groupBy(damDocuments.companyTag);

    const byStatus = await db
      .select({
        processingStatus: damDocuments.processingStatus,
        count: sql<number>`count(*)`,
      })
      .from(damDocuments)
      .groupBy(damDocuments.processingStatus);

    const total = byType.reduce((sum: number, r: { count: number }) => sum + Number(r.count), 0);

    return {
      total,
      byType: Object.fromEntries(byType.map((r: { docType: string | null; count: number }) => [r.docType ?? "other", Number(r.count)])),
      byCompany: Object.fromEntries(
        byCompany.map((r: { companyTag: string | null; count: number }) => [r.companyTag ?? "untagged", Number(r.count)])
      ),
      byStatus: Object.fromEntries(
        byStatus.map((r: { processingStatus: string | null; count: number }) => [r.processingStatus ?? "unknown", Number(r.count)])
      ),
    };
  }),

  // ── Trigger LLM text extraction ────────────────────────────────────────────
  // Reads the document URL, sends to LLM with file_url content type,
  // saves extractedText + extractedMeta, sets processingStatus = 'indexed'.
  triggerExtract: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [doc] = await db
        .select()
        .from(damDocuments)
        .where(eq(damDocuments.id, input.id))
        .limit(1);

      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Mark as processing
      await db
        .update(damDocuments)
        .set({ processingStatus: "processing" })
        .where(eq(damDocuments.id, input.id));

      try {
        // Get a fresh signed URL for the LLM
        const { url: freshUrl } = await storageGet(doc.fileKey);

        // Determine MIME type for LLM file_url content
        const mime = doc.mimeType ?? "application/pdf";
        const supportedMimes = [
          "application/pdf",
          "audio/mpeg",
          "audio/wav",
          "audio/mp4",
          "video/mp4",
        ];
        const llmMime = supportedMimes.includes(mime) ? mime : "application/pdf";

        // Build system prompt based on doc type
        const systemPrompts: Record<string, string> = {
          past_proposal: `You are an expert AEC (Architecture, Engineering, Construction) proposal analyst. 
Extract structured information from this past proposal document. Return JSON with:
- title: string (project/proposal title)
- client: string (client/agency name)
- rfpNumber: string (RFP or contract number if present)
- submitDate: string (submission date if present)
- awardDate: string (award date if present)
- contractValue: string (dollar value if present)
- serviceLines: string[] (disciplines: special_inspections, construction_management, traffic_engineering, etc.)
- keyPersonnel: string[] (names of key staff mentioned)
- projectDescription: string (2-3 sentence summary)
- winThemes: string[] (key differentiators or win themes mentioned)
- summary: string (plain-text summary of the full document, 3-5 paragraphs)`,

          project_sheet: `You are an expert AEC project data analyst.
Extract structured information from this project sheet/experience form. Return JSON with:
- projectName: string
- projectNumber: string (if present)
- client: string
- location: string
- contractValue: string
- startDate: string
- endDate: string
- serviceLines: string[] (disciplines)
- keyPersonnel: string[] (names of staff on project)
- description: string (project description, 2-3 paragraphs)
- highlights: string[] (key accomplishments or notable aspects)
- summary: string (plain-text summary)`,

          resume: `You are an expert AEC HR analyst.
Extract structured information from this staff resume/CV. Return JSON with:
- name: string (full name)
- title: string (job title)
- yearsExperience: number
- education: string[] (degrees and institutions)
- certifications: string[] (all certifications, licenses, and credentials with numbers if present)
- serviceLines: string[] (disciplines they work in)
- skills: string[] (technical skills and software)
- projectExperience: string[] (notable projects they've worked on)
- summary: string (professional summary, 2-3 paragraphs)`,

          certification: `You are an AEC certification document analyst.
Extract structured information from this certification document. Return JSON with:
- holderName: string (name of the certified individual)
- certificationName: string (full name of the certification)
- certificationNumber: string (credential/license number if present)
- issuingAuthority: string (issuing organization)
- issueDate: string
- expirationDate: string (if present)
- level: string (level or grade if applicable, e.g. "Level III")
- summary: string (brief description of what this certification covers)`,

          other: `You are a document analyst. Extract the key information from this document.
Return JSON with:
- title: string
- documentType: string (what kind of document this appears to be)
- date: string (any date found)
- keyEntities: string[] (people, organizations, projects mentioned)
- summary: string (plain-text summary of the document)`,
        };

        const systemPrompt =
          systemPrompts[doc.docType] ?? systemPrompts.other;

        const userContent: any[] = [
          {
            type: "file_url",
            file_url: {
              url: freshUrl,
              mime_type: llmMime,
            },
          },
          {
            type: "text",
            text: `Please analyze this ${doc.docType.replace("_", " ")} document titled "${doc.title}" and extract the structured information as described. Return valid JSON only.`,
          },
        ];

        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ];

        const response = await invokeLLM({
          messages,
          response_format: { type: "json_object" } as any,
        });

        const rawContentRaw = response?.choices?.[0]?.message?.content ?? "{}";
        const rawContent = typeof rawContentRaw === "string" ? rawContentRaw : JSON.stringify(rawContentRaw);
        let extractedMeta: Record<string, unknown> = {};
        try {
          extractedMeta = JSON.parse(rawContent);
        } catch {
          extractedMeta = { raw: rawContent };
        }

        // Build plain-text summary from meta
        const extractedText =
          (extractedMeta.summary as string) ??
          (extractedMeta.description as string) ??
          rawContent;

        await db
          .update(damDocuments)
          .set({
            extractedText,
            extractedMeta,
            processingStatus: "indexed",
            processingError: null,
          })
          .where(eq(damDocuments.id, input.id));

        const [updated] = await db
          .select()
          .from(damDocuments)
          .where(eq(damDocuments.id, input.id))
          .limit(1);

        return updated;
      } catch (err: any) {
        await db
          .update(damDocuments)
          .set({
            processingStatus: "error",
            processingError: err?.message ?? "Unknown extraction error",
          })
          .where(eq(damDocuments.id, input.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Extraction failed: ${err?.message}`,
        });
      }
    }),
});
