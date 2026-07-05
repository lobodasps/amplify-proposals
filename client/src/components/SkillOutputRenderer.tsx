/**
 * client/src/components/SkillOutputRenderer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes skill output to the correct renderer based on outputType:
 *   prose          → inline rich text editor (editable textarea)
 *   json           → skill-specific structured UI (no raw JSON shown)
 *   json_with_prose→ prose in editor + JSON metadata in sidebar
 *   unknown/error  → monospace code block + warning banner
 *
 * Skill-specific JSON renderers:
 *   win_theme_generator        → WinThemeCards
 *   requirements_matrix_builder→ ComplianceChecklist
 *   conflict_detector          → ConflictCards
 *   proposal_scorer            → ProposalScorecard
 *   (all other json skills)    → GenericJsonViewer (collapsible key/value)
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lightbulb,
  BarChart3,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { WorkflowSkillName } from "../../../shared/workflowTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillOutputType = "json" | "prose" | "json_with_prose";

interface RendererProps {
  skillName: WorkflowSkillName;
  output: string;
  outputType: SkillOutputType | null | undefined;
  sessionId: string;
  isComplete: boolean;
  onSaved: (newOutput: string) => void;
  /** Called when the user clicks Re-render to force prose rendering of a saved JSON section */
  onRerender?: () => void;
  /** True when the configured skill provider failed and the system default provider was used instead */
  usedDefaultModel?: boolean;
  /** Human-readable label of the default model that was used (e.g. 'openai/gpt-4o') */
  defaultModelName?: string;
}

// ─── Win Theme Cards ──────────────────────────────────────────────────────────

interface WinTheme {
  themeId?: string;
  title: string;
  statement: string;
  rationale: string;
  proof: string;
  applicableSections?: string[];
}

interface WinThemeOutput {
  winThemes: WinTheme[];
}

function WinThemeCards({ data }: { data: WinThemeOutput }) {
  const themes = data.winThemes ?? [];
  if (themes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No win themes generated.</p>
    );
  }
  return (
    <div className="space-y-4">
      {themes.map((theme, i) => (
        <div
          key={theme.themeId ?? i}
          className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug">
                {theme.title.replace(/\*\*/g, "")}
              </h3>
              {theme.themeId && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {theme.themeId}
                </span>
              )}
            </div>
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          </div>

          <div className="space-y-2 pl-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Statement
              </p>
              <p className="text-sm leading-relaxed">{theme.statement}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Rationale
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{theme.rationale}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Proof Point
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{theme.proof}</p>
            </div>
            {theme.applicableSections && theme.applicableSections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {theme.applicableSections.map((s, j) => (
                  <Badge key={j} variant="secondary" className="text-[10px] px-2 py-0">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Compliance Checklist ─────────────────────────────────────────────────────

interface Requirement {
  requirementId?: string;
  section?: string;
  pageRef?: string | null;
  requirement: string;
  requirementType?: "mandatory" | "scored" | "informational";
  proposalSection?: string;
  complianceMethod?: string;
  complianceStatus?: "addressed" | "partial" | "not_addressed";
  priority?: "high" | "medium" | "low";
  notes?: string | null;
}

interface RequirementsMatrixOutput {
  requirements: Requirement[];
  mandatoryCount?: number;
  scoredCount?: number;
  highPriorityGaps?: string[];
}

const COMPLIANCE_BADGE: Record<string, { label: string; className: string }> = {
  addressed: {
    label: "Addressed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  not_addressed: {
    label: "Gap",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  medium: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

function ComplianceChecklist({ data }: { data: RequirementsMatrixOutput }) {
  const reqs = data.requirements ?? [];
  const gaps = data.highPriorityGaps ?? [];

  const mandatory = reqs.filter((r) => r.requirementType === "mandatory");
  const scored = reqs.filter((r) => r.requirementType === "scored");
  const informational = reqs.filter((r) => r.requirementType === "informational");

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">{mandatory.length} Mandatory</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{scored.length} Scored</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{informational.length} Informational</span>
        </div>
      </div>

      {/* High priority gaps */}
      {gaps.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20 p-4">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ShieldX className="h-3.5 w-3.5" />
            High Priority Gaps ({gaps.length})
          </p>
          <ul className="space-y-1">
            {gaps.map((g, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">·</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Requirements table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-16">ID</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Requirement</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-28 hidden sm:table-cell">Proposal Section</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-24">Status</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-16 hidden md:table-cell">Priority</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((req, i) => {
              const compliance = COMPLIANCE_BADGE[req.complianceStatus ?? ""] ?? COMPLIANCE_BADGE.partial;
              const priorityCls = PRIORITY_BADGE[req.priority ?? "low"] ?? PRIORITY_BADGE.low;
              return (
                <tr
                  key={req.requirementId ?? i}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {req.requirementId ?? `R${i + 1}`}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium leading-snug">{req.requirement}</p>
                    {req.section && (
                      <p className="text-muted-foreground mt-0.5">{req.section}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {req.proposalSection ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${compliance.className}`}>
                      {compliance.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${priorityCls}`}>
                      {req.priority ?? "low"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Conflict Cards ───────────────────────────────────────────────────────────

interface Conflict {
  conflictId?: string;
  conflictType?: string;
  severity?: "high" | "medium" | "low";
  title: string;
  description: string;
  conflictingStatements?: string[];
  affectedSections?: string[];
  pageReferences?: string[];
  recommendation?: string;
  proposalRisk?: string;
}

interface ConflictDetectorOutput {
  conflicts: Conflict[];
  overallRiskLevel?: "high" | "medium" | "low";
  summary?: string;
}

const SEVERITY_CONFIG: Record<string, {
  icon: ReactNode;
  badgeCls: string;
  borderCls: string;
  bgCls: string;
}> = {
  high: {
    icon: <ShieldX className="h-4 w-4 text-red-500" />,
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    borderCls: "border-red-200 dark:border-red-800",
    bgCls: "bg-red-50/30 dark:bg-red-950/10",
  },
  medium: {
    icon: <ShieldAlert className="h-4 w-4 text-amber-500" />,
    badgeCls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    borderCls: "border-amber-200 dark:border-amber-800",
    bgCls: "bg-amber-50/30 dark:bg-amber-950/10",
  },
  low: {
    icon: <AlertTriangle className="h-4 w-4 text-blue-400" />,
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    borderCls: "border-blue-200 dark:border-blue-800",
    bgCls: "bg-blue-50/30 dark:bg-blue-950/10",
  },
};

function ConflictCards({ data }: { data: ConflictDetectorOutput }) {
  const conflicts = data.conflicts ?? [];
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">No conflicts detected</p>
        <p className="text-xs text-muted-foreground">The RFP appears internally consistent.</p>
      </div>
    );
  }

  const riskCfg = SEVERITY_CONFIG[data.overallRiskLevel ?? "medium"] ?? SEVERITY_CONFIG.medium;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`rounded-lg border p-4 ${riskCfg.borderCls} ${riskCfg.bgCls}`}>
        <div className="flex items-center gap-2 mb-1">
          {riskCfg.icon}
          <span className="text-sm font-semibold capitalize">
            Overall Risk: {data.overallRiskLevel ?? "unknown"}
          </span>
          <Badge className={`ml-auto text-[10px] px-2 py-0 ${riskCfg.badgeCls}`}>
            {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        {data.summary && (
          <p className="text-xs text-muted-foreground mt-1">{data.summary}</p>
        )}
      </div>

      {/* Conflict cards */}
      {conflicts.map((c, i) => {
        const cfg = SEVERITY_CONFIG[c.severity ?? "medium"] ?? SEVERITY_CONFIG.medium;
        const isOpen = expanded.has(i);
        return (
          <div key={c.conflictId ?? i} className={`rounded-xl border ${cfg.borderCls} overflow-hidden`}>
            <button
              className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/20 ${cfg.bgCls}`}
              onClick={() => toggle(i)}
            >
              <span className="shrink-0 mt-0.5">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{c.title}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg.badgeCls}`}>
                    {c.severity ?? "medium"}
                  </span>
                  {c.conflictType && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {c.conflictType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {c.description}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t bg-background/50">
                {c.conflictingStatements && c.conflictingStatements.length > 0 && (
                  <div className="pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Conflicting Statements
                    </p>
                    <ul className="space-y-1.5">
                      {c.conflictingStatements.map((s, j) => (
                        <li key={j} className="text-xs bg-muted/50 rounded px-3 py-1.5 italic">
                          "{s}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.recommendation && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Recommendation
                    </p>
                    <p className="text-xs leading-relaxed">{c.recommendation}</p>
                  </div>
                )}
                {c.proposalRisk && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Proposal Risk
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      {c.proposalRisk}
                    </p>
                  </div>
                )}
                {(c.affectedSections ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.affectedSections!.map((s, j) => (
                      <Badge key={j} variant="outline" className="text-[10px] px-2 py-0">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Proposal Scorecard ───────────────────────────────────────────────────────

interface ScoredCriterion {
  criterion: string;
  weight?: number | string;
  score: number;
  maxScore?: number;
  gaps?: string[];
  improvements?: string[];
}

interface ProposalScorerOutput {
  overallScore?: number;
  criteria?: ScoredCriterion[];
  topGaps?: string[];
  improvements?: string[];
  summary?: string;
  // Some LLM outputs use slightly different keys
  criteriaScores?: ScoredCriterion[];
  complianceScore?: number;
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.23,1,0.32,1)" }}
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.22}
        fontWeight="700"
        fill={color}
      >
        {score}
      </text>
    </svg>
  );
}

function ProposalScorecard({ data }: { data: ProposalScorerOutput }) {
  const overall = data.overallScore ?? data.complianceScore ?? 0;
  const criteria = data.criteria ?? data.criteriaScores ?? [];
  const gaps = data.topGaps ?? [];
  const improvements = data.improvements ?? [];

  const overallColor =
    overall >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : overall >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <div className="flex items-center gap-5 p-5 rounded-xl border bg-card shadow-sm">
        <ScoreRing score={overall} size={80} />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
            Overall Proposal Score
          </p>
          <p className={`text-3xl font-bold ${overallColor}`}>{overall}/100</p>
          {data.summary && (
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
              {data.summary}
            </p>
          )}
        </div>
      </div>

      {/* Criteria bars */}
      {criteria.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Criteria Scores
          </p>
          {criteria.map((c, i) => {
            const max = c.maxScore ?? 100;
            const pct = Math.round((c.score / max) * 100);
            const barColor =
              pct >= 80
                ? "bg-emerald-500"
                : pct >= 60
                  ? "bg-amber-500"
                  : "bg-red-500";
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate mr-2">{c.criterion}</span>
                  <span className={`font-bold shrink-0 ${pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {c.score}/{max}
                    {c.weight ? ` (wt: ${c.weight})` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {(c.gaps ?? []).length > 0 && (
                  <ul className="space-y-0.5 pl-2">
                    {c.gaps!.map((g, j) => (
                      <li key={j} className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <span className="shrink-0 mt-0.5 text-red-400">·</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Top gaps */}
      {gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Top Priority Gaps
          </p>
          <ol className="space-y-1.5">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {g}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Improvements */}
      {improvements.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Improvement Suggestions
          </p>
          <ul className="space-y-1.5">
            {improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                {imp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── RFP Parser Summary Card ─────────────────────────────────────────────────

interface EvalCriterion { id?: string; title: string; weight: string; description?: string; }
interface PersonnelReq { role: string; requiredCertifications?: string[]; minimumYearsExperience?: number; description?: string; }
interface PageLimit { section: string; limit: string; }
interface ConflictItem { type?: string; description: string; }

interface ParsedRfpData {
  projectTitle?: string;
  agency?: string;
  rfpNumber?: string;
  submissionDeadline?: string;
  estimatedValue?: string;
  serviceLines?: string[];
  evaluationCriteria?: EvalCriterion[];
  keyPersonnelRequirements?: PersonnelReq[];
  pageLimits?: PageLimit[];
  mandatoryItems?: string[];
  submissionFormat?: string;
  scopeSummary?: string;
  conflictsDetected?: ConflictItem[];
}

function RfpParserSummary({ data }: { data: ParsedRfpData }) {
  const [showAll, setShowAll] = useState(false);
  const criteria = data.evaluationCriteria ?? [];
  const personnel = data.keyPersonnelRequirements ?? [];
  const mandatory = data.mandatoryItems ?? [];
  const pageLimits = data.pageLimits ?? [];
  const conflicts = data.conflictsDetected ?? [];
  const serviceLines = data.serviceLines ?? [];

  return (
    <div className="space-y-5">
      {/* Header summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Agency", value: data.agency ?? "—" },
          { label: "RFP Number", value: data.rfpNumber ?? "—" },
          { label: "Due Date", value: data.submissionDeadline ?? "—" },
          { label: "Est. Value", value: data.estimatedValue ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium truncate" title={value}>{value}</p>
          </div>
        ))}
      </div>

      {/* Scope summary */}
      {data.scopeSummary && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Scope Summary</p>
          <p className="text-sm leading-relaxed text-foreground/90">{data.scopeSummary}</p>
        </div>
      )}

      {/* Service lines */}
      {serviceLines.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Service Lines</p>
          <div className="flex flex-wrap gap-1.5">
            {serviceLines.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation criteria */}
      {criteria.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Evaluation Criteria</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Criterion</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-16">Weight</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, i) => (
                  <tr key={c.id ?? i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{c.title}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] font-bold">{c.weight}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{c.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Key personnel requirements */}
      {personnel.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Personnel Requirements</p>
          <div className="space-y-2">
            {personnel.map((p, i) => (
              <div key={i} className="rounded-lg border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold">{p.role}</span>
                  {p.minimumYearsExperience != null && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">{p.minimumYearsExperience}+ yrs exp</Badge>
                  )}
                </div>
                {p.description && <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>}
                {(p.requiredCertifications ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.requiredCertifications!.map((cert, j) => (
                      <Badge key={j} variant="outline" className="text-[10px]">{cert}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory items + page limits in two columns */}
      {(mandatory.length > 0 || pageLimits.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mandatory.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mandatory Items ({mandatory.length})</p>
              <ul className="space-y-1">
                {(showAll ? mandatory : mandatory.slice(0, 5)).map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                    {item}
                  </li>
                ))}
                {!showAll && mandatory.length > 5 && (
                  <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline mt-1">+{mandatory.length - 5} more</button>
                )}
              </ul>
            </div>
          )}
          {pageLimits.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Page Limits</p>
              <ul className="space-y-1">
                {pageLimits.map((pl, i) => (
                  <li key={i} className="flex items-center justify-between text-xs rounded border px-2 py-1 bg-muted/20">
                    <span className="truncate mr-2">{pl.section}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{pl.limit}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Conflicts detected */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Conflicts / Ambiguities Detected ({conflicts.length})
          </p>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">·</span>
                {c.type ? <strong>{c.type}: </strong> : null}{c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission format */}
      {data.submissionFormat && (
        <div className="rounded-lg border bg-muted/20 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Submission Format</p>
          <p className="text-xs leading-relaxed">{data.submissionFormat}</p>
        </div>
      )}
    </div>
  );
}

// ─── Generic JSON Viewer ──────────────────────────────────────────────────────

function GenericJsonViewer({ data }: { data: unknown }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ─── Fallback / Parse Error ───────────────────────────────────────────────────

function FallbackRenderer({
  output,
  reason,
  onRerender,
}: {
  output: string;
  reason: string;
  onRerender?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Raw output — structured renderer unavailable
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              {reason}
            </p>
          </div>
        </div>
        {onRerender && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
            onClick={onRerender}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Re-render as Prose
          </Button>
        )}
      </div>
      <ScrollArea className="rounded-md border bg-muted/20 p-4 max-h-[500px]">
        <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
          {output}
        </pre>
      </ScrollArea>
    </div>
  );
}

// ─── Prose Editor ─────────────────────────────────────────────────────────────

function ProseEditor({
  skillName,
  output,
  sessionId,
  isComplete,
  onSaved,
}: {
  skillName: WorkflowSkillName;
  output: string;
  sessionId: string;
  isComplete: boolean;
  onSaved: (newOutput: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(output);

  const updateMutation = trpc.rfpSessions.updateSkillOutput.useMutation({
    onSuccess: () => {
      onSaved(draft);
      setEditing(false);
      toast.success("Output saved");
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  useEffect(() => {
    if (!editing) setDraft(output);
  }, [output, editing]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {isComplete && (
            <Badge
              variant="secondary"
              className="text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Prose
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(output);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  updateMutation.mutate({ sessionId, skillName, output: draft })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={!isComplete}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 font-sans text-sm resize-none min-h-[400px] leading-relaxed"
          placeholder="Edit the proposal content here..."
        />
      ) : (
        <ScrollArea className="rounded-md border bg-muted/20 p-5 min-h-[200px]">
          <div className="space-y-2 prose prose-sm dark:prose-invert max-w-none">
            {output.split("\n").map((line, i) => {
              // Render markdown-style headers
              if (line.startsWith("## "))
                return <h2 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(3)}</h2>;
              if (line.startsWith("### "))
                return <h3 key={i} className="text-sm font-semibold mt-3 mb-0.5">{line.slice(4)}</h3>;
              if (line.startsWith("# "))
                return <h1 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(2)}</h1>;
              if (line.startsWith("- ") || line.startsWith("* "))
                return <p key={i} className="text-sm leading-relaxed flex items-start gap-1.5"><span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-foreground/40" />{line.slice(2)}</p>;
              return (
                <p key={i} className="text-sm leading-relaxed">
                  {line || <span className="block h-2" />}
                </p>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── JSON Renderer Router ─────────────────────────────────────────────────────

function JsonRenderer({
  skillName,
  output,
  sessionId,
  isComplete,
  onSaved,
  onRerender,
}: {
  skillName: WorkflowSkillName;
  output: string;
  sessionId: string;
  isComplete: boolean;
  onSaved: (newOutput: string) => void;
  onRerender?: () => void;
}) {
  // Try to parse the JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return (
      <FallbackRenderer
        output={output}
        reason="Output could not be parsed as JSON. The raw text is shown below."
        onRerender={onRerender}
      />
    );
  }

  // Route to skill-specific renderer
  switch (skillName) {
    case "rfp_parser":
      return <RfpParserSummary data={parsed as ParsedRfpData} />;
    case "win_themes":
      return <WinThemeCards data={parsed as WinThemeOutput} />;
    case "proposal_scorer":
      return <ProposalScorecard data={parsed as ProposalScorerOutput} />;
    default:
      // For all other JSON skills (rfp_parser, key_personnel, past_performance, fee_estimator)
      // show a clean generic viewer with an edit button
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isComplete && (
                <Badge
                  variant="secondary"
                  className="text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Structured Data
              </Badge>
            </div>
            {onRerender && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={onRerender}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Re-render as Prose
              </Button>
            )}
          </div>
          <GenericJsonViewer data={parsed} />
        </div>
      );
  }
}

// ─── Main Exported Component ──────────────────────────────────────────────────

export function SkillOutputRenderer({
  skillName,
  output,
  outputType,
  sessionId,
  isComplete,
  onSaved,
  onRerender,
  usedDefaultModel,
  defaultModelName,
}: RendererProps) {
  // Determine effective output type
  const effectiveType = outputType ?? "prose";

  // Local state: user can force prose rendering for sections saved as JSON
  const [forceProse, setForceProse] = useState(false);

  if (!output || output.trim() === "") {
    return (
      <p className="text-sm text-muted-foreground italic">No output available yet.</p>
    );
  }

  // Default model fallback banner
  const defaultModelBanner = usedDefaultModel ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-3">
      <span className="shrink-0">⚠️</span>
      <span>
        <strong>Default model used:</strong> The configured skill provider failed. This output was generated using the system default provider
        {defaultModelName ? <> (<code className="font-mono bg-amber-100 px-1 rounded">{defaultModelName}</code>)</> : ""}.
        To update the skill’s provider, go to <strong>Settings → AI Skills</strong>.
      </span>
    </div>
  ) : null;

  // If user clicked Re-render, or caller forced prose, render as prose regardless of outputType
  if (forceProse) {
    return (
      <div className="space-y-2">
        {defaultModelBanner}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Re-rendered as prose. Use Edit to make corrections.</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs ml-auto"
            onClick={() => setForceProse(false)}
          >
            Undo re-render
          </Button>
        </div>
        <ProseEditor
          skillName={skillName}
          output={output}
          sessionId={sessionId}
          isComplete={isComplete}
          onSaved={onSaved}
        />
      </div>
    );
  }

  const handleRerender = () => {
    setForceProse(true);
    if (onRerender) onRerender();
  };

  switch (effectiveType) {
    case "prose":
      return (
        <div>
          {defaultModelBanner}
          <ProseEditor
            skillName={skillName}
            output={output}
            sessionId={sessionId}
            isComplete={isComplete}
            onSaved={onSaved}
          />
        </div>
      );

    case "json":
      return (
        <div>
          {defaultModelBanner}
          <JsonRenderer
            skillName={skillName}
            output={output}
            sessionId={sessionId}
            isComplete={isComplete}
            onSaved={onSaved}
            onRerender={handleRerender}
          />
        </div>
      );

    case "json_with_prose": {
      // Try to split: the prose is the first non-JSON block, JSON is the rest
      let proseContent = output;
      let jsonData: Record<string, unknown> | null = null;
      try {
        // If the whole thing is JSON, treat the "prose" field as prose
        const parsed = JSON.parse(output) as Record<string, unknown>;
        proseContent = (parsed.prose as string) ?? (parsed.content as string) ?? JSON.stringify(parsed, null, 2);
        jsonData = parsed;
      } catch {
        // Not JSON — show as prose with a note
      }

      return (
        <div>
          {defaultModelBanner}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <ProseEditor
                skillName={skillName}
                output={proseContent}
                sessionId={sessionId}
                isComplete={isComplete}
                onSaved={onSaved}
              />
            </div>
            {jsonData && (
              <div className="w-72 shrink-0 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Metadata
                </p>
                <GenericJsonViewer data={jsonData} />
              </div>
            )}
          </div>
        </div>
      );
    }

    default:
      return (
        <div>
          {defaultModelBanner}
          <FallbackRenderer
            output={output}
            reason={`Unknown outputType "${effectiveType}". Showing raw output.`}
            onRerender={handleRerender}
          />
        </div>
      );
  }
}
