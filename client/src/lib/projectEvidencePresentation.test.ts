import { describe, expect, it } from "vitest";
import { isResumeDerivedProjectSheet } from "./projectEvidencePresentation";

describe("Project Experience evidence presentation", () => {
  it("identifies a project sheet extracted from a résumé source file", () => {
    expect(isResumeDerivedProjectSheet({
      docType: "project_sheet",
      fileName: "Resume_Strans_Ritesh M Patel_PM IE.pdf",
    })).toBe(true);
  });

  it("does not hide ordinary project-sheet source files", () => {
    expect(isResumeDerivedProjectSheet({
      docType: "project_sheet",
      fileName: "Tompkinsville Station Project Sheet.pdf",
    })).toBe(false);
  });
});
