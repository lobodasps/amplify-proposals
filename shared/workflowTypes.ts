/**
 * shared/workflowTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared types for the Proposal Workspace sequential skill workflow.
 * Imported by both server (tRPC router) and client (React orchestrator).
 * Must remain framework-agnostic (no React, no Drizzle, no tRPC imports).
 */

// ─── Skill Names ──────────────────────────────────────────────────────────────

/**
 * The ordered list of skills in the sequential workflow.
 * Order is significant: downstream skills depend on upstream outputs.
 */
export const WORKFLOW_SKILL_NAMES = [
  "rfp_parser",
  "win_themes",
  "technical_outline",
  "technical_writer",
  "key_personnel",
  "past_performance",
  "fee_estimator",
  "proposal_scorer",
] as const;

export type WorkflowSkillName = (typeof WORKFLOW_SKILL_NAMES)[number];

// ─── Skill Status ─────────────────────────────────────────────────────────────

export type SkillStatus = "pending" | "running" | "complete" | "error";

export interface SkillStateEntry {
  status: SkillStatus;
  startedAt?: string;   // ISO timestamp
  completedAt?: string; // ISO timestamp
  errorMessage?: string;
  /** Which model/provider was used */
  model?: string;
  provider?: string;
  /** Live sub-step message written during long-running operations (e.g. shredding file X of Y) */
  subStepMessage?: string;
}

/** Full workflow state — stored in rfpSessions.workflowState */
export type WorkflowState = Partial<Record<WorkflowSkillName, SkillStateEntry>>;

/** Full skill outputs — stored in rfpSessions.skillOutputs */
export type SkillOutputs = Partial<Record<WorkflowSkillName, string>>;

// ─── Skill Metadata (for UI display) ─────────────────────────────────────────

export interface SkillMeta {
  name: WorkflowSkillName;
  displayName: string;
  description: string;
  /** Which upstream skill outputs this skill reads */
  dependsOn: WorkflowSkillName[];
  /** Approximate max seconds this skill may take */
  estimatedSeconds: number;
}

export const SKILL_META: Record<WorkflowSkillName, SkillMeta> = {
  rfp_parser: {
    name: "rfp_parser",
    displayName: "RFP Parser & Compliance Checker",
    description: "Extracts requirements matrix, evaluation criteria, key dates, page limits, and mandatory items from the uploaded RFP.",
    dependsOn: [],
    estimatedSeconds: 20,
  },
  win_themes: {
    name: "win_themes",
    displayName: "Win Theme Generator",
    description: "Develops 3–5 differentiated win themes with evidence citations from past performance and firm capabilities.",
    dependsOn: ["rfp_parser"],
    estimatedSeconds: 25,
  },
  technical_outline: {
    name: "technical_outline",
    displayName: "Technical Approach Outliner",
    description: "Creates a section-by-section outline with key points, organized to directly address RFP evaluation criteria.",
    dependsOn: ["rfp_parser", "win_themes"],
    estimatedSeconds: 20,
  },
  technical_writer: {
    name: "technical_writer",
    displayName: "Technical Approach Writer",
    description: "Drafts the full technical approach narrative from the outline, incorporating win themes and firm experience.",
    dependsOn: ["rfp_parser", "win_themes", "technical_outline"],
    estimatedSeconds: 45,
  },
  key_personnel: {
    name: "key_personnel",
    displayName: "Key Personnel Matcher & Writer",
    description: "Matches RFP key personnel requirements to qualified staff and drafts the key personnel section.",
    dependsOn: ["rfp_parser"],
    estimatedSeconds: 30,
  },
  past_performance: {
    name: "past_performance",
    displayName: "Past Performance / SF-330 Section F",
    description: "Selects and formats 5–8 relevant project descriptions to match RFP past performance requirements.",
    dependsOn: ["rfp_parser"],
    estimatedSeconds: 35,
  },
  fee_estimator: {
    name: "fee_estimator",
    displayName: "Fee Estimator",
    description: "Generates a preliminary fee breakdown by task and phase based on scope and labor categories.",
    dependsOn: ["rfp_parser", "technical_outline"],
    estimatedSeconds: 25,
  },
  proposal_scorer: {
    name: "proposal_scorer",
    displayName: "Proposal Scorer",
    description: "Scores the full proposal draft section-by-section against RFP evaluation criteria and flags gaps.",
    dependsOn: ["rfp_parser", "technical_writer", "key_personnel", "past_performance"],
    estimatedSeconds: 30,
  },
};

/** Ordered array of skill metadata for sequential execution */
export const ORDERED_SKILLS: SkillMeta[] = WORKFLOW_SKILL_NAMES.map(
  (name) => SKILL_META[name]
);

// ─── Parsed RFP Data (output of rfp_parser skill) ─────────────────────────────

export interface ParsedRfpData {
  projectTitle: string;
  agency: string;
  rfpNumber: string;
  submissionDeadline: string;
  estimatedValue: string;
  serviceLines: string[];
  evaluationCriteria: Array<{
    id: string;
    title: string;
    weight: string;
    description: string;
  }>;
  keyPersonnelRequirements: Array<{
    role: string;
    requiredCertifications: string[];
    minimumYearsExperience: number;
    description: string;
  }>;
  pageLimits: Array<{ section: string; limit: string }>;
  mandatoryItems: string[];
  submissionFormat: string;
  scopeSummary: string;
  conflictsDetected: Array<{
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
  }>;
}

// ─── Proposal Scorer Output ───────────────────────────────────────────────────

export interface ScorerCriterionScore {
  criterionId: string;
  criterionTitle: string;
  score: number; // 0-100
  addressedWell: string;
  gaps: string[];
  improvements: string[];
}

export interface ScorerOutput {
  overallScore: number; // 0-100
  sectionScores: Record<string, number>;
  criteriaScores: ScorerCriterionScore[];
  topGaps: string[];
  topImprovements: string[];
  summary: string;
}

// ─── executeSkill Input/Output ────────────────────────────────────────────────

export interface ExecuteSkillInput {
  sessionId: number;
  skillName: WorkflowSkillName;
}

export interface ExecuteSkillOutput {
  success: boolean;
  skillName: WorkflowSkillName;
  output: string;
  model: string;
  provider: string;
  completedAt: string;
}

// ─── Resume State (computed by frontend from workflowState) ───────────────────

export interface ResumeState {
  /** The next skill to run (first pending skill after all complete ones) */
  nextSkillToRun: WorkflowSkillName | null;
  /** Number of skills already complete */
  completedCount: number;
  /** Whether all skills are complete */
  isFullyComplete: boolean;
  /** Whether any skill has errored */
  hasError: boolean;
  /** The errored skill name if any */
  erroredSkill: WorkflowSkillName | null;
}

/**
 * Computes resume state from a workflowState record.
 * Used by the frontend orchestrator to determine where to resume.
 */
export function computeResumeState(
  workflowState: WorkflowState | null | undefined
): ResumeState {
  if (!workflowState) {
    return {
      nextSkillToRun: WORKFLOW_SKILL_NAMES[0],
      completedCount: 0,
      isFullyComplete: false,
      hasError: false,
      erroredSkill: null,
    };
  }

  let completedCount = 0;
  let nextSkillToRun: WorkflowSkillName | null = null;
  let hasError = false;
  let erroredSkill: WorkflowSkillName | null = null;

  for (const skillName of WORKFLOW_SKILL_NAMES) {
    const entry = workflowState[skillName];
    if (entry?.status === "complete") {
      completedCount++;
    } else if (entry?.status === "error") {
      hasError = true;
      erroredSkill = skillName;
      if (!nextSkillToRun) nextSkillToRun = skillName; // retry from error
      break;
    } else {
      // pending or running — this is the next to run
      if (!nextSkillToRun) nextSkillToRun = skillName;
      break;
    }
  }

  return {
    nextSkillToRun,
    completedCount,
    isFullyComplete: completedCount === WORKFLOW_SKILL_NAMES.length,
    hasError,
    erroredSkill,
  };
}
