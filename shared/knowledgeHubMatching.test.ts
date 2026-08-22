import { describe, expect, it } from "vitest";
import { hasApprovedAssetSelections, rankKnowledgeHubDocuments, requiresWriterApprovedAssets, scoreDeterministicEvidence } from "./knowledgeHubMatching";

describe("rankKnowledgeHubDocuments", () => {
  const documents = [
    { id: "resume-1", docType: "resume", title: "Bridge Inspector Resume", tags: "bridge inspection", extractedText: "PE, NICET bridge inspector with 12 years experience" },
    { id: "resume-2", docType: "resume", title: "Landscape Resume", tags: "landscape", extractedText: "Landscape architect" },
    { id: "past-1", docType: "past_proposal", title: "Bridge Fee Proposal", tags: "bridge inspection", extractedText: "Hourly rate $175; total fee $120,000" },
  ];

  it("ranks relevant document types deterministically and records suggestion provenance", () => {
    const matches = rankKnowledgeHubDocuments(documents, {
      docTypes: ["resume"],
      serviceLines: ["Bridge Inspection"],
      personnelRequirements: [{ role: "Inspector", certification: "NICET" }],
    });

    expect(matches.map((match) => match.document.id)).toEqual(["resume-1", "resume-2"]);
    expect(matches[0].autoMatched).toBe(true);
    expect(matches[0].reasons.join(" ")).toContain("Service-line overlap");
    expect(matches[0].reasons.join(" ")).toContain("Personnel-requirement overlap");
  });

  it("requires stated pricing when matching fee evidence", () => {
    const matches = rankKnowledgeHubDocuments(documents, {
      docTypes: ["past_proposal"],
      serviceLines: ["Bridge Inspection"],
      requirePricing: true,
    });

    expect(matches.map((match) => match.document.id)).toEqual(["past-1"]);
  });

  it("requires an explicit writer-approved selection before evidence-dependent generation", () => {
    expect(hasApprovedAssetSelections()).toBe(false);
    expect(hasApprovedAssetSelections({ selectedProjectIds: [], selectedPastProposalIds: [], selectedPersonnel: [] })).toBe(false);
    expect(hasApprovedAssetSelections({ selectedProjectIds: ["project-1"] })).toBe(true);
    expect(hasApprovedAssetSelections({ selectedPersonnel: [{ damDocumentId: "resume-1" }] })).toBe(true);
    expect(requiresWriterApprovedAssets("key_personnel", "pursuit-1", { selectedPersonnel: [] })).toBe(true);
    expect(requiresWriterApprovedAssets("key_personnel", "pursuit-1", { selectedPersonnel: [{ damDocumentId: "resume-1" }] })).toBe(false);
    expect(requiresWriterApprovedAssets("rfp_parser", "pursuit-1", { selectedPersonnel: [] })).toBe(false);
  });

  it("uses the shared deterministic evidence scoring weights", () => {
    expect(scoreDeterministicEvidence({ evidenceWeight: 1, priorityScore: 1, relevanceBoost: 1 })).toBe(1);
    expect(scoreDeterministicEvidence({ evidenceWeight: 1, priorityScore: 0.5, relevanceBoost: 0 })).toBe(0.65);
  });
});
