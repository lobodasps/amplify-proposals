import { describe, expect, it } from "vitest";
import { getGoNoGoActionLabel, getLaunchRestoreNotice } from "./launchRecoveryUi";

describe("Launchpad recovery UI decisions", () => {
  it("labels a restored cached score, stale edited score, and fresh score correctly", () => {
    expect(getGoNoGoActionLabel({ hasResult: true, isCurrent: true, isStale: false })).toBe("Open Saved Go/No-Go");
    expect(getGoNoGoActionLabel({ hasResult: true, isCurrent: false, isStale: true })).toBe("Re-run Go/No-Go");
    expect(getGoNoGoActionLabel({ hasResult: false, isCurrent: false, isStale: false })).toBe("Run Go/No-Go Analysis");
  });

  it("describes processing, review, and decision restoration without implying re-extraction", () => {
    expect(getLaunchRestoreNotice("processing")).toContain("Resuming");
    expect(getLaunchRestoreNotice("review")).toContain("not reprocessed");
    expect(getLaunchRestoreNotice("decision")).toContain("decision");
  });
});
