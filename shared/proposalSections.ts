/**
 * shared/proposalSections.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Types and constants for the RFP-driven proposal section structure.
 * Imported by both server (generation procedures) and client (workspace UI).
 * Must remain framework-agnostic.
 */

// ─── Section Types ───────────────────────────────────────────────────────────

export const SECTION_TYPES = [
  "cover_letter",
  "executive_summary",
  "firm_qualifications",
  "technical_approach",
  "project_experience",
  "key_personnel",
  "mbe_dbe",
  "fee_proposal",
  "other",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

// ─── Section Status ──────────────────────────────────────────────────────────

export type SectionStatus =
  | "not_started"
  | "generating"
  | "scoring"
  | "complete"
  | "needs_attention"
  | "error";

// ─── Section-to-Skill Mapping ────────────────────────────────────────────────

export interface SectionSkillMapping {
  writerSkill: string;
  scorerSkill: string | null;
}

/**
 * Maps each section type to its writer skill and scorer skill.
 * Writer skill is the ai_skills.skillType used to generate the section.
 * Scorer skill is the ai_skills.skillType used to score it (null = not scored).
 */
export const SECTION_TO_SKILL_MAP: Record<SectionType, SectionSkillMapping> = {
  cover_letter:        { writerSkill: "proposal_writer",              scorerSkill: "proposal_scorer" },
  executive_summary:   { writerSkill: "executive_summary_writer",     scorerSkill: "proposal_scorer" },
  firm_qualifications: { writerSkill: "firm_qualifications_writer",   scorerSkill: "proposal_scorer" },
  technical_approach:  { writerSkill: "technical_approach_writer",    scorerSkill: "proposal_scorer" },
  project_experience:  { writerSkill: "project_experience_writer",   scorerSkill: "proposal_scorer" },
  key_personnel:       { writerSkill: "key_personnel_writer",        scorerSkill: "proposal_scorer" },
  mbe_dbe:             { writerSkill: "proposal_writer",              scorerSkill: "proposal_scorer" },
  fee_proposal:        { writerSkill: "proposal_writer",              scorerSkill: null },
  other:               { writerSkill: "proposal_writer",              scorerSkill: "proposal_scorer" },
};

// ─── Default AEC Proposal Sections ──────────────────────────────────────────

export interface DefaultSectionDef {
  sectionType: SectionType;
  title: string;
  pageLimit: number;
  wordLimit: number; // approximate: pageLimit * 450 words/page
  order: number;
}

/**
 * Default section structure when no RFP section_map is available.
 * Standard AEC proposal format.
 */
export const DEFAULT_SECTIONS: DefaultSectionDef[] = [
  { sectionType: "cover_letter",        title: "Cover Letter",               pageLimit: 1,  wordLimit: 450,  order: 1 },
  { sectionType: "executive_summary",   title: "Executive Summary",          pageLimit: 2,  wordLimit: 900,  order: 2 },
  { sectionType: "firm_qualifications", title: "Firm Qualifications",        pageLimit: 3,  wordLimit: 1350, order: 3 },
  { sectionType: "technical_approach",  title: "Technical Approach",         pageLimit: 5,  wordLimit: 2250, order: 4 },
  { sectionType: "project_experience",  title: "Project Experience",         pageLimit: 4,  wordLimit: 1800, order: 5 },
  { sectionType: "key_personnel",       title: "Key Personnel",             pageLimit: 3,  wordLimit: 1350, order: 6 },
  { sectionType: "mbe_dbe",             title: "MBE/DBE Participation Plan", pageLimit: 1,  wordLimit: 450,  order: 7 },
  { sectionType: "fee_proposal",        title: "Fee Proposal",              pageLimit: 0,  wordLimit: 0,    order: 8 },
];

// ─── Proposal Section Data Model ────────────────────────────────────────────

/**
 * Per-section data stored in proposals.sections jsonb column.
 */
export interface ProposalSection {
  sectionType: SectionType;
  title: string;
  pageLimit: number;
  wordLimit: number;
  order: number;
  /** AI-generated content (preserved even after user edits) */
  content: string | null;
  /** User-edited content (null if user hasn't modified the AI draft) */
  editedContent: string | null;
  /** Current word count of the active content */
  wordCount: number;
  /** Section status */
  status: SectionStatus;
  /** Generation timestamp */
  generatedAt: string | null;
  /** Score from proposal_scorer (0-100) */
  score: number | null;
  /** Scoring timestamp */
  scoredAt: string | null;
  /** Full scorer output JSON */
  scorerOutput: ScorerSectionOutput | null;
  /** User edit timestamp */
  editedAt: string | null;
  /** Error message if generation failed */
  errorMessage: string | null;
}

/**
 * Scorer output for a single section.
 */
export interface ScorerSectionOutput {
  score: number;
  criteriaScores: Array<{
    criterionId: string;
    criterionTitle: string;
    score: number;
    status: "met" | "partially_met" | "not_met";
    feedback: string;
  }>;
  gaps: string[];
  improvements: string[];
  summary: string;
  winThemesCovered: string[];
}

// ─── Proposal Sections Record ────────────────────────────────────────────────

/**
 * The full sections record stored in proposals.sections jsonb.
 * Keyed by sectionType.
 */
export type ProposalSectionsRecord = Record<string, ProposalSection>;

// ─── Generation Context (passed to buildSkillVariables) ─────────────────────

export interface SectionGenerationContext {
  sectionType: SectionType;
  sectionTitle: string;
  wordLimit: number;
  rfpRequirements: string;
  winThemes: string;
  previousScore: number | null;
  scorerGaps: string | null;
}

// ─── Helper: Compute overall compliance ─────────────────────────────────────

/**
 * Computes overall compliance score from section scores.
 * Simple average of all scored sections (excludes unscored like fee_proposal).
 */
export function computeOverallCompliance(sections: ProposalSectionsRecord): {
  overallScore: number;
  completedCount: number;
  totalCount: number;
} {
  const entries = Object.values(sections);
  const totalCount = entries.length;
  const scored = entries.filter((s) => s.score !== null && s.score !== undefined);
  const completedCount = entries.filter(
    (s) => s.status === "complete" || s.status === "needs_attention"
  ).length;

  if (scored.length === 0) {
    return { overallScore: 0, completedCount, totalCount };
  }

  const sum = scored.reduce((acc, s) => acc + (s.score ?? 0), 0);
  const overallScore = Math.round(sum / scored.length);

  return { overallScore, completedCount, totalCount };
}

/**
 * Infer section type from a free-text section title (from RFP section_map).
 * Falls back to "other" if no match.
 */
export function inferSectionType(title: string): SectionType {
  const lower = title.toLowerCase();
  if (/cover\s*letter|transmittal/i.test(lower)) return "cover_letter";
  if (/executive\s*summary|overview/i.test(lower)) return "executive_summary";
  if (/firm\s*(qualifications?|experience|capability|profile)/i.test(lower)) return "firm_qualifications";
  if (/technical\s*(approach|methodology|plan|solution)/i.test(lower)) return "technical_approach";
  if (/project\s*(experience|examples?|past\s*performance)|sf[\s-]*330.*section\s*f/i.test(lower)) return "project_experience";
  if (/key\s*personnel|staff(ing)?|team|resumes?|sf[\s-]*330.*section\s*e/i.test(lower)) return "key_personnel";
  if (/mbe|dbe|m\/wbe|disadvantaged|minority|participation/i.test(lower)) return "mbe_dbe";
  if (/fee|cost|price|budget|rate/i.test(lower)) return "fee_proposal";
  return "other";
}
