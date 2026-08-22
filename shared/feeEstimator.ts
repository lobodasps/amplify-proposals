export type FeeScheduleEvidenceDocument = {
  title?: string | null;
  fileName?: string | null;
  docType?: string | null;
  tags?: string | null;
  extractedText?: string | null;
};

const FEE_EVIDENCE_PATTERN = /\b(fee|billing|labor|rate)\b/i;

export function buildFeeScheduleContext(documents: FeeScheduleEvidenceDocument[]): string {
  const matches = documents.filter((document) =>
    FEE_EVIDENCE_PATTERN.test([
      document.title,
      document.fileName,
      document.docType,
      document.tags,
    ].filter(Boolean).join(" "))
  ).slice(0, 6);

  if (matches.length === 0) {
    return "No fee schedule or labor-rate document is available in Knowledge Hub. Do not invent billing rates. Produce a planning-level task and labor-hours estimate, identify rate-dependent totals as TBD, and list the fee-schedule inputs required to finalize pricing.";
  }

  return [
    "Knowledge Hub fee-schedule evidence:",
    ...matches.map((document, index) => [
      `${index + 1}. ${document.title ?? document.fileName ?? "Untitled fee schedule"}`,
      `Source file: ${document.fileName ?? "Not recorded"}`,
      document.extractedText?.trim() ? `Extracted content: ${document.extractedText.trim().slice(0, 2_000)}` : "Extracted content: Not available; do not infer unstated rates.",
    ].join("\n")),
  ].join("\n\n");
}

export function buildFeeEstimatorTemplateVariables(input: {
  rfpContext: string;
  technicalOutline: string;
  agency: string;
  firmName: string;
  rfpTitle: string;
  scopeSummary: string;
  firmSize: string;
  laborCategories: string;
  feeScheduleContext: string;
}) {
  const rfpRequirements = [
    `RFP CONTEXT:\n${input.rfpContext || "Not available"}`,
    `SCOPE SUMMARY:\n${input.scopeSummary || "Not available"}`,
    `TECHNICAL OUTLINE:\n${input.technicalOutline || "Not available"}`,
    `FEE-SCHEDULE EVIDENCE:\n${input.feeScheduleContext}`,
  ].join("\n\n");
  const firmExperience = [
    `Firm: ${input.firmName}`,
    `Firm size: ${input.firmSize || "Not specified"}`,
    `Standard labor categories: ${input.laborCategories}`,
  ].join("\n");

  return {
    ...input,
    firmSize: input.firmSize || "Not specified",
    sectionType: "Preliminary Fee Estimate",
    rfpRequirements,
    firmExperience,
    wordLimit: "Use a task-by-task labor-hours table, assumptions, exclusions, and pricing caveats.",
  };
}
