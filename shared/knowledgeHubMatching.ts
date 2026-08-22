export type KnowledgeHubDocument = {
  id?: string;
  docType?: string | null;
  title?: string | null;
  fileName?: string | null;
  tags?: string | null;
  staffName?: string | null;
  contractValue?: string | null;
  extractedText?: string | null;
  extractedMeta?: unknown;
};

export type MatchSelectionSource = "manual" | "suggested_approved";

export type DeterministicMatch = {
  document: KnowledgeHubDocument;
  relevanceScore: number;
  autoMatched: true;
  reasons: string[];
};

export type MatchOptions = {
  docTypes: string[];
  serviceLines?: string[];
  personnelRequirements?: unknown;
  requirePricing?: boolean;
  limit?: number;
};

export type ApprovedAssetSelections = {
  selectedProjectIds?: unknown;
  selectedPastProposalIds?: unknown;
  selectedPersonnel?: unknown;
};

export function hasApprovedAssetSelections(selections?: ApprovedAssetSelections | null): boolean {
  if (!selections) return false;
  return [
    selections.selectedProjectIds,
    selections.selectedPastProposalIds,
    selections.selectedPersonnel,
  ].some((value) => Array.isArray(value) && value.length > 0);
}

const EVIDENCE_DEPENDENT_SKILLS = new Set([
  "win_themes",
  "technical_writer",
  "key_personnel",
  "past_performance",
  "proposal_scorer",
]);

export function requiresWriterApprovedAssets(
  skillName: string,
  pursuitId: string | null | undefined,
  selections?: ApprovedAssetSelections | null,
): boolean {
  return Boolean(pursuitId) && EVIDENCE_DEPENDENT_SKILLS.has(skillName) && !hasApprovedAssetSelections(selections);
}

/** The shared 0.5 evidence-quality + 0.3 priority + 0.2 relevance formula. */
export function scoreDeterministicEvidence(input: {
  evidenceWeight: number;
  priorityScore: number;
  relevanceBoost: number;
}): number {
  return input.evidenceWeight * 0.5 + input.priorityScore * 0.3 + input.relevanceBoost * 0.2;
}

const GENERIC_TERMS = new Set([
  "and", "the", "for", "with", "services", "service", "engineering", "proposal", "project",
]);

const TYPE_WEIGHT: Record<string, number> = {
  resume: 1,
  certification: 1,
  project_sheet: 1,
  past_proposal: 0.9,
  rate_sheet: 1,
  spreadsheet: 0.8,
};

const PRICING_PATTERN = /(?:\$\s?[\d,.]+|\b(?:fee|price|billing rate|labor rate|hourly rate|not-to-exceed|NTE)\b)/i;

function tokens(value: string): Set<string> {
  return new Set(
    value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !GENERIC_TERMS.has(token)),
  );
}

function metadataText(metadata: unknown): string {
  return metadata && typeof metadata === "object" ? JSON.stringify(metadata) : "";
}

export function knowledgeHubDocumentText(document: KnowledgeHubDocument): string {
  return [
    document.title,
    document.fileName,
    document.tags,
    document.staffName,
    document.contractValue,
    document.extractedText,
    metadataText(document.extractedMeta),
  ].filter(Boolean).join("\n");
}

function requirementText(requirements: unknown): string {
  if (typeof requirements === "string") return requirements;
  return requirements ? JSON.stringify(requirements) : "";
}

function overlapRatio(target: Set<string>, candidate: Set<string>): number {
  if (target.size === 0) return 0;
  let matches = 0;
  for (const term of Array.from(target)) if (candidate.has(term)) matches += 1;
  return matches / target.size;
}

/**
 * Shared deterministic ranking for all Knowledge Hub suggestion callers.
 * Its 0.5 type/chunk-weight + 0.3 priority + 0.2 relevance structure mirrors
 * evidenceBundleBuilder's evidence ranking while remaining inspectable at document level.
 */
export function rankKnowledgeHubDocuments(
  documents: KnowledgeHubDocument[],
  options: MatchOptions,
): DeterministicMatch[] {
  const serviceTerms = tokens((options.serviceLines ?? []).join(" "));
  const requirementTerms = tokens(requirementText(options.personnelRequirements));

  return documents
    .filter((document) => {
      if (!options.docTypes.includes(document.docType ?? "")) return false;
      return !options.requirePricing || PRICING_PATTERN.test(knowledgeHubDocumentText(document));
    })
    .map((document) => {
      const candidateTerms = tokens(knowledgeHubDocumentText(document));
      const serviceLineBoost = overlapRatio(serviceTerms, candidateTerms);
      const requirementBoost = overlapRatio(requirementTerms, candidateTerms);
      const relevanceBoost = requirementTerms.size > 0
        ? (serviceLineBoost + requirementBoost) / 2
        : serviceLineBoost;
      const chunkWeight = TYPE_WEIGHT[document.docType ?? ""] ?? 0.5;
      const priorityScore = options.docTypes.indexOf(document.docType ?? "") === 0 ? 1 : 0.7;
      const relevanceScore = chunkWeight * 0.5 + priorityScore * 0.3 + relevanceBoost * 0.2;
      const reasons = [
        `Document type: ${document.docType ?? "other"}`,
        ...(serviceLineBoost > 0 ? [`Service-line overlap: ${Math.round(serviceLineBoost * 100)}%`] : []),
        ...(requirementBoost > 0 ? [`Personnel-requirement overlap: ${Math.round(requirementBoost * 100)}%`] : []),
        ...(options.requirePricing ? ["Contains stated pricing evidence"] : []),
      ];
      return { document, relevanceScore, autoMatched: true as const, reasons };
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore || (left.document.title ?? "").localeCompare(right.document.title ?? ""))
    .slice(0, options.limit ?? 5);
}

export function selectionSourceLabel(source?: MatchSelectionSource): string {
  return source === "suggested_approved" ? "Writer-approved suggestion" : "Manual selection";
}
