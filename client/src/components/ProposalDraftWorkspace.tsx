/**
 * client/src/components/ProposalDraftWorkspace.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Step 4 Phase A — Three-Panel Proposal Draft Workspace
 *
 * Layout:
 *   [Compliance Bar — full width]
 *   [Section Navigator 220px] | [Section Editor flex] | [Section Scorecard 280px]
 *
 * Data flow:
 *   - trpc.rfpSessions.getSections → section list from rfp_structured_index or DEFAULT_SECTIONS
 *   - trpc.rfpSessions.generateSection → fire-and-forget, polls getSections for status
 *   - trpc.rfpSessions.generateFullProposal → fire-and-forget, polls getSections for status
 *   - trpc.rfpSessions.updateSectionContent → saves user edits to proposals.sections jsonb
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Play,
  RotateCcw,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Download,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  type ProposalSection,
  type SectionStatus,
  computeOverallCompliance,
} from "../../../shared/proposalSections";

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionWithDef = ProposalSection & {
  sectionType: string;
  title: string;
  pageLimit: number;
  wordLimit: number;
  order: number;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function SectionStatusBadge({ status }: { status: SectionStatus }) {
  const config: Record<SectionStatus, { label: string; className: string; icon?: React.ReactNode }> = {
    not_started: {
      label: "Not Started",
      className: "bg-muted text-muted-foreground border-border",
    },
    generating: {
      label: "Generating",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    scoring: {
      label: "Scoring",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    complete: {
      label: "Complete",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
    },
    needs_attention: {
      label: "Needs Attention",
      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
      icon: <AlertTriangle className="h-2.5 w-2.5" />,
    },
    error: {
      label: "Error",
      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
      icon: <XCircle className="h-2.5 w-2.5" />,
    },
  };
  const { label, className, icon } = config[status] ?? config.not_started;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const cls =
    score >= 80
      ? "bg-emerald-500 text-white"
      : score >= 60
        ? "bg-amber-500 text-white"
        : "bg-red-500 text-white";
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>
      {score}
    </span>
  );
}

// ─── Compliance Bar ───────────────────────────────────────────────────────────

function ComplianceBar({
  sections,
  pursuitTitle,
  dueDate,
  onExport,
  onGenerateAll,
  isGenerating,
  generatingLabel,
}: {
  sections: SectionWithDef[];
  pursuitTitle: string;
  dueDate?: string | null;
  onExport: () => void;
  onGenerateAll: () => void;
  isGenerating: boolean;
  generatingLabel: string;
}) {
  const sectionsRecord: Record<string, ProposalSection> = {};
  for (const s of sections) sectionsRecord[s.sectionType] = s;
  const { overallScore, completedCount, totalCount } = computeOverallCompliance(sectionsRecord);
  const canExport = overallScore >= 80;

  const barColor =
    overallScore >= 80
      ? "bg-emerald-500"
      : overallScore >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-xs shrink-0">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="font-medium truncate max-w-[200px]" title={pursuitTitle}>
        {pursuitTitle || "Proposal Draft"}
      </span>
      <Separator orientation="vertical" className="h-4" />

      {/* Compliance bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative h-2 w-32 rounded-full bg-muted overflow-hidden shrink-0">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <span className="font-semibold text-foreground">{overallScore}% compliant</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{completedCount} of {totalCount} sections complete</span>
        {dueDate && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Due: {dueDate}</span>
          </>
        )}
      </div>

      {/* Generate All button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 shrink-0"
        onClick={onGenerateAll}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="max-w-[140px] truncate">{generatingLabel}</span>
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" />
            Generate Full Proposal
          </>
        )}
      </Button>

      {/* Export button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={canExport ? "default" : "outline"}
            className="h-7 text-xs gap-1 shrink-0"
            onClick={onExport}
            disabled={!canExport}
          >
            <Download className="h-3 w-3" />
            Export Package
          </Button>
        </TooltipTrigger>
        {!canExport && (
          <TooltipContent>
            Proposal must be at least 80% compliant before export. Current: {overallScore}%
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}

// ─── Section Navigator ────────────────────────────────────────────────────────

function SectionNavigator({
  sections,
  selectedType,
  onSelect,
  onGenerateAll,
  isGenerating,
}: {
  sections: SectionWithDef[];
  selectedType: string | null;
  onSelect: (sectionType: string) => void;
  onGenerateAll: () => void;
  isGenerating: boolean;
}) {
  const sectionsRecord: Record<string, ProposalSection> = {};
  for (const s of sections) sectionsRecord[s.sectionType] = s;
  const { overallScore } = computeOverallCompliance(sectionsRecord);

  return (
    <div className="w-[220px] shrink-0 flex flex-col border-r bg-muted/10">
      {/* Generate Full Proposal button at top */}
      <div className="p-2 border-b">
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={onGenerateAll}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          Generate Full Proposal
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {sections.map((section) => (
            <button
              key={section.sectionType}
              onClick={() => onSelect(section.sectionType)}
              className={[
                "w-full flex flex-col gap-1 px-2.5 py-2 rounded-lg text-left transition-all duration-150",
                "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selectedType === section.sectionType ? "bg-accent" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium leading-snug truncate flex-1">
                  {section.title}
                </span>
                <ScoreBadge score={section.score ?? null} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <SectionStatusBadge status={section.status} />
                {section.wordLimit > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {section.wordCount ?? 0}/{section.wordLimit}w
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Overall compliance footer */}
      <div className="p-3 border-t">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Overall</span>
          <span className={`font-bold ${overallScore >= 80 ? "text-emerald-500" : overallScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
            {overallScore}%
            {overallScore < 80 && " ⚠️"}
          </span>
        </div>
        <Progress
          value={overallScore}
          className="h-1.5"
        />
      </div>
    </div>
  );
}

// ─── Section Scorecard (Right Panel) ─────────────────────────────────────────

function SectionScorecard({
  section,
  onImprove,
}: {
  section: SectionWithDef | null;
  onImprove: () => void;
}) {
  if (!section) {
    return (
      <div className="w-[280px] shrink-0 border-l bg-muted/5 flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-4">
          Select a section to see its scorecard
        </p>
      </div>
    );
  }

  const scorer = section.scorerOutput as Record<string, unknown> | null;
  const criteria = (scorer?.criteria as Array<{ criterion: string; score: number; met: boolean; feedback?: string }>) ?? [];
  const gaps = (scorer?.gaps as string[]) ?? [];
  const improvements = (scorer?.improvements as string[]) ?? [];
  const winThemesCoverage = (scorer?.winThemesCoverage as string[]) ?? [];
  const score = section.score ?? null;

  const ringColor =
    score === null
      ? "text-muted-foreground"
      : score >= 80
        ? "text-emerald-500"
        : score >= 60
          ? "text-amber-500"
          : "text-red-500";

  const wordLimitStatus =
    section.wordLimit > 0
      ? section.wordCount >= section.wordLimit * 0.8 && section.wordCount <= section.wordLimit * 1.1
        ? "✅"
        : section.wordCount < section.wordLimit * 0.8
          ? "⚠️"
          : "❌"
      : null;

  return (
    <ScrollArea className="w-[280px] shrink-0 border-l bg-muted/5">
      <div className="p-4 space-y-4">
        {/* Score ring */}
        <div className="text-center">
          <div className={`text-5xl font-black ${ringColor}`}>
            {score !== null ? score : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Section Score</p>
          {section.scoredAt && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              Scored {new Date(section.scoredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        <Separator />

        {/* Evaluation criteria */}
        {criteria.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Criteria Coverage
            </p>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] leading-snug flex-1 truncate" title={c.criterion}>
                      {c.met ? "✅" : c.score >= 50 ? "⚠️" : "❌"} {c.criterion}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{c.score}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.score >= 80 ? "bg-emerald-500" : c.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Word count status */}
        {section.wordLimit > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Word Count
            </p>
            <p className="text-xs">
              {wordLimitStatus} {section.wordCount} / {section.wordLimit} words
              {section.pageLimit > 0 && ` (${section.pageLimit} page${section.pageLimit !== 1 ? "s" : ""})`}
            </p>
          </div>
        )}

        {/* Missing elements / gaps */}
        {gaps.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Missing Elements
            </p>
            <ul className="space-y-1">
              {gaps.slice(0, 5).map((gap, i) => (
                <li key={i} className="text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1">
                  <span className="shrink-0 mt-0.5">❌</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Top improvements */}
        {improvements.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Top Improvements
            </p>
            <ul className="space-y-1">
              {improvements.slice(0, 3).map((imp, i) => (
                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <span className="shrink-0 mt-0.5 text-blue-400">→</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Win themes coverage */}
        {winThemesCoverage.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Win Themes Present
            </p>
            <div className="flex flex-wrap gap-1">
              {winThemesCoverage.map((t, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Improve button */}
        {(section.status === "complete" || section.status === "needs_attention") && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1.5"
            onClick={onImprove}
          >
            <RotateCcw className="h-3 w-3" />
            Improve This Section
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Section Editor (Center Panel) ───────────────────────────────────────────

function SectionEditor({
  section,
  sessionId,
  onGenerate,
  onRegenerate,
  isGenerating,
  onContentSaved,
}: {
  section: SectionWithDef | null;
  sessionId: string;
  onGenerate: (sectionType: string) => void;
  onRegenerate: (sectionType: string) => void;
  isGenerating: boolean;
  onContentSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateMutation = trpc.rfpSessions.updateSectionContent.useMutation({
    onSuccess: () => {
      setEditing(false);
      setIsSaving(false);
      toast.success("Section saved");
      onContentSaved();
    },
    onError: (err) => {
      setIsSaving(false);
      toast.error(`Save failed: ${err.message}`);
    },
  });

  // Reset draft when section changes
  useEffect(() => {
    if (section) {
      const displayContent = section.editedContent ?? section.content ?? "";
      setDraft(displayContent);
      setEditing(false);
    }
  }, [section?.sectionType, section?.editedContent, section?.content]);

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">Select a section from the navigator</p>
        </div>
      </div>
    );
  }

  const displayContent = section.editedContent ?? section.content ?? "";
  const isEdited = !!section.editedContent;
  const wordCount = section.wordCount ?? 0;
  const isActive = section.status === "generating" || section.status === "scoring";

  const handleSave = () => {
    if (!draft.trim()) return;
    setIsSaving(true);
    updateMutation.mutate({
      sessionId,
      sectionType: section.sectionType,
      editedContent: draft,
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Section header */}
      <div className="flex items-start justify-between px-5 py-3 border-b shrink-0 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <SectionStatusBadge status={section.status} />
            {isEdited && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                Edited
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {section.wordLimit > 0 && (
              <span>{wordCount} / {section.wordLimit} words</span>
            )}
            {section.pageLimit > 0 && (
              <span>· {section.pageLimit} page{section.pageLimit !== 1 ? "s" : ""}</span>
            )}
            {section.score !== null && (
              <span>· Score: <span className={section.score >= 80 ? "text-emerald-500 font-semibold" : section.score >= 60 ? "text-amber-500 font-semibold" : "text-red-500 font-semibold"}>{section.score}/100</span></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={isSaving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                Save
              </Button>
            </>
          ) : (
            <>
              {displayContent && !isActive && (
                <>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(displayContent); setEditing(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRegenerate(section.sectionType)} disabled={isGenerating}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Regenerate
                  </Button>
                </>
              )}
              {!displayContent && !isActive && (
                <Button size="sm" className="h-7 text-xs" onClick={() => onGenerate(section.sectionType)} disabled={isGenerating}>
                  <Play className="h-3 w-3 mr-1" /> Generate
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-5">
        {isActive ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <div>
              <p className="text-sm font-medium">
                {section.status === "generating" ? "Generating content..." : "Scoring section..."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take 30–90 seconds. You can safely navigate away.
              </p>
            </div>
          </div>
        ) : section.status === "error" ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <XCircle className="h-10 w-10 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Generation failed</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">{section.errorMessage}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onGenerate(section.sectionType)} disabled={isGenerating}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[500px] text-sm leading-relaxed resize-y font-sans"
            autoFocus
          />
        ) : displayContent ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {displayContent.split("\n").map((line, i) => (
              <p key={i} className="text-sm leading-relaxed mb-1.5">
                {line || <span className="block h-2" />}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Circle className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Not yet generated</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Click Generate to create this section using your RFP context and selected assets.
              </p>
            </div>
            <Button size="sm" onClick={() => onGenerate(section.sectionType)} disabled={isGenerating}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Generate Section
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProposalDraftWorkspace({
  sessionId,
  proposalId,
  pursuitTitle,
  dueDate,
}: {
  sessionId: string;
  proposalId: string;
  pursuitTitle?: string;
  dueDate?: string | null;
}) {
  const utils = trpc.useUtils();

  // ── Section data ────────────────────────────────────────────────────────────
  const { data: sectionsData, refetch: refetchSections } = trpc.rfpSessions.getSections.useQuery(
    { sessionId },
    { enabled: !!sessionId, refetchInterval: false }
  );

  const sections = (sectionsData?.sections ?? []) as SectionWithDef[];

  // ── Polling for active sections ─────────────────────────────────────────────
  const hasActiveSections = sections.some(
    (s) => s.status === "generating" || s.status === "scoring"
  );
  useEffect(() => {
    if (!hasActiveSections) return;
    const interval = setInterval(() => refetchSections(), 3000);
    return () => clearInterval(interval);
  }, [hasActiveSections, refetchSections]);

  // ── Local state ─────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showScorecardPanel, setShowScorecardPanel] = useState(true);
  const [showGenerateAllDialog, setShowGenerateAllDialog] = useState(false);

  // Auto-select first section on load
  useEffect(() => {
    if (!selectedType && sections.length > 0) {
      setSelectedType(sections[0].sectionType);
    }
  }, [sections.length, selectedType]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const generateSectionMutation = trpc.rfpSessions.generateSection.useMutation({
    onSuccess: () => {
      refetchSections();
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const generateFullMutation = trpc.rfpSessions.generateFullProposal.useMutation({
    onSuccess: () => {
      toast.success("Full proposal generation started. Sections will update as they complete.");
      refetchSections();
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const selectedSection = sections.find((s) => s.sectionType === selectedType) ?? null;
  const isGenerating = generateSectionMutation.isPending || generateFullMutation.isPending || hasActiveSections;

  // Count which section is currently generating for toolbar label
  const generatingSection = sections.find((s) => s.status === "generating" || s.status === "scoring");
  const generatingIndex = generatingSection ? sections.indexOf(generatingSection) + 1 : 0;
  const generatingLabel = generatingSection
    ? `Generating ${generatingSection.title} (${generatingIndex} of ${sections.length})...`
    : "Generating...";

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback((sectionType: string) => {
    const def = sections.find((s) => s.sectionType === sectionType);
    if (!def) return;
    generateSectionMutation.mutate({
      sessionId,
      sectionType,
      sectionTitle: def.title,
      pageLimit: def.pageLimit,
      wordLimit: def.wordLimit,
    });
  }, [sections, sessionId, generateSectionMutation]);

  const handleRegenerate = useCallback((sectionType: string) => {
    const def = sections.find((s) => s.sectionType === sectionType);
    if (!def) return;
    const scorerOutput = def.scorerOutput as Record<string, unknown> | null;
    const gaps = (scorerOutput?.gaps as string[]) ?? [];
    generateSectionMutation.mutate({
      sessionId,
      sectionType,
      sectionTitle: def.title,
      pageLimit: def.pageLimit,
      wordLimit: def.wordLimit,
      force: true,
      previousScore: def.score ?? null,
      scorerGaps: gaps.join("; ") || null,
    });
  }, [sections, sessionId, generateSectionMutation]);

  const handleGenerateAll = useCallback(() => {
    setShowGenerateAllDialog(false);
    generateFullMutation.mutate({ sessionId, force: true });
  }, [sessionId, generateFullMutation]);

  const handleExport = useCallback(() => {
    toast.info("Export Package feature coming soon.");
  }, []);

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Loading section structure...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Compliance Bar */}
        <ComplianceBar
          sections={sections}
          pursuitTitle={pursuitTitle ?? "Proposal Draft"}
          dueDate={dueDate}
          onExport={handleExport}
          onGenerateAll={() => setShowGenerateAllDialog(true)}
          isGenerating={isGenerating}
          generatingLabel={generatingLabel}
        />

        {/* Three-panel layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Section Navigator */}
          <SectionNavigator
            sections={sections}
            selectedType={selectedType}
            onSelect={setSelectedType}
            onGenerateAll={() => setShowGenerateAllDialog(true)}
            isGenerating={isGenerating}
          />

          {/* Center: Section Editor */}
          <SectionEditor
            section={selectedSection}
            sessionId={sessionId}
            onGenerate={handleGenerate}
            onRegenerate={handleRegenerate}
            isGenerating={isGenerating}
            onContentSaved={() => refetchSections()}
          />

          {/* Right: Section Scorecard (collapsible) */}
          {showScorecardPanel ? (
            <SectionScorecard
              section={selectedSection}
              onImprove={() => selectedType && handleRegenerate(selectedType)}
            />
          ) : null}

          {/* Toggle scorecard button */}
          <button
            onClick={() => setShowScorecardPanel((v) => !v)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-l-md bg-muted border border-r-0 text-muted-foreground hover:text-foreground transition-colors"
            title={showScorecardPanel ? "Hide scorecard" : "Show scorecard"}
          >
            {showScorecardPanel ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Generate All Confirmation Dialog */}
      <AlertDialog open={showGenerateAllDialog} onOpenChange={setShowGenerateAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Full Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate all proposal sections using your selected assets and RFP context.
              Previously generated sections will be overwritten. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateAll}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Generate All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
