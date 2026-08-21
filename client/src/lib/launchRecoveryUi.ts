export type GoNoGoActionLabel = "Run Go/No-Go Analysis" | "Re-run Go/No-Go" | "Open Saved Go/No-Go";

export function getGoNoGoActionLabel(input: {
  hasResult: boolean;
  isCurrent: boolean;
  isStale: boolean;
}): GoNoGoActionLabel {
  if (input.hasResult && input.isCurrent) return "Open Saved Go/No-Go";
  if (input.isStale) return "Re-run Go/No-Go";
  return "Run Go/No-Go Analysis";
}

export function getLaunchRestoreNotice(target: "processing" | "review" | "decision"): string {
  if (target === "processing") return "Resuming saved RFP extraction…";
  if (target === "decision") return "Restored your saved Go/No-Go decision.";
  return "Restored your extracted RFP review. Source files were not reprocessed.";
}
