import { describe, expect, it } from "vitest";
import {
  resolveLaunchClassificationLabel,
  shouldExtractRfpTextBeforeLlm,
  shouldUseNativeRfpFileInput,
} from "../shared/launchDocumentProcessing";

describe("Launch DOCX processing safeguards", () => {
  it("extracts DOCX text before LLM analysis even when Gemini file input is available", () => {
    expect(shouldUseNativeRfpFileInput({ isPdf: false, isWord: true, supportsFileUrl: true })).toBe(false);
    expect(shouldExtractRfpTextBeforeLlm({ isPdf: false, isWord: true, supportsFileUrl: true })).toBe(true);
  });

  it("keeps native file input for supported PDFs and falls back to text for providers without it", () => {
    expect(shouldUseNativeRfpFileInput({ isPdf: true, isWord: false, supportsFileUrl: true })).toBe(true);
    expect(shouldExtractRfpTextBeforeLlm({ isPdf: true, isWord: false, supportsFileUrl: false })).toBe(true);
  });

  it("preserves a user-designated Main RFP when automated classification is inconclusive", () => {
    expect(resolveLaunchClassificationLabel(true, "Supplemental", "Main RFP")).toBe("Main RFP");
    expect(resolveLaunchClassificationLabel(false, "Scope of Work", "Supplemental")).toBe("Scope of Work");
  });
});
