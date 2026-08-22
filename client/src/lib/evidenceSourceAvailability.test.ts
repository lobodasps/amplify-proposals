import { describe, expect, it } from "vitest";
import { getEvidenceSourceAvailabilityMessage } from "./evidenceSourceAvailability";

describe("evidence source availability messaging", () => {
  it("explains when no assets were selected", () => {
    expect(getEvidenceSourceAvailabilityMessage([])).toContain("No Knowledge Hub assets were selected");
  });

  it("explains selected assets without usable historical excerpts", () => {
    expect(getEvidenceSourceAvailabilityMessage(["doc-1", "doc-2"])).toContain("2 selected Knowledge Hub assets were searched");
  });
});
