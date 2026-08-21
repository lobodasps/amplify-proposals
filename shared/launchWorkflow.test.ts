import { describe, expect, it } from "vitest";
import { buildGoNoGoInputHash, emptyLaunchState, recordLaunchStage, readLaunchState, resolveLaunchRestoreTarget } from "./launchWorkflow";

const review = {
  title: "Bridge Inspection",
  agency: "NYC DOT",
  rfpNumber: "RFP-7",
  submissionDeadline: "2026-10-01",
  estimatedValue: "$500,000",
  serviceLines: ["Construction Management", "Traffic Engineering"],
  scopeSummary: "Inspect the bridge.",
};

describe("resumable Launch workflow", () => {
  it("keeps Go/No-Go input hashes stable across service-line ordering", () => {
    expect(buildGoNoGoInputHash(review)).toBe(buildGoNoGoInputHash({ ...review, serviceLines: [...review.serviceLines].reverse() }));
    expect(buildGoNoGoInputHash(review)).not.toBe(buildGoNoGoInputHash({ ...review, estimatedValue: "$600,000" }));
  });

  it("records bounded stage history and resumes extraction at review", () => {
    const state = recordLaunchStage(emptyLaunchState(), "extract", "complete", "RFP parsed");
    expect(state.currentStage).toBe("review");
    expect(state.stageStatus.extract).toBe("complete");
    expect(state.events).toHaveLength(1);
    expect(readLaunchState({ events: "invalid" }).events).toEqual([]);
  });

  it("restores only the furthest safe UI step and never restarts completed work", () => {
    const extracting = recordLaunchStage(emptyLaunchState(), "extract", "running");
    expect(resolveLaunchRestoreTarget(extracting, "running")).toBe("processing");
    const reviewed = recordLaunchStage(extracting, "extract", "complete");
    expect(resolveLaunchRestoreTarget(reviewed, "complete")).toBe("review");
    expect(resolveLaunchRestoreTarget({
      ...reviewed,
      goNoGo: { status: "complete", result: { score: 80 } },
    }, "complete")).toBe("decision");
  });
});
