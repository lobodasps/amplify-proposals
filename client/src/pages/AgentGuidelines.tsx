/**
 * Agent Guidelines Page — Karpathy Pattern 3
 *
 * CLAUDE.md-style structured AI workflow:
 * 1. Define success criteria (not just commands)
 * 2. Get 3 approaches with pros/cons before generating anything
 * 3. Choose an approach, then generate with that strategy
 * 4. Score the output against the success criteria
 *
 * This page is the "pre-flight checklist" before any proposal section is written.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Target, Loader2, CheckCircle2, XCircle, Lightbulb, ThumbsUp,
  ThumbsDown, ChevronRight, Zap, BarChart2, AlertTriangle, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Approach {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
  rationale: string;
}

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
  summary: string;
  topImprovements: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentGuidelines() {
  // Step 1: Task definition
  const [taskDescription, setTaskDescription] = useState("");
  const [sectionType, setSectionType] = useState("technical_approach");
  const [rfpContext, setRfpContext] = useState("");
  const [firmContext, setFirmContext] = useState(
    "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY."
  );

  // Step 2: Success criteria
  const [criteria, setCriteria] = useState<string[]>([
    "Directly address all evaluation criteria by name",
    "Reference at least 3 relevant firm projects with agency names and dollar values",
    "Use terminology that mirrors the RFP language",
  ]);
  const [newCriterion, setNewCriterion] = useState("");

  // Step 3: Approaches
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [overallRec, setOverallRec] = useState("");
  const [loadingApproaches, setLoadingApproaches] = useState(false);
  const [chosenApproach, setChosenApproach] = useState<number | null>(null);

  // Step 4: Score output
  const [outputToScore, setOutputToScore] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);

  const [activeStep, setActiveStep] = useState(1);

  const approachesMutation = trpc.agentGuidelines.suggestApproaches.useMutation();
  const scoreOutputMutation = trpc.agentGuidelines.scoreOutput.useMutation();

  const handleGetApproaches = async () => {
    if (!taskDescription.trim()) { toast.error("Describe the task first"); return; }
    setLoadingApproaches(true);
    try {
      const result = await approachesMutation.mutateAsync({
        taskDescription,
        sectionType,
        rfpContext: rfpContext || undefined,
        firmContext,
        successCriteria: criteria,
      });
      setApproaches(result.approaches);
      setOverallRec(result.overallRecommendation);
      setActiveStep(3);
      toast.success(`${result.approaches.length} approaches generated`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setLoadingApproaches(false);
    }
  };

  const handleScoreOutput = async () => {
    if (!outputToScore.trim()) { toast.error("Paste the output to score first"); return; }
    if (criteria.length === 0) { toast.error("Add success criteria first"); return; }
    setScoring(true);
    try {
      const result = await scoreOutputMutation.mutateAsync({
        output: outputToScore,
        successCriteria: criteria,
        rfpContext: rfpContext || undefined,
      });
      setScoreResult(result as ScoreResult);
      setActiveStep(4);
    } catch (err: any) {
      toast.error(`Scoring failed: ${err.message}`);
    } finally {
      setScoring(false);
    }
  };

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria([...criteria, newCriterion.trim()]);
    setNewCriterion("");
  };

  const removeCriterion = (i: number) => setCriteria(criteria.filter((_, idx) => idx !== i));

  const sectionTypes = [
    { value: "technical_approach", label: "Technical Approach" },
    { value: "project_experience", label: "Project Experience" },
    { value: "key_personnel", label: "Key Personnel" },
    { value: "management_plan", label: "Management Plan" },
    { value: "qualifications", label: "Qualifications" },
    { value: "cover_letter", label: "Cover Letter" },
    { value: "executive_summary", label: "Executive Summary" },
    { value: "cost_proposal", label: "Cost Proposal" },
    { value: "other", label: "Other" },
  ];

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const steps = [
    { n: 1, label: "Define Task" },
    { n: 2, label: "Success Criteria" },
    { n: 3, label: "Choose Approach" },
    { n: 4, label: "Score Output" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6 text-amber-500" />
          Agent Guidelines
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Karpathy Pattern 3 — Define success criteria, explore 3 approaches, then generate with intention
        </p>
      </div>

      {/* Pattern explanation */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-6 text-sm">
            <div className="flex items-start gap-2 flex-1">
              <Target className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Success criteria, not commands</p>
                <p className="text-muted-foreground">Define measurable criteria the output must meet. The AI iterates toward criteria, not just instructions.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">3 approaches first</p>
                <p className="text-muted-foreground">Ask for approaches before generating. Prevents the model from defaulting to its first instinct.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <BarChart2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Score the output</p>
                <p className="text-muted-foreground">After generating, score the output against your criteria. Iterate until it passes.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep(n)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeStep === n
                  ? "bg-amber-500 text-white"
                  : n < activeStep
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {n < activeStep ? <CheckCircle2 className="h-3 w-3" /> : <span>{n}</span>}
              {label}
            </button>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Define Task */}
      {activeStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 1: Define the Task</CardTitle>
              <CardDescription>Be specific about what you need to write and for whom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Section Type</Label>
                <Select value={sectionType} onValueChange={setSectionType}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTypes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Task Description</Label>
                <Textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="e.g. Write the Technical Approach section for NJDOT's Special Inspection services RFP. The section must be 800 words and address all 5 evaluation criteria."
                  className="h-28 text-sm resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">RFP Context (paste wiki criteria or key requirements)</Label>
                <Textarea
                  value={rfpContext}
                  onChange={(e) => setRfpContext(e.target.value)}
                  placeholder="Paste evaluation criteria from the RFP wiki, or key requirements..."
                  className="h-24 text-sm resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Firm Context</Label>
                <Textarea
                  value={firmContext}
                  onChange={(e) => setFirmContext(e.target.value)}
                  className="h-16 text-sm resize-none"
                />
              </div>
              <Button onClick={() => setActiveStep(2)} className="w-full" disabled={!taskDescription.trim()}>
                Next: Define Success Criteria <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">Why this matters</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>Most proposal writers give the AI a command: <em>"Write the technical approach."</em></p>
              <p>The Agent Guidelines pattern flips this: you define <strong>what success looks like</strong>, then ask for approaches before generating anything.</p>
              <p>This means:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The AI explores the solution space instead of defaulting to its first instinct</li>
                <li>You make a strategic choice before committing to a direction</li>
                <li>The output can be scored against measurable criteria</li>
                <li>Iteration is structured, not random</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Success Criteria */}
      {activeStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2: Define Success Criteria</CardTitle>
            <CardDescription>
              What must the output achieve? Be specific and measurable. The AI will score the output against these criteria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm flex-1">{c}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCriterion(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                placeholder="Add a success criterion..."
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && addCriterion()}
              />
              <Button variant="outline" onClick={addCriterion} disabled={!newCriterion.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setActiveStep(1)}>Back</Button>
              <Button
                onClick={handleGetApproaches}
                disabled={loadingApproaches || criteria.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {loadingApproaches ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating 3 Approaches...</>
                ) : (
                  <><Lightbulb className="h-4 w-4 mr-2" />Get 3 Approaches</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose Approach */}
      {activeStep === 3 && approaches.length > 0 && (
        <div className="space-y-4">
          <Card className="border-amber-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Overall Recommendation
              </p>
              <p className="text-sm text-muted-foreground mt-1">{overallRec}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {approaches.map((approach, i) => (
              <Card
                key={i}
                className={`cursor-pointer transition-all ${
                  chosenApproach === i
                    ? "border-amber-400 ring-2 ring-amber-400/30"
                    : "hover:border-amber-200"
                }`}
                onClick={() => setChosenApproach(i)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{approach.title}</CardTitle>
                    {approach.recommended && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs shrink-0">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">{approach.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mb-1">
                      <ThumbsUp className="h-3 w-3" /> Pros
                    </p>
                    <ul className="space-y-1">
                      {approach.pros.map((p, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-emerald-500 mt-0.5">+</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-500 flex items-center gap-1 mb-1">
                      <ThumbsDown className="h-3 w-3" /> Cons
                    </p>
                    <ul className="space-y-1">
                      {approach.cons.map((c, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-red-400 mt-0.5">−</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground italic border-t pt-2">{approach.rationale}</p>
                  {chosenApproach === i && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Selected
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setActiveStep(2)}>Back</Button>
            <Button
              onClick={() => setActiveStep(4)}
              disabled={chosenApproach === null}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Use Approach {chosenApproach !== null ? chosenApproach + 1 : ""} → Score Output
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Score Output */}
      {activeStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 4: Score Your Output</CardTitle>
              <CardDescription>
                Paste the generated content and score it against your success criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {chosenApproach !== null && approaches[chosenApproach] && (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                  <p className="text-xs font-medium text-amber-700">Chosen approach: {approaches[chosenApproach].title}</p>
                  <p className="text-xs text-amber-600 mt-0.5">{approaches[chosenApproach].rationale}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs">Paste generated content to score</Label>
                <Textarea
                  value={outputToScore}
                  onChange={(e) => setOutputToScore(e.target.value)}
                  placeholder="Paste the proposal section, resume, or other AI-generated content here..."
                  className="h-48 text-sm resize-none font-mono"
                />
              </div>
              <Button
                onClick={handleScoreOutput}
                disabled={scoring || !outputToScore.trim()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                {scoring ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scoring against {criteria.length} criteria...</>
                ) : (
                  <><BarChart2 className="h-4 w-4 mr-2" />Score Output</>
                )}
              </Button>
            </CardContent>
          </Card>

          {scoreResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Score Results</CardTitle>
                  <div className={`text-2xl font-bold ${scoreColor(scoreResult.overallScore)}`}>
                    {scoreResult.overallScore}/100
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scoreResult.overallPassed ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-600 border-red-200">
                      <XCircle className="h-3 w-3 mr-1" /> Needs Revision
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={scoreResult.overallScore} className="h-2" />

                <p className="text-sm text-muted-foreground">{scoreResult.summary}</p>

                {scoreResult.topImprovements.length > 0 && (
                  <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-2">
                      <AlertTriangle className="h-3 w-3" /> Top Improvements
                    </p>
                    <ul className="space-y-1">
                      {scoreResult.topImprovements.map((imp, i) => (
                        <li key={i} className="text-xs text-amber-600">
                          {i + 1}. {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {scoreResult.criteriaScores.map((cs, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1">
                            {cs.passed
                              ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              : <XCircle className="h-3 w-3 text-red-400" />}
                            {cs.criterion}
                          </p>
                          <span className={`text-xs font-bold ${scoreColor(cs.score)}`}>{cs.score}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-4">{cs.feedback}</p>
                        {!cs.passed && (
                          <p className="text-xs text-amber-600 pl-4 italic">{cs.suggestion}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
