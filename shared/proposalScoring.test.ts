import { describe, expect, it } from "vitest";
import {
  assembleProposalContent,
  buildSectionScoringInput,
  formatEvaluationCriteria,
  getProposalScoreDisplay,
  getScoringReadiness,
} from "./proposalScoring";

describe("proposal scoring input and display state", () => {
  it("formats extracted criteria and assembled completed proposal sections", () => {
    const criteria = formatEvaluationCriteria([{ title: "Technical Approach", weight: "40%", description: "Demonstrate methodology" }]);
    const content = assembleProposalContent([{ title: "Technical Approach", content: "A grounded approach." }]);
    expect(criteria).toContain("Technical Approach");
    expect(content).toContain("## Technical Approach");
    expect(getScoringReadiness(criteria, content)).toEqual({ ready: true });
  });

  it("blocks unresolved placeholder scoring inputs", () => {
    expect(getScoringReadiness("{{evaluationCriteria}}", "proposal text").ready).toBe(false);
    expect(getScoringReadiness("1. Scope", "{{contentToScore}}").ready).toBe(false);
  });

  it("builds canonical evaluator variables for section-level scoring", () => {
    const input = buildSectionScoringInput("1. Technical Approach", "Technical Approach", "Grounded proposal text.");
    expect(input.evaluationCriteria).toBe("1. Technical Approach");
    expect(input.contentToScore).toContain("## Technical Approach");
    expect(input.readiness).toEqual({ ready: true });
  });

  it("renders historical placeholder-driven zero results as unscored", () => {
    const display = getProposalScoreDisplay(0, {
      overallSummary: "The request could not be substantively scored because {{evaluationCriteria}} was unresolved.",
    });
    expect(display.kind).toBe("unscored");
  });
});
