/**
 * hybridRetrieval.ts
 *
 * Pure helper module for Phase 3 hybrid asset retrieval.
 * Contains all scoring logic, weight constants, and query helpers.
 * No side effects — all functions are deterministic and unit-testable.
 *
 * Composite score formula (locked July 5, 2026):
 *   compositeScore = (legacyTagScore × 0.4) + (ftScore × 0.4) + (metaScore × 0.2)
 *
 * matchQuality thresholds (Rec 4, locked July 5, 2026):
 *   "hybrid"   — ftScore > 0.1
 *   "tag-only" — legacyTagScore > 0 AND ftScore <= 0.1
 *   "fallback" — both are 0
 *
 * corpusSize suppression (Rec 5, locked July 5, 2026):
 *   compositeScore badges are suppressed in the UI when corpusSize < 8.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

// ─── Chunk-type weights ───────────────────────────────────────────────────────
// Applied to ts_rank before summing into ftScore.
// Higher weight = chunk type is a stronger relevance signal.

export const CHUNK_TYPE_WEIGHTS: Record<string, number> = {
  project_description: 1.0,
  personnel_bio: 1.0,
  win_theme: 0.9,
  project_experience: 0.9,
  section_content: 0.8,
  project_highlight: 0.7,
  image_caption: 0.5,
  certification_detail: 0.8,
};

/** Returns the weight for a given chunk type, defaulting to 0.7 for unknowns. */
export function getChunkTypeWeight(chunkType: string): number {
  return CHUNK_TYPE_WEIGHTS[chunkType] ?? 0.7;
}

// ─── matchQuality classification ─────────────────────────────────────────────

export type MatchQuality = "hybrid" | "tag-only" | "fallback";

/**
 * Classify the match quality based on the component scores.
 * Thresholds locked July 5, 2026 (Rec 4).
 */
export function classifyMatchQuality(
  legacyTagScore: number,
  ftScore: number
): MatchQuality {
  if (ftScore > 0.1) return "hybrid";
  if (legacyTagScore > 0) return "tag-only";
  return "fallback";
}

// ─── Composite score ──────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  legacyTagScore: number; // [0, 1] — tag overlap score using legacy tags column
  ftScore: number;        // [0, 1] — full-text search score from document_chunks
  metaScore: number;      // [0, 1] — metadata enrichment score (recency, completeness)
  compositeScore: number; // [0, 1] — weighted composite
}

/**
 * Compute the composite relevance score from component scores.
 * Formula: (legacyTagScore × 0.4) + (ftScore × 0.4) + (metaScore × 0.2)
 * All inputs and output are in [0, 1].
 */
export function computeCompositeScore(
  legacyTagScore: number,
  ftScore: number,
  metaScore: number
): ScoreBreakdown {
  const compositeScore =
    legacyTagScore * 0.4 + ftScore * 0.4 + metaScore * 0.2;
  return {
    legacyTagScore: clamp(legacyTagScore),
    ftScore: clamp(ftScore),
    metaScore: clamp(metaScore),
    compositeScore: clamp(compositeScore),
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Legacy tag score ─────────────────────────────────────────────────────────

/**
 * Compute a [0, 1] tag overlap score between the RFP service lines and a
 * document's legacy comma-separated tags column.
 *
 * Matching is case-insensitive substring match (each service line term is
 * checked against the full tags string). Score = matched / total service lines.
 * Returns 0 if serviceLines is empty.
 */
export function computeLegacyTagScore(
  serviceLines: string[],
  tagsString: string | null | undefined
): number {
  if (!serviceLines.length || !tagsString) return 0;
  const tagsLower = tagsString.toLowerCase();
  let matched = 0;
  for (const sl of serviceLines) {
    if (tagsLower.includes(sl.toLowerCase().trim())) matched++;
  }
  return matched / serviceLines.length;
}

// ─── Metadata enrichment score ────────────────────────────────────────────────

/**
 * Compute a [0, 1] metadata enrichment score for a document.
 * Rewards: recency, completeness of extractedMeta, chunkStatus = "chunked".
 *
 * Components:
 *   - recencyScore (0.5 weight): documents indexed within the last 2 years score 1.0,
 *     linearly decaying to 0 at 5 years.
 *   - completenessScore (0.3 weight): 1.0 if extractedMeta is non-null, 0 otherwise.
 *   - chunkScore (0.2 weight): 1.0 if chunkStatus = "chunked", 0 otherwise.
 */
export function computeMetaScore(doc: {
  createdAt: Date | null;
  extractedMeta: unknown;
  chunkStatus: string | null;
}): number {
  const now = Date.now();
  const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
  const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

  let recencyScore = 0;
  if (doc.createdAt) {
    const ageMs = now - doc.createdAt.getTime();
    if (ageMs <= TWO_YEARS_MS) {
      recencyScore = 1.0;
    } else if (ageMs < FIVE_YEARS_MS) {
      recencyScore = 1.0 - (ageMs - TWO_YEARS_MS) / (FIVE_YEARS_MS - TWO_YEARS_MS);
    }
  }

  const completenessScore = doc.extractedMeta != null ? 1.0 : 0.0;
  const chunkScore = doc.chunkStatus === "chunked" ? 1.0 : 0.0;

  return clamp(
    recencyScore * 0.5 + completenessScore * 0.3 + chunkScore * 0.2
  );
}

// ─── Full-text score from document_chunks ─────────────────────────────────────

export interface ChunkPreview {
  chunkType: string;
  content: string;
  pageRef: string | null;
  relevanceScore: number;
}

export interface FtsResult {
  damDocumentId: string;
  ftScore: number;       // [0, 1] normalized
  topChunks: ChunkPreview[];
}

/**
 * Run a full-text search against document_chunks for the given document IDs
 * and query string. Returns per-document ftScore and top-3 chunk previews.
 *
 * Uses PostgreSQL ts_rank with the GIN expression index on
 * to_tsvector('english', content). Chunk-type weights are applied before
 * summing into the per-document score.
 *
 * Returns an empty map when documentIds is empty or query is blank.
 */
export async function fetchFtsScores(
  documentIds: string[],
  query: string
): Promise<Map<string, FtsResult>> {
  const result = new Map<string, FtsResult>();
  if (!documentIds.length || !query.trim()) return result;

  // Sanitize query: remove special tsquery characters, collapse whitespace
  const sanitized = query
    .replace(/[&|!():*<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return result;

  // Fetch all matching chunks for the given document IDs
  // ts_rank returns a float in [0, 1]; we apply chunk-type weight inline
  const db = await getDb();
  if (!db) return result;
  const rows = await db.execute(sql`
    SELECT
      dc."damDocumentId",
      dc."chunkType",
      LEFT(dc.content, 200) AS preview,
      dc."pageRef",
      ts_rank(
        to_tsvector('english', dc.content),
        plainto_tsquery('english', ${sanitized})
      ) AS raw_rank
    FROM document_chunks dc
    WHERE
      dc."damDocumentId" = ANY(${documentIds}::uuid[])
      AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${sanitized})
    ORDER BY dc."damDocumentId", raw_rank DESC
  `);

  // Group by document, apply chunk-type weights, take top 3 per document
  const byDoc = new Map<string, Array<{ chunkType: string; preview: string; pageRef: string | null; weightedRank: number }>>();

  type RawRow = {
    damDocumentId: string;
    chunkType: string;
    preview: string;
    pageRef: string | null;
    raw_rank: number;
  };

  for (const row of (rows as unknown) as RawRow[]) {
    const weight = getChunkTypeWeight(row.chunkType);
    const weightedRank = (row.raw_rank ?? 0) * weight;
    if (!byDoc.has(row.damDocumentId)) byDoc.set(row.damDocumentId, []);
    byDoc.get(row.damDocumentId)!.push({
      chunkType: row.chunkType,
      preview: row.preview,
      pageRef: row.pageRef,
      weightedRank,
    });
  }

  // For each document: sum top-3 weighted ranks, normalize to [0, 1]
  // Maximum possible ts_rank is 1.0 × weight 1.0 × 3 chunks = 3.0
  const MAX_POSSIBLE = 3.0;

  type ChunkEntry = { chunkType: string; preview: string; pageRef: string | null; weightedRank: number };

  for (const [docId, chunks] of Array.from(byDoc.entries())) {
    const sorted = (chunks as ChunkEntry[]).sort(
      (a: ChunkEntry, b: ChunkEntry) => b.weightedRank - a.weightedRank
    );
    const top3 = sorted.slice(0, 3);
    const rawSum = top3.reduce((s: number, c: ChunkEntry) => s + c.weightedRank, 0);
    const ftScore = clamp(rawSum / MAX_POSSIBLE);

    result.set(docId, {
      damDocumentId: docId,
      ftScore,
      topChunks: top3.map((c: ChunkEntry) => ({
        chunkType: c.chunkType,
        content: c.preview,
        pageRef: c.pageRef,
        relevanceScore: clamp(c.weightedRank),
      })),
    });
  }

  return result;
}

// ─── FTS query string builder ─────────────────────────────────────────────────

/**
 * Build a plain-English FTS query string from an RFP's service lines and
 * optional keywords. The result is passed to plainto_tsquery().
 *
 * plainto_tsquery() handles tokenization, stemming, and stop words — no
 * special operators needed. We simply join the terms with spaces.
 */
export function buildFtsQuery(
  serviceLines: string[],
  additionalKeywords: string[] = []
): string {
  return [...serviceLines, ...additionalKeywords]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

// ─── corpusSize suppression threshold ────────────────────────────────────────

/** Minimum corpus size before compositeScore badges are shown in the UI. */
export const CORPUS_SIZE_THRESHOLD = 8;
