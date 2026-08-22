import { describe, expect, it } from "vitest";
import { isBlankSkillOutput, requireNonEmptySkillOutput } from "./skillOutput";

describe("skill output validation", () => {
  it("preserves a non-empty text response", () => {
    expect(requireNonEmptySkillOutput("  Fee estimate  ", "fee_estimator")).toBe("Fee estimate");
  });

  it("supports text response blocks", () => {
    expect(requireNonEmptySkillOutput([{ type: "text", text: "Fee estimate" }], "fee_estimator")).toBe("Fee estimate");
  });

  it("rejects blank responses so they cannot be marked complete", () => {
    expect(() => requireNonEmptySkillOutput("   ", "fee_estimator")).toThrow("returned an empty response");
  });

  it("identifies persisted blank output for retry recovery", () => {
    expect(isBlankSkillOutput("")).toBe(true);
    expect(isBlankSkillOutput("Generated estimate")).toBe(false);
  });
});
