import { describe, expect, it } from "vitest";
import {
  buildFeeEstimatorTemplateVariables,
  createFeeEvidenceUnavailableOutput,
  findFeePricingEvidence,
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
});
