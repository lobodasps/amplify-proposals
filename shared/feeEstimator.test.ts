import { describe, expect, it } from "vitest";
import {
  buildFeeEstimatorTemplateVariables,
  createFeeEvidenceUnavailableOutput,
  findFeePricingEvidence,
  isLegacyFeeEstimateWithoutEvidenceProvenance,
} from "./feeEstimator";

describe("Fee Estimator evidence gate", () => {
  it("leaves the fee section explicitly blank when neither permitted source is available", () => {
    const evidence = findFeePricingEvidence([], []);
    const output = createFeeEvidenceUnavailableOutput(evidence.sourceSummary);
    expect(evidence.available).toBe(false);
    expect(output).toContain("Fee section intentionally left blank");
    expect(output).toContain("No rates, hours, or fee totals have been inferred");
  });

  it("accepts an approved rate artifact and a selected priced past proposal as the only evidence sources", () => {
    const evidence = findFeePricingEvidence([
      { id: "rate-1", docType: "rate_sheet", title: "2026 Labor Rates", extractedText: "Project Manager: $185/hour" },
      { id: "past-1", docType: "past_proposal", title: "Similar RFP", contractValue: "$425,000" },
      { id: "past-2", docType: "past_proposal", title: "Unselected RFP", contractValue: "$900,000" },
      { id: "project-1", docType: "project_sheet", title: "Project Sheet", contractValue: "$1,200,000" },
    ], ["past-1"]);

    expect(evidence.available).toBe(true);
    expect(evidence.sourceSummary).toContain("2026 Labor Rates");
    expect(evidence.sourceSummary).toContain("Similar RFP");
    expect(evidence.sourceSummary).not.toContain("Unselected RFP");
    expect(evidence.sourceSummary).not.toContain("Project Sheet");
  });

  it("allows an unselected past proposal only when it has pricing and overlaps the pursuit service lines", () => {
    const evidence = findFeePricingEvidence([
      { id: "relevant", docType: "past_proposal", title: "Environmental Remediation Support", contractValue: "$425,000", extractedMeta: { serviceLines: ["Environmental"] } },
      { id: "unrelated", docType: "past_proposal", title: "Bridge Inspection Support", contractValue: "$900,000", extractedMeta: { serviceLines: ["Structural"] } },
    ], [], ["Environmental"]);

    expect(evidence.available).toBe(true);
    expect(evidence.sourceSummary).toContain("Environmental Remediation Support");
    expect(evidence.sourceSummary).not.toContain("Bridge Inspection Support");
    expect(evidence.sourceSummary).toContain("Relevant priced prior proposal");
  });

  it("does not use an unselected priced prior proposal when the pursuit has no service-line context", () => {
    const evidence = findFeePricingEvidence([
      { id: "past-1", docType: "past_proposal", title: "Environmental Remediation Support", contractValue: "$425,000" },
    ], []);
    expect(evidence.available).toBe(false);
  });

  it("includes fee-bearing extracted metadata from a selected prior proposal in the cited prompt context", () => {
    const evidence = findFeePricingEvidence([{
      id: "past-1",
      docType: "past_proposal",
      title: "Comparable Past Proposal",
      extractedMeta: {
        sections: [{ title: "Fee Summary", content: "Average hourly rate: $185/hour. Total project fee: $120,001." }],
      },
    }], ["past-1"]);

    expect(evidence.available).toBe(true);
    expect(evidence.promptContext).toContain("Section: Fee Summary");
    expect(evidence.promptContext).toContain("$185/hour");
  });

  it("passes all generic proposal-writer variables together with evidence provenance", () => {
    const variables = buildFeeEstimatorTemplateVariables({
      rfpContext: "RFP context",
      technicalOutline: "Task 1",
      agency: "MTA",
      firmName: "JPCL",
      rfpTitle: "Station work",
      scopeSummary: "Instrumentation",
      firmSize: "50-60",
      laborCategories: "Project Manager",
      pricingEvidence: { available: true, sourceSummary: "Rate sheet found", promptContext: "Rate sheet found" },
    });

    expect(variables.feeEvidenceStatus).toBe("available");
    expect(variables.rfpRequirements).toContain("TECHNICAL OUTLINE:\nTask 1");
    expect(variables.firmExperience).toContain("Firm size: 50-60");
    expect(variables.wordLimit).toContain("Do not invent rates or totals");
  });

  it("requires historical completed fee output without evidence provenance to be revalidated", () => {
    expect(isLegacyFeeEstimateWithoutEvidenceProvenance({ status: "complete" })).toBe(true);
    expect(isLegacyFeeEstimateWithoutEvidenceProvenance({ status: "complete", feeEvidenceStatus: "available" })).toBe(false);
  });
});
