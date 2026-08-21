import { describe, expect, it } from "vitest";
import { restoreLaunchManifest } from "./launchSessionManifest";

describe("persisted Launch manifest recovery", () => {
  it("restores display metadata without reconstructing browser File objects", () => {
    const restored = restoreLaunchManifest([{
      name: "Solicitation.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      label: "Main RFP",
      url: "https://files.example.com/rfp.docx",
    }]);
    expect(restored).toEqual([{
      id: "restored-0-Solicitation.docx",
      name: "Solicitation.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      type: "docx",
      label: "Main RFP",
      url: "https://files.example.com/rfp.docx",
    }]);
    expect("file" in restored[0]).toBe(false);
  });
});
