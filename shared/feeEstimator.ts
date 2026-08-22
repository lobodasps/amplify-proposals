export type FeePricingEvidenceDocument = {
  id?: string;
  title?: string | null;
  fileName?: string | null;
  docType?: string | null;
  tags?: string | null;
  contractValue?: string | null;
  extractedText?: string | null;
  extractedMeta?: unknown;
};

export type FeePricingEvidence = {
  available: boolean;
  sourceSummary: string;
  promptContext: string;
};

export function isLegacyFeeEstimateWithoutEvidenceProvenance(entry?: {
  status?: string;
  feeEvidenceStatus?: string;
}): boolean {
  return entry?.status === "complete" && !entry.feeEvidenceStatus;
}

const RATE_ARTIFACT_PATTERN = /\b(fee|billing|labor|rate|price)\b/i;
const PRICING_VALUE_PATTERN = /(?:\$\s?[\d,.]+|\b(?:fee|price|billing rate|labor rate|hourly rate|not-to-exceed|NTE)\b)/i;

function metadataAsText(metadata: unknown): string {
  return metadata && typeof metadata === "object" ? JSON.stringify(metadata) : "";
}

function documentEvidenceText(document: FeePricingEvidenceDocument): string {
  return [
    document.title,
    document.fileName,
    document.tags,
    document.contractValue,
    document.extractedText,
    metadataAsText(document.extractedMeta),
  ].filter(Boolean).join("\n");
}

function sourceExcerpt(document: FeePricingEvidenceDocument): string {
  const extractedText = document.extractedText?.trim();
  if (extractedText) return extractedText.slice(0, 2_000);
  const value = document.contractValue?.trim();
  return value ? `Recorded contract/proposal value: ${value}` : "Pricing metadata is available; use only stated amounts and rates.";
}

/** Approved rate artifacts and explicitly selected priced prior proposals are the only permitted fee inputs. */
export function findFeePricingEvidence(
  documents: FeePricingEvidenceDocument[],
  selectedPastProposalIds: string[]
): FeePricingEvidence {
  const selectedIds = new Set(selectedPastProposalIds);
  const rateArtifacts = documents.filter((document) => {
    if (document.docType === "rate_sheet") return true;
    return (document.docType === "spreadsheet" || document.docType === "other")
      && RATE_ARTIFACT_PATTERN.test([document.title, document.fileName, document.tags].filter(Boolean).join(" "));
  });
  const pricedPastProposals = documents.filter((document) =>
    document.id && selectedIds.has(document.id) && document.docType === "past_proposal"
      && PRICING_VALUE_PATTERN.test(documentEvidenceText(document))
  );
  const sources = [
    ...rateArtifacts.map((document) => ({ type: "Knowledge Hub rate artifact", document })),
    ...pricedPastProposals.map((document) => ({ type: "Selected priced prior proposal", document })),
  ].slice(0, 6);

  if (sources.length === 0) {
    const sourceSummary = "Searched Knowledge Hub rate sheets and price-labeled spreadsheets, plus the pursuit's selected past proposals with stated pricing. No permitted fee evidence was found.";
    return { available: false, sourceSummary, promptContext: sourceSummary };
  }

  const sourceSummary = `Permitted fee evidence found: ${sources.map(({ type, document }) => `${type} — ${document.title ?? document.fileName ?? "Untitled"}`).join("; ")}.`;
  return {
    available: true,
    sourceSummary,
    promptContext: [
      sourceSummary,
      ...sources.map(({ type, document }, index) => [
        `${index + 1}. ${type}: ${document.title ?? document.fileName ?? "Untitled"}`,
        `Source file: ${document.fileName ?? "Not recorded"}`,
        `Evidence excerpt:\n${sourceExcerpt(document)}`,
      ].join("\n")),
    ].join("\n\n"),
  };
}

export function createFeeEvidenceUnavailableOutput(sourceSummary: string): string {
  return [
    "## Fee Estimate",
    "",
    "> **Fee section intentionally left blank.**",
    "> No approved fee schedule, rate artifact, or selected prior proposal with usable pricing was available.",
    "",
    sourceSummary,
    "",
    "To generate this section, add an approved `Rate Sheet` or price-labeled spreadsheet in Knowledge Hub, or select a prior proposal that contains stated pricing for this pursuit. No rates, hours, or fee totals have been inferred.",
  ].join("\n");
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
  pricingEvidence: FeePricingEvidence;
}) {
  const rfpRequirements = [
    `RFP CONTEXT:\n${input.rfpContext || "Not available"}`,
    `SCOPE SUMMARY:\n${input.scopeSummary || "Not available"}`,
    `TECHNICAL OUTLINE:\n${input.technicalOutline || "Not available"}`,
    `PERMITTED FEE EVIDENCE:\n${input.pricingEvidence.promptContext}`,
  ].join("\n\n");
  const firmExperience = [
    `Firm: ${input.firmName}`,
    `Firm size: ${input.firmSize || "Not specified"}`,
    `Standard labor categories: ${input.laborCategories}`,
  ].join("\n");

  return {
    rfpContext: input.rfpContext,
    technicalOutline: input.technicalOutline,
    agency: input.agency,
    firmName: input.firmName,
    rfpTitle: input.rfpTitle,
    scopeSummary: input.scopeSummary,
    firmSize: input.firmSize || "Not specified",
    laborCategories: input.laborCategories,
    feeEvidenceStatus: input.pricingEvidence.available ? "available" : "unavailable",
    feeEvidenceSummary: input.pricingEvidence.sourceSummary,
    sectionType: "Preliminary Fee Estimate",
    rfpRequirements,
    firmExperience,
    wordLimit: "Use a task-by-task labor-hours table, cited pricing inputs, assumptions, and exclusions. Do not invent rates or totals.",
  };
}
