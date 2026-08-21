import { describe, expect, it } from "vitest";
import { getWinThemeDraftDisplay, parseWinThemeDraft } from "./winThemeDraft";

describe("parseWinThemeDraft", () => {
  it("parses saved Win Themes JSON into display-safe structured cards", () => {
    expect(parseWinThemeDraft(JSON.stringify({
      winThemes: [{ title: "Proven delivery", statement: "We reduce risk.", rationale: "Relevant experience.", proof: "12 similar projects." }],
    }))).toEqual({
      winThemes: [{ title: "Proven delivery", statement: "We reduce risk.", rationale: "Relevant experience.", proof: "12 similar projects.", applicableSections: undefined }],
    });
  });

  it("parses the fenced JSON shape persisted by older Draft Mode sections", () => {
    const output = parseWinThemeDraft("```json\n{\"winThemes\":[{\"themeId\":\"WT1\",\"title\":\"**Remedial Design**\",\"statement\":\"Integrated delivery\",\"rationale\":\"NJDEP alignment\"}]}\n```");
    expect(output?.winThemes[0]).toMatchObject({
      title: "Remedial Design",
      statement: "Integrated delivery",
      rationale: "NJDEP alignment",
    });
  });

  it("leaves prose and malformed JSON to the ordinary proposal renderer", () => {
    expect(parseWinThemeDraft("A narrative win theme")).toBeNull();
    expect(parseWinThemeDraft("{not-json")).toBeNull();
  });

  it("identifies malformed JSON-like payloads for a readable recovery view", () => {
    expect(getWinThemeDraftDisplay('{"winThemes": invalid}')).toEqual({ kind: "recovery" });
    expect(getWinThemeDraftDisplay("A narrative win theme")).toEqual({ kind: "prose" });
  });
});
