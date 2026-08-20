export type GoNoGoRecommendation = "GO" | "NO-GO" | "CONDITIONAL GO";

export interface NormalizedGoNoGoResult {
  score: number;
  recommendation: GoNoGoRecommendation;
  rationale: string;
  strengths: string[];
  risks: string[];
  winThemes: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim().replace(/^[•*-]\s*/, "")).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return toStringArray(parsed);
    } catch {
      // Treat a prose or bullet-delimited response as a single/multiple list values.
    }
    return value.split(/\n|(?:^|\s)[•-]\s+/).map((item) => item.trim().replace(/^[•*-]\s*/, "")).filter(Boolean);
  }
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(String).map((item) => item.trim().replace(/^[•*-]\s*/, "")).filter(Boolean);
  return [];
}

export function normalizeGoNoGoResult(value: unknown): NormalizedGoNoGoResult {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const numericScore = Number(raw.score);
  const recommendation = raw.recommendation === "GO" || raw.recommendation === "NO-GO" || raw.recommendation === "CONDITIONAL GO"
    ? raw.recommendation
    : "CONDITIONAL GO";
  return {
    score: Number.isFinite(numericScore) ? Math.max(0, Math.min(100, numericScore)) : 50,
    recommendation,
    rationale: typeof raw.rationale === "string" ? raw.rationale : String(raw.rationale ?? "No rationale returned."),
    strengths: toStringArray(raw.strengths),
    risks: toStringArray(raw.risks),
    winThemes: toStringArray(raw.winThemes),
  };
}
