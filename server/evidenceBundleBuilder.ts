/**
 * server/evidenceBundleBuilder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4 — Evidence Bundle Assembly
 *
 * Builds skill-specific EvidenceBundle objects from document_chunks rows.
 * Each bundle contains ranked, capped evidence items grouped by source type
 * (project_sheet, resume, past_proposal, boilerplate, other).
 *
 * Design rules (per Phase 4 approval):
 *  1. Deterministic and skill-specific — each skill has its own chunk type
 *     priority list and per-source-type caps.
 *  2. Additive — this module never removes or replaces legacy summary variables.
 *  3. Empty-bundle fallback is automatic — returns an empty bundle with
 *     `hasSufficientEvidence: false` when no chunks are available.
 *  4. No hardcoded prompts — this module only assembles data; prompt text
 *     stays in the ai_skills table.
 *  5. Provenance-complete — every EvidenceItem carries damDocumentId, chunkType,
 *     pageRef, and a relevanceScore so Phase 5 can trace citations.
 */

import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { documentChunks, damDocuments } from "../drizzle/schema";
import type { EvidenceBundle, EvidenceItem } from "../shared/workflowTypes";

// ─── Skill-specific configuration ─────────────────────────────────────────────

/**
 * For each workflow skill, defines:
 *  - `chunkTypePriority`: ordered list of chunk types to prefer (first = highest rank)
 *  - `sourceTypeCaps`: max evidence items per DAM docType source
 *  - `totalCap`: max total items in the bundle
 *  - `minConfidence`: minimum chunk confidence to include
 */
interface SkillEvidenceConfig {
  chunkTypePriority: string[];
  sourceTypeCaps: Partial<Record<string, number>>;
  totalCap: number;
  minConfidence: number;
}

const SKILL_EVIDENCE_CONFIGS: Record<string, SkillEvidenceConfig> = {
  win_themes: {
    // Win themes need project highlights, descriptions, and past proposal win themes
    chunkTypePriority: [
      "win_theme",
      "project_description",
      "project_highlight",
      "section_content",
      "personnel_bio",
    ],
    sourceTypeCaps: {
      project_sheet: 6,
      past_proposal: 4,
      resume: 2,
      boilerplate: 2,
    },
    totalCap: 12,
    minConfidence: 0.7,
  },

  technical_writer: {
    // Technical approach needs project descriptions, section content, and highlights
    chunkTypePriority: [
      "project_description",
      "section_content",
      "project_highlight",
      "win_theme",
      "image_caption",
    ],
    sourceTypeCaps: {
      project_sheet: 8,
      past_proposal: 4,
      boilerplate: 3,
      resume: 1,
    },
    totalCap: 14,
    minConfidence: 0.7,
  },

  key_personnel: {
    // Key personnel needs bios, project experience, and certifications
    chunkTypePriority: [
      "personnel_bio",
      "project_experience",
      "section_content",
    ],
    sourceTypeCaps: {
      resume: 10,
      project_sheet: 3,
      boilerplate: 2,
    },
    totalCap: 12,
    minConfidence: 0.7,
  },

  past_performance: {
    // Past performance needs project descriptions, highlights, and past proposal content
    chunkTypePriority: [
      "project_description",
      "project_highlight",
      "win_theme",
      "section_content",
      "image_caption",
    ],
    sourceTypeCaps: {
      project_sheet: 8,
      past_proposal: 6,
      boilerplate: 2,
    },
    totalCap: 14,
    minConfidence: 0.7,
  },
};

// Default config for skills not explicitly listed (safe fallback)
const DEFAULT_EVIDENCE_CONFIG: SkillEvidenceConfig = {
  chunkTypePriority: ["project_description", "section_content", "project_highlight"],
  sourceTypeCaps: { project_sheet: 5, past_proposal: 3, resume: 2 },
  totalCap: 8,
  minConfidence: 0.7,
};

// ─── Chunk-type relevance weights (reused from hybridRetrieval) ───────────────

const CHUNK_TYPE_WEIGHTS: Record<string, number> = {
  project_description: 1.0,
  personnel_bio: 1.0,
  win_theme: 0.9,
  project_experience: 0.9,
  section_content: 0.8,
  project_highlight: 0.7,
  image_caption: 0.5,
};

// ─── Main export ──────────────────────────────────────────────────────────────

export interface BuildEvidenceBundleResult {
  bundle: EvidenceBundle;
  /** Human-readable string for injection into skill variables */
  evidenceContext: string;
  /** True when at least one evidence item was found */
  hasSufficientEvidence: boolean;
}

/**
 * Build a skill-specific evidence bundle from document_chunks for the given
 * DAM document IDs.
 *
 * @param docIds     - DAM document IDs selected for this pursuit (project sheets,
 *                     resumes, past proposals)
 * @param skillName  - Workflow skill name (win_themes, technical_writer, etc.)
 * @param rfpServiceLines - Service lines from the RFP/pursuit for relevance scoring
 */
export async function buildEvidenceBundle(
  docIds: string[],
  skillName: string,
  rfpServiceLines: string[] = []
): Promise<BuildEvidenceBundleResult> {
  const emptyResult: BuildEvidenceBundleResult = {
    bundle: {
      skillName,
      items: [],
      assembledAt: Date.now(),
      sourceDocIds: docIds,
    },
    evidenceContext: "",
    hasSufficientEvidence: false,
  };

  if (docIds.length === 0) return emptyResult;

  const config = SKILL_EVIDENCE_CONFIGS[skillName] ?? DEFAULT_EVIDENCE_CONFIG;

  try {
    const db = await getDb();
    if (!db) return emptyResult;
    // ── Fetch all chunks for selected documents ──────────────────────────────
    const chunks = await db
      .select({
        id: documentChunks.id,
        damDocumentId: documentChunks.damDocumentId,
        chunkType: documentChunks.chunkType,
        content: documentChunks.content,
        pageRef: documentChunks.pageRef,
        sectionRef: documentChunks.sectionRef,
        confidence: documentChunks.confidence,
        extractionMethod: documentChunks.extractionMethod,
        metadata: documentChunks.metadata,
        serviceLineTags: documentChunks.serviceLineTags,
      })
      .from(documentChunks)
      .where(inArray(documentChunks.damDocumentId, docIds));

    if (chunks.length === 0) return emptyResult;

    // ── Fetch document metadata for source type resolution ───────────────────
    const docs = await db
      .select({
        id: damDocuments.id,
        docType: damDocuments.docType,
        title: damDocuments.title,
        projectName: damDocuments.projectName,
        clientName: damDocuments.clientName,
        tags: damDocuments.tags,
      })
      .from(damDocuments)
      .where(inArray(damDocuments.id, docIds));

    const docMap = new Map(docs.map((d) => [d.id, d]));

    // ── Score and filter chunks ───────────────────────────────────────────────
    const scored = chunks
      .filter((c) => {
        // Filter by minimum confidence
        const conf = typeof c.confidence === "number" ? c.confidence : parseFloat(String(c.confidence ?? "0"));
        if (conf < config.minConfidence) return false;
        // Only include chunk types in the priority list
        return config.chunkTypePriority.includes(c.chunkType ?? "");
      })
      .map((c) => {
        const doc = docMap.get(c.damDocumentId ?? "");
        const chunkWeight = CHUNK_TYPE_WEIGHTS[c.chunkType ?? ""] ?? 0.5;
        const priorityRank = config.chunkTypePriority.indexOf(c.chunkType ?? "");
        const priorityScore = priorityRank >= 0 ? 1 - priorityRank / config.chunkTypePriority.length : 0;

        // Service line relevance boost
        let serviceLineBoost = 0;
        if (rfpServiceLines.length > 0) {
          const chunkTags = (c.serviceLineTags as string[] | null) ?? [];
          const docTags = doc?.tags ?? "";
          const tagText = [...chunkTags, docTags].join(" ").toLowerCase();
          const matchCount = rfpServiceLines.filter((sl) =>
            tagText.includes(sl.toLowerCase())
          ).length;
          serviceLineBoost = matchCount / rfpServiceLines.length;
        }

        const relevanceScore = chunkWeight * 0.5 + priorityScore * 0.3 + serviceLineBoost * 0.2;

        return {
          chunk: c,
          doc,
          relevanceScore,
          sourceType: doc?.docType ?? "other",
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // ── Apply per-source-type caps ────────────────────────────────────────────
    const sourceTypeCounts: Record<string, number> = {};
    const selectedItems: EvidenceItem[] = [];

    for (const { chunk, doc, relevanceScore, sourceType } of scored) {
      if (selectedItems.length >= config.totalCap) break;

      const cap = config.sourceTypeCaps[sourceType] ?? 2;
      const currentCount = sourceTypeCounts[sourceType] ?? 0;
      if (currentCount >= cap) continue;

      sourceTypeCounts[sourceType] = currentCount + 1;

      selectedItems.push({
        chunkId: chunk.id ?? "",
        damDocumentId: chunk.damDocumentId ?? "",
        chunkType: chunk.chunkType ?? "section_content",
        content: chunk.content ?? "",
        pageRef: chunk.pageRef ?? null,
        sectionRef: chunk.sectionRef ?? null,
        relevanceScore,
        sourceDocTitle: doc?.projectName || doc?.title || "Unknown",
        sourceDocType: sourceType,
        extractionMethod: chunk.extractionMethod ?? "pdf_parse",
        confidence: typeof chunk.confidence === "number"
          ? chunk.confidence
          : parseFloat(String(chunk.confidence ?? "0")),
      });
    }

    const hasSufficientEvidence = selectedItems.length > 0;

    const bundle: EvidenceBundle = {
      skillName,
      items: selectedItems,
      assembledAt: Date.now(),
      sourceDocIds: docIds,
    };

    const evidenceContext = hasSufficientEvidence
      ? formatEvidenceContext(selectedItems, skillName)
      : "";

    return { bundle, evidenceContext, hasSufficientEvidence };
  } catch (err) {
    // Non-blocking — log and return empty bundle so generation can proceed
    console.warn(`[evidenceBundleBuilder] Failed to build bundle for skill "${skillName}":`, err);
    return emptyResult;
  }
}

// ─── Evidence context formatter ───────────────────────────────────────────────

/**
 * Citation format options for formatEvidenceContext.
 *
 * - `"none"` (default): preserves the existing output format exactly.
 *   All current callers receive this behavior unchanged.
 * - `"inline"`: appends a `[Source: {title}, p.{page}]` marker after each
 *   evidence item's content, making the context citation-ready for future
 *   prompt updates that ask the LLM to reproduce inline citations.
 *   Handles null/undefined pageRef gracefully (omits the page component).
 */
export type CitationFormat = "none" | "inline";

/**
 * Format evidence items into a structured string for injection into skill
 * variables. Groups by source document, preserves provenance.
 *
 * @param items - Evidence items to format
 * @param skillName - Skill name for the bundle header
 * @param citationFormat - `"none"` (default) preserves existing output;
 *   `"inline"` appends citation markers to each item's content.
 */
export function formatEvidenceContext(
  items: EvidenceItem[],
  skillName: string,
  citationFormat: CitationFormat = "none"
): string {
  if (items.length === 0) return "";

  // Group by source document
  const byDoc = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = item.damDocumentId;
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(item);
  }

  const sections: string[] = [];
  sections.push(`=== EVIDENCE BUNDLE (${skillName}) ===`);
  sections.push(`${items.length} evidence items from ${byDoc.size} source document(s).`);
  sections.push("Use these specific facts, names, and values in your response. Do not invent details not present here.");
  sections.push("");

  for (const [, docItems] of Array.from(byDoc.entries())) {
    const first = docItems[0];
    const docLabel = `[${first.sourceDocType.toUpperCase()}] ${first.sourceDocTitle}`;
    sections.push(docLabel);
    sections.push("─".repeat(Math.min(docLabel.length, 60)));

    for (const item of docItems) {
      const pageNote = item.pageRef ? ` (p.${item.pageRef})` : "";
      const typeNote = item.chunkType.replace(/_/g, " ");
      sections.push(`  [${typeNote}${pageNote}]`);

      if (citationFormat === "inline") {
        // Phase 7 Track C: append citation marker after content.
        // Handles null/undefined pageRef gracefully — omits page component.
        const pageRef = item.pageRef != null && item.pageRef !== ""
          ? `, p.${item.pageRef}`
          : "";
        const citation = `[Source: ${item.sourceDocTitle}${pageRef}]`;
        sections.push(`  ${item.content.trim()} ${citation}`);
      } else {
        // Default ("none"): identical to pre-Phase-7 output
        sections.push(`  ${item.content.trim()}`);
      }
      sections.push("");
    }
  }

  sections.push("=== END EVIDENCE BUNDLE ===");
  return sections.join("\n");
}
