export type DraftWinTheme = {
  themeId?: string;
  title: string;
  statement: string;
  rationale: string;
  proof: string;
  applicableSections?: string[];
};

export type DraftWinThemeOutput = { winThemes: DraftWinTheme[] };

export type WinThemeDraftDisplay =
  | { kind: "cards"; data: DraftWinThemeOutput }
  | { kind: "recovery" }
  | { kind: "prose" };

/** Returns a display-safe Win Themes payload only when the saved section is valid structured output. */
export function parseWinThemeDraft(content: string | null | undefined): DraftWinThemeOutput | null {
  if (!content?.trim()) return null;
  try {
    const trimmed = content.trim();
    const json = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
    const parsed = JSON.parse(json) as unknown;
    const candidates = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { winThemes?: unknown }).winThemes)
        ? (parsed as { winThemes: unknown[] }).winThemes
        : null;
    if (!candidates) return null;

    const winThemes = candidates.flatMap((candidate, index) => {
      if (!candidate || typeof candidate !== "object") return [];
      const value = candidate as Record<string, unknown>;
      const title = String(value.title ?? value.name ?? `Win Theme ${index + 1}`).trim().replace(/^(\*\*|__)(.*)(\*\*|__)$/, "$2");
      const statement = String(value.statement ?? value.theme ?? value.description ?? "").trim();
      const rationale = String(value.rationale ?? value.whyItMatters ?? "").trim();
      const proof = String(value.proof ?? value.proofPoint ?? value.evidence ?? "").trim();
      if (!statement) return [];
      return [{
        themeId: typeof value.themeId === "string" ? value.themeId : undefined,
        title,
        statement,
        rationale,
        proof,
        applicableSections: Array.isArray(value.applicableSections)
          ? value.applicableSections.filter((section): section is string => typeof section === "string")
          : undefined,
      }];
    });
    return winThemes.length > 0 ? { winThemes } : null;
  } catch {
    return null;
  }
}

/** Keeps JSON-like legacy payloads out of proposal prose while allowing normal narrative content through. */
export function getWinThemeDraftDisplay(content: string | null | undefined): WinThemeDraftDisplay {
  const data = parseWinThemeDraft(content);
  if (data) return { kind: "cards", data };
  const trimmed = content?.trim() ?? "";
  return trimmed.startsWith("{") || trimmed.startsWith("[") || /^```(?:json)?/i.test(trimmed)
    ? { kind: "recovery" }
    : { kind: "prose" };
}
