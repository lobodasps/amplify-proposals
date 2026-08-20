const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export function buildKnowledgeHubDocumentUrl(documentId: string): string {
  return `/knowledge-hub?document=${encodeURIComponent(documentId)}`;
}

export function getKnowledgeHubDocumentId(search: string): string | null {
  const documentId = new URLSearchParams(search).get("document");
  return documentId && UUID_PATTERN.test(documentId) ? documentId : null;
}
