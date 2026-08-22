import { describe, expect, it } from "vitest";
import {
  GENERATED_SECTIONS_DESCRIPTION,
  GENERATED_SECTIONS_LABEL,
  PROPOSAL_DOCUMENT_LABEL,
} from "./proposalViewTerminology";

describe("proposal view terminology", () => {
  it("distinguishes the editable document from skill-generated sections", () => {
    expect(PROPOSAL_DOCUMENT_LABEL).toBe("Proposal Document");
    expect(GENERATED_SECTIONS_LABEL).toBe("Generated Sections");
    expect(GENERATED_SECTIONS_DESCRIPTION).toContain("welcome letter");
  });
});
