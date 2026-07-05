/**
 * client/src/components/EvidenceSourcesPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 6 — Evidence Sources Panel
 *
 * Displays the stored evidenceBundles and scorerEvidenceInput for a session,
 * grouped by skill. Each skill section shows:
 *   - Source document title and type
 *   - Chunk type badge
 *   - Confidence score
 *   - Page/section reference (when available)
 *   - Excerpt preview (truncated)
 *
 * The scorer section additionally shows:
 *   - Evidence coverage bar
 *   - Unsupported claims count
 *
 * This panel is read-only — it surfaces provenance data only.
 */

import { trpc } from "@/lib/trpc";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  User,
  BookOpen,
  Award,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { useState } from "react";
import type { EvidenceBundle, EvidenceItem } from "../../../shared/workflowTypes";

// ─── Skill display metadata ───────────────────────────────────────────────────

const SKILL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  win_themes: {
    label: "Win Themes",
    icon: <Award className="h-3.5 w-3.5" />,
    color: "text-purple-600 dark:text-purple-400",
  },
  technical_writer: {
    label: "Technical Approach",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  key_personnel: {
    label: "Key Personnel",
    icon: <User className="h-3.5 w-3.5" />,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  past_performance: {
    label: "Past Performance",
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "text-amber-600 dark:text-amber-400",
  },
  proposal_scorer: {
    label: "Proposal Scorer",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-rose-600 dark:text-rose-400",
  },
};

// ─── Chunk type badge color ───────────────────────────────────────────────────

function chunkTypeBadgeClass(chunkType: string): string {
  switch (chunkType) {
    case "win_theme": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    case "project_description":
    case "project_highlight": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "personnel_bio":
    case "project_experience": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "section_content": return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "image_caption": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    default: return "bg-muted text-muted-foreground";
  }
}

// ─── Source type badge ────────────────────────────────────────────────────────

function sourceTypeBadgeClass(sourceDocType: string): string {
  switch (sourceDocType) {
    case "project_sheet": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
    case "resume": return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
    case "past_proposal": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
    case "boilerplate": return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : pct >= 60
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {pct}%
    </span>
  );
}

// ─── Single evidence item row ─────────────────────────────────────────────────

function EvidenceItemRow({ item }: { item: EvidenceItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Doc title + source type */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-medium truncate max-w-[200px]">
              {item.sourceDocTitle || item.documentName || "Untitled"}
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 shrink-0 ${sourceTypeBadgeClass(item.sourceDocType || "")}`}
            >
              {(item.sourceDocType || "unknown").replace("_", " ")}
            </Badge>
          </div>

          {/* Chunk type + confidence + page ref */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${chunkTypeBadgeClass(item.chunkType)}`}>
              {item.chunkType.replace(/_/g, " ")}
            </span>
            <ConfidenceBadge confidence={item.confidence || 0} />
            {item.pageRef && (
              <span className="text-[10px] text-muted-foreground">
                p. {item.pageRef}
              </span>
            )}
            {item.sectionRef && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                § {item.sectionRef}
              </span>
            )}
          </div>

          {/* Content preview */}
          {item.content && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {expanded ? "Hide excerpt" : "Show excerpt"}
              </button>
              {expanded && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed bg-muted/50 rounded p-2 border-l-2 border-muted-foreground/20">
                  {item.content.length > 400
                    ? item.content.slice(0, 400) + "…"
                    : item.content}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skill bundle section ─────────────────────────────────────────────────────

function SkillBundleSection({
  skillName,
  bundle,
  isScorer = false,
}: {
  skillName: string;
  bundle: EvidenceBundle;
  isScorer?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const meta = SKILL_META[skillName] ?? {
    label: skillName.replace(/_/g, " "),
    icon: <Database className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
  };

  const items = bundle.items ?? [];
  const coverage = isScorer ? (bundle as unknown as { evidenceCoverage?: number }).evidenceCoverage : undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between py-2 px-1 hover:bg-muted/30 rounded transition-colors cursor-pointer">
          <div className={`flex items-center gap-2 text-xs font-semibold ${meta.color}`}>
            {meta.icon}
            {meta.label}
            <span className="text-muted-foreground font-normal">
              ({items.length} source{items.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {coverage !== undefined && (
              <span className={`text-[10px] font-bold ${
                coverage >= 0.8
                  ? "text-emerald-600 dark:text-emerald-400"
                  : coverage >= 0.5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              }`}>
                {Math.round(coverage * 100)}% covered
              </span>
            )}
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-2 pb-3 pl-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2 pl-2">
              No evidence items were assembled for this skill.
            </p>
          ) : (
            items.map((item, i) => (
              <EvidenceItemRow key={`${skillName}-${i}`} item={item} />
            ))
          )}

          {/* Scorer-specific: assembled-at timestamp */}
          {bundle.assembledAt && (
            <p className="text-[10px] text-muted-foreground pl-1 pt-1">
              Assembled {new Date(bundle.assembledAt).toLocaleString()}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface EvidenceSourcesPanelProps {
  sessionId: string;
}

export default function EvidenceSourcesPanel({ sessionId }: EvidenceSourcesPanelProps) {
  const { data, isLoading } = trpc.rfpSessions.getEvidenceSources.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const evidenceBundles = (data?.evidenceBundles ?? null) as Record<string, EvidenceBundle> | null;
  const scorerEvidenceInput = (data?.scorerEvidenceInput ?? null) as EvidenceBundle | null;
  // liveScoreDetails carries the real evidenceCoverage and unsupportedClaims from the scorer output
  const liveScoreDetails = (data?.liveScoreDetails ?? null) as {
    evidenceCoverage?: number;
    unsupportedClaims?: Array<{ section: string; claim: string; reason: string; relatedCriterion?: string }>;
  } | null;

  const hasAnyData =
    (evidenceBundles && Object.keys(evidenceBundles).length > 0) ||
    scorerEvidenceInput !== null;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
        <Database className="h-8 w-8 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">No evidence sources yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Evidence sources are assembled when the Win Themes, Technical Approach, Key Personnel,
            Past Performance, or Proposal Scorer skills run. Complete those skills to see sources here.
          </p>
        </div>
      </div>
    );
  }

  // Ordered skill display: generation skills first, scorer last
  const GENERATION_SKILLS = ["win_themes", "technical_writer", "key_personnel", "past_performance"];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          These are the verified source documents and excerpts that were assembled into the evidence
          bundle for each skill. Use this panel to inspect what supported each section of the proposal.
        </p>

        {/* Generation skill bundles */}
        {GENERATION_SKILLS.map((skillName) => {
          const bundle = evidenceBundles?.[skillName];
          if (!bundle) return null;
          return (
            <div key={skillName}>
              <SkillBundleSection skillName={skillName} bundle={bundle} />
              <Separator className="my-1" />
            </div>
          );
        })}

        {/* Scorer evidence input */}
        {scorerEvidenceInput && (
          <div>
            <SkillBundleSection
              skillName="proposal_scorer"
              bundle={{
                ...scorerEvidenceInput,
                // Attach real evidenceCoverage from liveScoreDetails for the coverage bar
                ...(liveScoreDetails?.evidenceCoverage !== undefined
                  ? { evidenceCoverage: liveScoreDetails.evidenceCoverage }
                  : {}),
              } as unknown as EvidenceBundle}
              isScorer
            />
          </div>
        )}

        {/* Unsupported claims summary — sourced from liveScoreDetails (real scorer output) */}
        {liveScoreDetails?.unsupportedClaims && liveScoreDetails.unsupportedClaims.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              {liveScoreDetails.unsupportedClaims.length} Unsupported Claim{liveScoreDetails.unsupportedClaims.length !== 1 ? "s" : ""} (from Scorer)
            </p>
            <ul className="space-y-2">
              {liveScoreDetails.unsupportedClaims.map((c, i) => (
                <li key={i} className="text-[11px] border-t border-amber-200/60 dark:border-amber-800/60 pt-1.5 first:border-0 first:pt-0">
                  <span className="font-medium text-amber-800 dark:text-amber-300">{c.section}: </span>
                  <span className="text-amber-700 dark:text-amber-300">{c.claim}</span>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">{c.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
