/**
 * chunkBuilder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, deterministic transformer: converts a DAM document's `extractedMeta`
 * into an array of `InsertDocumentChunk` rows ready for bulk insert.
 *
 * Design constraints (per Phase 2 approval):
 *  - Pure function of (docType, extractedMeta, documentMetadata) — no DB calls,
 *    no LLM calls, no side effects. Fully unit-testable.
 *  - Idempotent: calling twice with the same input produces the same output.
 *  - Conservative: fewer, higher-signal chunks. Skip low-value content.
 *  - 80-char minimum applies to section_content and narrative chunks only.
 *    project_highlight, win_theme, project_experience are exempt (short but
 *    high-signal).
 *  - image_caption: skip only when BOTH caption and description are blank.
 *
 * Locked docType → ChunkType mapping (approved Jul 5, 2026):
 *  project_sheet  → project_description, project_highlight, section_content, image_caption
 *  resume         → personnel_bio, project_experience, section_content
 *  past_proposal  → win_theme, section_content, project_description, image_caption
 *  boilerplate    → section_content (fallback: project_description)
 *  certification  → section_content (single chunk)
 *  image          → image_caption (single chunk)
 *  other          → section_content (confidence 0.85)
 *  rfp            → (no chunks — lives in rfp_structured_index)
 *  contract       → (no chunks — legal reference, not proposal evidence)
 */

import type { InsertDocumentChunk } from "../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentInput {
  id: string;
  docType: string;
  title: string;
  staffName?: string | null;
  projectName?: string | null;
  serviceLines?: string[] | null;
  fileUrl?: string | null;
}

/** Partial InsertDocumentChunk without id/createdAt (DB generates those) */
export type ChunkInsert = Omit<InsertDocumentChunk, "id" | "createdAt">;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum character length for section_content and narrative chunks */
const NARRATIVE_MIN_CHARS = 80;

/** docTypes that produce no chunks */
const NO_CHUNK_TYPES = new Set(["rfp", "contract"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim();
}

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

/** True if content meets the narrative minimum length threshold */
function meetsNarrativeMin(content: string): boolean {
  return content.trim().length >= NARRATIVE_MIN_CHARS;
}

/** Extract service line tags from extractedMeta.serviceLines */
function extractServiceLineTags(meta: Record<string, any>): string[] {
  const raw = meta.serviceLines;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"));
}

/** Build a base chunk with shared fields */
function base(
  doc: DocumentInput,
  chunkType: string,
  content: string,
  opts: {
    pageRef?: string;
    sectionRef?: string;
    confidence?: number;
    extractionMethod?: string;
    metadata?: Record<string, any>;
    serviceLineTags?: string[];
  } = {}
): ChunkInsert {
  return {
    damDocumentId: doc.id,
    chunkType,
    content,
    pageRef: opts.pageRef ?? null,
    sectionRef: opts.sectionRef ?? null,
    confidence: opts.confidence ?? 1.0,
    extractionMethod: opts.extractionMethod ?? "llm_structured",
    metadata: opts.metadata ?? null,
    serviceLineTags: opts.serviceLineTags ?? [],
  };
}

// ─── Per-docType builders ─────────────────────────────────────────────────────

function buildProjectSheetChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  const chunks: ChunkInsert[] = [];
  const tags = extractServiceLineTags(meta);

  // 1. project_description — description + summary joined
  const descParts = [norm(meta.description), norm(meta.summary)].filter(
    (s) => !isBlank(s)
  );
  if (descParts.length > 0) {
    const content = descParts.join("\n\n");
    if (meetsNarrativeMin(content)) {
      chunks.push(
        base(doc, "project_description", content, {
          sectionRef: "Overview",
          serviceLineTags: tags,
          metadata: {
            projectName: meta.projectName ?? doc.projectName ?? null,
            owner: meta.owner ?? null,
            client: meta.client ?? null,
            firmRole: meta.firmRole ?? null,
            contractValue: meta.contractValue ?? null,
            location: meta.location ?? null,
            startDate: meta.startDate ?? null,
            endDate: meta.endDate ?? null,
          },
        })
      );
    }
  }

  // 2. project_highlight — each item in highlights[] (exempt from 80-char min)
  if (Array.isArray(meta.highlights)) {
    meta.highlights.forEach((h: unknown, i: number) => {
      const content = norm(h as string);
      if (!isBlank(content)) {
        chunks.push(
          base(doc, "project_highlight", content, {
            sectionRef: "Highlights",
            serviceLineTags: tags,
            metadata: { index: i },
          })
        );
      }
    });
  }

  // 3. section_content — each section (80-char min applies)
  if (Array.isArray(meta.sections)) {
    meta.sections.forEach((s: any) => {
      const content = norm(s?.content);
      const title = norm(s?.title);
      if (meetsNarrativeMin(content)) {
        chunks.push(
          base(doc, "section_content", content, {
            pageRef: s?.page != null ? String(s.page) : undefined,
            sectionRef: title || undefined,
            serviceLineTags: tags,
          })
        );
      }
    });
  }

  // 4. image_caption — skip only when BOTH caption and description are blank
  if (Array.isArray(meta.images)) {
    meta.images.forEach((img: any, i: number) => {
      const caption = norm(img?.caption);
      const description = norm(img?.description);
      if (isBlank(caption) && isBlank(description)) return; // both blank → skip
      const content = [caption, description].filter((s) => !isBlank(s)).join(" — ");
      chunks.push(
        base(doc, "image_caption", content, {
          pageRef: img?.page != null ? String(img.page) : undefined,
          confidence: 0.9,
          extractionMethod: "llm_vision",
          serviceLineTags: tags,
          metadata: {
            imageType: img?.imageType ?? null,
            imageTags: img?.tags ?? [],
            index: i,
          },
        })
      );
    });
  }

  return chunks;
}

function buildResumeChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  const chunks: ChunkInsert[] = [];
  const tags = extractServiceLineTags(meta);
  const staffName = norm(meta.name) || doc.staffName || null;

  // 1. personnel_bio — summary
  const bio = norm(meta.summary);
  if (meetsNarrativeMin(bio)) {
    chunks.push(
      base(doc, "personnel_bio", bio, {
        sectionRef: "Summary",
        serviceLineTags: tags,
        metadata: {
          name: staffName,
          title: meta.title ?? null,
          yearsExperience: meta.yearsExperience ?? null,
          education: meta.education ?? [],
          certifications: meta.certifications ?? [],
        },
      })
    );
  }

  // 2. project_experience — each item in projectExperience[] (exempt from 80-char min)
  if (Array.isArray(meta.projectExperience)) {
    meta.projectExperience.forEach((exp: unknown, i: number) => {
      const content = norm(exp as string);
      if (!isBlank(content)) {
        chunks.push(
          base(doc, "project_experience", content, {
            sectionRef: "Project Experience",
            serviceLineTags: tags,
            metadata: { staffName, index: i },
          })
        );
      }
    });
  }

  // 3. section_content — each section (80-char min applies)
  if (Array.isArray(meta.sections)) {
    meta.sections.forEach((s: any) => {
      const content = norm(s?.content);
      const title = norm(s?.title);
      if (meetsNarrativeMin(content)) {
        chunks.push(
          base(doc, "section_content", content, {
            pageRef: s?.page != null ? String(s.page) : undefined,
            sectionRef: title || undefined,
            serviceLineTags: tags,
          })
        );
      }
    });
  }

  return chunks;
}

function buildPastProposalChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  const chunks: ChunkInsert[] = [];
  const tags = extractServiceLineTags(meta);

  // 1. win_theme — each item in winThemes[] (exempt from 80-char min)
  if (Array.isArray(meta.winThemes)) {
    meta.winThemes.forEach((wt: unknown, i: number) => {
      const content = norm(wt as string);
      if (!isBlank(content)) {
        chunks.push(
          base(doc, "win_theme", content, {
            sectionRef: "Win Themes",
            serviceLineTags: tags,
            metadata: { index: i },
          })
        );
      }
    });
  }

  // 2. project_description — projectDescription + summary
  const descParts = [
    norm(meta.projectDescription),
    norm(meta.summary),
  ].filter((s) => !isBlank(s));
  if (descParts.length > 0) {
    const content = descParts.join("\n\n");
    if (meetsNarrativeMin(content)) {
      chunks.push(
        base(doc, "project_description", content, {
          sectionRef: "Overview",
          serviceLineTags: tags,
          metadata: {
            title: meta.title ?? doc.title ?? null,
            owner: meta.owner ?? null,
            client: meta.client ?? null,
            firmRole: meta.firmRole ?? null,
            rfpNumber: meta.rfpNumber ?? null,
            submitDate: meta.submitDate ?? null,
            contractValue: meta.contractValue ?? null,
          },
        })
      );
    }
  }

  // 3. section_content — each section (80-char min applies)
  if (Array.isArray(meta.sections)) {
    meta.sections.forEach((s: any) => {
      const content = norm(s?.content);
      const title = norm(s?.title);
      if (meetsNarrativeMin(content)) {
        chunks.push(
          base(doc, "section_content", content, {
            pageRef: s?.page != null ? String(s.page) : undefined,
            sectionRef: title || undefined,
            serviceLineTags: tags,
          })
        );
      }
    });
  }

  // 4. image_caption — skip only when BOTH caption and description are blank
  if (Array.isArray(meta.images)) {
    meta.images.forEach((img: any, i: number) => {
      const caption = norm(img?.caption);
      const description = norm(img?.description);
      if (isBlank(caption) && isBlank(description)) return;
      const content = [caption, description].filter((s) => !isBlank(s)).join(" — ");
      chunks.push(
        base(doc, "image_caption", content, {
          pageRef: img?.page != null ? String(img.page) : undefined,
          confidence: 0.9,
          extractionMethod: "llm_vision",
          serviceLineTags: tags,
          metadata: {
            imageType: img?.imageType ?? null,
            imageTags: img?.tags ?? [],
            index: i,
          },
        })
      );
    });
  }

  return chunks;
}

function buildBoilerplateChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  const chunks: ChunkInsert[] = [];
  const tags = extractServiceLineTags(meta);

  // section_content — each section (80-char min applies)
  if (Array.isArray(meta.sections) && meta.sections.length > 0) {
    meta.sections.forEach((s: any) => {
      const content = norm(s?.content);
      const title = norm(s?.title);
      if (meetsNarrativeMin(content)) {
        chunks.push(
          base(doc, "section_content", content, {
            pageRef: s?.page != null ? String(s.page) : undefined,
            sectionRef: title || undefined,
            serviceLineTags: tags,
          })
        );
      }
    });
  } else {
    // Fallback: project_description from summary or description
    const fallback = [norm(meta.summary), norm(meta.description)]
      .filter((s) => !isBlank(s))
      .join("\n\n");
    if (meetsNarrativeMin(fallback)) {
      chunks.push(
        base(doc, "project_description", fallback, {
          sectionRef: "Overview",
          serviceLineTags: tags,
        })
      );
    }
  }

  return chunks;
}

function buildCertificationChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  // Single section_content chunk combining key fields
  const parts = [
    meta.certificationName ? `Certification: ${norm(meta.certificationName)}` : "",
    meta.issuingAuthority ? `Issued by: ${norm(meta.issuingAuthority)}` : "",
    meta.holderName ? `Holder: ${norm(meta.holderName)}` : "",
    meta.certificationNumber ? `Number: ${norm(meta.certificationNumber)}` : "",
    meta.issueDate ? `Issued: ${norm(meta.issueDate)}` : "",
    meta.expirationDate ? `Expires: ${norm(meta.expirationDate)}` : "",
    meta.summary ? norm(meta.summary) : "",
  ].filter((s) => !isBlank(s));

  if (parts.length === 0) return [];

  const content = parts.join("\n");
  return [
    base(doc, "section_content", content, {
      sectionRef: "Certification Details",
      metadata: {
        certificationName: meta.certificationName ?? null,
        issuingAuthority: meta.issuingAuthority ?? null,
        holderName: meta.holderName ?? null,
        certificationNumber: meta.certificationNumber ?? null,
        issueDate: meta.issueDate ?? null,
        expirationDate: meta.expirationDate ?? null,
      },
    }),
  ];
}

function buildImageChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  // Single image_caption chunk; skip only when BOTH caption and description are blank
  const caption = norm(meta.caption);
  const description = norm(meta.description);
  if (isBlank(caption) && isBlank(description)) return [];

  const contentParts = [caption, description].filter((s) => !isBlank(s));
  if (meta.structureType) contentParts.push(`Structure type: ${norm(meta.structureType)}`);
  if (meta.environment) contentParts.push(`Environment: ${norm(meta.environment)}`);

  const content = contentParts.join(" — ");

  const tags: string[] = Array.isArray(meta.tags)
    ? meta.tags
        .filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t: string) => t.trim().toLowerCase().replace(/\s+/g, "_"))
    : [];

  return [
    base(doc, "image_caption", content, {
      confidence: 0.9,
      extractionMethod: "llm_vision",
      serviceLineTags: tags,
      metadata: {
        structureType: meta.structureType ?? null,
        imageQuality: meta.qualityRating ?? null,
        hasPersonnel: meta.hasPersonnel ?? null,
        imageTags: meta.tags ?? [],
      },
    }),
  ];
}

function buildOtherChunks(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  const chunks: ChunkInsert[] = [];
  const tags = extractServiceLineTags(meta);

  if (Array.isArray(meta.sections)) {
    meta.sections.forEach((s: any) => {
      const content = norm(s?.content);
      const title = norm(s?.title);
      if (meetsNarrativeMin(content)) {
        chunks.push(
          base(doc, "section_content", content, {
            pageRef: s?.page != null ? String(s.page) : undefined,
            sectionRef: title || undefined,
            confidence: 0.85,
            serviceLineTags: tags,
          })
        );
      }
    });
  }

  return chunks;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Pure function: derive document_chunks rows from a DAM document's extractedMeta.
 *
 * @param doc     — document metadata (id, docType, title, staffName, etc.)
 * @param meta    — parsed extractedMeta JSON (from dam_documents.extractedMeta)
 * @returns       — array of ChunkInsert rows ready for bulk insert (may be empty)
 */
export function buildChunksFromDocument(
  doc: DocumentInput,
  meta: Record<string, any>
): ChunkInsert[] {
  if (!meta || typeof meta !== "object") return [];
  if (NO_CHUNK_TYPES.has(doc.docType)) return [];

  switch (doc.docType) {
    case "project_sheet":
      return buildProjectSheetChunks(doc, meta);
    case "resume":
      return buildResumeChunks(doc, meta);
    case "past_proposal":
      return buildPastProposalChunks(doc, meta);
    case "boilerplate":
      return buildBoilerplateChunks(doc, meta);
    case "certification":
      return buildCertificationChunks(doc, meta);
    case "image":
      return buildImageChunks(doc, meta);
    default:
      return buildOtherChunks(doc, meta);
  }
}
