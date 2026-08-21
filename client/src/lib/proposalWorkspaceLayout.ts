export function getProposalWorkspaceLayout(workspaceMode: string, activeView: string) {
  const pageScrollableDraft = workspaceMode === "workflow" && activeView === "full_draft";
  return {
    rootClass: pageScrollableDraft ? "min-h-full" : "h-full",
    bodyClass: pageScrollableDraft ? "min-h-0" : "flex-1 min-h-0",
    mainClass: pageScrollableDraft ? "overflow-visible" : "overflow-y-auto",
    pageScrollableDraft,
  };
}

export function getSkillPipelineLayout() {
  return {
    sidebarClass: "min-h-0",
    listClass: "flex-1 min-h-0 overflow-y-auto scrollbar-thin",
  };
}
