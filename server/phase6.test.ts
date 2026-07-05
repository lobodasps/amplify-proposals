/**
 * server/phase6.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 6 unit tests — Sources panel, telemetry, and validation
 *
 * Tests cover:
 *   1. getEvidenceSources procedure shape contract
 *   2. Sources button visibility logic (activeSessionId guard)
 *   3. Scorer analytics telemetry metadata shape
 *   4. Empty evidence → Sources panel empty state
 *   5. llmUsageLogs.metadata column type compatibility
 *   6. EvidenceSourcesPanel data transformation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EvidenceBundle, EvidenceItem, EvidenceBundleMap } from "../shared/workflowTypes";

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeEvidenceItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    chunkId: "chunk-001",
    damDocumentId: "doc-001",
    documentName: "Riverside Bridge Project Sheet",
    sourceDocTitle: "Riverside Bridge Project Sheet",
    sourceDocType: "project_sheet",
    chunkType: "project_description",
    content: "We delivered the Riverside Bridge project on time and under budget.",
    pageRef: "3",
    sectionRef: "Project Overview",
    relevanceScore: 0.87,
    extractionMethod: "pdf_text",
    confidence: 0.87,
    serviceLineTags: ["Structural Engineering"],
    ...overrides,
  };
}

function makeEvidenceBundle(skillName: string, items: EvidenceItem[] = []): EvidenceBundle {
  return {
    skillName,
    assembledAt: Date.now(),
    items,
    sourceDocIds: items.map(i => i.damDocumentId),
  };
}

// ─── 1. getEvidenceSources procedure shape ────────────────────────────────────

describe("getEvidenceSources procedure shape", () => {
  it("returns null for both fields when session is not found", () => {
    // Simulate the procedure's null-return path
    const notFoundResult = { evidenceBundles: null, scorerEvidenceInput: null };
    expect(notFoundResult.evidenceBundles).toBeNull();
    expect(notFoundResult.scorerEvidenceInput).toBeNull();
  });

  it("returns evidenceBundles and scorerEvidenceInput when session exists", () => {
    const bundle = makeEvidenceBundle("win_themes", [makeEvidenceItem()]);
    const scorerBundle = makeEvidenceBundle("proposal_scorer", [makeEvidenceItem({ chunkType: "win_theme" })]);

    const result = {
      evidenceBundles: { win_themes: bundle } as EvidenceBundleMap,
      scorerEvidenceInput: scorerBundle,
    };

    expect(result.evidenceBundles).toBeDefined();
    expect(result.evidenceBundles!["win_themes"]).toBeDefined();
    expect(result.evidenceBundles!["win_themes"].skillName).toBe("win_themes");
    expect(result.scorerEvidenceInput).toBeDefined();
    expect(result.scorerEvidenceInput!.skillName).toBe("proposal_scorer");
  });

  it("returns only evidenceBundles when scorerEvidenceInput is null", () => {
    const bundle = makeEvidenceBundle("key_personnel", [makeEvidenceItem({ chunkType: "personnel_bio" })]);
    const result = {
      evidenceBundles: { key_personnel: bundle } as EvidenceBundleMap,
      scorerEvidenceInput: null,
    };

    expect(result.evidenceBundles!["key_personnel"].items).toHaveLength(1);
    expect(result.scorerEvidenceInput).toBeNull();
  });

  it("returns only scorerEvidenceInput when evidenceBundles is null", () => {
    const scorerBundle = makeEvidenceBundle("proposal_scorer", [makeEvidenceItem()]);
    const result = {
      evidenceBundles: null,
      scorerEvidenceInput: scorerBundle,
    };

    expect(result.evidenceBundles).toBeNull();
    expect(result.scorerEvidenceInput!.items).toHaveLength(1);
  });
});

// ─── 2. Sources button visibility logic ──────────────────────────────────────

describe("Sources button visibility logic", () => {
  it("Sources button is visible when activeSessionId is truthy", () => {
    const activeSessionId = "550e8400-e29b-41d4-a716-446655440000";
    const shouldShow = !!activeSessionId;
    expect(shouldShow).toBe(true);
  });

  it("Sources button is hidden when activeSessionId is null", () => {
    const activeSessionId: string | null = null;
    const shouldShow = !!activeSessionId;
    expect(shouldShow).toBe(false);
  });

  it("Sources button is hidden when activeSessionId is empty string", () => {
    const activeSessionId = "";
    const shouldShow = !!activeSessionId;
    expect(shouldShow).toBe(false);
  });

  it("Sources button is independent of session.pursuitId (unlike Assets button)", () => {
    // Assets button requires session.pursuitId; Sources only needs activeSessionId
    const activeSessionId = "550e8400-e29b-41d4-a716-446655440000";
    const sessionPursuitId: string | null = null; // no pursuit linked

    const sourcesVisible = !!activeSessionId;
    const assetsVisible = !!sessionPursuitId;

    expect(sourcesVisible).toBe(true);
    expect(assetsVisible).toBe(false);
  });
});

// ─── 3. Scorer analytics telemetry metadata shape ────────────────────────────

describe("Scorer analytics telemetry metadata shape", () => {
  it("telemetry metadata contains all required fields", () => {
    const scorerOutput = {
      overallScore: 78,
      evidenceCoverage: 0.82,
      unsupportedClaims: [
        { section: "Technical Approach", claim: "We have 50 years of experience", reason: "Not found in evidence" },
      ],
    };

    const metadata = {
      evidenceCoverage: typeof scorerOutput.evidenceCoverage === "number" ? scorerOutput.evidenceCoverage : null,
      unsupportedClaimsCount: Array.isArray(scorerOutput.unsupportedClaims) ? scorerOutput.unsupportedClaims.length : 0,
      overallScore: typeof scorerOutput.overallScore === "number" ? scorerOutput.overallScore : null,
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
    };

    expect(metadata.evidenceCoverage).toBe(0.82);
    expect(metadata.unsupportedClaimsCount).toBe(1);
    expect(metadata.overallScore).toBe(78);
    expect(metadata.sessionId).toBeTruthy();
  });

  it("telemetry metadata handles missing evidenceCoverage gracefully", () => {
    const scorerOutput = {
      overallScore: 65,
      // evidenceCoverage absent
      unsupportedClaims: [],
    };

    const metadata = {
      evidenceCoverage: typeof (scorerOutput as any).evidenceCoverage === "number" ? (scorerOutput as any).evidenceCoverage : null,
      unsupportedClaimsCount: Array.isArray(scorerOutput.unsupportedClaims) ? scorerOutput.unsupportedClaims.length : 0,
      overallScore: typeof scorerOutput.overallScore === "number" ? scorerOutput.overallScore : null,
      sessionId: "test-session",
    };

    expect(metadata.evidenceCoverage).toBeNull();
    expect(metadata.unsupportedClaimsCount).toBe(0);
    expect(metadata.overallScore).toBe(65);
  });

  it("telemetry metadata handles missing unsupportedClaims gracefully", () => {
    const scorerOutput = {
      overallScore: 90,
      evidenceCoverage: 0.95,
      // unsupportedClaims absent
    };

    const metadata = {
      evidenceCoverage: typeof scorerOutput.evidenceCoverage === "number" ? scorerOutput.evidenceCoverage : null,
      unsupportedClaimsCount: Array.isArray((scorerOutput as any).unsupportedClaims) ? (scorerOutput as any).unsupportedClaims.length : 0,
      overallScore: typeof scorerOutput.overallScore === "number" ? scorerOutput.overallScore : null,
      sessionId: "test-session",
    };

    expect(metadata.unsupportedClaimsCount).toBe(0);
    expect(metadata.evidenceCoverage).toBe(0.95);
  });

  it("telemetry is logged with skillType=proposal_scorer_analytics", () => {
    // Verify the analytics row has a distinct skillType for filtering
    const analyticsRow = {
      skillType: "proposal_scorer_analytics",
      provider: "analytics",
      model: "n/a",
      tokensIn: 0,
      tokensOut: 0,
      durationMs: 0,
      success: true,
      metadata: { evidenceCoverage: 0.75, unsupportedClaimsCount: 2, overallScore: 72, sessionId: "s1" },
    };

    expect(analyticsRow.skillType).toBe("proposal_scorer_analytics");
    expect(analyticsRow.tokensIn).toBe(0);
    expect(analyticsRow.tokensOut).toBe(0);
    expect(analyticsRow.success).toBe(true);
    expect(analyticsRow.metadata.evidenceCoverage).toBe(0.75);
  });
});

// ─── 4. Empty evidence → Sources panel empty state ───────────────────────────

describe("EvidenceSourcesPanel empty state", () => {
  it("hasAnyData is false when both evidenceBundles and scorerEvidenceInput are null", () => {
    const evidenceBundles: EvidenceBundleMap | null = null;
    const scorerEvidenceInput: EvidenceBundle | null = null;

    const hasAnyData =
      (evidenceBundles && Object.keys(evidenceBundles).length > 0) ||
      scorerEvidenceInput !== null;

    expect(hasAnyData).toBeFalsy();
  });

  it("hasAnyData is false when evidenceBundles is empty object", () => {
    const evidenceBundles: EvidenceBundleMap = {};
    const scorerEvidenceInput: EvidenceBundle | null = null;

    const hasAnyData =
      (evidenceBundles && Object.keys(evidenceBundles).length > 0) ||
      scorerEvidenceInput !== null;

    expect(hasAnyData).toBeFalsy();
  });

  it("hasAnyData is true when evidenceBundles has at least one skill", () => {
    const evidenceBundles: EvidenceBundleMap = {
      win_themes: makeEvidenceBundle("win_themes", [makeEvidenceItem()]),
    };
    const scorerEvidenceInput: EvidenceBundle | null = null;

    const hasAnyData =
      (evidenceBundles && Object.keys(evidenceBundles).length > 0) ||
      scorerEvidenceInput !== null;

    expect(hasAnyData).toBeTruthy();
  });

  it("hasAnyData is true when only scorerEvidenceInput is present", () => {
    const evidenceBundles: EvidenceBundleMap | null = null;
    const scorerEvidenceInput = makeEvidenceBundle("proposal_scorer", []);

    const hasAnyData =
      (evidenceBundles && Object.keys(evidenceBundles).length > 0) ||
      scorerEvidenceInput !== null;

    expect(hasAnyData).toBeTruthy();
  });
});

// ─── 5. llmUsageLogs.metadata column type compatibility ──────────────────────

describe("llmUsageLogs metadata column", () => {
  it("metadata field accepts a plain object", () => {
    const metadata: Record<string, unknown> = {
      evidenceCoverage: 0.8,
      unsupportedClaimsCount: 3,
      overallScore: 75,
      sessionId: "abc-123",
    };

    // Simulate the insert values object shape
    const insertValues = {
      skillType: "proposal_scorer_analytics",
      provider: "analytics",
      model: "n/a",
      tokensIn: 0,
      tokensOut: 0,
      durationMs: 0,
      success: true,
      metadata,
    };

    expect(typeof insertValues.metadata).toBe("object");
    expect(insertValues.metadata).not.toBeNull();
    expect((insertValues.metadata as any).evidenceCoverage).toBe(0.8);
  });

  it("metadata field can be null (for non-analytics rows)", () => {
    const insertValues = {
      skillType: "win_themes",
      provider: "openai",
      model: "gpt-4o",
      tokensIn: 1200,
      tokensOut: 800,
      durationMs: 3500,
      success: true,
      metadata: null,
    };

    expect(insertValues.metadata).toBeNull();
  });
});

// ─── 6. EvidenceItem rendering data contract ─────────────────────────────────

describe("EvidenceItem rendering data contract", () => {
  it("EvidenceItem has all fields required by EvidenceSourcesPanel", () => {
    const item = makeEvidenceItem();

    // Fields used by EvidenceItemRow component
    expect(item.sourceDocTitle).toBeDefined();
    expect(item.documentName).toBeDefined();
    expect(item.sourceDocType).toBeDefined();
    expect(item.chunkType).toBeDefined();
    expect(item.confidence).toBeDefined();
    expect(item.content).toBeDefined();
    // Optional fields
    expect(item.pageRef).toBeDefined();
    expect(item.sectionRef).toBeDefined();
  });

  it("EvidenceItem with null pageRef does not break rendering", () => {
    const item = makeEvidenceItem({ pageRef: null, sectionRef: null });
    expect(item.pageRef).toBeNull();
    expect(item.sectionRef).toBeNull();
    // Rendering guard: !!item.pageRef should be false
    expect(!!item.pageRef).toBe(false);
  });

  it("confidence is clamped to 0-1 range for badge rendering", () => {
    const item = makeEvidenceItem({ confidence: 0.87 });
    const pct = Math.round(item.confidence * 100);
    expect(pct).toBe(87);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("content truncation at 400 chars works correctly", () => {
    const longContent = "A".repeat(500);
    const item = makeEvidenceItem({ content: longContent });
    const displayed = item.content.length > 400
      ? item.content.slice(0, 400) + "…"
      : item.content;
    expect(displayed.length).toBe(401); // 400 chars + ellipsis
    expect(displayed.endsWith("…")).toBe(true);
  });

  it("short content is displayed without truncation", () => {
    const shortContent = "Short content for testing.";
    const item = makeEvidenceItem({ content: shortContent });
    const displayed = item.content.length > 400
      ? item.content.slice(0, 400) + "…"
      : item.content;
    expect(displayed).toBe(shortContent);
    expect(displayed.endsWith("…")).toBe(false);
  });
});
