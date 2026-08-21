import { describe, expect, it } from "vitest";
import { shouldFallbackToGoogleAfterAnthropicFailure } from "./_core/llmSkill";

describe("Anthropic forbidden-response fallback", () => {
  it("uses Google when Anthropic fails and no distinct default provider exists", () => {
    expect(shouldFallbackToGoogleAfterAnthropicFailure("anthropic", true, null)).toBe(true);
    expect(shouldFallbackToGoogleAfterAnthropicFailure("anthropic", true, "anthropic")).toBe(true);
  });

  it("leaves distinct configured defaults and non-Anthropic failures to their normal routing", () => {
    expect(shouldFallbackToGoogleAfterAnthropicFailure("anthropic", true, "openai")).toBe(false);
    expect(shouldFallbackToGoogleAfterAnthropicFailure("google_gemini", true, null)).toBe(false);
    expect(shouldFallbackToGoogleAfterAnthropicFailure("anthropic", false, null)).toBe(false);
  });
});
