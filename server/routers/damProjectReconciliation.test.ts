import { describe, expect, it } from "vitest";
import { groupLegacyProjectSheets, normalizeProjectExperienceKey } from "./dam";

describe("legacy project-sheet reconciliation", () => {
  it("normalizes harmless spacing and case differences without changing the project name to show users", () => {
    expect(normalizeProjectExperienceKey("  Tompkinsville   Station ")).toBe("tompkinsville station");
  });

  it("groups duplicate legacy sheets under one canonical Project Experience candidate", () => {
    const groups = groupLegacyProjectSheets([
      { id: "a", title: "Tompkinsville Station", projectName: null },
      { id: "b", title: "Tompkinsville Station", projectName: "Tompkinsville Station" },
      { id: "c", title: "Croton Water Treatment Plant", projectName: null },
    ]);

    expect(groups.get("tompkinsville station")).toEqual({
      name: "Tompkinsville Station",
      documentIds: ["a", "b"],
    });
    expect(groups.get("croton water treatment plant")?.documentIds).toEqual(["c"]);
  });
});
