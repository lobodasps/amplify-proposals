import { describe, expect, it } from "vitest";
import { getProposalWorkspaceLayout, getSkillPipelineLayout } from "./proposalWorkspaceLayout";

describe("getProposalWorkspaceLayout", () => {
  it("hands full proposal draft scrolling to the application page rather than an inner panel", () => {
    expect(getProposalWorkspaceLayout("workflow", "full_draft")).toEqual({
      rootClass: "min-h-full",
      bodyClass: "min-h-0",
      mainClass: "overflow-visible",
      pageScrollableDraft: true,
    });
  });

  it("keeps bounded inner scrolling for workflow views", () => {
    expect(getProposalWorkspaceLayout("workflow", "overview")).toMatchObject({
      rootClass: "h-full",
      bodyClass: "flex-1 min-h-0",
      mainClass: "overflow-y-auto",
      pageScrollableDraft: false,
    });
  });

  it("assigns the full skill list a bounded native scroll viewport", () => {
    expect(getSkillPipelineLayout()).toEqual({
      sidebarClass: "min-h-0",
      listClass: "flex-1 min-h-0 overflow-y-auto scrollbar-thin",
    });
  });
});
