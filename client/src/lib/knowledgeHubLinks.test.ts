import { describe, expect, it } from "vitest";
import {
  buildKnowledgeHubDocumentUrl,
  buildProjectSheetIntakeUrl,
  getKnowledgeHubDocumentId,
  getProjectSheetIntakeProjectId,
} from "./knowledgeHubLinks";

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

describe("Knowledge Hub project-sheet handoff links", () => {
  const projectId = "8f72e0d5-05d8-4fe3-9234-683cedb5aa16";

  it("builds and validates a canonical Project Experience intake URL", () => {
    expect(buildProjectSheetIntakeUrl(projectId)).toBe(`/knowledge-hub?projectSheet=${projectId}`);
    expect(getProjectSheetIntakeProjectId(`?projectSheet=${projectId}`)).toBe(projectId);
    expect(getProjectSheetIntakeProjectId("?projectSheet=not-a-project")).toBeNull();
  });
});
