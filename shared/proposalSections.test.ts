import { describe, expect, it } from "vitest";
import { resolveProposalStructure } from "./proposalSections";

describe("resolveProposalStructure", () => {
  it("sorts explicit RFP section-map entries by their declared order", () => {
    const result = resolveProposalStructure({
      sectionMap: JSON.stringify([
        { title: "Fee Schedule", order: 3 },
        { title: "Technical Approach", order: 2 },
        { title: "Transmittal Letter", order: 1 },
      ]),
    });
    expect(result.source).toBe("rfp_section_map");
    expect(result.sections.map((section) => section.title)).toEqual([
      "Transmittal Letter", "Technical Approach", "Fee Schedule",
    ]);
  });

  it("derives and labels an evaluation-criteria fallback without claiming an explicit section map", () => {
    const result = resolveProposalStructure({
      submissionFormat: "A Transmittal Letter and Cost Proposal must be separate PDF files.",
      evaluationCriteria: [
        { title: "Proposer's General Qualifications", description: "Qualifications and experience of personnel, client history, and references." },
        { title: "Technical Approach and Scope of Services", description: "Understanding of scope." },
        { title: "Cost Proposal/Fee Schedule", description: "Detailed anticipated charges." },
        { title: "Compliance with Laws and Regulations", description: "Required forms." },
      ],
    });
    expect(result.source).toBe("rfp_evaluation_criteria");
    expect(result.sections.map((section) => section.sectionType)).toEqual([
      "cover_letter", "firm_qualifications", "key_personnel", "project_experience", "technical_approach", "fee_proposal", "other",
    ]);
  });
});
