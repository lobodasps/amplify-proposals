import { describe, expect, it } from "vitest";
import { buildKnowledgeHubDocumentUrl, getKnowledgeHubDocumentId } from "./knowledgeHubLinks";

describe("Knowledge Hub direct document links", () => {
  const documentId = "b5605af8-69cd-458a-a16f-024450648ade";

  it("builds a document-preview URL from a canonical DAM ID", () => {
    expect(buildKnowledgeHubDocumentUrl(documentId)).toBe(`/knowledge-hub?document=${documentId}`);
  });

  it("accepts a valid document ID and rejects malformed deep links", () => {
    expect(getKnowledgeHubDocumentId(`?document=${documentId}`)).toBe(documentId);
    expect(getKnowledgeHubDocumentId("?document=not-a-document")).toBeNull();
  });
});
