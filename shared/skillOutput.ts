export function requireNonEmptySkillOutput(content: unknown, skillName: string): string {
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => {
          if (!part || typeof part !== "object") return "";
          const textPart = part as { type?: unknown; text?: unknown };
          return textPart.type === "text" && typeof textPart.text === "string" ? textPart.text : "";
        }).join("")
      : "";
  const normalized = text.trim();
  if (!normalized) {
    throw new Error(`${skillName} returned an empty response. Please retry the skill.`);
  }
  return normalized;
}

export function isBlankSkillOutput(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length === 0;
  if (Array.isArray(content)) return content.every((part) => {
    if (!part || typeof part !== "object") return true;
    const textPart = part as { type?: unknown; text?: unknown };
    return textPart.type !== "text" || typeof textPart.text !== "string" || textPart.text.trim().length === 0;
  });
  return true;
}
