export interface NormalizedScoredCriterion {
  criterion: string;
  weight?: number | string;
  score: number;
  maxScore?: number;
  gaps: string[];
  improvements: string[];
}

export interface NormalizedProposalScorecard {
  overallScore: number;
  criteria: NormalizedScoredCriterion[];
  topGaps: string[];
  improvements: string[];
  topImprovements: string[];
  summary?: string;
  evidenceCoverage?: number;
  unsupportedClaims: Array<{ section: string; claim: string; reason: string; relatedCriterion?: string }>;
  winThemesCoverage: Array<{ theme: string; coveredInSections: string[]; coverageScore?: number; notes?: string }>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parsed(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

export function toScorecardStringList(value: unknown): string[] {
  const resolved = parsed(value);
  if (Array.isArray(resolved)) return resolved.flatMap(toScorecardStringList).filter(Boolean);
  if (typeof resolved === "string") {
    return resolved.split(/\n+/).map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  }
  const obj = record(resolved);
  if (obj) return Object.values(obj).flatMap(toScorecardStringList).filter(Boolean);
  if (resolved == null) return [];
  return [String(resolved)];
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  const resolved = parsed(value);
  if (Array.isArray(resolved)) return resolved.map(record).filter((item): item is Record<string, unknown> => item !== null);
  const obj = record(resolved);
  return obj ? [obj] : [];
}

export function normalizeProposalScorecard(value: unknown): NormalizedProposalScorecard {
  const source = record(parsed(value)) ?? {};
  const rawCriteria = source.criteria ?? source.criteriaScores;
  const criteria = toObjectArray(rawCriteria).map((item) => ({
    criterion: typeof item.criterion === "string" ? item.criterion : typeof item.title === "string" ? item.title : "Untitled criterion",
    weight: typeof item.weight === "number" || typeof item.weight === "string" ? item.weight : undefined,
    score: toNumber(item.score),
    maxScore: item.maxScore == null ? undefined : toNumber(item.maxScore, 100),
    gaps: toScorecardStringList(item.gaps),
    improvements: toScorecardStringList(item.improvements),
  }));
  const rawClaims = toObjectArray(source.unsupportedClaims);
  const rawCoverage = toObjectArray(source.winThemesCoverage);
  const overallScore = toNumber(source.overallScore ?? source.complianceScore);
  const evidence = source.evidenceCoverage == null ? undefined : toNumber(source.evidenceCoverage);

  return {
    overallScore,
    criteria,
    topGaps: toScorecardStringList(source.topGaps ?? source.gaps),
    improvements: toScorecardStringList(source.improvements),
    topImprovements: toScorecardStringList(source.topImprovements),
    summary: typeof source.summary === "string" ? source.summary : undefined,
    evidenceCoverage: evidence,
    unsupportedClaims: rawClaims.map((item) => ({
      section: typeof item.section === "string" ? item.section : "Proposal",
      claim: typeof item.claim === "string" ? item.claim : toScorecardStringList(item.claim).join(" "),
      reason: typeof item.reason === "string" ? item.reason : toScorecardStringList(item.reason).join(" "),
      relatedCriterion: typeof item.relatedCriterion === "string" ? item.relatedCriterion : undefined,
    })).filter((item) => item.claim || item.reason),
    winThemesCoverage: rawCoverage.map((item) => ({
      theme: typeof item.theme === "string" ? item.theme : "Untitled theme",
      coveredInSections: toScorecardStringList(item.coveredInSections),
      coverageScore: item.coverageScore == null ? undefined : toNumber(item.coverageScore),
      notes: typeof item.notes === "string" ? item.notes : undefined,
    })),
  };
}
