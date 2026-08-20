import { describe, expect, it } from "vitest";
import { getMissingCriticalRfpFields } from "./launchExtraction";

describe("Launch extraction completeness", () => {
  it("flags blank and placeholder critical values for manual review", () => {
    expect(getMissingCriticalRfpFields({
      title: "",
      agency: "City of Trenton",
      submissionDeadline: "TBD",
      estimatedValue: "Not Specified",
    })).toEqual(["Project / RFP title", "Submission deadline", "Estimated value"]);
  });

  it("accepts complete extracted opportunity metadata", () => {
    expect(getMissingCriticalRfpFields({
      title: "Environmental Site Assessments",
      agency: "City of Trenton",
      submissionDeadline: "2026-07-01",
      estimatedValue: "$500,000",
    })).toEqual([]);
  });
});
