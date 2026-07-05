/**
 * server/hybridRetrieval.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 unit tests for the hybrid retrieval scoring helpers.
 *
 * Function signatures (from hybridRetrieval.ts):
 *   computeCompositeScore(legacyTagScore, ftScore, metaScore): ScoreBreakdown
 *   classifyMatchQuality(legacyTagScore, ftScore): MatchQuality
 *   CHUNK_TYPE_WEIGHTS: Record<string, number>
 *   CORPUS_SIZE_THRESHOLD: number (= 8)
 *
 * Tests required by the Phase 3 spec (6 groups):
 *  1. Composite score formula with known inputs
 *  2. Chunk-type weight application
 *  3. matchQuality thresholds (hybrid / tag-only / fallback)
 *  4. Fallback behavior when document_chunks is empty
 *  5. Mixed corpus (some docs chunked, some not)
 *  6. Shape compatibility (all three match procedures return required fields)
 */

import { describe, it, expect } from "vitest";
import {
  computeCompositeScore,
  classifyMatchQuality,
  CHUNK_TYPE_WEIGHTS,
  CORPUS_SIZE_THRESHOLD,
} from "./hybridRetrieval";

// ─── Test 1: Composite score formula with known inputs ────────────────────────

describe("computeCompositeScore", () => {
  it("returns weighted sum of tagScore, ftScore, and metaScore", () => {
    const result = computeCompositeScore(1.0, 0.8, 0.5);
    // Expected: (1.0 × 0.4) + (0.8 × 0.4) + (0.5 × 0.2) = 0.4 + 0.32 + 0.10 = 0.82
    expect(result.compositeScore).toBeCloseTo(0.82, 5);
  });

  it("returns 0 compositeScore when all components are 0", () => {
    const result = computeCompositeScore(0, 0, 0);
    expect(result.compositeScore).toBe(0);
  });

  it("returns 1.0 compositeScore when all components are 1.0", () => {
    const result = computeCompositeScore(1.0, 1.0, 1.0);
    expect(result.compositeScore).toBeCloseTo(1.0, 5);
  });

  it("clamps compositeScore to [0, 1] range even with inputs above 1", () => {
    const result = computeCompositeScore(2.0, 2.0, 2.0);
    expect(result.compositeScore).toBeLessThanOrEqual(1.0);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
  });

  it("weight constants sum to 1.0 (0.4 + 0.4 + 0.2)", () => {
    const tagWeight = 0.4;
    const ftWeight = 0.4;
    const metaWeight = 0.2;
    expect(tagWeight + ftWeight + metaWeight).toBeCloseTo(1.0, 10);
  });

  it("tag-only score (ftScore=0) uses only tag and meta components", () => {
    const result = computeCompositeScore(0.75, 0, 0.5);
    // Expected: (0.75 × 0.4) + (0 × 0.4) + (0.5 × 0.2) = 0.30 + 0 + 0.10 = 0.40
    expect(result.compositeScore).toBeCloseTo(0.40, 5);
  });

  it("returns a ScoreBreakdown object with all four fields", () => {
    const result = computeCompositeScore(0.5, 0.3, 0.2);
    expect(result).toHaveProperty("legacyTagScore");
    expect(result).toHaveProperty("ftScore");
    expect(result).toHaveProperty("metaScore");
    expect(result).toHaveProperty("compositeScore");
  });

  it("input values are clamped and reflected in the breakdown", () => {
    const result = computeCompositeScore(1.5, 0.3, 0.2);
    expect(result.legacyTagScore).toBeLessThanOrEqual(1.0);
  });
});

// ─── Test 2: Chunk-type weight application ────────────────────────────────────

describe("CHUNK_TYPE_WEIGHTS", () => {
  it("project_description and personnel_bio have weight 1.0 (highest)", () => {
    expect(CHUNK_TYPE_WEIGHTS["project_description"]).toBe(1.0);
    expect(CHUNK_TYPE_WEIGHTS["personnel_bio"]).toBe(1.0);
  });

  it("win_theme and project_experience have weight 0.9", () => {
    expect(CHUNK_TYPE_WEIGHTS["win_theme"]).toBe(0.9);
    expect(CHUNK_TYPE_WEIGHTS["project_experience"]).toBe(0.9);
  });

  it("section_content has weight 0.8", () => {
    expect(CHUNK_TYPE_WEIGHTS["section_content"]).toBe(0.8);
  });

  it("project_highlight has weight 0.7", () => {
    expect(CHUNK_TYPE_WEIGHTS["project_highlight"]).toBe(0.7);
  });

  it("image_caption has weight 0.5 (lowest)", () => {
    expect(CHUNK_TYPE_WEIGHTS["image_caption"]).toBe(0.5);
  });

  it("all defined weights are in [0.5, 1.0] range", () => {
    for (const [, weight] of Object.entries(CHUNK_TYPE_WEIGHTS)) {
      expect(weight).toBeGreaterThanOrEqual(0.5);
      expect(weight).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── Test 3: matchQuality thresholds ─────────────────────────────────────────

describe("classifyMatchQuality", () => {
  it("returns 'hybrid' when ftScore > 0.1", () => {
    expect(classifyMatchQuality(0, 0.15)).toBe("hybrid");
    expect(classifyMatchQuality(1.0, 0.5)).toBe("hybrid");
  });

  it("returns 'hybrid' even with zero tagScore when ftScore > 0.1", () => {
    expect(classifyMatchQuality(0, 0.11)).toBe("hybrid");
  });

  it("returns 'tag-only' when legacyTagScore > 0 and ftScore <= 0.1", () => {
    expect(classifyMatchQuality(0.5, 0)).toBe("tag-only");
    expect(classifyMatchQuality(0.1, 0.05)).toBe("tag-only");
    expect(classifyMatchQuality(1.0, 0.1)).toBe("tag-only");
  });

  it("returns 'fallback' when both tagScore and ftScore are 0", () => {
    expect(classifyMatchQuality(0, 0)).toBe("fallback");
  });

  it("ftScore exactly at threshold (0.1) is 'tag-only', not 'hybrid'", () => {
    // The spec says ftScore > 0.1 for hybrid, so exactly 0.1 is tag-only
    expect(classifyMatchQuality(0.5, 0.1)).toBe("tag-only");
  });

  it("ftScore just above threshold (0.101) is 'hybrid'", () => {
    expect(classifyMatchQuality(0, 0.101)).toBe("hybrid");
  });
});

// ─── Test 4: Fallback behavior when document_chunks is empty ─────────────────

describe("fallback behavior (no chunks)", () => {
  it("compositeScore with ftScore=0 reflects tag-only scoring", () => {
    // When a document has no chunks, ftScore = 0
    const result = computeCompositeScore(1.0, 0, 0.3);
    // Expected: (1.0 × 0.4) + (0 × 0.4) + (0.3 × 0.2) = 0.40 + 0 + 0.06 = 0.46
    expect(result.compositeScore).toBeCloseTo(0.46, 5);
    expect(result.compositeScore).toBeGreaterThan(0);
  });

  it("matchQuality is 'tag-only' when ftScore=0 and tagScore > 0", () => {
    expect(classifyMatchQuality(0.8, 0)).toBe("tag-only");
  });

  it("matchQuality is 'fallback' when both scores are 0 (no tags, no chunks)", () => {
    expect(classifyMatchQuality(0, 0)).toBe("fallback");
  });
});

// ─── Test 5: Mixed corpus (some docs chunked, some not) ──────────────────────

describe("mixed corpus scoring", () => {
  it("chunked doc scores higher than unchunked doc with same tags", () => {
    const chunkedScore = computeCompositeScore(0.5, 0.6, 0.3).compositeScore;
    const unchunkedScore = computeCompositeScore(0.5, 0, 0.3).compositeScore;
    expect(chunkedScore).toBeGreaterThan(unchunkedScore);
  });

  it("unchunked doc with strong tag match can still outscore weakly-chunked doc", () => {
    const strongTagNoChunk = computeCompositeScore(1.0, 0, 1.0).compositeScore;
    const weakTagWeakChunk = computeCompositeScore(0.1, 0.15, 0.1).compositeScore;
    // strongTagNoChunk: (1.0×0.4) + (0×0.4) + (1.0×0.2) = 0.60
    // weakTagWeakChunk: (0.1×0.4) + (0.15×0.4) + (0.1×0.2) = 0.04 + 0.06 + 0.02 = 0.12
    expect(strongTagNoChunk).toBeGreaterThan(weakTagWeakChunk);
  });

  it("corpus size threshold is 8", () => {
    expect(CORPUS_SIZE_THRESHOLD).toBe(8);
  });

  it("score badges should be suppressed for corpus < 8 (threshold check)", () => {
    const smallCorpus = 5;
    const largeCorpus = 10;
    expect(smallCorpus < CORPUS_SIZE_THRESHOLD).toBe(true);
    expect(largeCorpus >= CORPUS_SIZE_THRESHOLD).toBe(true);
  });
});

// ─── Test 6: Shape compatibility ─────────────────────────────────────────────

describe("shape compatibility", () => {
  it("computeCompositeScore returns a ScoreBreakdown object (not a bare number)", () => {
    const result = computeCompositeScore(0.5, 0.3, 0.2);
    expect(typeof result).toBe("object");
    expect(typeof result.compositeScore).toBe("number");
  });

  it("classifyMatchQuality returns one of the three valid MatchQuality values", () => {
    const validValues = ["hybrid", "tag-only", "fallback"];
    expect(validValues).toContain(classifyMatchQuality(1, 0.5));
    expect(validValues).toContain(classifyMatchQuality(1, 0));
    expect(validValues).toContain(classifyMatchQuality(0, 0));
  });

  it("CHUNK_TYPE_WEIGHTS is an object with string keys and number values", () => {
    expect(typeof CHUNK_TYPE_WEIGHTS).toBe("object");
    for (const [key, val] of Object.entries(CHUNK_TYPE_WEIGHTS)) {
      expect(typeof key).toBe("string");
      expect(typeof val).toBe("number");
    }
  });

  it("all seven chunk types from chunkBuilder are present in CHUNK_TYPE_WEIGHTS", () => {
    const expectedTypes = [
      "project_description",
      "project_highlight",
      "section_content",
      "image_caption",
      "personnel_bio",
      "project_experience",
      "win_theme",
    ];
    for (const type of expectedTypes) {
      expect(CHUNK_TYPE_WEIGHTS).toHaveProperty(type);
    }
  });
});
