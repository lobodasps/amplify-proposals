/**
 * client/src/pages/ProposalWorkspace.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Proposal Workspace — Sequential Skill Workflow Orchestrator
 *
 * ORCHESTRATION CONTRACT (strictly enforced):
 * 1. Skills execute ONE AT A TIME. The next skill fires only after the
 *    previous mutation returns success. Promise.all is never used.
 * 2. On every page load, workflowState is read from the DB to compute
 *    the resume point. Already-complete skills are never re-run.
 * 3. If a skill errors or the user closes the browser, the DB retains
 *    all completed outputs. The UI offers "Resume from Skill N+1".
 * 4. Each skill output is editable after completion. Edits are saved
 *    back to skillOutputs via updateSkillOutput mutation.
 * 5. Individual skills can be reset (re-run) without restarting the
 *    entire workflow.
 */

import AppLayout from "@/components/AppLayout";
import { SkillOutputRenderer, type SkillOutputType } from "@/components/SkillOutputRenderer";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ChevronRight,
  FileText,
  AlertTriangle,
  Pencil,
  Eye,
  ArrowLeft,
  Zap,
  Clock,
} from "lucide-react";
import {
  ORDERED_SKILLS,
  WORKFLOW_SKILL_NAMES,
  WORKFLOW_SKILL_TO_SKILL_TYPE,
  computeResumeState,
  type WorkflowSkillName,
  type WorkflowState,
  type SkillOutputs,
  type SkillStateEntry,
  type ParsedRfpData,
} from "../../../shared/workflowTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveView = "overview" | "full_draft" | WorkflowSkillName;

// ─── Dynamic outputType resolver ────────────────────────────────────────────────────
// Reads outputType from the live ai_skills records fetched at runtime.
// Falls back to 'prose' if the record is not yet loaded or the skill type
// is not found — this prevents showing raw JSON while the query loads.
function resolveOutputType(
  skillName: WorkflowSkillName,
  skillRecords: Array<{ skillType: string; outputType: string | null }> | undefined
): SkillOutputType {
  if (!skillRecords || skillRecords.length === 0) return "prose";
  const skillType = WORKFLOW_SKILL_TO_SKILL_TYPE[skillName];
  const record = skillRecords.find((r) => r.skillType === skillType);
  const ot = record?.outputType;
  if (ot === "json" || ot === "prose" || ot === "json_with_prose") return ot;
  return "prose"; // safe fallback
}

// ─── Skill Status Icon ────────────────────────────────────────────────────────

function SkillStatusIcon({
  status,
  isActive,
  size = "md",
}: {
  status: SkillStateEntry["status"] | "pending";
  isActive: boolean;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  if (status === "complete")
    return <CheckCircle2 className={`${cls} text-emerald-500 shrink-0`} />;
  if (status === "error")
    return <XCircle className={`${cls} text-red-500 shrink-0`} />;
  if (status === "running" || isActive)
    return <Loader2 className={`${cls} text-blue-500 animate-spin shrink-0`} />;
  return <Circle className={`${cls} text-muted-foreground/30 shrink-0`} />;
}

// ─── Skill Sidebar Row ────────────────────────────────────────────────────────

function SkillRow({
  skill,
  index,
  stateEntry,
  isActive,
  isSelected,
  onClick,
}: {
  skill: (typeof ORDERED_SKILLS)[number];
  index: number;
  stateEntry?: SkillStateEntry;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = stateEntry?.status ?? "pending";

  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
        "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isSelected ? "bg-accent" : "",
        isActive ? "ring-1 ring-blue-500/30" : "",
      ].join(" ")}
    >
      <span className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 w-3 shrink-0">
        {index + 1}
      </span>
      <SkillStatusIcon status={status} isActive={isActive} size="sm" />
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-xs font-medium leading-snug",
            status === "complete"
              ? "text-foreground"
              : status === "error"
                ? "text-red-500"
                : isActive
                  ? "text-blue-500"
                  : "text-muted-foreground",
          ].join(" ")}
        >
          {skill.displayName}
        </p>
        {isActive && stateEntry?.subStepMessage && (
          <p className="text-[10px] text-blue-400 mt-0.5 animate-pulse">
            {stateEntry.subStepMessage}
          </p>
        )}
        {stateEntry?.completedAt && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {stateEntry.model ?? "AI"} ·{" "}
            {new Date(stateEntry.completedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        {stateEntry?.missingVariables && stateEntry.missingVariables.length > 0 && (
          <p className="text-[10px] text-amber-500 mt-0.5 line-clamp-1" title={stateEntry.missingVariables.join(", ")}>
            ⚠ {stateEntry.missingVariables.length} variable{stateEntry.missingVariables.length > 1 ? "s" : ""} missing
          </p>
        )}
        {stateEntry?.errorMessage && (
          <p className="text-[10px] text-red-400 mt-0.5 line-clamp-1">
            {stateEntry.errorMessage}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Full Draft Section Card (inline-editable with autosave) ────────────────

function FullDraftSectionCard({
  section,
  onSave,
}: {
  section: {
    id: string;
    title: string;
    content: string | null;
    sectionOrder: number | null;
    rfpRequirement: string | null;
    complianceStatus: string | null;
    aiGenerated: boolean | null;
    status: string | null;
  };
  onSave: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content ?? "");
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(section.content ?? "");
  }, [section.content, editing]);

  const handleBlur = () => {
    // Debounce blur to avoid saving when clicking within the textarea
    blurTimerRef.current = setTimeout(() => {
      if (draft !== (section.content ?? "")) {
        onSave(draft);
        toast.success(`"${section.title}" saved`, { duration: 2000 });
      }
      setEditing(false);
    }, 200);
  };

  const handleFocus = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  // Score badge from complianceStatus (stored as "85" or similar)
  const sectionScore = section.complianceStatus
    ? parseInt(section.complianceStatus, 10)
    : null;

  return (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono w-5">
              {section.sectionOrder ?? "-"}
            </span>
            <CardTitle className="text-sm">{section.title}</CardTitle>
            {section.aiGenerated && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                AI
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sectionScore !== null && !isNaN(sectionScore) && (
              <Badge
                className={[
                  "text-xs px-2 py-0.5",
                  sectionScore >= 80
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : sectionScore >= 60
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                ].join(" ")}
              >
                {sectionScore}/100
              </Badge>
            )}
            {!editing && (
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
        {section.rfpRequirement && (
          <p className="text-xs text-muted-foreground/70 mt-1 italic">
            Requirement: {section.rfpRequirement}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onFocus={handleFocus}
            autoFocus
            className="min-h-[200px] text-sm leading-relaxed resize-y font-sans"
          />
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 transition-colors"
            onClick={() => setEditing(true)}
          >
            {(section.content ?? "").split("\n").map((line, i) => (
              <p key={i} className="text-sm leading-relaxed mb-1.5">
                {line || <span className="block h-2" />}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Parsed RFP Summary Card ──────────────────────────────────────────────────

function ParsedRfpSummary({ data }: { data: ParsedRfpData }) {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-muted/50 border">
        <p className="font-semibold">{data.projectTitle}</p>
        <p className="text-sm text-muted-foreground">
          {data.agency}
          {data.rfpNumber ? ` · ${data.rfpNumber}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Due Date
          </p>
          <p className="text-sm font-medium">{data.submissionDeadline}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Est. Value
          </p>
          <p className="text-sm font-medium">{data.estimatedValue}</p>
        </div>
      </div>
      {data.scopeSummary && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Scope
          </p>
          <p className="text-sm">{data.scopeSummary}</p>
        </div>
      )}
      {data.conflictsDetected.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {data.conflictsDetected.length} Conflict
            {data.conflictsDetected.length > 1 ? "s" : ""} Detected
          </p>
          {data.conflictsDetected.map((c, i) => (
            <p
              key={i}
              className="text-xs text-amber-800 dark:text-amber-300 mb-1"
            >
              <span className="font-medium capitalize">[{c.severity}]</span>{" "}
              {c.description}
            </p>
          ))}
        </div>
      )}
      {data.mandatoryItems.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Mandatory Items ({data.mandatoryItems.length})
          </p>
          <ul className="space-y-1">
            {data.mandatoryItems.slice(0, 6).map((item, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <span className="text-muted-foreground mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
            {data.mandatoryItems.length > 6 && (
              <li className="text-xs text-muted-foreground">
                +{data.mandatoryItems.length - 6} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProposalWorkspace() {
  // Route param is the proposalId (from /proposals/:id)
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const proposalId = id ?? "";

  // Guard: demo proposals use integer ids ("1", "2", etc.) — not valid UUIDs.
  // Disable all session queries/mutations when the id is not a UUID.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isRealProposal = UUID_RE.test(proposalId);

  // ── tRPC utils ─────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  // ── Session state — load or create a session for this proposalId ───────────
  // We list sessions by proposal to find an existing one, or create a new one.
  const { data: sessionList, isLoading: sessionsLoading } =
    trpc.rfpSessions.listByProposal.useQuery(
      { proposalId },
      { enabled: !!proposalId && isRealProposal }
    );

  const createSessionMutation = trpc.rfpSessions.create.useMutation({
    onSuccess: () =>
      utils.rfpSessions.listByProposal.invalidate({ proposalId }),
  });

  // The active session is the most recent one for this proposal
  const activeSessionId =
    sessionList && sessionList.length > 0
      ? sessionList[sessionList.length - 1].id
      : null;

  // ── Load the full session ──────────────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } =
    trpc.rfpSessions.getById.useQuery(
      { id: activeSessionId! },
      { enabled: !!activeSessionId, refetchInterval: false }
    );

  // ── Local orchestration state ──────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeSkill, setActiveSkill] = useState<WorkflowSkillName | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [localOutputs, setLocalOutputs] = useState<SkillOutputs>({});
  const [localState, setLocalState] = useState<WorkflowState>({});
  const [showResetDialog, setShowResetDialog] = useState<WorkflowSkillName | null>(null);
  const abortRef = useRef(false);

  // ── Sync server → local state on session load ──────────────────────────────
  useEffect(() => {
    if (session) {
      setLocalOutputs((session.skillOutputs ?? {}) as SkillOutputs);
      setLocalState((session.workflowState ?? {}) as WorkflowState);
    }
  }, [session]);

  // ── tRPC mutations ─────────────────────────────────────────────────────────
  // ── AI Skills records — for dynamic outputType resolution ─────────────────
  const { data: aiSkillRecords } = trpc.aiSkills.list.useQuery();

  // ── Full Draft: load proposal sections ──────────────────────────────────────
  const { data: proposalSections, refetch: refetchSections } =
    trpc.proposals.getSections.useQuery(
      { proposalId },
      { enabled: !!proposalId && isRealProposal }
    );
  const updateSectionMutation = trpc.proposals.updateSection.useMutation({
    onSuccess: () => refetchSections(),
  });

  const executeSkillMutation = trpc.rfpSessions.executeSkill.useMutation();
  const resetSkillMutation = trpc.rfpSessions.resetSkill.useMutation({
    onSuccess: () =>
      utils.rfpSessions.getById.invalidate({ id: activeSessionId! }),
  });

  // ── Computed values ────────────────────────────────────────────────────────
  const resumeState = computeResumeState(localState);
  const progressPct = Math.round(
    (resumeState.completedCount / WORKFLOW_SKILL_NAMES.length) * 100
  );
  const liveScore = session?.liveScore ?? null;

  // ── Skill display name lookup ──────────────────────────────────────────────
  const skillDisplayName = useCallback(
    (name: WorkflowSkillName) =>
      ORDERED_SKILLS.find((s) => s.name === name)?.displayName ?? name,
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CORE SEQUENTIAL ORCHESTRATOR
  //
  // Rules enforced here:
  // • One skill per request — never loops or batches.
  // • Next skill fires only after previous mutation resolves.
  // • Promise.all is never used.
  // • On error: marks skill as error in local state, stops chain, shows retry.
  // • On browser close mid-run: DB already has all completed outputs saved.
  // ─────────────────────────────────────────────────────────────────────────
  const runSequentialWorkflow = useCallback(
    async (startFrom: WorkflowSkillName, sessionId: string) => {
      abortRef.current = false;
      setIsRunning(true);

      const startIndex = WORKFLOW_SKILL_NAMES.indexOf(startFrom);
      if (startIndex === -1) {
        setIsRunning(false);
        return;
      }

      const skillsToRun = WORKFLOW_SKILL_NAMES.slice(startIndex);

      for (const skillName of skillsToRun) {
        // Check if user clicked Pause
        if (abortRef.current) {
          toast.info("Workflow paused. Click Resume to continue.");
          break;
        }

        // ── Mark this skill as running locally (optimistic) ────────────────
        setActiveSkill(skillName);
        setActiveView(skillName);
        setLocalState((prev) => ({
          ...prev,
          [skillName]: {
            status: "running",
            startedAt: new Date().toISOString(),
          } satisfies SkillStateEntry,
        }));

        try {
          // ── SINGLE SKILL CALL — one tRPC request, one skill ───────────────────
          // The backend fires the LLM in a background job and returns
          // immediately with running:true. We then poll getById every 2s
          // until the skill reaches "complete" or "error" in workflowState.
          await executeSkillMutation.mutateAsync({
            sessionId,
            skillName,
          });

          // ── Poll DB until skill completes or errors ────────────────────────
          const POLL_INTERVAL_MS = 2000;
          const MAX_WAIT_MS = 15 * 60 * 1000; // 15 minutes
          const pollStart = Date.now();

          let finalOutput = "";
          let finalModel = "unknown";
          let finalProvider = "unknown";
          let finalCompletedAt = new Date().toISOString();
          let skillErrorMessage: string | undefined;

          while (true) {
            if (abortRef.current) break;
            if (Date.now() - pollStart > MAX_WAIT_MS) {
              throw new Error(`Skill "${skillName}" timed out after 15 minutes`);
            }

            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

            // Fetch fresh session state from the server
            const freshData = await utils.rfpSessions.getById.fetch({ id: sessionId });
            const freshState = (freshData?.workflowState ?? {}) as WorkflowState;
            const freshOutputs = (freshData?.skillOutputs ?? {}) as SkillOutputs;
            const entry = freshState[skillName];

            if (entry?.status === "complete") {
              finalOutput = freshOutputs[skillName] ?? "";
              finalModel = entry.model ?? "unknown";
              finalProvider = entry.provider ?? "unknown";
              finalCompletedAt = entry.completedAt ?? new Date().toISOString();
              break;
            }
            if (entry?.status === "error") {
              skillErrorMessage = entry.errorMessage ?? `Skill "${skillName}" failed`;
              break;
            }
            // Still running — update sub-step message if present
            if (entry?.subStepMessage) {
              setLocalState((prev) => ({
                ...prev,
                [skillName]: { ...prev[skillName], subStepMessage: entry.subStepMessage } as SkillStateEntry,
              }));
            }
          }

          if (skillErrorMessage) throw new Error(skillErrorMessage);

          // ── Update local state from polled result ──────────────────────────
          setLocalOutputs((prev) => ({
            ...prev,
            [skillName]: finalOutput,
          }));
          setLocalState((prev) => ({
            ...prev,
            [skillName]: {
              status: "complete",
              completedAt: finalCompletedAt,
              model: finalModel,
              provider: finalProvider,
            } satisfies SkillStateEntry,
          }));

          // Refresh server cache (non-blocking)
          utils.rfpSessions.getById.invalidate({ id: sessionId });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown error";

          // ── Mark skill as error — chain stops here ─────────────────────────
          setLocalState((prev) => ({
            ...prev,
            [skillName]: {
              status: "error",
              errorMessage: message,
            } satisfies SkillStateEntry,
          }));

          toast.error(`${skillDisplayName(skillName)} failed`, {
            description: message,
            duration: 8000,
            action: {
              label: "Retry",
              onClick: () => {
                if (activeSessionId)
                  runSequentialWorkflow(skillName, activeSessionId);
              },
            },
          });

          setIsRunning(false);
          setActiveSkill(null);
          return; // Stop the chain — do not proceed to next skill
        }
      }

      setIsRunning(false);
      setActiveSkill(null);

      if (!abortRef.current) {
        toast.success("Proposal generation complete!", {
          description: `All ${WORKFLOW_SKILL_NAMES.length} skills completed and saved. Switching to Full Draft view.`,
        });
        setActiveView("full_draft");
        refetchSections();
        utils.rfpSessions.getById.invalidate({ id: sessionId });
      }
    },
    [executeSkillMutation, utils, skillDisplayName, activeSessionId, refetchSections]
  );

  // ── Handle "Generate Proposal" / "Resume" click ────────────────────────────
  const handleStartOrResume = useCallback(async () => {
    // If no session exists yet, create one first
    let sessionId = activeSessionId;
    if (!sessionId) {
      const result = await createSessionMutation.mutateAsync({
        proposalId,
      });
      sessionId = result.sessionId;
    }

    const startFrom = resumeState.nextSkillToRun ?? WORKFLOW_SKILL_NAMES[0];
    runSequentialWorkflow(startFrom, sessionId);
  }, [
    activeSessionId,
    createSessionMutation,
    proposalId,
    resumeState.nextSkillToRun,
    runSequentialWorkflow,
  ]);

  // ── Handle Pause ───────────────────────────────────────────────────────────
  const handlePause = () => {
    abortRef.current = true;
  };

  // ── Handle Reset Skill ─────────────────────────────────────────────────────
  const handleResetSkill = async (skillName: WorkflowSkillName) => {
    if (!activeSessionId) return;
    await resetSkillMutation.mutateAsync({
      sessionId: activeSessionId,
      skillName,
    });
    setLocalState((prev) => ({
      ...prev,
      [skillName]: { status: "pending" },
    }));
    setLocalOutputs((prev) => {
      const next = { ...prev };
      delete next[skillName];
      return next;
    });
    setShowResetDialog(null);
    toast.info(`${skillDisplayName(skillName)} reset — ready to re-run`);
  };

  // ── Parsed RFP data (structured JSON from rfp_parser) ─────────────────────
  const parsedRfpData = (() => {
    const raw = localOutputs.rfp_parser;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ParsedRfpData;
    } catch {
      return null;
    }
  })();

  // ── Loading state ──────────────────────────────────────────────────────────
  const isLoading =
    sessionsLoading || (!!activeSessionId && sessionLoading);

  if (isLoading) {
    return (
      <AppLayout title="Proposal Workspace">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // ── Selected skill for the main panel ─────────────────────────────────────
  const selectedSkill =
    activeView !== "overview" && activeView !== "full_draft"
      ? ORDERED_SKILLS.find((s) => s.name === activeView)
      : null;
  const selectedOutput = selectedSkill
    ? localOutputs[selectedSkill.name] ?? ""
    : "";
  const selectedState = selectedSkill
    ? localState[selectedSkill.name]
    : undefined;

  // ── Status label ──────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (resumeState.isFullyComplete) return "All 8 skills complete";
    if (resumeState.hasError)
      return `Error in ${skillDisplayName(resumeState.erroredSkill!)}`;
    if (isRunning && activeSkill)
      return `Running: ${skillDisplayName(activeSkill)}...`;
    if (resumeState.completedCount === 0) return "Ready to generate";
    return `${resumeState.completedCount} of ${WORKFLOW_SKILL_NAMES.length} complete`;
  })();

  // Demo proposal guard — show a friendly message instead of firing UUID-only API calls
  if (!isRealProposal) {
    return (
      <TooltipProvider>
        <AppLayout title="Proposal Workspace">
          <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-6 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <FileText className="w-8 h-8 text-amber-600" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-semibold text-foreground mb-2">Demo Proposal</h2>
              <p className="text-muted-foreground text-sm">
                This is a sample proposal used to illustrate the interface. To use the full AI
                workflow, create a real proposal via the Proposal Launchpad or the Proposals page.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/proposals")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Proposals
              </Button>
              <Button className="bg-amplify-gradient text-white" onClick={() => navigate("/launch")}>
                Start New Proposal
              </Button>
            </div>
          </div>
        </AppLayout>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <AppLayout title="Proposal Workspace">
        <div className="flex flex-col h-full overflow-x-hidden">
          {/* ── Top Bar ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b shrink-0 gap-2 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => navigate("/proposals")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold truncate">
                  {session?.rfpFileName ??
                    parsedRfpData?.projectTitle ??
                    "Proposal Workspace"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {parsedRfpData?.agency ?? `Proposal #${proposalId}`}
                  {session && ` · Session #${session.id}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Live score badge */}
              {liveScore !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      className={[
                        "text-sm font-bold px-3 py-1 cursor-default",
                        liveScore >= 80
                          ? "bg-emerald-500 hover:bg-emerald-500 text-white"
                          : liveScore >= 60
                            ? "bg-amber-500 hover:bg-amber-500 text-white"
                            : "bg-red-500 hover:bg-red-500 text-white",
                      ].join(" ")}
                    >
                      {liveScore}/100
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Proposal Score (from Skill 8 — Proposal Scorer)
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Progress bar */}
              <div className="flex items-center gap-2 w-36">
                <Progress value={progressPct} className="h-1.5" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {resumeState.completedCount}/{WORKFLOW_SKILL_NAMES.length}
                </span>
              </div>

              {/* Primary action */}
              {isRunning ? (
                <Button size="sm" variant="destructive" onClick={handlePause}>
                  Pause
                </Button>
              ) : resumeState.isFullyComplete ? (
                <Button size="sm" variant="outline" disabled>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  Complete
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartOrResume}
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : resumeState.completedCount === 0 ? (
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {resumeState.completedCount === 0
                    ? "Generate Proposal"
                    : `Resume from Skill ${resumeState.completedCount + 1}`}
                </Button>
              )}
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0">
            {/* ── Left Sidebar: Skill Pipeline ─────────────────────────── */}
            <div className="w-56 shrink-0 border-r flex flex-col overflow-hidden bg-muted/10">
              <div className="px-3 py-2 border-b">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Skill Pipeline
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-0.5">
                  {/* Overview row */}
                  <button
                    onClick={() => setActiveView("overview")}
                    className={[
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all",
                      "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      activeView === "overview" ? "bg-accent" : "",
                    ].join(" ")}
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium">Overview</span>
                  </button>

                  <Separator className="my-1" />

                  {ORDERED_SKILLS.map((skill, index) => (
                    <div key={skill.name} className="relative">
                      {/* Connector line between skills */}
                      {index < ORDERED_SKILLS.length - 1 && (
                        <div className="absolute left-[1.6rem] top-[2.4rem] w-px h-[0.4rem] bg-border/60" />
                      )}
                      <SkillRow
                        skill={skill}
                        index={index}
                        stateEntry={localState[skill.name]}
                        isActive={activeSkill === skill.name}
                        isSelected={activeView === skill.name}
                        onClick={() => setActiveView(skill.name)}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Full Draft button */}
              {resumeState.completedCount > 0 && (
                <div className="px-3 py-2 border-t">
                  <button
                    onClick={() => setActiveView("full_draft")}
                    className={[
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all",
                      "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      activeView === "full_draft" ? "bg-accent" : "",
                    ].join(" ")}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium">Full Draft</span>
                    {resumeState.isFullyComplete && (
                      <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">
                        Ready
                      </Badge>
                    )}
                  </button>
                </div>
              )}

              {/* Session status footer */}
              <div className="p-3 border-t space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  ) : resumeState.isFullyComplete ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : resumeState.hasError ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  <span className="truncate">{statusLabel}</span>
                </div>
                {session?.rfpFileName && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{session.rfpFileName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Main Panel ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {activeView === "overview" ? (
                /* ── Overview Panel ──────────────────────────────────── */
                <ScrollArea className="flex-1">
                  <div className="p-6 max-w-3xl mx-auto space-y-5">
                    {/* Status card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Workflow Status
                        </CardTitle>
                        <CardDescription>
                          {resumeState.isFullyComplete
                            ? "All 8 skills completed. Your proposal draft is ready for review."
                            : resumeState.hasError
                              ? `Error in "${skillDisplayName(resumeState.erroredSkill!)}". Click the skill to retry from that point.`
                              : isRunning && activeSkill
                                ? `Running: ${skillDisplayName(activeSkill)}...`
                                : resumeState.completedCount === 0
                                  ? !session
                                    ? "Click Generate Proposal to begin. A new session will be created automatically."
                                    : "Session created. Click Generate Proposal to start the workflow."
                                  : `${resumeState.completedCount} of ${WORKFLOW_SKILL_NAMES.length} skills complete. Click Resume to continue from Skill ${resumeState.completedCount + 1}.`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Overall Progress
                            </span>
                            <span className="font-medium">{progressPct}%</span>
                          </div>
                          <Progress value={progressPct} className="h-2.5" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Resume prompt (shown when partially complete) */}
                    {!isRunning &&
                      !resumeState.isFullyComplete &&
                      resumeState.completedCount > 0 && (
                        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                  Resume from Skill{" "}
                                  {resumeState.completedCount + 1}
                                </p>
                                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                                  {resumeState.completedCount} skill
                                  {resumeState.completedCount !== 1
                                    ? "s"
                                    : ""}{" "}
                                  already saved — continuing from{" "}
                                  <strong>
                                    {skillDisplayName(
                                      resumeState.nextSkillToRun!
                                    )}
                                  </strong>
                                </p>
                              </div>
                              <Button size="sm" onClick={handleStartOrResume}>
                                <Play className="h-3.5 w-3.5 mr-1.5" />
                                Resume
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    {/* Parsed RFP summary */}
                    {parsedRfpData && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Parsed RFP
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ParsedRfpSummary data={parsedRfpData} />
                        </CardContent>
                      </Card>
                    )}

                    {/* Skills grid */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Skill Results
                        </CardTitle>
                        <CardDescription>
                          Click any skill to view or edit its output.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {ORDERED_SKILLS.map((skill, index) => {
                            const entry = localState[skill.name];
                            const status = entry?.status ?? "pending";
                            const hasOutput = !!localOutputs[skill.name];
                            return (
                              <div
                                key={skill.name}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 cursor-pointer transition-colors"
                                onClick={() => setActiveView(skill.name)}
                              >
                                <span className="text-xs text-muted-foreground/50 font-mono w-4 shrink-0">
                                  {index + 1}
                                </span>
                                <SkillStatusIcon
                                  status={status}
                                  isActive={activeSkill === skill.name}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">
                                    {skill.displayName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {skill.description}
                                  </p>
                                </div>
                                {hasOutput && (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              ) : activeView === "full_draft" ? (
                /* ── Full Draft Panel ──────────────────────────────────── */
                <ScrollArea className="flex-1">
                  <div className="p-6 max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h2 className="text-lg font-semibold">Full Proposal Draft</h2>
                        <p className="text-sm text-muted-foreground">
                          {proposalSections?.length ?? 0} sections · Edit any section inline, changes save automatically.
                        </p>
                      </div>
                      {liveScore !== null && (
                        <Badge
                          className={[
                            "text-sm font-bold px-3 py-1",
                            liveScore >= 80
                              ? "bg-emerald-500 hover:bg-emerald-500 text-white"
                              : liveScore >= 60
                                ? "bg-amber-500 hover:bg-amber-500 text-white"
                                : "bg-red-500 hover:bg-red-500 text-white",
                          ].join(" ")}
                        >
                          Score: {liveScore}/100
                        </Badge>
                      )}
                    </div>

                    {(!proposalSections || proposalSections.length === 0) ? (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                          <p className="text-muted-foreground">No sections generated yet.</p>
                          <p className="text-sm text-muted-foreground/60 mt-1">
                            Run the proposal generation workflow to populate sections.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      proposalSections.map((section) => (
                        <FullDraftSectionCard
                          key={section.id}
                          section={section}
                          onSave={(content) =>
                            updateSectionMutation.mutate({
                              sectionId: section.id,
                              content,
                            })
                          }
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              ) : selectedSkill ? (
                /* ── Skill Output Panel ──────────────────────────────── */
                <div className="flex flex-col">
                  {/* Skill header */}
                  <div className="flex items-start justify-between px-6 py-4 border-b shrink-0 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SkillStatusIcon
                          status={selectedState?.status ?? "pending"}
                          isActive={activeSkill === selectedSkill.name}
                          size="sm"
                        />
                        <h2 className="text-base font-semibold">
                          {selectedSkill.displayName}
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedSkill.description}
                      </p>
                      {selectedState?.model && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {selectedState.provider} · {selectedState.model}
                          {selectedState.completedAt &&
                            ` · completed ${new Date(selectedState.completedAt).toLocaleTimeString()}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Re-run button for completed skills */}
                      {selectedState?.status === "complete" && !isRunning && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setShowResetDialog(selectedSkill.name)
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Re-run
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Reset and re-run this skill
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Run from here for pending/error skills */}
                      {(selectedState?.status === "pending" ||
                        selectedState?.status === "error" ||
                        !selectedState) &&
                        !isRunning && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              let sessionId = activeSessionId;
                              if (!sessionId) {
                                const r =
                                  await createSessionMutation.mutateAsync({
                                    proposalId,
                                  });
                                sessionId = r.sessionId;
                              }
                              runSequentialWorkflow(
                                selectedSkill.name,
                                sessionId
                              );
                            }}
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Run from here
                          </Button>
                        )}
                      {/* Running indicator */}
                      {activeSkill === selectedSkill.name && (
                        <div className="flex items-center gap-2 text-sm text-blue-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Running...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Skill output */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {activeSkill === selectedSkill.name ? (
                      /* Running state */
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <div className="relative">
                          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                        </div>
                        <div>
                          <p className="text-base font-medium">
                            {selectedSkill.displayName} is running...
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            ~{selectedSkill.estimatedSeconds}s estimated. The
                            result will be saved to the database automatically.
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-2">
                            You can safely close this tab — the workflow will
                            resume where it left off.
                          </p>
                        </div>
                      </div>
                    ) : selectedState?.status === "error" ? (
                      /* Error state */
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <XCircle className="h-12 w-12 text-red-500" />
                        <div>
                          <p className="text-base font-medium text-red-600 dark:text-red-400">
                            Skill failed
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 max-w-md">
                            {selectedState.errorMessage}
                          </p>
                        </div>
                        <Button
                          onClick={async () => {
                            let sessionId = activeSessionId;
                            if (!sessionId) {
                              const r =
                                await createSessionMutation.mutateAsync({
                                  proposalId,
                                });
                              sessionId = r.sessionId;
                            }
                            runSequentialWorkflow(
                              selectedSkill.name,
                              sessionId
                            );
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Retry from here
                        </Button>
                      </div>
                    ) : selectedOutput ? (
                      /* Has output — render based on outputType */
                      <SkillOutputRenderer
                        skillName={selectedSkill.name}
                        output={selectedOutput}
                        outputType={resolveOutputType(selectedSkill.name, aiSkillRecords)}
                        sessionId={activeSessionId!}
                        isComplete={selectedState?.status === "complete"}
                        onSaved={(newOutput) =>
                          setLocalOutputs((prev) => ({
                            ...prev,
                            [selectedSkill.name]: newOutput,
                          }))
                        }
                      />
                    ) : (
                      /* Pending state */
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <Circle className="h-12 w-12 text-muted-foreground/20" />
                        <div>
                          <p className="text-base font-medium text-muted-foreground">
                            Not yet generated
                          </p>
                          <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
                            {selectedSkill.dependsOn.length > 0
                              ? `This skill reads output from: ${selectedSkill.dependsOn.map(skillDisplayName).join(", ")}`
                              : "This is the first skill in the chain. Click Generate Proposal to start."}
                          </p>
                        </div>
                        {!isRunning && (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              let sessionId = activeSessionId;
                              if (!sessionId) {
                                const r =
                                  await createSessionMutation.mutateAsync({
                                    proposalId,
                                  });
                                sessionId = r.sessionId;
                              }
                              runSequentialWorkflow(
                                selectedSkill.name,
                                sessionId
                              );
                            }}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Run from here
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </AppLayout>

      {/* ── Reset Confirmation Dialog ──────────────────────────────────── */}
      <AlertDialog
        open={!!showResetDialog}
        onOpenChange={(open) => !open && setShowResetDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run this skill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the saved output for{" "}
              <strong>
                {showResetDialog ? skillDisplayName(showResetDialog) : ""}
              </strong>{" "}
              and re-run it from scratch. Downstream skills that depend on this
              output may also need to be re-run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                showResetDialog && handleResetSkill(showResetDialog)
              }
            >
              Re-run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
