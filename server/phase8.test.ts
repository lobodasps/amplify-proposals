/**
 * Phase 8 Track C — Generation Skill Prompt Grounding Tests
 *
 * Verifies that all four generation skills in DEFAULT_SKILLS have:
 * 1. `evidenceContext` in their `templateVariables` array
 * 2. `{{evidenceContext}}` token in their `userPromptTemplate`
 * 3. Grounding instruction text in their `systemPrompt`
 * 4. All pre-existing template variables preserved (no regressions)
 */

import { describe, it, expect } from "vitest";

// ── Import DEFAULT_SKILLS directly ────────────────────────────────────────────
// We import the raw object to test the seeded defaults without DB interaction.
// The actual DB-seeded values come from this same object via seedDefaultSkills().
import { DEFAULT_SKILLS } from "./_core/llmSkill";

// ── Skills under test ─────────────────────────────────────────────────────────
const GENERATION_SKILLS = [
  "win_theme_generator",
  "technical_approach_writer",
  "key_personnel_writer",
  "project_experience_writer",
] as const;

// ── Pre-existing variables that must NOT be removed ───────────────────────────
const REQUIRED_LEGACY_VARS: Record<string, string[]> = {
  win_theme_generator: [
    "pursuitTitle",
    "agency",
    "serviceLines",
    "value",
    "dueDate",
    "rfpSummary",
    "evaluationCriteria",
    "firmStrengths",
  ],
  technical_approach_writer: [
    "agency",
    "pursuitTitle",
    "scopeSummary",
    "serviceLines",
    "evaluationCriteria",
    "winThemes",
    "relevantProjects",
    "rfpRequirements",
  ],
  key_personnel_writer: [
    "agency",
    "pursuitTitle",
    "serviceLines",
    "evaluationCriteria",
    "rfpPersonnelRequirements",
    "selectedPersonnel",
  ],
  project_experience_writer: [
    "agency",
    "pursuitTitle",
    "serviceLines",
    "evaluationCriteria",
    "selectedProjects",
  ],
};

// ── Grounding instruction phrases that must appear in systemPrompt ─────────────
const GROUNDING_PHRASES = [
  "GROUNDING RULES",
  "Do NOT invent",
  "evidence bundle is empty",
];

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 8 Track C — evidenceContext in templateVariables", () => {
  for (const skillName of GENERATION_SKILLS) {
    it(`${skillName} includes evidenceContext in templateVariables`, () => {
      const skill = DEFAULT_SKILLS[skillName];
      expect(skill).toBeDefined();
      expect(skill.templateVariables).toContain("evidenceContext");
    });
  }
});

describe("Phase 8 Track C — {{evidenceContext}} token in userPromptTemplate", () => {
  for (const skillName of GENERATION_SKILLS) {
    it(`${skillName} userPromptTemplate contains {{evidenceContext}}`, () => {
      const skill = DEFAULT_SKILLS[skillName];
      expect(skill.userPromptTemplate).toContain("{{evidenceContext}}");
    });
  }
});

describe("Phase 8 Track C — grounding instructions in systemPrompt", () => {
  for (const skillName of GENERATION_SKILLS) {
    for (const phrase of GROUNDING_PHRASES) {
      it(`${skillName} systemPrompt contains "${phrase}"`, () => {
        const skill = DEFAULT_SKILLS[skillName];
        expect(skill.systemPrompt).toContain(phrase);
      });
    }
  }
});

describe("Phase 8 Track C — legacy variables preserved (no regressions)", () => {
  for (const skillName of GENERATION_SKILLS) {
    const legacyVars = REQUIRED_LEGACY_VARS[skillName];
    for (const varName of legacyVars) {
      it(`${skillName} still has legacy variable "${varName}"`, () => {
        const skill = DEFAULT_SKILLS[skillName];
        expect(skill.templateVariables).toContain(varName);
      });
    }
  }
});

describe("Phase 8 Track C — evidenceContext is last in templateVariables (additive)", () => {
  for (const skillName of GENERATION_SKILLS) {
    it(`${skillName} has evidenceContext as the last templateVariable`, () => {
      const skill = DEFAULT_SKILLS[skillName];
      const vars = skill.templateVariables;
      expect(vars[vars.length - 1]).toBe("evidenceContext");
    });
  }
});

describe("Phase 8 Track C — proposal_scorer evidenceContext unchanged", () => {
  it("proposal_scorer still has evidenceContext in templateVariables (Phase 5 regression)", () => {
    const skill = DEFAULT_SKILLS["proposal_scorer"];
    expect(skill).toBeDefined();
    expect(skill.templateVariables).toContain("evidenceContext");
  });

  it("proposal_scorer userPromptTemplate still contains {{evidenceContext}} (Phase 5 regression)", () => {
    const skill = DEFAULT_SKILLS["proposal_scorer"];
    expect(skill.userPromptTemplate).toContain("{{evidenceContext}}");
  });
});

describe("Phase 8 Track C — outputType preserved", () => {
  it("win_theme_generator outputType is still json", () => {
    expect(DEFAULT_SKILLS["win_theme_generator"].outputType).toBe("json");
  });

  it("technical_approach_writer outputType is still prose", () => {
    expect(DEFAULT_SKILLS["technical_approach_writer"].outputType).toBe("prose");
  });

  it("key_personnel_writer outputType is still prose", () => {
    expect(DEFAULT_SKILLS["key_personnel_writer"].outputType).toBe("prose");
  });

  it("project_experience_writer outputType is still prose", () => {
    expect(DEFAULT_SKILLS["project_experience_writer"].outputType).toBe("prose");
  });
});
