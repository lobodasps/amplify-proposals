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
const GENERIC_RELEVANCE_TERMS = new Set(["and", "the", "for", "with", "services", "service", "engineering", "proposal", "project"]);

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

function relevanceTokens(value: string): Set<string> {
  return new Set(
    value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !GENERIC_RELEVANCE_TERMS.has(token))
  );
}

function hasRelevantServiceOverlap(document: FeePricingEvidenceDocument, serviceLines: string[]): boolean {
  const targetTerms = relevanceTokens(serviceLines.join(" "));
  if (targetTerms.size === 0) return false;
  const documentTerms = relevanceTokens(documentEvidenceText(document));
  return Array.from(targetTerms).some((term) => documentTerms.has(term));
}

function metadataPricingExcerpt(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const sections = (metadata as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return "";
  return sections
    .filter((section) => {
      if (!section || typeof section !== "object") return false;
      const { title, content } = section as { title?: unknown; content?: unknown };
      return PRICING_VALUE_PATTERN.test([title, content].filter((value) => typeof value === "string").join("\n"));
    })
    .map((section) => {
      const { title, content } = section as { title?: unknown; content?: unknown };
      return [`Section: ${typeof title === "string" ? title : "Pricing detail"}`, typeof content === "string" ? content : ""].filter(Boolean).join("\n");
    })
    .join("\n\n")
    .slice(0, 2_000);
}

function sourceExcerpt(document: FeePricingEvidenceDocument): string {
  const extractedText = document.extractedText?.trim();
  if (extractedText) return extractedText.slice(0, 2_000);
  const metadataExcerpt = metadataPricingExcerpt(document.extractedMeta);
  if (metadataExcerpt) return metadataExcerpt;
  const value = document.contractValue?.trim();
  return value ? `Recorded contract/proposal value: ${value}` : "Pricing metadata is available; use only stated amounts and rates.";
}

/** Approved rate artifacts, selected priced proposals, and relevant priced prior proposals are permitted fee inputs. */
export function findFeePricingEvidence(
  documents: FeePricingEvidenceDocument[],
  selectedPastProposalIds: string[],
  serviceLines: string[] = []
): FeePricingEvidence {
  const selectedIds = new Set(selectedPastProposalIds);
  const rateArtifacts = rankKnowledgeHubDocuments(documents, {
    docTypes: ["rate_sheet", "spreadsheet", "other"],
    serviceLines,
    requirePricing: true,
    limit: 3,
  }).filter(({ document }) =>
    document.docType === "rate_sheet" || RATE_ARTIFACT_PATTERN.test([document.title, document.fileName, document.tags].filter(Boolean).join(" ")),
  ).map(({ document }) => document);
  const selectedPricedPastProposals = rankKnowledgeHubDocuments(
    documents.filter((document) => Boolean(document.id && selectedIds.has(document.id))),
    { docTypes: ["past_proposal"], serviceLines, requirePricing: true, limit: 3 },
  ).map(({ document }) => document);
  const relevantPricedPastProposals = rankKnowledgeHubDocuments(
    documents.filter((document) => !selectedIds.has(document.id ?? "")),
    { docTypes: ["past_proposal"], serviceLines, requirePricing: true, limit: 3 },
  ).filter(({ document }) => hasRelevantServiceOverlap(document, serviceLines)).map(({ document }) => document);
  const sources = [
    ...rateArtifacts.map((document) => ({ type: "Knowledge Hub rate artifact", document })),
    ...selectedPricedPastProposals.map((document) => ({ type: "Selected priced prior proposal", document })),
    ...relevantPricedPastProposals.map((document) => ({ type: "Relevant priced prior proposal", document })),
  ].slice(0, 6);

  if (sources.length === 0) {
    const sourceSummary = "Searched Knowledge Hub rate sheets and price-labeled spreadsheets, plus selected and service-line-relevant past proposals with stated pricing. No permitted fee evidence was found.";
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
import { rankKnowledgeHubDocuments } from "./knowledgeHubMatching";
