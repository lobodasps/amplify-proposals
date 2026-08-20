import { describe, expect, it } from "vitest";
import { normalizeGoNoGoResult } from "../../shared/goNoGo";

describe("Go/No-Go response normalization", () => {
  it("normalizes a string-valued strengths response so the Launchpad can render it safely", () => {
    const result = normalizeGoNoGoResult({
      score: "78",
      recommendation: "GO",
      rationale: "Strong agency fit.",
      strengths: "• Relevant water experience\n• Existing client relationship",
      risks: { first: "Short response window" },
      winThemes: "[\"Local knowledge\", \"Certified team\"]",
    });
    expect(result.score).toBe(78);
    expect(result.strengths).toEqual(["Relevant water experience", "Existing client relationship"]);
    expect(result.risks).toEqual(["Short response window"]);
    expect(result.winThemes).toEqual(["Local knowledge", "Certified team"]);
  });

  it("returns safe defaults for malformed values", () => {
    expect(normalizeGoNoGoResult({ strengths: null, recommendation: "MAYBE" })).toMatchObject({
      score: 50,
      recommendation: "CONDITIONAL GO",
      strengths: [],
      risks: [],
      winThemes: [],
    });
  });
});
