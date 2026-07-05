/**
 * server/evidenceBundleBuilder.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for Phase 4 — Evidence Bundle Assembly
 *
 * Tests cover:
 *  1. Empty-bundle fallback (docIds=[] or no matching chunks)
 *  2. Skill-specific chunk type priority and source-type caps
 *  3. Relevance scoring and ordering
 *  4. Service line boost
 *  5. Confidence threshold filtering
 *  6. formatEvidenceContext output structure
 *  7. Non-blocking error handling (DB failure → empty bundle)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
// We mock getDb so tests run without a real database connection.

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

// Build a chainable mock query builder
function makeQueryChain(result: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    // For queries without .limit()
    then: undefined as unknown,
  };
  // Allow awaiting the chain directly (without .limit())
  (chain as unknown as Promise<unknown[]>)[Symbol.toStringTag] = "Promise";
  return chain;
}

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const MOCK_DOC_PROJECT: Record<string, unknown> = {
  id: "doc-proj-1",
  docType: "project_sheet",
  title: "Bridge Inspection Project",
  projectName: "Route 9 Bridge Inspection",
  clientName: "NJDOT",
  tags: "Special Inspections, Structural",
};

const MOCK_DOC_RESUME: Record<string, unknown> = {
  id: "doc-resume-1",
  docType: "resume",
  title: "John Smith Resume",
  projectName: null,
  clientName: null,
  tags: "Structural Engineering",
};

const MOCK_DOC_PROPOSAL: Record<string, unknown> = {
  id: "doc-proposal-1",
  docType: "past_proposal",
  title: "NJDOT Bridge Inspection Proposal 2023",
  projectName: "NJDOT Bridge Inspection Proposal 2023",
  clientName: "NJDOT",
  tags: "Special Inspections",
};

function makeChunk(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "chunk-1",
    damDocumentId: "doc-proj-1",
    chunkType: "project_description",
    content: "We performed comprehensive bridge inspections for NJDOT.",
    pageRef: "2",
    sectionRef: "Project Overview",
    confidence: 0.9,
    extractionMethod: "pdf_parse",
    metadata: null,
    serviceLineTags: ["Special Inspections"],
    ...overrides,
  };
}

// ─── Mock setup helper ────────────────────────────────────────────────────────

type MockDbSetup = {
  chunks: Record<string, unknown>[];
  docs: Record<string, unknown>[];
};

function setupMockDb({ chunks, docs }: MockDbSetup) {
  // We need to intercept the two DB calls in buildEvidenceBundle:
  // 1. documentChunks query → returns chunks
  // 2. damDocuments query → returns docs
  let callCount = 0;
  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          // First call = chunks query, second call = docs query
          return Promise.resolve(callCount === 1 ? chunks : docs);
        }),
      })),
    })),
  };
  return mockDb;
}

// ─── Import the module under test (after mocking) ────────────────────────────

// We need to mock the db module before importing the module under test
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Also mock the schema imports used in evidenceBundleBuilder
vi.mock("../drizzle/schema", () => ({
  documentChunks: { id: "id", damDocumentId: "damDocumentId", chunkType: "chunkType", content: "content", pageRef: "pageRef", sectionRef: "sectionRef", confidence: "confidence", extractionMethod: "extractionMethod", metadata: "metadata", serviceLineTags: "serviceLineTags" },
  damDocuments: { id: "id", docType: "docType", title: "title", projectName: "projectName", clientName: "clientName", tags: "tags" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  inArray: vi.fn((col, vals) => ({ inArray: [col, vals] })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings.join("?"), values })),
}));

import { getDb } from "./db";
import { buildEvidenceBundle } from "./evidenceBundleBuilder";

const mockGetDb = vi.mocked(getDb);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildEvidenceBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Empty-bundle fallback ──────────────────────────────────────────────

  describe("empty-bundle fallback", () => {
    it("returns empty bundle when docIds is empty array", async () => {
      const result = await buildEvidenceBundle([], "win_themes", []);

      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.bundle.items).toHaveLength(0);
      expect(result.evidenceContext).toBe("");
      expect(result.bundle.skillName).toBe("win_themes");
      expect(result.bundle.sourceDocIds).toEqual([]);
      // getDb should never be called when docIds is empty
      expect(mockGetDb).not.toHaveBeenCalled();
    });

    it("returns empty bundle when DB is unavailable (getDb returns null)", async () => {
      mockGetDb.mockResolvedValue(null as never);

      const result = await buildEvidenceBundle(["doc-1"], "win_themes", []);

      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.bundle.items).toHaveLength(0);
      expect(result.evidenceContext).toBe("");
    });

    it("returns empty bundle when no chunks exist for the given docIds", async () => {
      const mockDb = setupMockDb({ chunks: [], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.bundle.items).toHaveLength(0);
      expect(result.evidenceContext).toBe("");
    });

    it("returns empty bundle when DB throws (non-blocking fallback)", async () => {
      mockGetDb.mockRejectedValue(new Error("DB connection failed"));

      // Should not throw — returns empty bundle
      const result = await buildEvidenceBundle(["doc-1"], "win_themes", []);

      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.bundle.items).toHaveLength(0);
    });

    it("preserves skillName and sourceDocIds in empty bundle", async () => {
      const result = await buildEvidenceBundle([], "key_personnel", []);

      expect(result.bundle.skillName).toBe("key_personnel");
      expect(result.bundle.sourceDocIds).toEqual([]);
    });
  });

  // ── 2. Confidence threshold filtering ────────────────────────────────────

  describe("confidence threshold filtering", () => {
    it("excludes chunks below minimum confidence (0.7)", async () => {
      const lowConfChunk = makeChunk({ id: "chunk-low", confidence: 0.5 });
      const highConfChunk = makeChunk({ id: "chunk-high", confidence: 0.9 });
      const mockDb = setupMockDb({
        chunks: [lowConfChunk, highConfChunk],
        docs: [MOCK_DOC_PROJECT],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.bundle.items).toHaveLength(1);
      expect(result.bundle.items[0].chunkId).toBe("chunk-high");
    });

    it("excludes chunks with chunkType not in skill priority list", async () => {
      // "image_caption" is not in win_themes priority list
      const irrelevantChunk = makeChunk({ id: "chunk-img", chunkType: "image_caption" });
      const relevantChunk = makeChunk({ id: "chunk-desc", chunkType: "project_description" });
      const mockDb = setupMockDb({
        chunks: [irrelevantChunk, relevantChunk],
        docs: [MOCK_DOC_PROJECT],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.bundle.items).toHaveLength(1);
      expect(result.bundle.items[0].chunkId).toBe("chunk-desc");
    });
  });

  // ── 3. Skill-specific chunk type priority ─────────────────────────────────

  describe("skill-specific chunk type priority", () => {
    it("win_themes: includes win_theme and project_description chunks", async () => {
      const winThemeChunk = makeChunk({ id: "chunk-wt", chunkType: "win_theme", confidence: 0.95 });
      const descChunk = makeChunk({ id: "chunk-desc", chunkType: "project_description", confidence: 0.85 });
      const mockDb = setupMockDb({
        chunks: [descChunk, winThemeChunk],
        docs: [MOCK_DOC_PROJECT],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.bundle.items.length).toBeGreaterThanOrEqual(2);
      const types = result.bundle.items.map((i) => i.chunkType);
      expect(types).toContain("win_theme");
      expect(types).toContain("project_description");
    });

    it("key_personnel: includes personnel_bio chunks", async () => {
      const bioChunk = makeChunk({
        id: "chunk-bio",
        damDocumentId: "doc-resume-1",
        chunkType: "personnel_bio",
        confidence: 0.9,
      });
      const mockDb = setupMockDb({
        chunks: [bioChunk],
        docs: [MOCK_DOC_RESUME],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-resume-1"], "key_personnel", []);

      expect(result.hasSufficientEvidence).toBe(true);
      expect(result.bundle.items[0].chunkType).toBe("personnel_bio");
    });

    it("past_performance: includes project_description and project_highlight chunks", async () => {
      const descChunk = makeChunk({ id: "chunk-desc", chunkType: "project_description", confidence: 0.9 });
      const highlightChunk = makeChunk({ id: "chunk-hl", chunkType: "project_highlight", confidence: 0.85 });
      const mockDb = setupMockDb({
        chunks: [descChunk, highlightChunk],
        docs: [MOCK_DOC_PROJECT],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "past_performance", []);

      expect(result.hasSufficientEvidence).toBe(true);
      const types = result.bundle.items.map((i) => i.chunkType);
      expect(types).toContain("project_description");
      expect(types).toContain("project_highlight");
    });

    it("technical_writer: excludes personnel_bio (not in priority list)", async () => {
      const bioChunk = makeChunk({ id: "chunk-bio", chunkType: "personnel_bio", confidence: 0.9 });
      const descChunk = makeChunk({ id: "chunk-desc", chunkType: "project_description", confidence: 0.9 });
      const mockDb = setupMockDb({
        chunks: [bioChunk, descChunk],
        docs: [MOCK_DOC_PROJECT],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "technical_writer", []);

      const types = result.bundle.items.map((i) => i.chunkType);
      expect(types).not.toContain("personnel_bio");
      expect(types).toContain("project_description");
    });
  });

  // ── 4. Source-type caps ───────────────────────────────────────────────────

  describe("source-type caps", () => {
    it("win_themes: caps project_sheet at 6 items", async () => {
      // Create 10 project_sheet chunks — only 6 should be included
      const chunks = Array.from({ length: 10 }, (_, i) =>
        makeChunk({
          id: `chunk-${i}`,
          chunkType: "project_description",
          confidence: 0.9 - i * 0.01,
        })
      );
      const mockDb = setupMockDb({ chunks, docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      // project_sheet cap for win_themes is 6
      const projSheetItems = result.bundle.items.filter((i) => i.sourceDocType === "project_sheet");
      expect(projSheetItems.length).toBeLessThanOrEqual(6);
    });

    it("key_personnel: caps resume at 10 items", async () => {
      const chunks = Array.from({ length: 15 }, (_, i) =>
        makeChunk({
          id: `chunk-${i}`,
          damDocumentId: "doc-resume-1",
          chunkType: "personnel_bio",
          confidence: 0.9,
        })
      );
      const mockDb = setupMockDb({ chunks, docs: [MOCK_DOC_RESUME] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-resume-1"], "key_personnel", []);

      const resumeItems = result.bundle.items.filter((i) => i.sourceDocType === "resume");
      expect(resumeItems.length).toBeLessThanOrEqual(10);
    });

    it("respects totalCap across all source types", async () => {
      // Create many chunks from multiple sources
      const projChunks = Array.from({ length: 8 }, (_, i) =>
        makeChunk({ id: `proj-${i}`, chunkType: "project_description", confidence: 0.9 })
      );
      const resumeChunks = Array.from({ length: 8 }, (_, i) =>
        makeChunk({
          id: `resume-${i}`,
          damDocumentId: "doc-resume-1",
          chunkType: "personnel_bio",
          confidence: 0.9,
        })
      );
      const mockDb = setupMockDb({
        chunks: [...projChunks, ...resumeChunks],
        docs: [MOCK_DOC_PROJECT, MOCK_DOC_RESUME],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(
        ["doc-proj-1", "doc-resume-1"],
        "win_themes",
        []
      );

      // win_themes totalCap is 12
      expect(result.bundle.items.length).toBeLessThanOrEqual(12);
    });
  });

  // ── 5. EvidenceItem provenance fields ─────────────────────────────────────

  describe("EvidenceItem provenance", () => {
    it("populates all required EvidenceItem fields", async () => {
      const chunk = makeChunk({
        id: "chunk-1",
        damDocumentId: "doc-proj-1",
        chunkType: "project_description",
        content: "We performed bridge inspections.",
        pageRef: "3",
        sectionRef: "Overview",
        confidence: 0.92,
        extractionMethod: "pdf_parse",
      });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.bundle.items).toHaveLength(1);
      const item = result.bundle.items[0];
      expect(item.chunkId).toBe("chunk-1");
      expect(item.damDocumentId).toBe("doc-proj-1");
      expect(item.chunkType).toBe("project_description");
      expect(item.content).toBe("We performed bridge inspections.");
      expect(item.pageRef).toBe("3");
      expect(item.sectionRef).toBe("Overview");
      expect(item.confidence).toBeCloseTo(0.92, 2);
      expect(item.extractionMethod).toBe("pdf_parse");
      expect(item.sourceDocType).toBe("project_sheet");
      expect(item.sourceDocTitle).toBe("Route 9 Bridge Inspection");
      expect(typeof item.relevanceScore).toBe("number");
      expect(item.relevanceScore).toBeGreaterThan(0);
      expect(item.relevanceScore).toBeLessThanOrEqual(1);
    });

    it("handles null pageRef gracefully", async () => {
      const chunk = makeChunk({ pageRef: null });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.bundle.items[0].pageRef).toBeNull();
    });

    it("uses projectName as sourceDocTitle when available", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      // MOCK_DOC_PROJECT has projectName = "Route 9 Bridge Inspection"
      expect(result.bundle.items[0].sourceDocTitle).toBe("Route 9 Bridge Inspection");
    });

    it("falls back to title when projectName is null", async () => {
      const chunk = makeChunk({ damDocumentId: "doc-resume-1", chunkType: "personnel_bio" });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_RESUME] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-resume-1"], "key_personnel", []);

      // MOCK_DOC_RESUME has no projectName, title = "John Smith Resume"
      expect(result.bundle.items[0].sourceDocTitle).toBe("John Smith Resume");
    });
  });

  // ── 6. Service line relevance boost ──────────────────────────────────────

  describe("service line relevance boost", () => {
    it("ranks chunks with matching service line tags higher", async () => {
      // Use two different docs so docTags don't contaminate the boost:
      // doc-proj-1 has tags "Special Inspections, Structural" (would boost both chunks)
      // Use a neutral doc for the non-matching chunk
      const NEUTRAL_DOC = {
        id: "doc-neutral-1",
        docType: "project_sheet",
        title: "Landscape Architecture Project",
        projectName: "Streetscape Redesign",
        clientName: "City of Newark",
        tags: "Landscape Architecture",
      };
      const matchingChunk = makeChunk({
        id: "chunk-match",
        damDocumentId: "doc-proj-1",
        chunkType: "project_description",
        confidence: 0.9,
        serviceLineTags: ["Special Inspections"],
      });
      const nonMatchingChunk = makeChunk({
        id: "chunk-nomatch",
        damDocumentId: "doc-neutral-1",
        chunkType: "project_description",
        confidence: 0.9,
        serviceLineTags: ["Landscape Architecture"],
      });
      const mockDb = setupMockDb({
        chunks: [nonMatchingChunk, matchingChunk],
        docs: [MOCK_DOC_PROJECT, NEUTRAL_DOC],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(
        ["doc-proj-1", "doc-neutral-1"],
        "win_themes",
        ["Special Inspections"]
      );

      // The matching chunk should appear first (higher relevance score from service line boost)
      expect(result.bundle.items[0].chunkId).toBe("chunk-match");
    });
  });

  // ── 7. evidenceContext string format ──────────────────────────────────────

  describe("evidenceContext format", () => {
    it("returns empty string when no evidence items", async () => {
      const result = await buildEvidenceBundle([], "win_themes", []);
      expect(result.evidenceContext).toBe("");
    });

    it("includes skill name header in evidenceContext", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.evidenceContext).toContain("win_themes");
      expect(result.evidenceContext).toContain("EVIDENCE BUNDLE");
    });

    it("includes source document type and title in evidenceContext", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.evidenceContext).toContain("PROJECT_SHEET");
      expect(result.evidenceContext).toContain("Route 9 Bridge Inspection");
    });

    it("includes chunk content in evidenceContext", async () => {
      const chunk = makeChunk({ content: "We performed comprehensive bridge inspections for NJDOT." });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.evidenceContext).toContain("We performed comprehensive bridge inspections for NJDOT.");
    });

    it("includes page reference when available", async () => {
      const chunk = makeChunk({ pageRef: "5" });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.evidenceContext).toContain("p.5");
    });

    it("includes END EVIDENCE BUNDLE footer", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.evidenceContext).toContain("END EVIDENCE BUNDLE");
    });
  });

  // ── 8. EvidenceBundle metadata ────────────────────────────────────────────

  describe("EvidenceBundle metadata", () => {
    it("sets assembledAt as a Unix timestamp (number)", async () => {
      const before = Date.now();
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);
      const after = Date.now();

      expect(typeof result.bundle.assembledAt).toBe("number");
      expect(result.bundle.assembledAt).toBeGreaterThanOrEqual(before);
      expect(result.bundle.assembledAt).toBeLessThanOrEqual(after);
    });

    it("sets sourceDocIds to the input docIds", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1", "doc-resume-1"], "win_themes", []);

      expect(result.bundle.sourceDocIds).toEqual(["doc-proj-1", "doc-resume-1"]);
    });

    it("sets skillName correctly", async () => {
      const chunk = makeChunk({ damDocumentId: "doc-resume-1", chunkType: "personnel_bio" });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_RESUME] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-resume-1"], "key_personnel", []);

      expect(result.bundle.skillName).toBe("key_personnel");
    });
  });

  // ── 9. Default config for unknown skills ──────────────────────────────────

  describe("default config for unknown skills", () => {
    it("returns a bundle for an unknown skill name using default config", async () => {
      const chunk = makeChunk({ chunkType: "project_description", confidence: 0.9 });
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      // "fee_estimator" is not in SKILL_EVIDENCE_CONFIGS — uses default
      const result = await buildEvidenceBundle(["doc-proj-1"], "fee_estimator", []);

      // Should not throw; may or may not find chunks depending on default config
      expect(result.bundle.skillName).toBe("fee_estimator");
      expect(Array.isArray(result.bundle.items)).toBe(true);
    });
  });

  // ── 10. Multi-document bundle assembly ────────────────────────────────────

  describe("multi-document bundle assembly", () => {
    it("assembles evidence from multiple document types", async () => {
      const projChunk = makeChunk({
        id: "chunk-proj",
        damDocumentId: "doc-proj-1",
        chunkType: "project_description",
        confidence: 0.9,
      });
      const resumeChunk = makeChunk({
        id: "chunk-resume",
        damDocumentId: "doc-resume-1",
        chunkType: "personnel_bio",
        confidence: 0.9,
      });
      const proposalChunk = makeChunk({
        id: "chunk-proposal",
        damDocumentId: "doc-proposal-1",
        chunkType: "win_theme",
        confidence: 0.9,
      });
      const mockDb = setupMockDb({
        chunks: [projChunk, resumeChunk, proposalChunk],
        docs: [MOCK_DOC_PROJECT, MOCK_DOC_RESUME, MOCK_DOC_PROPOSAL],
      });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(
        ["doc-proj-1", "doc-resume-1", "doc-proposal-1"],
        "win_themes",
        []
      );

      // win_themes priority includes project_description and win_theme but not personnel_bio
      const types = result.bundle.items.map((i) => i.sourceDocType);
      expect(types).toContain("project_sheet");
      expect(types).toContain("past_proposal");
      // resume/personnel_bio is in win_themes priority list (personnel_bio is listed)
    });

    it("hasSufficientEvidence is true when at least one item found", async () => {
      const chunk = makeChunk();
      const mockDb = setupMockDb({ chunks: [chunk], docs: [MOCK_DOC_PROJECT] });
      mockGetDb.mockResolvedValue(mockDb as never);

      const result = await buildEvidenceBundle(["doc-proj-1"], "win_themes", []);

      expect(result.hasSufficientEvidence).toBe(true);
    });
  });
});
