export type ProposalScoreDisplay =
  | { kind: "scored"; score: number }
  | { kind: "unscored"; reason: string }
  | { kind: "not_run" };

const PLACEHOLDER_PATTERN = /{{\s*(evaluationCriteria|contentToScore)\s*}}/i;

function isMeaningful(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && !PLACEHOLDER_PATTERN.test(value));
}

function criteriaLine(criterion: unknown, index: number): string {
  if (typeof criterion === "string") return criterion.trim();
  if (!criterion || typeof criterion !== "object") return "";
  const record = criterion as Record<string, unknown>;
  const title = String(record.title ?? record.name ?? record.criterion ?? `Criterion ${index + 1}`).trim();
  const description = String(record.description ?? record.detail ?? record.feedback ?? "").trim();
  const weight = String(record.weight ?? record.points ?? "").trim();
  return [title, weight ? `(${weight})` : "", description].filter(Boolean).join(" — ");
}

/** Converts parsed RFP criteria into readable prompt text and avoids passing an empty JSON array to a scorer. */
export function formatEvaluationCriteria(criteria: unknown): string {
  const values = Array.isArray(criteria) ? criteria : typeof criteria === "string" ? [criteria] : [];
  const formatted = values.map(criteriaLine).filter(Boolean);
  return formatted.length > 0 ? formatted.map((item, index) => `${index + 1}. ${item}`).join("\n") : "";
}

/** Builds the actual full proposal text used by the scorer from completed workflow outputs. */
export function assembleProposalContent(sections: Array<{ title: string; content?: string | null }>): string {
  return sections
    .filter((section) => isMeaningful(section.content))
    .map((section) => `## ${section.title}\n${section.content!.trim()}`)
    .join("\n\n");
}

export function getScoringReadiness(evaluationCriteria: string, contentToScore: string): { ready: boolean; reason?: string } {
  if (!isMeaningful(evaluationCriteria)) {
    return { ready: false, reason: "No usable RFP evaluation criteria were extracted. Revisit the RFP review before scoring." };
  }
  if (!isMeaningful(contentToScore)) {
    return { ready: false, reason: "No completed proposal content is available to score yet." };
  }
  return { ready: true };
}

/** Supplies the exact scorer-template variables for a single generated proposal section. */
export function buildSectionScoringInput(evaluationCriteria: string, sectionTitle: string, content: string) {
  const contentToScore = assembleProposalContent([{ title: sectionTitle, content }]);
  return {
    evaluationCriteria,
    contentToScore,
    readiness: getScoringReadiness(evaluationCriteria, contentToScore),
  };
}

/** Maps persisted score state to an honest UI state; invalid historical 0 scores are not quality scores. */
export function getProposalScoreDisplay(liveScore: unknown, details: unknown): ProposalScoreDisplay {
  const record = details && typeof details === "object" ? details as Record<string, unknown> : null;
  const summary = String(record?.overallSummary ?? record?.summary ?? record?.reason ?? "");
  const unscored = record?.scoreStatus === "unscored"
    || record?.unscored === true
    || PLACEHOLDER_PATTERN.test(summary)
    || /could not be substantively scored|no compliant, evaluable content|missing evaluation data/i.test(summary);
  if (unscored) {
    return { kind: "unscored", reason: summary || "The required RFP criteria or completed proposal content was unavailable." };
  }
  return typeof liveScore === "number" && Number.isFinite(liveScore)
    ? { kind: "scored", score: liveScore }
    : { kind: "not_run" };
}

export function createUnscoredScoreOutput(reason: string) {
  return {
    scoreStatus: "unscored" as const,
    unscored: true,
    reason,
    overallSummary: reason,
    criteriaScores: [],
    topGaps: [],
    readyToSubmit: false,
  };
}
