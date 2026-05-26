/**
 * Proposal Scorer — Standalone full-page scoring tool
 *
 * Paste any proposal section (or full proposal), define evaluation criteria
 * (or load from an RFP wiki), and get:
 *   1. An overall compliance score (0–100)
 *   2. Per-criterion scores with pass/fail
 *   3. Inline annotated text with color-coded highlights:
 *      - Red    = critical gap (missing required element)
 *      - Amber  = warning (weak or vague language)
 *      - Blue   = suggestion (could be stronger)
 *   4. Top improvements priority list
 *
 * Each highlight is hoverable — shows the criterion name and a specific fix.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, Loader2, BarChart2, AlertTriangle,
  Plus, Trash2, FileText, Target, Lightbulb, RefreshCw, ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import AnnotatedProposalViewer, { type Annotation } from "@/components/AnnotatedProposalViewer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CriterionScore {
  criterion: string;
  score: number;
  passed: boolean;
  feedback: string;
  suggestion: string;
}

interface ScoreResult {
  overallScore: number;
  overallPassed: boolean;
  criteriaScores: CriterionScore[];
  annotations: Annotation[];
  summary: string;
  topImprovements: string[];
}

interface ScoringSession {
  id: string;
  timestamp: Date;
  label: string;
  overallScore: number;
  overallPassed: boolean;
  annotationCount: number;
  result: ScoreResult;
  proposalText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
};

const scoreBarColor = (score: number) => {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
};

const DEFAULT_CRITERIA = [
  "Directly address all evaluation criteria by name",
  "Reference at least 3 relevant firm projects with agency names and dollar values",
  "Use terminology that mirrors the RFP language",
  "Demonstrate understanding of the project scope and challenges",
  "Provide a clear, structured approach with measurable milestones",
];

const SECTION_TYPES = [
  { value: "technical_approach", label: "Technical Approach" },
  { value: "management_approach", label: "Management Approach" },
  { value: "relevant_experience", label: "Relevant Experience" },
  { value: "key_personnel", label: "Key Personnel" },
  { value: "project_understanding", label: "Project Understanding" },
  { value: "price_proposal", label: "Price Proposal" },
  { value: "executive_summary", label: "Executive Summary" },
  { value: "full_proposal", label: "Full Proposal" },
  { value: "other", label: "Other" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalScorer() {
  // Input state
  const [proposalText, setProposalText] = useState("");
  const [rfpContext, setRfpContext] = useState("");
  const [sectionType, setSectionType] = useState("technical_approach");
  const [criteria, setCriteria] = useState<string[]>(DEFAULT_CRITERIA);
  const [newCriterion, setNewCriterion] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");

  // Scoring state
  const [scoring, setScoring] = useState(false);
  const [currentResult, setCurrentResult] = useState<ScoreResult | null>(null);
  const [sessions, setSessions] = useState<ScoringSession[]>([]);
  const [activeTab, setActiveTab] = useState<"score" | "history">("score");

  const scoreOutputMutation = trpc.agentGuidelines.scoreOutput.useMutation();

  const handleScore = async () => {
    if (!proposalText.trim()) { toast.error("Paste proposal text first"); return; }
    if (criteria.length === 0) { toast.error("Add at least one criterion"); return; }
    setScoring(true);
    try {
      const result = await scoreOutputMutation.mutateAsync({
        output: proposalText,
        successCriteria: criteria,
        rfpContext: rfpContext || undefined,
      });
      const scoreResult = result as ScoreResult;
      setCurrentResult(scoreResult);

      // Save to session history
      const session: ScoringSession = {
        id: Date.now().toString(),
        timestamp: new Date(),
        label: sessionLabel || `${SECTION_TYPES.find(s => s.value === sectionType)?.label ?? "Section"} — ${new Date().toLocaleTimeString()}`,
        overallScore: scoreResult.overallScore,
        overallPassed: scoreResult.overallPassed,
        annotationCount: scoreResult.annotations?.length ?? 0,
        result: scoreResult,
        proposalText,
      };
      setSessions(prev => [session, ...prev]);
      setActiveTab("score");
      toast.success(`Scored: ${scoreResult.overallScore}/100 — ${scoreResult.annotations?.length ?? 0} annotations`);
    } catch (err: any) {
      toast.error(`Scoring failed: ${err.message}`);
    } finally {
      setScoring(false);
    }
  };

  const loadSession = (session: ScoringSession) => {
    setCurrentResult(session.result);
    setProposalText(session.proposalText);
    setActiveTab("score");
    toast.info(`Loaded: ${session.label}`);
  };

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria([...criteria, newCriterion.trim()]);
    setNewCriterion("");
  };

  const removeCriterion = (i: number) => setCriteria(criteria.filter((_, idx) => idx !== i));

  const criticalCount = useMemo(() =>
    currentResult?.annotations?.filter(a => a.severity === "critical").length ?? 0,
    [currentResult]
  );
  const warningCount = useMemo(() =>
    currentResult?.annotations?.filter(a => a.severity === "warning").length ?? 0,
    [currentResult]
  );
  const suggestionCount = useMemo(() =>
    currentResult?.annotations?.filter(a => a.severity === "suggestion").length ?? 0,
    [currentResult]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-amber-500" />
            Proposal Scorer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Score proposal sections against RFP criteria with inline text annotations
          </p>
        </div>
        {currentResult && (
          <div className="flex items-center gap-3">
            <div className={`text-3xl font-bold ${scoreColor(currentResult.overallScore)}`}>
              {currentResult.overallScore}<span className="text-lg font-normal text-muted-foreground">/100</span>
            </div>
            {currentResult.overallPassed ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-600 border-red-200">
                <XCircle className="h-3 w-3 mr-1" /> Needs Revision
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel: inputs ── */}
        <div className="w-80 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
          {/* Section type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Section Type</Label>
            <select
              value={sectionType}
              onChange={(e) => setSectionType(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SECTION_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Session label */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Session Label (optional)</Label>
            <Input
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="e.g. Technical Approach v2"
              className="text-sm h-8"
            />
          </div>

          {/* RFP context */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">RFP Context (optional)</Label>
            <Textarea
              value={rfpContext}
              onChange={(e) => setRfpContext(e.target.value)}
              placeholder="Paste key RFP requirements, evaluation criteria, or wiki content..."
              className="h-28 text-xs resize-none"
            />
          </div>

          {/* Criteria editor */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Target className="h-3 w-3" /> Success Criteria
              <span className="ml-auto text-muted-foreground font-normal">{criteria.length}</span>
            </Label>
            <ScrollArea className="h-44">
              <div className="space-y-1.5 pr-1">
                {criteria.map((c, i) => (
                  <div key={i} className="flex items-start gap-1.5 group">
                    <span className="text-[10px] text-muted-foreground mt-1.5 w-4 flex-shrink-0">{i + 1}.</span>
                    <p className="text-xs text-foreground flex-1 leading-snug">{c}</p>
                    <button
                      onClick={() => removeCriterion(i)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity flex-shrink-0 mt-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-1.5">
              <Input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCriterion()}
                placeholder="Add criterion..."
                className="text-xs h-7 flex-1"
              />
              <Button onClick={addCriterion} size="sm" variant="outline" className="h-7 w-7 p-0">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Score button */}
          <Button
            onClick={handleScore}
            disabled={scoring || !proposalText.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            {scoring ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scoring {criteria.length} criteria...</>
            ) : (
              <><BarChart2 className="h-4 w-4 mr-2" />Score Proposal</>
            )}
          </Button>

          {/* Quick stats after scoring */}
          {currentResult && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Last Score Summary</p>
              <Progress value={currentResult.overallScore} className="h-1.5" />
              <div className="flex flex-wrap gap-1.5">
                {criticalCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400">
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
                    {warningCount} warning
                  </span>
                )}
                {suggestionCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400">
                    {suggestionCount} suggestion
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{currentResult.summary}</p>
            </div>
          )}

          {/* Session history list */}
          {sessions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Score History</p>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s)}
                    className="w-full text-left rounded-md border border-border p-2 hover:bg-muted/50 transition-colors space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate flex-1">{s.label}</span>
                      <span className={`text-xs font-bold ml-2 ${scoreColor(s.overallScore)}`}>{s.overallScore}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {s.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">{s.annotationCount} annotations</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: proposal text + results ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 px-4 pt-3 pb-0 border-b border-border">
              <TabsList className="h-8">
                <TabsTrigger value="score" className="text-xs h-6">
                  <FileText className="h-3 w-3 mr-1.5" /> Proposal Text
                </TabsTrigger>
                {currentResult && (
                  <TabsTrigger value="annotated" className="text-xs h-6">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1" />
                    Annotated View
                  </TabsTrigger>
                )}
                {currentResult && (
                  <TabsTrigger value="criteria" className="text-xs h-6">
                    <Target className="h-3 w-3 mr-1.5" /> Criteria Scores
                  </TabsTrigger>
                )}
              </TabsList>
              {currentResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  onClick={() => { setCurrentResult(null); setActiveTab("score"); }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> New Score
                </Button>
              )}
            </div>

            {/* Proposal text input tab */}
            <TabsContent value="score" className="flex-1 p-4 m-0 overflow-hidden">
              <div className="h-full flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Proposal Text to Score</Label>
                  <span className="text-xs text-muted-foreground">
                    {proposalText.length.toLocaleString()} chars
                  </span>
                </div>
                <Textarea
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder="Paste the proposal section or full proposal text here...

The scorer will identify specific passages that fail to meet the evaluation criteria and highlight them inline with color-coded annotations:
  🔴 Red = Critical gap (missing required element)
  🟡 Amber = Warning (weak or vague language)  
  🔵 Blue = Suggestion (could be stronger)"
                  className="flex-1 text-sm resize-none font-mono leading-relaxed"
                />
                {!currentResult && proposalText.trim() && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-border">
                    <ClipboardPaste className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {proposalText.split(/\s+/).filter(Boolean).length.toLocaleString()} words ready to score against {criteria.length} criteria
                    </p>
                    <Button
                      onClick={handleScore}
                      disabled={scoring}
                      size="sm"
                      className="ml-auto h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart2 className="h-3 w-3 mr-1" />}
                      Score
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Annotated view tab */}
            {currentResult && (
              <TabsContent value="annotated" className="flex-1 p-4 m-0 overflow-auto">
                <AnnotatedProposalViewer
                  text={proposalText}
                  annotations={currentResult.annotations ?? []}
                  showLegend={true}
                />
              </TabsContent>
            )}

            {/* Criteria scores tab */}
            {currentResult && (
              <TabsContent value="criteria" className="flex-1 p-4 m-0 overflow-auto">
                <div className="space-y-4 max-w-2xl">
                  {currentResult.topImprovements.length > 0 && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                      <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5 mb-3">
                        <AlertTriangle className="h-4 w-4" /> Top Priority Improvements
                      </p>
                      <ol className="space-y-1.5">
                        {currentResult.topImprovements.map((imp, i) => (
                          <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                            <span className="font-bold flex-shrink-0">{i + 1}.</span>
                            {imp}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="space-y-3">
                    {currentResult.criteriaScores.map((cs, i) => (
                      <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {cs.passed
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                            <p className="text-sm font-medium text-foreground">{cs.criterion}</p>
                          </div>
                          <span className={`text-lg font-bold ${scoreColor(cs.score)}`}>{cs.score}</span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full rounded-full transition-all ${scoreBarColor(cs.score)}`}
                            style={{ width: `${cs.score}%` }}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">{cs.feedback}</p>
                        {!cs.passed && cs.suggestion && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">{cs.suggestion}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
