export type ProjectHubDocument = {
  docType?: string | null;
  fileName?: string | null;
};

/**
 * A project sheet can be extracted from a staff résumé. Its project association is valid,
 * but opening its underlying file would show the résumé rather than the project content.
 */
export function isResumeDerivedProjectSheet(document: ProjectHubDocument): boolean {
  return document.docType === "project_sheet" && /^resume(?:[\s_-]|$)/i.test(document.fileName?.trim() ?? "");
}
