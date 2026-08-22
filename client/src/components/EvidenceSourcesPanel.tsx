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
import { getEvidenceSourceAvailabilityMessage } from "@/lib/evidenceSourceAvailability";
import { Button } from "@/components/ui/button";
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
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type { EvidenceBundle, EvidenceItem } from "../../../shared/workflowTypes";

// ─── Skill display metadata ───────────────────────────────────────────────────

const SKILL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rfp_parser: { label: "RFP Parser", icon: <FileText className="h-3.5 w-3.5" />, color: "text-slate-600 dark:text-slate-400" },
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
  technical_outline: { label: "Technical Outline", icon: <BookOpen className="h-3.5 w-3.5" />, color: "text-blue-600 dark:text-blue-400" },
  fee_estimator: { label: "Fee Estimate", icon: <Database className="h-3.5 w-3.5" />, color: "text-emerald-600 dark:text-emerald-400" },
};

const ALL_WORKFLOW_SKILLS = [
  "rfp_parser", "win_themes", "technical_outline", "technical_writer",
  "key_personnel", "past_performance", "fee_estimator", "proposal_scorer",
];

const NOT_APPLICABLE_SOURCE_MESSAGES: Record<string, string> = {
  rfp_parser: "This skill uses the uploaded RFP package. It does not assemble Knowledge Hub evidence excerpts.",
  technical_outline: "This skill is derived from the parsed RFP and Win Themes output. It does not independently retrieve Knowledge Hub evidence.",
  fee_estimator: "This skill uses approved rate artifacts and relevant priced prior proposals. Its pricing-source summary is recorded with the Fee Estimate output.",
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
  emptyMessage,
}: {
  skillName: string;
  bundle: EvidenceBundle;
  isScorer?: boolean;
  emptyMessage?: string;
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
              {emptyMessage ?? getEvidenceSourceAvailabilityMessage(bundle.sourceDocIds)}
            </p>
          ) : (
            items.map((item, i) => (
              <EvidenceItemRow key={`${skillName}-${i}`} item={item} />
            ))
          )}

          {/* Scorer-specific: assembled-at timestamp */}
          {bundle.assembledAt && (
            <p className="text-[10px] text-muted-foreground pl-1 pt-1">
              {(bundle as EvidenceBundle & { reconstructedAt?: number }).reconstructedAt
                ? `Rebuilt from current selected assets ${new Date((bundle as EvidenceBundle & { reconstructedAt: number }).reconstructedAt).toLocaleString()}`
                : `Assembled ${new Date(bundle.assembledAt).toLocaleString()}`}
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
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rfpSessions.getEvidenceSources.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
  const rebuildSources = trpc.rfpSessions.rebuildEvidenceSources.useMutation({
    onSuccess: () => utils.rfpSessions.getEvidenceSources.invalidate({ sessionId }),
  });

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
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs mt-3"
            disabled={rebuildSources.isPending}
            onClick={() => rebuildSources.mutate({ sessionId })}
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${rebuildSources.isPending ? "animate-spin" : ""}`} />
            Rebuild from current assets
          </Button>
        </div>
      </div>
    );
  }

  const emptyBundle = (skillName: string): EvidenceBundle => ({
    skillName,
    items: [],
    assembledAt: Date.now(),
    sourceDocIds: [],
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        <div className="rounded-lg border bg-muted/30 p-3 mb-4 space-y-2">
          <p className="text-xs leading-relaxed"><strong>Sources</strong> shows the document excerpts a skill actually used or, for a legacy rebuild, the current selected-asset evidence assembled for review.</p>
          <p className="text-xs text-muted-foreground leading-relaxed"><strong>Assets</strong> opens the editable pursuit inputs—project sheets, resumes, and prior proposals—from which future skills may draw sources. Selecting an asset does not mean every skill used it.</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={rebuildSources.isPending}
            onClick={() => rebuildSources.mutate({ sessionId })}
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${rebuildSources.isPending ? "animate-spin" : ""}`} />
            Rebuild from current assets
          </Button>
          <p className="text-[10px] text-muted-foreground">Use this for older proposals with empty bundles. Rebuilt entries are labeled and do not overwrite the historical execution record.</p>
        </div>

        {ALL_WORKFLOW_SKILLS.map((skillName) => {
          const rawBundle = skillName === "proposal_scorer"
            ? scorerEvidenceInput
            : evidenceBundles?.[skillName];
          const bundle = skillName === "proposal_scorer" && rawBundle
            ? {
                ...rawBundle,
                ...(liveScoreDetails?.evidenceCoverage !== undefined
                  ? { evidenceCoverage: liveScoreDetails.evidenceCoverage }
                  : {}),
              }
            : rawBundle;
          return (
            <div key={skillName}>
              <SkillBundleSection
                skillName={skillName}
                bundle={(bundle ?? emptyBundle(skillName)) as EvidenceBundle}
                isScorer={skillName === "proposal_scorer"}
                emptyMessage={NOT_APPLICABLE_SOURCE_MESSAGES[skillName]}
              />
              <Separator className="my-1" />
            </div>
          );
        })}

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
