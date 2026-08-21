import { describe, expect, it } from "vitest";
import { normalizeProposalScorecard, toScorecardStringList } from "./proposalScorecard";

describe("Proposal Scorecard normalization", () => {
  it("normalizes strings, JSON strings, objects, and null list fields into arrays", () => {
    expect(toScorecardStringList("- Missing resume\n- Missing fee")).toEqual(["Missing resume", "Missing fee"]);
    expect(toScorecardStringList('{"one":"Missing resume","two":"Missing fee"}')).toEqual(["Missing resume", "Missing fee"]);
    expect(toScorecardStringList(null)).toEqual([]);
  });

  it("prevents malformed saved scoring output from exposing non-array fields to renderers", () => {
    const scorecard = normalizeProposalScorecard({
      overallScore: "74",
      criteria: [{ criterion: "Experience", score: "68", gaps: "- Add transit work" }],
      topGaps: "[\"Add project sheets\", \"Clarify staffing\"]",
      improvements: { first: "Add quantified outcomes" },
      unsupportedClaims: { claim: "Best in class", reason: "No source" },
    });
    expect(scorecard.overallScore).toBe(74);
    expect(scorecard.criteria[0].gaps).toEqual(["Add transit work"]);
    expect(scorecard.topGaps).toEqual(["Add project sheets", "Clarify staffing"]);
    expect(scorecard.improvements).toEqual(["Add quantified outcomes"]);
    expect(scorecard.unsupportedClaims).toHaveLength(1);
  });
});
