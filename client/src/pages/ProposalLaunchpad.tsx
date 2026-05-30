/**
 * ProposalLaunchpad.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 2-step wizard for rapid RFP intake and Go/No-Go decision.
 *
 * Step 1 — Upload RFP:
 *   • Drag-and-drop PDF upload → POST /api/upload (existing endpoint)
 *   • Create rfpSession → rfpSessions.create
 *   • Save file metadata → rfpSessions.saveRfpFile
 *   • Run rfp_parser skill → rfpSessions.executeSkill
 *   • Display extracted summary card (editable fields)
 *
 * Step 2 — Go/No-Go:
 *   • Invoke proposals.scoreGoNoGo with extracted data
 *   • Display score, recommendation, strengths, risks
 *   • GO → pursuits.create → redirect to /pursuits/:id
 *   • NO-GO → archive (stay on page with reset option)
 *
 * Rules: no new backend code, only existing tRPC procedures and /api/upload.
 */

import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Rocket,
  Building2,
  Hash,
  Calendar,
  DollarSign,
  Tag,
  AlignLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
} from "lucide-react";
import type { ParsedRfpData } from "../../../shared/workflowTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoNoGoResult {
  score: number;
  recommendation: "GO" | "NO-GO" | "CONDITIONAL GO";
  rationale: string;
  strengths: string[];
  risks: string[];
  winThemes: string[];
}

type WizardStep = "upload" | "extracting" | "review" | "scoring" | "decision" | "archived";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<{ fileUrl: string; fileKey: string; fileName: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "rfp");

  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Upload failed");
  }
  const data = await res.json();
  return { fileUrl: data.url, fileKey: data.key, fileName: data.fileName, size: data.size };
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 45) return "text-amber-600";
  return "text-red-600";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalLaunchpad() {
  const [, navigate] = useLocation();

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload + session state ────────────────────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string; name: string; size: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extractProgress, setExtractProgress] = useState(0);

  // ── Extracted RFP data (editable) ────────────────────────────────────────
  const [rfpTitle, setRfpTitle] = useState("");
  const [rfpAgency, setRfpAgency] = useState("");
  const [rfpNumber, setRfpNumber] = useState("");
  const [rfpDueDate, setRfpDueDate] = useState("");
  const [rfpEstValue, setRfpEstValue] = useState("");
  const [rfpServiceLines, setRfpServiceLines] = useState<string[]>([]);
  const [rfpSummary, setRfpSummary] = useState("");

  // ── Go/No-Go result ───────────────────────────────────────────────────────
  const [goNoGoResult, setGoNoGoResult] = useState<GoNoGoResult | null>(null);

  // ── tRPC mutations ────────────────────────────────────────────────────────
  const createSession = trpc.rfpSessions.create.useMutation();
  const saveRfpFile = trpc.rfpSessions.saveRfpFile.useMutation();
  const executeSkill = trpc.rfpSessions.executeSkill.useMutation();
  const scoreGoNoGo = trpc.proposals.scoreGoNoGo.useMutation();
  const createPursuit = trpc.pursuits.create.useMutation();
  const utils = trpc.useUtils();

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  // ── Core upload + extract flow ────────────────────────────────────────────
  const handleFileSelected = async (file: File) => {
    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50 MB limit.");
      return;
    }

    setStep("extracting");
    setExtractProgress(10);

    try {
      // 1. Upload file to storage
      const uploaded = await uploadFile(file);
      setUploadedFile({ url: uploaded.fileUrl, key: uploaded.fileKey, name: uploaded.fileName, size: uploaded.size });
      setExtractProgress(30);

      // 2. Create rfpSession
      const { sessionId: sid } = await createSession.mutateAsync({});
      setSessionId(sid);
      setExtractProgress(45);

      // 3. Save file metadata to session
      await saveRfpFile.mutateAsync({
        sessionId: sid,
        rfpFileName: uploaded.fileName,
        rfpFileKey: uploaded.fileKey,
        rfpFileUrl: uploaded.fileUrl,
        rfpMimeType: "application/pdf",
        rfpFileSizeBytes: uploaded.size,
      });
      setExtractProgress(60);

      // 4. Run rfp_parser skill
      const result = await executeSkill.mutateAsync({ sessionId: sid, skillName: "rfp_parser" });
      setExtractProgress(90);

      // 5. Parse structured output
      let parsed: Partial<ParsedRfpData> = {};
      try {
        parsed = JSON.parse(result.output) as ParsedRfpData;
      } catch {
        // fallback: use raw output as summary
        parsed = { scopeSummary: result.output };
      }

      setRfpTitle(parsed.projectTitle ?? file.name.replace(/\.pdf$/i, ""));
      setRfpAgency(parsed.agency ?? "");
      setRfpNumber(parsed.rfpNumber ?? "");
      setRfpDueDate(parsed.submissionDeadline ?? "");
      setRfpEstValue(parsed.estimatedValue ?? "");
      setRfpServiceLines(parsed.serviceLines ?? []);
      setRfpSummary(parsed.scopeSummary ?? "");

      setExtractProgress(100);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      toast.error(msg);
      setStep("upload");
      setExtractProgress(0);
    }
  };

  // ── Go/No-Go scoring ──────────────────────────────────────────────────────
  const handleRunGoNoGo = async () => {
    setStep("scoring");
    try {
      const estValue = rfpEstValue ? parseFloat(rfpEstValue.replace(/[^0-9.]/g, "")) : undefined;
      const result = await scoreGoNoGo.mutateAsync({
        pursuitTitle: rfpTitle,
        clientAgency: rfpAgency,
        serviceLines: rfpServiceLines,
        estimatedValue: isNaN(estValue ?? NaN) ? undefined : estValue,
        dueDate: rfpDueDate || undefined,
        rfpSummary: rfpSummary || undefined,
      });
      setGoNoGoResult(result as GoNoGoResult);
      setStep("decision");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scoring failed";
      toast.error(msg);
      setStep("review");
    }
  };

  // ── Create pursuit on GO ──────────────────────────────────────────────────
  const handleGo = async () => {
    try {
      const estValue = rfpEstValue ? parseFloat(rfpEstValue.replace(/[^0-9.]/g, "")) : undefined;
      const dueDate = rfpDueDate ? new Date(rfpDueDate) : undefined;

      await createPursuit.mutateAsync({
        title: rfpTitle,
        clientName: rfpAgency,
        rfpNumber: rfpNumber || undefined,
        dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
        estimatedValue: isNaN(estValue ?? NaN) ? undefined : estValue,
        serviceLines: rfpServiceLines.length > 0 ? rfpServiceLines : undefined,
      });

      // Fetch the newly created pursuit (most recent)
      await utils.pursuits.list.invalidate();
      const pursuitList = await utils.pursuits.list.fetch();
      const newest = pursuitList?.[0];

      toast.success("Pursuit created! Opening pursuit plan…");

      if (newest?.id) {
        navigate(`/pursuits/${newest.id}`);
      } else {
        navigate("/pursuits");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create pursuit";
      toast.error(msg);
    }
  };

  // ── Archive on NO-GO ──────────────────────────────────────────────────────
  const handleNoGo = () => {
    setStep("archived");
    toast.info("RFP archived. No pursuit created.");
  };

  // ── Reset wizard ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("upload");
    setUploadedFile(null);
    setSessionId(null);
    setExtractProgress(0);
    setRfpTitle("");
    setRfpAgency("");
    setRfpNumber("");
    setRfpDueDate("");
    setRfpEstValue("");
    setRfpServiceLines([]);
    setRfpSummary("");
    setGoNoGoResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Step indicator ────────────────────────────────────────────────────────
  const stepIndex = ["upload", "extracting", "review", "scoring", "decision", "archived"].indexOf(step);
  const progressSteps = [
    { label: "Upload RFP", active: stepIndex >= 0 },
    { label: "Extract Info", active: stepIndex >= 2 },
    { label: "Go/No-Go", active: stepIndex >= 4 },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Rocket className="w-4 h-4" />
            <span>Proposal Launchpad</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Launch a New Pursuit</h1>
          <p className="text-muted-foreground text-sm">
            Upload an RFP, extract key information automatically, and get an instant Go/No-Go recommendation.
          </p>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-2">
          {progressSteps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${s.active ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${s.active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < progressSteps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1a — Upload Drop Zone                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload RFP Document
              </CardTitle>
              <CardDescription>
                Drop a PDF here or click to browse. The AI will automatically extract agency, RFP number, due date, estimated value, service lines, and a summary.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                  transition-all duration-200 select-none
                  ${isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
                    <FileText className={`w-7 h-7 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {isDragging ? "Drop the PDF here" : "Drag & drop your RFP PDF"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse — PDF only, up to 50 MB</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1b — Extracting (progress)                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "extracting" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                Extracting RFP Information
              </CardTitle>
              <CardDescription>
                Uploading file and running AI extraction — this takes about 20–40 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {extractProgress < 30
                      ? "Uploading file…"
                      : extractProgress < 60
                      ? "Creating session…"
                      : extractProgress < 90
                      ? "Running AI extraction…"
                      : "Finalizing…"}
                  </span>
                  <span>{extractProgress}%</span>
                </div>
                <Progress value={extractProgress} className="h-2" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{uploadedFile?.name ?? "Uploading…"}</p>
                  {uploadedFile && (
                    <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — Review Extracted Info                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "review" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      Extracted RFP Information
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Review and edit the extracted details before running the Go/No-Go analysis.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    {uploadedFile?.name}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Project / RFP Title
                  </label>
                  <Input
                    value={rfpTitle}
                    onChange={(e) => setRfpTitle(e.target.value)}
                    placeholder="Enter project title"
                    className="font-medium"
                  />
                </div>

                {/* Agency + RFP Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Agency / Client
                    </label>
                    <Input
                      value={rfpAgency}
                      onChange={(e) => setRfpAgency(e.target.value)}
                      placeholder="e.g. NYC DOT"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> RFP Number
                    </label>
                    <Input
                      value={rfpNumber}
                      onChange={(e) => setRfpNumber(e.target.value)}
                      placeholder="e.g. RFP-2025-001"
                    />
                  </div>
                </div>

                {/* Due Date + Estimated Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Submission Deadline
                    </label>
                    <Input
                      value={rfpDueDate}
                      onChange={(e) => setRfpDueDate(e.target.value)}
                      placeholder="e.g. March 15, 2025"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Estimated Value
                    </label>
                    <Input
                      value={rfpEstValue}
                      onChange={(e) => setRfpEstValue(e.target.value)}
                      placeholder="e.g. $500,000"
                    />
                  </div>
                </div>

                {/* Service Lines */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Service Lines
                  </label>
                  <div className="flex flex-wrap gap-1.5 min-h-[2rem] p-2 rounded-md border border-input bg-background">
                    {rfpServiceLines.length === 0 ? (
                      <span className="text-xs text-muted-foreground self-center">No service lines detected</span>
                    ) : (
                      rfpServiceLines.map((sl) => (
                        <Badge key={sl} variant="secondary" className="text-xs">
                          {sl}
                          <button
                            onClick={() => setRfpServiceLines((prev) => prev.filter((x) => x !== sl))}
                            className="ml-1 hover:text-destructive transition-colors"
                          >
                            ×
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {/* Scope Summary */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" /> Scope Summary
                  </label>
                  <Textarea
                    value={rfpSummary}
                    onChange={(e) => setRfpSummary(e.target.value)}
                    placeholder="Brief description of the project scope…"
                    rows={4}
                    className="resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="flex items-center justify-between gap-4">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Start Over
              </Button>
              <Button
                size="lg"
                onClick={handleRunGoNoGo}
                disabled={!rfpTitle.trim()}
                className="gap-2"
              >
                Run Go/No-Go Analysis
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3a — Scoring spinner                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "scoring" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                Running Go/No-Go Analysis
              </CardTitle>
              <CardDescription>
                The AI advisor is evaluating strategic fit, competitive position, and risk factors…
              </CardDescription>
            </CardHeader>
            <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Analyzing <strong>{rfpTitle}</strong> for <strong>{rfpAgency || "the client agency"}</strong>…
              </p>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3b — Decision                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "decision" && goNoGoResult && (
          <div className="space-y-6">
            {/* Score card */}
            <Card className={`border-2 ${
              goNoGoResult.recommendation === "GO"
                ? "border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20"
                : goNoGoResult.recommendation === "CONDITIONAL GO"
                ? "border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20"
                : "border-red-500/40 bg-red-50/30 dark:bg-red-950/20"
            }`}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Score circle */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={`text-5xl font-black tabular-nums ${scoreColor(goNoGoResult.score)}`}>
                      {goNoGoResult.score}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">/ 100</div>
                    <div className="w-20 mt-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(goNoGoResult.score)}`}
                          style={{ width: `${goNoGoResult.score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-16" />

                  {/* Recommendation */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {goNoGoResult.recommendation === "GO" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                      ) : goNoGoResult.recommendation === "CONDITIONAL GO" ? (
                        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                      )}
                      <span className={`text-xl font-bold ${
                        goNoGoResult.recommendation === "GO"
                          ? "text-emerald-600"
                          : goNoGoResult.recommendation === "CONDITIONAL GO"
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}>
                        {goNoGoResult.recommendation}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {goNoGoResult.rationale}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strengths + Risks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {goNoGoResult.strengths.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None identified.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {goNoGoResult.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-500">
                    <TrendingDown className="w-4 h-4" />
                    Risks
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {goNoGoResult.risks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None identified.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {goNoGoResult.risks.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Win Themes (if any) */}
            {goNoGoResult.winThemes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-primary" />
                    Suggested Win Themes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5">
                    {goNoGoResult.winThemes.map((wt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Minus className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{wt}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* GO / NO-GO buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Button
                size="lg"
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleGo}
                disabled={createPursuit.isPending}
              >
                {createPursuit.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                GO — Create Pursuit
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleNoGo}
              >
                <XCircle className="w-4 h-4" />
                NO-GO — Archive RFP
              </Button>
            </div>
            <div className="flex justify-start">
              <Button variant="ghost" size="sm" onClick={() => setStep("review")} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Review
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ARCHIVED state                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "archived" && (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <XCircle className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">RFP Archived</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{rfpTitle}</strong> was marked as NO-GO. No pursuit was created.
                </p>
              </div>
              <Button variant="outline" onClick={handleReset} className="gap-2 mt-2">
                <RotateCcw className="w-4 h-4" />
                Launch Another RFP
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </AppLayout>
  );
}
