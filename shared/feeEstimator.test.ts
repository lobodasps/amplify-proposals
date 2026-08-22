import { describe, expect, it } from "vitest";
import { buildFeeEstimatorTemplateVariables, buildFeeScheduleContext } from "./feeEstimator";

describe("Fee Estimator inputs", () => {
  it("gives the estimator an explicit no-schedule instruction when Knowledge Hub has no usable rate evidence", () => {
    const context = buildFeeScheduleContext([]);
    expect(context).toContain("No fee schedule");
    expect(context).toContain("Do not invent billing rates");
  });

  it("passes every generic proposal-writer variable with the fee evidence and outline", () => {
    const variables = buildFeeEstimatorTemplateVariables({
      rfpContext: "RFP context",
      technicalOutline: "Task 1",
      agency: "MTA",
      firmName: "JPCL",
      rfpTitle: "Station work",
      scopeSummary: "Instrumentation",
      firmSize: "50-60",
      laborCategories: "Project Manager",
      feeScheduleContext: "No fee schedule or labor-rate document is available in Knowledge Hub.",
    });

    expect(variables.sectionType).toBe("Preliminary Fee Estimate");
    expect(variables.rfpRequirements).toContain("TECHNICAL OUTLINE:\nTask 1");
    expect(variables.firmExperience).toContain("Firm size: 50-60");
    expect(variables.wordLimit).toContain("labor-hours table");
  });
});
