/**
 * chunkBuilder.test.ts
 * Unit tests for the pure buildChunksFromDocument function.
 * No DB, no LLM, no side effects — pure input/output assertions.
 */

import { describe, it, expect } from "vitest";
import { buildChunksFromDocument, type DocumentInput } from "./chunkBuilder";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const doc = (overrides: Partial<DocumentInput> = {}): DocumentInput => ({
  id: "00000000-0000-0000-0000-000000000001",
  docType: "other",
  title: "Test Document",
  ...overrides,
});

const LONG = "A".repeat(100); // meets 80-char narrative minimum
const SHORT = "Too short"; // 9 chars — below 80-char minimum

// ─── No-chunk docTypes ────────────────────────────────────────────────────────

describe("docTypes that produce no chunks", () => {
  it("rfp → empty array", () => {
    const result = buildChunksFromDocument(doc({ docType: "rfp" }), {
      sections: [{ title: "Scope", page: 1, content: LONG }],
    });
    expect(result).toHaveLength(0);
  });

  it("contract → empty array", () => {
    const result = buildChunksFromDocument(doc({ docType: "contract" }), {
      sections: [{ title: "Terms", page: 1, content: LONG }],
    });
    expect(result).toHaveLength(0);
  });

  it("null/undefined meta → empty array", () => {
    expect(buildChunksFromDocument(doc({ docType: "project_sheet" }), null as any)).toHaveLength(0);
    expect(buildChunksFromDocument(doc({ docType: "project_sheet" }), undefined as any)).toHaveLength(0);
  });
});

// ─── project_sheet ────────────────────────────────────────────────────────────

describe("project_sheet", () => {
  const projectDoc = doc({ docType: "project_sheet", projectName: "Bridge Rehab" });

  it("produces project_description from description + summary", () => {
    const result = buildChunksFromDocument(projectDoc, {
      description: LONG,
      summary: "Summary text here.",
    });
    const desc = result.filter((c) => c.chunkType === "project_description");
    expect(desc).toHaveLength(1);
    expect(desc[0].content).toContain(LONG);
    expect(desc[0].content).toContain("Summary text here.");
    expect(desc[0].damDocumentId).toBe(projectDoc.id);
  });

  it("skips project_description when content is below 80-char minimum", () => {
    const result = buildChunksFromDocument(projectDoc, {
      description: SHORT,
      summary: SHORT,
    });
    expect(result.filter((c) => c.chunkType === "project_description")).toHaveLength(0);
  });

  it("produces project_highlight chunks (exempt from 80-char min)", () => {
    const result = buildChunksFromDocument(projectDoc, {
      highlights: ["Short win", "Another short win"],
    });
    const highlights = result.filter((c) => c.chunkType === "project_highlight");
    expect(highlights).toHaveLength(2);
    expect(highlights[0].content).toBe("Short win");
  });

  it("skips blank highlights", () => {
    const result = buildChunksFromDocument(projectDoc, {
      highlights: ["", "  ", "Valid highlight"],
    });
    const highlights = result.filter((c) => c.chunkType === "project_highlight");
    expect(highlights).toHaveLength(1);
    expect(highlights[0].content).toBe("Valid highlight");
  });

  it("produces section_content chunks meeting 80-char min", () => {
    const result = buildChunksFromDocument(projectDoc, {
      sections: [
        { title: "Approach", page: 2, content: LONG },
        { title: "Short", page: 3, content: SHORT },
      ],
    });
    const sections = result.filter((c) => c.chunkType === "section_content");
    expect(sections).toHaveLength(1);
    expect(sections[0].sectionRef).toBe("Approach");
    expect(sections[0].pageRef).toBe("2");
  });

  it("produces image_caption chunks when caption or description is present", () => {
    const result = buildChunksFromDocument(projectDoc, {
      images: [
        { page: 1, caption: "Bridge view", description: "East elevation", imageType: "photo", tags: [] },
        { page: 2, caption: null, description: "Site plan overview", imageType: "site-plan", tags: [] },
        { page: 3, caption: null, description: null, imageType: "other", tags: [] }, // both blank → skip
        { page: 4, caption: "", description: "  ", imageType: "other", tags: [] }, // both blank after trim → skip
      ],
    });
    const captions = result.filter((c) => c.chunkType === "image_caption");
    expect(captions).toHaveLength(2);
    expect(captions[0].confidence).toBe(0.9);
    expect(captions[0].extractionMethod).toBe("llm_vision");
  });

  it("extracts serviceLineTags from serviceLines", () => {
    const result = buildChunksFromDocument(projectDoc, {
      description: LONG,
      serviceLines: ["Traffic Engineering", "Bridge Design"],
    });
    const desc = result.filter((c) => c.chunkType === "project_description");
    expect(desc[0].serviceLineTags).toContain("traffic_engineering");
    expect(desc[0].serviceLineTags).toContain("bridge_design");
  });

  it("is idempotent — calling twice produces identical output", () => {
    const meta = {
      description: LONG,
      highlights: ["Win 1", "Win 2"],
      sections: [{ title: "Approach", page: 1, content: LONG }],
    };
    const first = buildChunksFromDocument(projectDoc, meta);
    const second = buildChunksFromDocument(projectDoc, meta);
    expect(first).toHaveLength(second.length);
    first.forEach((chunk, i) => {
      expect(chunk.content).toBe(second[i].content);
      expect(chunk.chunkType).toBe(second[i].chunkType);
    });
  });
});

// ─── resume ───────────────────────────────────────────────────────────────────

describe("resume", () => {
  const resumeDoc = doc({ docType: "resume", staffName: "Jane Smith" });

  it("produces personnel_bio from summary (80-char min applies)", () => {
    const result = buildChunksFromDocument(resumeDoc, { summary: LONG });
    const bios = result.filter((c) => c.chunkType === "personnel_bio");
    expect(bios).toHaveLength(1);
    // staffName from the doc input is stored in metadata.name
    expect(bios[0].metadata).toMatchObject({ name: "Jane Smith" });
  });

  it("skips personnel_bio when summary is below 80-char min", () => {
    const result = buildChunksFromDocument(resumeDoc, { summary: SHORT });
    expect(result.filter((c) => c.chunkType === "personnel_bio")).toHaveLength(0);
  });

  it("produces project_experience chunks (exempt from 80-char min)", () => {
    const result = buildChunksFromDocument(resumeDoc, {
      projectExperience: ["Bridge Rehab, NYSDOT, 2022", "Short"],
    });
    const exp = result.filter((c) => c.chunkType === "project_experience");
    expect(exp).toHaveLength(2);
  });

  it("skips blank project_experience entries", () => {
    const result = buildChunksFromDocument(resumeDoc, {
      projectExperience: ["", "  ", "Valid project"],
    });
    expect(result.filter((c) => c.chunkType === "project_experience")).toHaveLength(1);
  });
});

// ─── past_proposal ────────────────────────────────────────────────────────────

describe("past_proposal", () => {
  const proposalDoc = doc({ docType: "past_proposal" });

  it("produces win_theme chunks (exempt from 80-char min)", () => {
    const result = buildChunksFromDocument(proposalDoc, {
      winThemes: ["Local presence", "Proven track record"],
    });
    const themes = result.filter((c) => c.chunkType === "win_theme");
    expect(themes).toHaveLength(2);
    expect(themes[0].content).toBe("Local presence");
  });

  it("produces project_description from projectDescription + summary", () => {
    const result = buildChunksFromDocument(proposalDoc, {
      projectDescription: LONG,
      summary: "Summary.",
    });
    const desc = result.filter((c) => c.chunkType === "project_description");
    expect(desc).toHaveLength(1);
    expect(desc[0].content).toContain(LONG);
  });

  it("skips image_caption when both caption and description are blank", () => {
    const result = buildChunksFromDocument(proposalDoc, {
      images: [
        { page: 1, caption: "Has caption", description: null },
        { page: 2, caption: null, description: null },
        { page: 3, caption: "", description: "  " },
      ],
    });
    const captions = result.filter((c) => c.chunkType === "image_caption");
    expect(captions).toHaveLength(1);
    expect(captions[0].content).toBe("Has caption");
  });
});

// ─── boilerplate ──────────────────────────────────────────────────────────────

describe("boilerplate", () => {
  const boilerplateDoc = doc({ docType: "boilerplate" });

  it("produces section_content from sections (80-char min)", () => {
    const result = buildChunksFromDocument(boilerplateDoc, {
      sections: [
        { title: "Firm Overview", page: 1, content: LONG },
        { title: "Too short", page: 2, content: SHORT },
      ],
    });
    const sections = result.filter((c) => c.chunkType === "section_content");
    expect(sections).toHaveLength(1);
  });

  it("falls back to project_description when no sections", () => {
    const result = buildChunksFromDocument(boilerplateDoc, { summary: LONG });
    const desc = result.filter((c) => c.chunkType === "project_description");
    expect(desc).toHaveLength(1);
  });

  it("produces no chunks when sections is empty and summary is too short", () => {
    const result = buildChunksFromDocument(boilerplateDoc, {
      sections: [],
      summary: SHORT,
    });
    expect(result).toHaveLength(0);
  });
});

// ─── certification ────────────────────────────────────────────────────────────

describe("certification", () => {
  it("produces a single section_content chunk", () => {
    const result = buildChunksFromDocument(doc({ docType: "certification" }), {
      certificationName: "PE License",
      issuingAuthority: "NYSED",
      holderName: "John Doe",
      certificationNumber: "123456",
      issueDate: "2020-01-01",
      expirationDate: "2026-01-01",
    });
    expect(result).toHaveLength(1);
    expect(result[0].chunkType).toBe("section_content");
    expect(result[0].content).toContain("PE License");
    expect(result[0].content).toContain("NYSED");
  });

  it("returns empty array when all fields are null/missing", () => {
    const result = buildChunksFromDocument(doc({ docType: "certification" }), {});
    expect(result).toHaveLength(0);
  });
});

// ─── image ────────────────────────────────────────────────────────────────────

describe("image", () => {
  it("produces a single image_caption chunk", () => {
    const result = buildChunksFromDocument(doc({ docType: "image" }), {
      caption: "Aerial view of bridge",
      description: "Looking north from the approach span",
      structureType: "bridge",
      qualityRating: 4,
    });
    expect(result).toHaveLength(1);
    expect(result[0].chunkType).toBe("image_caption");
    expect(result[0].confidence).toBe(0.9);
    expect(result[0].content).toContain("Aerial view of bridge");
    expect(result[0].content).toContain("bridge");
  });

  it("skips when both caption and description are blank", () => {
    const result = buildChunksFromDocument(doc({ docType: "image" }), {
      caption: null,
      description: "  ",
    });
    expect(result).toHaveLength(0);
  });

  it("uses caption alone when description is blank", () => {
    const result = buildChunksFromDocument(doc({ docType: "image" }), {
      caption: "Site overview",
      description: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Site overview");
  });
});

// ─── other ────────────────────────────────────────────────────────────────────

describe("other (generic docType)", () => {
  it("produces section_content at confidence 0.85", () => {
    const result = buildChunksFromDocument(doc({ docType: "other" }), {
      sections: [{ title: "Background", page: 1, content: LONG }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].chunkType).toBe("section_content");
    expect(result[0].confidence).toBe(0.85);
  });

  it("produces no chunks when sections are all below 80-char min", () => {
    const result = buildChunksFromDocument(doc({ docType: "other" }), {
      sections: [
        { title: "A", page: 1, content: SHORT },
        { title: "B", page: 2, content: "" },
      ],
    });
    expect(result).toHaveLength(0);
  });

  it("unknown docType falls through to other handler", () => {
    const result = buildChunksFromDocument(doc({ docType: "unknown_future_type" }), {
      sections: [{ title: "Section", page: 1, content: LONG }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.85);
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe("idempotency", () => {
  it("calling buildChunksFromDocument twice with same input produces identical results", () => {
    const testDoc = doc({ docType: "resume", staffName: "Alice" });
    const meta = {
      summary: LONG,
      projectExperience: ["Project A", "Project B"],
      sections: [{ title: "Education", page: 1, content: LONG }],
    };
    const run1 = buildChunksFromDocument(testDoc, meta);
    const run2 = buildChunksFromDocument(testDoc, meta);
    expect(run1.length).toBe(run2.length);
    run1.forEach((chunk, i) => {
      expect(chunk.content).toBe(run2[i].content);
      expect(chunk.chunkType).toBe(run2[i].chunkType);
      expect(chunk.confidence).toBe(run2[i].confidence);
    });
  });
});
