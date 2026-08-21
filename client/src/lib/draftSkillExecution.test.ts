import { describe, expect, it } from "vitest";
import { shouldPollForSkillCompletion } from "./draftSkillExecution";

describe("shouldPollForSkillCompletion", () => {
  it("skips polling for a direct completed response", () => {
    expect(shouldPollForSkillCompletion({ success: true, running: false })).toBe(false);
  });

  it("skips polling for a cached response", () => {
    expect(shouldPollForSkillCompletion({ success: true, cached: true })).toBe(false);
  });

  it("retains polling for a background skill response", () => {
    expect(shouldPollForSkillCompletion({ success: true, running: true })).toBe(true);
  });
});
