const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export function buildKnowledgeHubDocumentUrl(documentId: string): string {
  return `/knowledge-hub?document=${encodeURIComponent(documentId)}`;
}

export function getKnowledgeHubDocumentId(search: string): string | null {
  const documentId = new URLSearchParams(search).get("document");
  return documentId && UUID_PATTERN.test(documentId) ? documentId : null;
}

export function buildProjectSheetIntakeUrl(projectId: string): string {
  return `/knowledge-hub?projectSheet=${encodeURIComponent(projectId)}`;
}

export function getProjectSheetIntakeProjectId(search: string): string | null {
  const projectId = new URLSearchParams(search).get("projectSheet");
  return projectId && UUID_PATTERN.test(projectId) ? projectId : null;
}
