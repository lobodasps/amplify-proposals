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
import { eq, desc, and, sql, like } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { damDocuments, personnel, projects } from "../../drizzle/schema";
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
  staffId: z.string().uuid().optional(),

  // Project / pursuit link
  projectName: z.string().optional(),
  projectNumber: z.string().optional(),
  pursuitId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),

  // Client / owner / role
  clientName: z.string().optional(),    // Direct contracting party
  ownerName: z.string().optional(),     // Public agency / asset owner (comma-separated if multiple)
  firmRole: z.string().optional(),      // prime | sub | joint-venture
  contractValue: z.string().optional(),
  awardYear: z.number().optional(),

  // Tags
  tags: z.string().optional(), // comma-separated
});

const updateMetaInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(512).optional(),
  description: z.string().optional(),
  docType: docTypeEnum.optional(),
  companyTag: companyTagEnum.optional(),
  staffName: z.string().optional(),
  staffId: z.string().uuid().optional(),
  projectName: z.string().optional(),
  projectNumber: z.string().optional(),
  pursuitId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),
  clientName: z.string().optional(),
  ownerName: z.string().optional(),
  firmRole: z.string().optional(),
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

// ─── Extracted types ─────────────────────────────────────────────────────────

interface ExtractedImage {
  page: number;
  caption: string | null;
  description: string;
  imageType: string;
  tags: string[];
}

interface ExtractedSection {
  title: string;
  page: number | null;
  content: string;
}

// ─── System prompts per docType ──────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {

  resume: `You are an expert AEC HR analyst extracting structured data from a staff resume or CV.

Return a single JSON object. Every field is required. Use null for missing values, empty arrays [] for missing lists.

Schema:
{
  "name": string | null,
  "title": string | null,
  "yearsExperience": number | null,
  "education": string[],
  "certifications": string[],
  "serviceLines": string[],
  "skills": string[],
  "projectExperience": string[],
  "summary": string | null,
  "sections": [
    { "title": string, "page": number | null, "content": string }
  ],
  "images": [
    {
      "page": number,
      "caption": string | null,
      "description": string,
      "imageType": "headshot" | "photo" | "diagram" | "chart" | "org-chart" | "site-plan" | "map" | "other",
      "tags": string[]
    }
  ],
  "tags": string[]
}

Be thorough with images — resumes often contain a headshot and project photos. Describe each one.`,

  project_sheet: `You are an expert AEC project data analyst extracting structured data from a project sheet or project profile.

Return a single JSON object. Every field is required. Use null for missing values, empty arrays [] for missing lists.

Schema:
{
  "projectName": string | null,
  "projectNumber": string | null,
  "owner": string[] (the public agency or asset owner — e.g. ["NYSDOT"], ["NYC Parks", "FHWA"]. Can be multiple.),
  "client": string | null (the direct contracting party: same as owner if we are prime; if we are a subconsultant, this is the prime contractor name e.g. "AECOM", "Naik Consulting Group"),
  "firmRole": "prime" | "sub" | "joint-venture" | null (our firm's role on this project),
  "location": string | null,
  "contractValue": string | null,
  "startDate": string | null,
  "endDate": string | null,
  "serviceLines": string[],
  "keyPersonnel": string[],
  "description": string | null,
  "highlights": string[],
  "summary": string | null,
  "sections": [
    { "title": string, "page": number | null, "content": string }
  ],
  "images": [
    {
      "page": number,
      "caption": string | null,
      "description": string,
      "imageType": "photo" | "site-plan" | "diagram" | "map" | "chart" | "rendering" | "before-after" | "other",
      "tags": string[]
    }
  ],
  "tags": string[]
}

Project sheets are image-heavy. Extract every photo, site plan, rendering, and diagram. These are critical for proposal assembly.`,

  past_proposal: `You are an expert AEC proposal analyst extracting structured data from a past proposal document.

Return a single JSON object. Every field is required. Use null for missing values, empty arrays [] for missing lists.

Schema:
{
  "title": string | null,
  "owner": string[] (the public agency or asset owner issuing the RFP — e.g. ["NJDOT"], ["Port Authority of NY/NJ"]. Can be multiple.),
  "client": string | null (the direct contracting party: same as owner if we are prime; if we are a subconsultant, this is the prime contractor name),
  "firmRole": "prime" | "sub" | "joint-venture" | null (our firm's role on this proposal),
  "rfpNumber": string | null,
  "submitDate": string | null,
  "awardDate": string | null,
  "contractValue": string | null,
  "serviceLines": string[],
  "keyPersonnel": string[],
  "projectDescription": string | null,
  "winThemes": string[],
  "summary": string | null,
  "sections": [
    { "title": string, "page": number | null, "content": string }
  ],
  "images": [
    {
      "page": number,
      "caption": string | null,
      "description": string,
      "imageType": "photo" | "site-plan" | "diagram" | "org-chart" | "map" | "chart" | "rendering" | "graphic" | "other",
      "tags": string[]
    }
  ],
  "tags": string[]
}

Extract all images — proposals contain org charts, project photos, graphics, diagrams, and site plans that are reused in future proposals.`,

  certification: `You are an AEC certification document analyst.

Return a single JSON object. Every field is required. Use null for missing values.

Schema:
{
  "holderName": string | null,
  "certificationName": string | null,
  "certificationNumber": string | null,
  "issuingAuthority": string | null,
  "issueDate": string | null,
  "expirationDate": string | null,
  "level": string | null,
  "summary": string | null,
  "images": [
    {
      "page": number,
      "caption": string | null,
      "description": string,
      "imageType": "photo" | "logo" | "seal" | "signature" | "other",
      "tags": string[]
    }
  ],
  "tags": string[]
}`,

  other: `You are a document analyst.

Return a single JSON object. Every field is required. Use null for missing values, empty arrays [] for missing lists.

Schema:
{
  "title": string | null,
  "documentType": string | null,
  "date": string | null,
  "keyEntities": string[],
  "summary": string | null,
  "sections": [
    { "title": string, "page": number | null, "content": string }
  ],
  "images": [
    {
      "page": number,
      "caption": string | null,
      "description": string,
      "imageType": "photo" | "diagram" | "chart" | "map" | "other",
      "tags": string[]
    }
  ],
  "tags": string[]
}`,
};

// ─── Tag builder ─────────────────────────────────────────────────────────────

function buildTagString(extracted: Record<string, any>): string {
  const tagSet = new Set<string>();

  const normalize = (t: string) =>
    t.trim().toLowerCase().replace(/\s+/g, "-");

  const addAll = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((t) => {
      if (typeof t === "string" && t.trim()) tagSet.add(normalize(t));
    });
  };

  // Top-level tags from LLM
  addAll(extracted.tags);

  // Service lines as tags
  addAll(extracted.serviceLines);

  // Certifications as tags (resume / certification docTypes)
  addAll(extracted.certifications);

  // Image-level tags
  if (Array.isArray(extracted.images)) {
    extracted.images.forEach((img: ExtractedImage) => addAll(img.tags));
  }

  return Array.from(tagSet).sort().join(",");
}

// ─── extractedText builder ───────────────────────────────────────────────────

function buildExtractedText(extracted: Record<string, any>): string {
  const parts: string[] = [];

  // Summary / description fields
  for (const key of ["summary", "description", "projectDescription"]) {
    if (extracted[key]) parts.push(extracted[key]);
  }

  // Section content
  if (Array.isArray(extracted.sections)) {
    extracted.sections.forEach((s: ExtractedSection) => {
      if (s.title) parts.push(`## ${s.title}`);
      if (s.content) parts.push(s.content);
    });
  }

  // Image descriptions (makes images searchable via plain text)
  if (Array.isArray(extracted.images) && extracted.images.length > 0) {
    parts.push("## Images");
    extracted.images.forEach((img: ExtractedImage, i: number) => {
      const label = img.caption ?? `Image ${i + 1}`;
      parts.push(`${label} (page ${img.page}): ${img.description}`);
    });
  }

  // List fields
  for (const key of ["highlights", "winThemes", "keyPersonnel", "projectExperience", "skills"]) {
    if (Array.isArray(extracted[key]) && extracted[key].length > 0) {
      parts.push(`## ${key}`);
      parts.push(extracted[key].join("\n"));
    }
  }

  return parts.join("\n\n");
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
    .input(z.object({ id: z.string().uuid() }))
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

    // Auto-link: resolve staffId for resumes/certifications
    let resolvedStaffId: string | null = input.staffId ?? null;
    if (!resolvedStaffId && input.staffName && (input.docType === "resume" || input.docType === "certification")) {
      const nameLower = input.staffName.trim();
      const existing = await db.select({ id: personnel.id })
        .from(personnel)
        .where(like(personnel.name, `%${nameLower}%`))
        .limit(1);
      if (existing.length > 0) {
        resolvedStaffId = existing[0].id;
      } else {
        const [newPerson] = await db.insert(personnel).values({
          name: nameLower,
          isActive: true,
        }).returning({ id: personnel.id });
        resolvedStaffId = newPerson.id;
      }
    }

    // Auto-link: resolve projectId for project sheets / past proposals
    let resolvedProjectId: string | null = (input as any).projectId ?? null;
    if (!resolvedProjectId && input.projectName && (input.docType === "project_sheet" || input.docType === "past_proposal")) {
      let existingProject: { id: string } | null = null;
      if (input.projectNumber) {
        const rows = await db.select({ id: projects.id })
          .from(projects)
          .where(eq(projects.projectNumber, input.projectNumber))
          .limit(1);
        if (rows.length > 0) existingProject = rows[0];
      }
      if (!existingProject) {
        const rows = await db.select({ id: projects.id })
          .from(projects)
          .where(like(projects.name, `%${input.projectName.trim()}%`))
          .limit(1);
        if (rows.length > 0) existingProject = rows[0];
      }
      if (existingProject) {
        resolvedProjectId = existingProject.id;
      } else {
        const contractValue = input.contractValue
          ? parseFloat(input.contractValue.replace(/[^0-9.]/g, "")) || undefined
          : undefined;
        const [newProject] = await db.insert(projects).values({
          name: input.projectName.trim(),
          projectNumber: input.projectNumber ?? undefined,
          clientName: input.clientName ?? undefined,
          contractValue: contractValue?.toString(),
          status: "completed",
          createdBy: ctx.user.id,
        }).returning({ id: projects.id });
        resolvedProjectId = newProject.id;
      }
    }

    const [inserted] = await db
      .insert(damDocuments)
      .values({
        ...input,
        staffId: resolvedStaffId,
        projectId: resolvedProjectId,
        uploadedBy: ctx.user.id,
        processingStatus: "uploaded",
      })
      .returning({ id: damDocuments.id });

    const [doc] = await db
      .select()
      .from(damDocuments)
      .where(eq(damDocuments.id, inserted.id))
      .limit(1);

    return { ...doc, resolvedStaffId, resolvedProjectId };
  }),

  // ── List by staff member (resumes & certifications) ────────────────────
  listByStaff: protectedProcedure
    .input(z.object({ staffId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(damDocuments)
        .where(eq(damDocuments.staffId, input.staffId))
        .orderBy(desc(damDocuments.createdAt));
    }),

  // ── List by project (project sheets & past proposals) ──────────────────
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(damDocuments)
        .where(eq(damDocuments.projectId, input.projectId))
        .orderBy(desc(damDocuments.createdAt));
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
    .input(z.object({ id: z.string().uuid() }))
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
  // saves extractedText + extractedMeta + tags, sets processingStatus = 'indexed'.
  triggerExtract: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
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

        // Select system prompt by docType
        const systemPrompt =
          SYSTEM_PROMPTS[doc.docType] ?? SYSTEM_PROMPTS.other;

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
            text: `Extract all structured data, sections, and images from this ${doc.docType.replace("_", " ")} document titled "${doc.title}". Return only the JSON object specified in your instructions.`,
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
        let extracted: Record<string, any> = {};
        try {
          extracted = JSON.parse(rawContent);
        } catch {
          extracted = { raw: rawContent };
        }

        // Build tags string and searchable text from structured output
        const tagString = buildTagString(extracted);
        const extractedText = buildExtractedText(extracted);

        // Resolve ownerName: join array or use string
        const rawOwner = extracted.owner;
        const resolvedOwnerName: string | null = Array.isArray(rawOwner)
          ? (rawOwner as string[]).join(", ") || null
          : typeof rawOwner === "string" ? rawOwner || null : null;

        // Resolve firmRole
        const resolvedFirmRole: string | null =
          typeof extracted.firmRole === "string" ? extracted.firmRole : null;

        // Write back to dam_documents
        await db
          .update(damDocuments)
          .set({
            extractedMeta: extracted,
            extractedText,
            tags: tagString,
            ownerName: resolvedOwnerName,
            firmRole: resolvedFirmRole,
            processingStatus: "indexed",
            processingError: null,
          })
          .where(eq(damDocuments.id, input.id));

        return { success: true, imageCount: extracted.images?.length ?? 0 };
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

  // ── Auto-extract metadata from a freshly uploaded file (pre-fill form) ──────
  // Called immediately after /api/upload returns, before the DB record is created.
  // Returns structured metadata so the upload form can be pre-filled.
  autoExtract: protectedProcedure
    .input(
      z.object({
        fileUrl: z.string(),
        fileKey: z.string().min(1),
        mimeType: z.string().default("application/pdf"),
        fileName: z.string().default(""),
      })
    )
    .mutation(async ({ input }) => {
      // Get a fresh signed URL so the LLM can access the file
      let accessUrl = input.fileUrl;
      try {
        const { url } = await storageGet(input.fileKey);
        accessUrl = url;
      } catch {
        // fall back to the original URL
      }

      const supportedMimes = ["application/pdf", "audio/mpeg", "audio/wav", "audio/mp4", "video/mp4"];
      const llmMime = supportedMimes.includes(input.mimeType) ? input.mimeType : "application/pdf";

      const systemPrompt = `You are an expert AEC (Architecture, Engineering, Construction) document analyst.
Your job is to read any AEC firm document and extract ALL available metadata to help categorize it.

IMPORTANT: Some documents are multi-project experience sheets or project lists that contain multiple distinct projects on a single page or document. If you detect that the document contains 2 or more distinct projects (each with their own name, client, scope, or value), set multiProject to true and populate the projects array. Otherwise set multiProject to false and leave projects as an empty array.

Return a JSON object with these fields (use null for fields you cannot determine):
{
  "docType": one of: "past_proposal" | "project_sheet" | "resume" | "certification" | "rfp" | "contract" | "boilerplate" | "other",
  "companyTag": one of: "JPCL" | "Strans" | "Both" | null  (look for company names, logos, letterhead),
  "title": string (best descriptive title for this document),
  "clientName": string | null (for single-project docs: the direct contracting party — if prime, same as owner; if sub, the prime contractor e.g. AECOM),
  "ownerName": string | null (for single-project docs: the public agency or asset owner e.g. NYSDOT, NYC Parks; comma-separated if multiple),
  "firmRole": one of: "prime" | "sub" | "joint-venture" | null (our firm’s role on this project),
  "projectName": string | null,
  "projectNumber": string | null,
  "contractValue": string | null (formatted dollar amount e.g. "$1,250,000"),
  "awardYear": number | null (4-digit year),
  "staffName": string | null (for resumes/certifications: the person full name),
  "tags": string | null (comma-separated keywords: disciplines, location, agency type etc.),
  "description": string | null (2-3 sentence summary of the document),
  "multiProject": boolean (true if this document lists 2+ distinct projects),
  "projects": array of objects, each with:
    {
      "projectName": string,
      "owner": string[] (public agency / asset owner names — can be multiple e.g. ["NYSDOT", "FHWA"]),
      "client": string | null (direct contracting party: same as owner if prime, prime contractor name if sub),
      "firmRole": one of: "prime" | "sub" | "joint-venture" | null,
      "location": string | null,
      "contractValue": string | null,
      "startDate": string | null (e.g. "2021" or "Jan 2021"),
      "endDate": string | null,
      "serviceLines": string | null (comma-separated),
      "scope": string | null (1-2 sentence scope description),
      "description": string | null (any additional detail)
    }
}

Return ONLY valid JSON. Do not include markdown fences or explanation.`;

      const userContent: any[] = [
        {
          type: "file_url",
          file_url: { url: accessUrl, mime_type: llmMime },
        },
        {
          type: "text",
          text: `Analyze this document (filename: "${input.fileName}") and extract all available metadata. Return JSON only.`,
        },
      ];

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      try {
        const response = await invokeLLM({
          messages,
          response_format: { type: "json_object" } as any,
        });
        const raw = response?.choices?.[0]?.message?.content ?? "{}";
        const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
        const meta = JSON.parse(rawStr) as Record<string, unknown>;
        const rawProjects = Array.isArray(meta.projects) ? meta.projects as Array<Record<string, unknown>> : [];
        return {
          docType: (meta.docType as string) ?? "other",
          companyTag: (meta.companyTag as string) ?? null,
          title: (meta.title as string) ?? input.fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
          clientName: (meta.clientName as string) ?? null,
          projectName: (meta.projectName as string) ?? null,
          projectNumber: (meta.projectNumber as string) ?? null,
          contractValue: (meta.contractValue as string) ?? null,
          awardYear: meta.awardYear ? Number(meta.awardYear) : null,
          staffName: (meta.staffName as string) ?? null,
          tags: (meta.tags as string) ?? null,
          description: (meta.description as string) ?? null,
          ownerName: (meta.ownerName as string) ?? null,
          firmRole: (meta.firmRole as string) ?? null,
          multiProject: Boolean(meta.multiProject) && rawProjects.length >= 2,
          projects: rawProjects.map((p) => ({
            projectName: (p.projectName as string) ?? "",
            owner: Array.isArray(p.owner) ? (p.owner as string[]).join(", ") : ((p.owner as string) ?? ""),
            client: (p.client as string) ?? null,
            firmRole: (p.firmRole as string) ?? null,
            location: (p.location as string) ?? null,
            contractValue: (p.contractValue as string) ?? null,
            startDate: (p.startDate as string) ?? null,
            endDate: (p.endDate as string) ?? null,
            serviceLines: (p.serviceLines as string) ?? null,
            scope: (p.scope as string) ?? null,
            description: (p.description as string) ?? null,
          })),
        };
      } catch {
        // If LLM fails, return safe defaults so the user can fill in manually
        return {
          docType: "other" as const,
          companyTag: null as string | null,
          title: input.fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
          clientName: null as string | null,
          projectName: null as string | null,
          projectNumber: null as string | null,
          contractValue: null as string | null,
          awardYear: null as number | null,
          staffName: null as string | null,
          tags: null as string | null,
          description: null as string | null,
          ownerName: null as string | null,
          firmRole: null as string | null,
          multiProject: false,
          projects: [] as Array<{
            projectName: string;
            owner: string;
            client: string | null;
            firmRole: string | null;
            location: string | null;
            contractValue: string | null;
            startDate: string | null;
            endDate: string | null;
            serviceLines: string | null;
            scope: string | null;
            description: string | null;
          }>,
        };
      }
    }),
});
