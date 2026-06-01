/**
 * ProposalLaunchpad.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 2-step wizard for rapid RFP intake and Go/No-Go decision.
 *
 * Step 1 — Upload RFP Package (multi-file):
 *   • Drag-and-drop / click-to-browse: PDF, DOCX, XLSX, ZIP (up to 50 MB each)
 *   • ZIP files are extracted client-side (fflate); each inner file is queued
 *   • Per-file label selector: Main RFP, Scope of Work, Appendix, Addendum,
 *     Fee Schedule, Reference Doc, Other
 *   • All files uploaded via existing /api/upload (rfp folder)
 *   • rfpSession created, primary file saved via rfpSessions.saveRfpFile,
 *     full manifest stored in extractedData.rfpFiles[]
 *   • PDF + DOCX → rfp_parser skill (LLM content extraction)
 *   • XLSX → client-side SheetJS table parse (structured data summary)
 *   • Summary card shows all processed files with type badge and label
 *
 * Step 2 — Go/No-Go (unchanged):
 *   • proposals.scoreGoNoGo → score / recommendation / strengths / risks
 *   • GO → pursuits.create → redirect to /pursuits/:id
 *   • NO-GO → archived state
 *
 * Rules: no new backend code, only existing tRPC procedures and /api/upload.
 */

import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import * as fflate from "fflate";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileArchive,
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
  X,
  Package,
  PenLine,
} from "lucide-react";
import type { ParsedRfpData } from "../../../shared/workflowTypes";
import { LABEL_TIER_MAP, TIER_BADGE, CONFIDENCE_BADGE, type RfpFileLabel, type ClassificationConfidence, type QuickSignals, type FirmProfile } from "../../../shared/types";
import { computeQuickSignal, SIGNAL_STRENGTH_CONFIG, SIGNAL_RATING_CONFIG } from "@/lib/quickSignal";
import { useEntityContext } from "@/contexts/EntityContext";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const FILE_LABELS = [
  "Main RFP",
  "Scope of Work",
  "Addendum",
  "Appendix",
  "Cover Letter",
  "Forms",
  "Certificate",
  "Fee Schedule",
  "Reference Doc",
  "Supplemental",
  "Other",
] as const;

type FileLabel = (typeof FILE_LABELS)[number];

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream", // some ZIPs arrive as this
]);

const ACCEPTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".zip"]);

// ─── Types ────────────────────────────────────────────────────────────────────

type FileType = "pdf" | "docx" | "xlsx" | "zip" | "other";

interface QueuedFile {
  id: string;
  file: File;
  type: FileType;
  label: FileLabel;
  /** Set after upload completes */
  uploadedUrl?: string;
  uploadedKey?: string;
  /** Set after extraction completes */
  extractedSummary?: string;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  error?: string;
  // ── Two-pass pre-classification ─────────────────────────────────────────
  /** Pass 1 or Pass 2 confidence level */
  confidence: ClassificationConfidence;
  /** Short human-readable reason for classification (max 15 words) */
  keyEvidence: string;
  /** PDF page count (read client-side from PDF header) */
  pageCount?: number;
  /** Whether Pass 2 Gemini skim is currently running for this file */
  pass2Running?: boolean;
}

interface GoNoGoResult {
  score: number;
  recommendation: "GO" | "NO-GO" | "CONDITIONAL GO";
  rationale: string;
  strengths: string[];
  risks: string[];
  winThemes: string[];
}

type WizardStep = "upload" | "processing" | "review" | "scoring" | "decision" | "archived";
type EntryMode = "choose" | "upload" | "manual";

const MANUAL_SERVICE_LINES = [
  "Special Inspections",
  "Construction Management",
  "Traffic Engineering",
  "Landscape / Streetscape",
  "Environmental",
  "Structural Engineering",
  "Civil Engineering",
  "Geotechnical",
  "MEP Engineering",
  "Other",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectFileType(file: File): FileType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "docx";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".zip") || file.type.includes("zip")) return "zip";
  return "other";
}

function isAccepted(file: File): boolean {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.has(ext);
}

/** Generic filenames that carry no classification signal — send to Pass 2 */
const GENERIC_NAME_PATTERN = /^(doc|document|file|attachment|attach|untitled|scan|image|page)\s*\d*$/i;

interface Pass1Result {
  label: FileLabel;
  confidence: ClassificationConfidence;
  keyEvidence: string;
}

/**
 * Pass 1: instant client-side classification.
 * Returns label + confidence + keyEvidence without any API call.
 */
function guessClassification(file: File, pageCount?: number): Pass1Result {
  const name = file.name.toLowerCase();
  const base = name.replace(/\.[^.]+$/, "").trim(); // strip extension

  // XLSX/XLS → fee_schedule (high confidence)
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    if (name.includes("fee") || name.includes("cost") || name.includes("price") || name.includes("budget") || name.includes("schedule")) {
      return { label: "Fee Schedule", confidence: "high", keyEvidence: "XLSX file with fee/cost/budget keyword" };
    }
    return { label: "Fee Schedule", confidence: "medium", keyEvidence: "XLSX spreadsheet — likely fee schedule" };
  }

  // Generic names → unclassified, needs Pass 2
  if (GENERIC_NAME_PATTERN.test(base)) {
    return { label: "Supplemental", confidence: "unclassified", keyEvidence: "Generic filename — needs Gemini review" };
  }

  // Cover letter / transmittal — check BEFORE generic 'form' or 'rfp' rules
  if (name.includes("cover letter") || name.includes("cover sheet") || name.includes("transmittal")) {
    return { label: "Cover Letter", confidence: "high", keyEvidence: "Filename contains cover letter/transmittal" };
  }
  // Main RFP — explicit keywords only
  if (name.includes("rfp") || name.includes("solicitation") || name.includes("invitation for bid") || name.includes("ifb") || name.includes("request for proposal")) {
    // Size heuristic: 20+ pages + rfp keyword → high confidence
    const conf: ClassificationConfidence = (pageCount !== undefined && pageCount >= 20) ? "high" : "medium";
    return { label: "Main RFP", confidence: conf, keyEvidence: `RFP keyword in filename${pageCount !== undefined ? `, ${pageCount}pp` : ""}` };
  }
  // Scope of Work
  if (name.includes("scope") || name.includes("sow") || name.includes("scope of work")) {
    return { label: "Scope of Work", confidence: "high", keyEvidence: "Scope/SOW keyword in filename" };
  }
  // Addendum / Amendment
  if (name.includes("addend") || name.includes("add-") || name.includes("amendment")) {
    return { label: "Addendum", confidence: "high", keyEvidence: "Addendum/amendment keyword in filename" };
  }
  // Appendix / Attachment + number
  if (name.includes("append") || /attach(ment)?[\s_-]?\d/.test(name)) {
    return { label: "Appendix", confidence: "high", keyEvidence: "Appendix/attachment keyword in filename" };
  }
  // Insurance / Certificate
  if (name.includes("insurance") || name.includes("coi") || name.includes("certificate") || name.includes("cert")) {
    return { label: "Certificate", confidence: "high", keyEvidence: "Insurance/certificate keyword in filename" };
  }
  // Forms / Exhibits
  if (name.includes("form") || name.includes("exhibit")) {
    return { label: "Forms", confidence: "high", keyEvidence: "Form/exhibit keyword in filename" };
  }
  // Reference docs
  if (name.includes("ref") || name.includes("standard") || name.includes("guide")) {
    return { label: "Reference Doc", confidence: "medium", keyEvidence: "Reference/standard/guide keyword" };
  }

  // Page count heuristics (PDF only)
  if (pageCount !== undefined) {
    if (pageCount === 1) {
      return { label: "Forms", confidence: "medium", keyEvidence: `1-page PDF — likely form or cover sheet` };
    }
    if (pageCount <= 3) {
      return { label: "Forms", confidence: "medium", keyEvidence: `${pageCount}-page PDF — likely form or certificate` };
    }
    if (pageCount >= 4 && pageCount <= 20) {
      return { label: "Supplemental", confidence: "unclassified", keyEvidence: `${pageCount}-page PDF — needs Gemini review` };
    }
    if (pageCount > 20) {
      return { label: "Main RFP", confidence: "medium", keyEvidence: `${pageCount}-page document — likely main RFP` };
    }
  }

  // Default: Supplemental — force user to manually designate Main RFP
  return { label: "Supplemental", confidence: "medium", keyEvidence: "No strong keyword match" };
}

/**
 * Read the page count of a PDF file client-side by scanning the binary for /Type /Page entries.
 * Fast and cheap — no library needed.
 */
async function readPdfPageCount(file: File): Promise<number | undefined> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return undefined;
  try {
    // Read first 64 KB — enough to find /Count in most PDFs
    const slice = file.slice(0, 65536);
    const text = await slice.text();
    // Look for /Count N in the PDF catalog
    const match = text.match(/\/Count\s+(\d+)/);
    if (match) return parseInt(match[1], 10);
    // Fallback: count /Type /Page occurrences
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) return pageMatches.length;
    return undefined;
  } catch {
    return undefined;
  }
}

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

/** Extract ZIP contents client-side using fflate, return inner files */
async function extractZip(file: File): Promise<File[]> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  return new Promise((resolve, reject) => {
    fflate.unzip(uint8, (err, unzipped) => {
      if (err) { reject(err); return; }
      const files: File[] = [];
      for (const [path, data] of Object.entries(unzipped)) {
        // Skip directories and hidden files
        if (path.endsWith("/") || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
        const name = path.split("/").pop() ?? path;
        const ext = "." + name.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_EXTENSIONS.has(ext)) continue;
        const blob = new Blob([data]);
        files.push(new File([blob], name));
      }
      resolve(files);
    });
  });
}

/** Parse XLSX client-side using SheetJS (loaded dynamically to avoid bundle bloat) */
async function parseXlsx(file: File): Promise<string> {
  try {
    // Dynamic import so SheetJS is only loaded when needed
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const lines: string[] = [`[Excel: ${file.name}]`];
    for (const sheetName of wb.SheetNames.slice(0, 5)) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      const rows = csv.split("\n").filter(Boolean).slice(0, 30);
      lines.push(`\nSheet: ${sheetName}`);
      lines.push(...rows);
    }
    return lines.join("\n");
  } catch {
    return `[Excel file: ${file.name} — could not parse]`;
  }
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

function FileTypeIcon({ type, className }: { type: FileType; className?: string }) {
  if (type === "xlsx") return <FileSpreadsheet className={className} />;
  if (type === "zip") return <FileArchive className={className} />;
  return <FileText className={className} />;
}

function FileTypeBadge({ type }: { type: FileType }) {
  const map: Record<FileType, { label: string; className: string }> = {
    pdf: { label: "PDF", className: "bg-red-100 text-red-700 border-red-200" },
    docx: { label: "DOCX", className: "bg-blue-100 text-blue-700 border-blue-200" },
    xlsx: { label: "XLSX", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    zip: { label: "ZIP", className: "bg-amber-100 text-amber-700 border-amber-200" },
    other: { label: "FILE", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = map[type];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${className}`}>
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProposalLaunchpad() {
  const [, navigate] = useLocation();
  const { activeEntityId } = useEntityContext();

  // ── Entry mode ────────────────────────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<EntryMode>("choose");

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File queue ────────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");

  // ── Session state ─────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  // ── Quick Signal pre-score ────────────────────────────────────────────────
  const [quickSignals, setQuickSignals] = useState<QuickSignals | null>(null);

  // ── Pre-process warning state ─────────────────────────────────────────────
  const [showProcessWarning, setShowProcessWarning] = useState(false);

  // ── tRPC mutations ────────────────────────────────────────────────────────
  const createSession = trpc.rfpSessions.create.useMutation();
  const saveRfpFile = trpc.rfpSessions.saveRfpFile.useMutation();
  const saveUploadedFiles = trpc.rfpSessions.saveUploadedFiles.useMutation();
  const executeSkill = trpc.rfpSessions.executeSkill.useMutation();
  const classifyFileMutation = trpc.rfpSessions.classifyFile.useMutation();
  const scoreGoNoGo = trpc.proposals.scoreGoNoGo.useMutation();
  const createPursuit = trpc.pursuits.create.useMutation();
  const createProposal = trpc.proposals.create.useMutation();
  const linkSession = trpc.rfpSessions.linkToProposal.useMutation();
  const createOpportunity = trpc.opportunities.create.useMutation();
  const utils = trpc.useUtils();

  // ── Firm profile for Quick Signal scoring ───────────────────────────────
  const { data: firmProfileData } = trpc.firmSettings.get.useQuery({ entityId: activeEntityId ?? undefined });
  const firmProfile: FirmProfile = {
    serviceLines: (firmProfileData?.serviceLines as string[]) ?? [],
    states: (firmProfileData?.states as string[]) ?? [],
    typicalValueMin: firmProfileData?.typicalValueMin != null ? parseFloat(String(firmProfileData.typicalValueMin)) : null,
    typicalValueMax: firmProfileData?.typicalValueMax != null ? parseFloat(String(firmProfileData.typicalValueMax)) : null,
    minDaysToRespond: firmProfileData?.minDaysToRespond ?? 14,
    preferredAgencies: (firmProfileData?.preferredAgencies as string[]) ?? [],
    avoidedAgencies: (firmProfileData?.avoidedAgencies as string[]) ?? [],
  };

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
    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addFilesToQueue(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Add files to queue (with ZIP expansion) ───────────────────────────────
  const addFilesToQueue = async (rawFiles: File[]) => {
    const newEntries: QueuedFile[] = [];

    for (const file of rawFiles) {
      if (!isAccepted(file)) {
        toast.error(`"${file.name}" is not a supported file type.`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 50 MB limit.`);
        continue;
      }

      const type = detectFileType(file);

      if (type === "zip") {
        try {
          const inner = await extractZip(file);
          if (inner.length === 0) {
            toast.warning(`"${file.name}" contained no supported files.`);
            continue;
          }
          for (const innerFile of inner) {
            const innerType = detectFileType(innerFile);
            const innerPageCount = await readPdfPageCount(innerFile);
            const cls = guessClassification(innerFile, innerPageCount);
            newEntries.push({
              id: crypto.randomUUID(),
              file: innerFile,
              type: innerType,
              label: cls.label,
              confidence: cls.confidence,
              keyEvidence: cls.keyEvidence,
              pageCount: innerPageCount,
              status: "pending",
            });
          }
          toast.success(`Extracted ${inner.length} file(s) from "${file.name}"`);
        } catch {
          toast.error(`Could not extract "${file.name}". Is it a valid ZIP?`);
        }
      } else {
        const pageCount = await readPdfPageCount(file);
        const cls = guessClassification(file, pageCount);
        newEntries.push({
          id: crypto.randomUUID(),
          file,
          type,
          label: cls.label,
          confidence: cls.confidence,
          keyEvidence: cls.keyEvidence,
          pageCount,
          status: "pending",
        });
      }
    }

    if (newEntries.length > 0) {
      setQueue((prev) => [...prev, ...newEntries]);
      // Pass 2: Gemini skim for unclassified or medium-confidence files
      const needsPass2 = newEntries.filter(
        (e) => e.confidence === "unclassified" || e.confidence === "medium"
      );
      if (needsPass2.length > 0) {
        runPass2Classification(needsPass2);
      }
    }
  };

  // ── Pass 2: Gemini Flash first-2-page skim ────────────────────────────────────────
  const runPass2Classification = async (entries: QueuedFile[]) => {
    setQueue((prev) =>
      prev.map((f) =>
        entries.some((e) => e.id === f.id) ? { ...f, pass2Running: true } : f
      )
    );
    const BATCH = 5;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (entry) => {
          try {
            const uploaded = await uploadFile(entry.file);
            // Detect if this file is already labeled (or heuristically identified) as Main RFP
            const isMainRfp = entry.label === "Main RFP";
            const result = await classifyFileMutation.mutateAsync({
              fileUrl: uploaded.fileUrl,
              fileName: entry.file.name,
              mimeType: entry.file.type || "application/octet-stream",
              isMainRfp,
            });
            const labelMap: Record<string, FileLabel> = {
              main_rfp: "Main RFP",
              scope: "Scope of Work",
              appendix: "Appendix",
              form: "Forms",
              addendum: "Addendum",
              fee_schedule: "Fee Schedule",
              certificate: "Certificate",
              cover_letter: "Cover Letter",
              reference: "Reference Doc",
              supplemental: "Supplemental",
            };
            const mappedLabel = labelMap[result.documentType] ?? "Supplemental";
            // Capture quickSignals when the file is confirmed as main_rfp
            if (result.documentType === "main_rfp" && result.quickSignals) {
              setQuickSignals(result.quickSignals as QuickSignals);
            }
            setQueue((prev) =>
              prev.map((f) =>
                f.id === entry.id
                  ? {
                      ...f,
                      label: mappedLabel,
                      confidence: result.confidence as ClassificationConfidence,
                      keyEvidence: result.keyEvidence,
                      pass2Running: false,
                    }
                  : f
              )
            );
          } catch {
            setQueue((prev) =>
              prev.map((f) =>
                f.id === entry.id ? { ...f, pass2Running: false } : f
              )
            );
          }
        })
      );
      if (i + BATCH < entries.length) await new Promise((r) => setTimeout(r, 500));
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const updateLabel = (id: string, label: FileLabel) => {
    setQueue((prev) => prev.map((f) => f.id === id ? { ...f, label } : f));
  };

  // ── Core processing flow ──────────────────────────────────────────────────
  const handleProcess = async () => {
    if (queue.length === 0) {
      toast.error("Please add at least one file.");
      return;
    }
    // Require at least one file labeled Main RFP
    const hasMainRfp = queue.some((f) => f.label === "Main RFP");
    if (!hasMainRfp) {
      toast.error("No Main RFP document designated — please label at least one file as Main RFP before processing.");
      return;
    }

    // Warn if any files are still unclassified or low confidence
    const needsReview = queue.filter(
      (f) => f.confidence === "unclassified" || f.confidence === "low"
    );
    if (needsReview.length > 0) {
      setShowProcessWarning(true);
      return;
    }

    await doProcess();
  };

  // ── Actual processing start (called by handleProcess or warning dialog) ────
  const doProcess = async () => {
    setStep("processing");
    setProcessingProgress(5);

    try {
      // 1. Create rfpSession
      setProcessingStatus("Creating session…");
      const { sessionId: sid } = await createSession.mutateAsync({});
      setSessionId(sid);
      setProcessingProgress(10);

      // 2. Upload all files sequentially, update queue status
      const totalFiles = queue.length;
      const uploadedFiles: Array<QueuedFile & { uploadedUrl: string; uploadedKey: string }> = [];

      for (let i = 0; i < totalFiles; i++) {
        const entry = queue[i];
        setProcessingStatus(`Uploading "${entry.file.name}" (${i + 1}/${totalFiles})…`);
        setQueue((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "uploading" } : f));

        const uploaded = await uploadFile(entry.file);
        uploadedFiles.push({ ...entry, uploadedUrl: uploaded.fileUrl, uploadedKey: uploaded.fileKey });
        setQueue((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "extracting", uploadedUrl: uploaded.fileUrl, uploadedKey: uploaded.fileKey } : f));

        const uploadPct = 10 + Math.round(((i + 1) / totalFiles) * 30);
        setProcessingProgress(uploadPct);
      }

      // 3. Save primary file (first PDF/DOCX, or first file) to rfpSessions
      const primary = uploadedFiles.find((f) => f.type === "pdf" || f.type === "docx") ?? uploadedFiles[0];
      await saveRfpFile.mutateAsync({
        sessionId: sid,
        rfpFileName: primary.file.name,
        rfpFileKey: primary.uploadedKey,
        rfpFileUrl: primary.uploadedUrl,
        rfpMimeType: primary.file.type || "application/octet-stream",
        rfpFileSizeBytes: primary.file.size,
      });

      // 3b. Save ALL uploaded file URLs so the LLM can read them.
      // Include the user-chosen label so the backend can apply the correct extraction tier.
      await saveUploadedFiles.mutateAsync({
        sessionId: sid,
        files: uploadedFiles.map((f) => ({
          name: f.file.name,
          url: f.uploadedUrl,
          mimeType: f.file.type || "application/octet-stream",
          label: f.label,
        })),
      });
      setProcessingProgress(45);

      // 4. Extract content from each file
      let combinedContext = "";
      let xlsxSummaries: string[] = [];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const entry = uploadedFiles[i];
        setProcessingStatus(`Extracting "${entry.file.name}" (${i + 1}/${uploadedFiles.length})…`);

        if (entry.type === "xlsx") {
          // Client-side SheetJS parse
          const summary = await parseXlsx(entry.file);
          xlsxSummaries.push(`[${entry.label}] ${summary}`);
          setQueue((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done", extractedSummary: summary.slice(0, 200) } : f));
        } else if (entry.type === "pdf" || entry.type === "docx") {
          // LLM extraction via rfp_parser skill on the primary file
          // (the skill uses the rfpFileUrl already saved on the session)
          combinedContext += `\n[${entry.label}: ${entry.file.name}] at ${entry.uploadedUrl}`;
          setQueue((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done" } : f));
        } else {
          setQueue((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "done" } : f));
        }

        const extractPct = 45 + Math.round(((i + 1) / uploadedFiles.length) * 30);
        setProcessingProgress(extractPct);
      }

      // 5. Run rfp_parser skill on the session (fire-and-forget — backend returns immediately)
      // We poll getById every 2s until workflowState.rfp_parser.status === 'complete' or 'error'
      setProcessingStatus("Starting AI extraction…");

      // Kick off the skill (returns immediately with running:true)
      try {
        await executeSkill.mutateAsync({ sessionId: sid, skillName: "rfp_parser" });
      } catch (skillErr) {
        throw skillErr;
      }

      // Poll until complete (max 15 minutes)
      const POLL_INTERVAL_MS = 2500;
      const MAX_POLL_MS = 15 * 60 * 1000;
      const pollStart = Date.now();
      let finalSessionData: Awaited<ReturnType<typeof utils.rfpSessions.getById.fetch>> | null = null;

      while (Date.now() - pollStart < MAX_POLL_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const sessionData = await utils.rfpSessions.getById.fetch({ id: sid });
          const rfpParserState = (sessionData?.workflowState as Record<string, { status?: string; subStepMessage?: string }> | null)?.rfp_parser;
          // Show sub-step message while running
          if (rfpParserState?.subStepMessage) {
            setProcessingStatus(rfpParserState.subStepMessage);
          }
          if (rfpParserState?.status === "complete") {
            finalSessionData = sessionData;
            break;
          }
          if (rfpParserState?.status === "error") {
            const errMsg = (rfpParserState as Record<string, unknown>).errorMessage as string | undefined;
            throw new Error(errMsg ?? "RFP extraction failed");
          }
        } catch (pollErr) {
          if (pollErr instanceof Error && pollErr.message.startsWith("RFP extraction")) throw pollErr;
          // network hiccup — keep polling
        }
      }

      if (!finalSessionData) {
        throw new Error("RFP extraction timed out — please try again.");
      }

      setProcessingProgress(90);

      // 6. Parse structured output from skillOutputs (not the mutation response)
      const rawOutput = (finalSessionData.skillOutputs as Record<string, string> | null)?.rfp_parser ?? "";
      let parsed: Partial<ParsedRfpData> = {};
      try {
        parsed = JSON.parse(rawOutput) as ParsedRfpData;
      } catch {
        parsed = { scopeSummary: rawOutput };
      }

      // Merge XLSX summaries into scope summary
      const xlsxNote = xlsxSummaries.length > 0
        ? `\n\n[Structured data from ${xlsxSummaries.length} spreadsheet(s) also included in package.]`
        : "";

      setRfpTitle(parsed.projectTitle ?? primary.file.name.replace(/\.[^.]+$/, ""));
      setRfpAgency(parsed.agency ?? "");
      setRfpNumber(parsed.rfpNumber ?? "");
      setRfpDueDate(parsed.submissionDeadline ?? "");
      setRfpEstValue(parsed.estimatedValue ?? "");
      setRfpServiceLines(parsed.serviceLines ?? []);
      setRfpSummary((parsed.scopeSummary ?? "") + xlsxNote);

      setProcessingProgress(100);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      toast.error(msg);
      setStep("upload");
      setProcessingProgress(0);
      // Reset queue statuses
      setQueue((prev) => prev.map((f) => ({ ...f, status: "pending", uploadedUrl: undefined, uploadedKey: undefined })));
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

      const pursuitResult = await createPursuit.mutateAsync({
        title: rfpTitle,
        clientName: rfpAgency,
        rfpNumber: rfpNumber || undefined,
        dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
        estimatedValue: isNaN(estValue ?? NaN) ? undefined : estValue,
        serviceLines: rfpServiceLines.length > 0 ? rfpServiceLines : undefined,
        rfpSessionId: sessionId || undefined,
      });

      await utils.pursuits.list.invalidate();
      const pursuitList = await utils.pursuits.list.fetch();
      const newest = pursuitList?.[0];
      const pursuitId = pursuitResult.pursuitId ?? newest?.id;

      // Create a linked proposal inheriting pursuit metadata
      const proposalResult = await createProposal.mutateAsync({
        pursuitId,
        title: rfpTitle,
        clientName: rfpAgency || undefined,
        rfpNumber: rfpNumber || undefined,
        serviceLines: rfpServiceLines.length > 0 ? rfpServiceLines : undefined,
        dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
        estimatedValue: isNaN(estValue ?? NaN) ? undefined : estValue,
      });

      // Link the Launchpad rfpSession to the new proposal so the Workspace finds it
      if (sessionId && proposalResult.proposalId) {
        await linkSession.mutateAsync({
          sessionId,
          proposalId: proposalResult.proposalId,
          pursuitId,
        });
      }

      toast.success("Pursuit created! Opening Proposal Workspace…");
      if (proposalResult.proposalId) {
        navigate(`/proposals/${proposalResult.proposalId}`);
      } else if (newest?.id) {
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

  // ── Quick Signal — Archive This RFP (creates archived opportunity, skips extraction) ──
  const handleQuickSignalArchive = async () => {
    try {
      const titleGuess = rfpTitle || queue[0]?.file.name || "Archived RFP";
      await createOpportunity.mutateAsync({
        title: titleGuess,
        agencyName: quickSignals?.agency ?? rfpAgency ?? undefined,
        description: quickSignals
          ? `Quick Signal archive. Agency: ${quickSignals.agency ?? "unknown"}, Type: ${quickSignals.projectType ?? "unknown"}, Value: ${quickSignals.estimatedValue ?? "unknown"}, Due: ${quickSignals.dueDate ?? "unknown"}.`
          : "Archived from Proposal Launchpad via Quick Signal.",
        estimatedValue: quickSignals?.estimatedValue
          ? parseFloat(quickSignals.estimatedValue.replace(/[^0-9.]/g, "")) || undefined
          : undefined,
        dueDate: quickSignals?.dueDate ? new Date(quickSignals.dueDate) : undefined,
        source: "rfp_upload",
        aiScore: 0,
        aiScoreReason: "Archived via Quick Signal pre-score before full analysis.",
      });
      setStep("archived");
      toast.info("RFP archived as an opportunity record.");
    } catch {
      toast.error("Failed to archive. Proceeding to archived state anyway.");
      setStep("archived");
    }
  };

  // ── Manual entry: populate fields and go straight to review ─────────────
  const handleManualSubmit = () => {
    if (!rfpTitle.trim()) { toast.error("Title is required."); return; }
    if (!rfpAgency.trim()) { toast.error("Agency / Client is required."); return; }
    setStep("review");
  };

  // ── Reset wizard ──────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("upload");
    setEntryMode("choose");
    setQueue([]);
    setSessionId(null);
    setProcessingProgress(0);
    setProcessingStatus("");
    setRfpTitle("");
    setRfpAgency("");
    setRfpNumber("");
    setRfpDueDate("");
    setRfpEstValue("");
    setRfpServiceLines([]);
    setRfpSummary("");
    setGoNoGoResult(null);
    setQuickSignals(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Step indicator ────────────────────────────────────────────────────────
  const stepIndex = ["upload", "processing", "review", "scoring", "decision", "archived"].indexOf(step);
  const progressSteps = entryMode === "manual"
    ? [
        { label: "Enter Details", active: true },
        { label: "Go/No-Go", active: stepIndex >= 4 },
      ]
    : [
        { label: "Upload Package", active: stepIndex >= 0 },
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
            Upload an RFP package (PDF, Word, Excel, or ZIP), extract key information automatically, and get an instant Go/No-Go recommendation.
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
        {/* ENTRY MODE CHOOSER                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "upload" && entryMode === "choose" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How would you like to start?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upload option */}
              <button
                type="button"
                onClick={() => setEntryMode("upload")}
                className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-accent/30 transition-all duration-200 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Upload RFP Package</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drag &amp; drop PDF, Word, Excel, or ZIP files. AI extracts key details automatically.
                  </p>
                </div>
                <span className="text-xs font-medium text-primary flex items-center gap-1">
                  Start upload <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Manual entry option */}
              <button
                type="button"
                onClick={() => setEntryMode("manual")}
                className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-border hover:border-primary/60 hover:bg-accent/30 transition-all duration-200 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <PenLine className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Enter Manually</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Type in opportunity details directly — no file needed. Proceed straight to Go/No-Go scoring.
                  </p>
                </div>
                <span className="text-xs font-medium text-violet-600 flex items-center gap-1">
                  Enter details <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MANUAL ENTRY FORM                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "upload" && entryMode === "manual" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-violet-600" />
                  Enter Opportunity Details
                </CardTitle>
                <CardDescription>
                  Fill in the key details and we'll run an instant Go/No-Go analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Project / RFP Title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={rfpTitle}
                    onChange={(e) => setRfpTitle(e.target.value)}
                    placeholder="e.g. Bridge Inspection Services — Route 9 Corridor"
                    className="font-medium"
                  />
                </div>

                {/* Agency + RFP Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Agency / Client <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={rfpAgency}
                      onChange={(e) => setRfpAgency(e.target.value)}
                      placeholder="e.g. NJDOT, NYC SCA"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> RFP / Solicitation Number
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
                      type="date"
                      value={rfpDueDate}
                      onChange={(e) => setRfpDueDate(e.target.value)}
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
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[2.5rem]">
                    {MANUAL_SERVICE_LINES.map((sl) => (
                      <button
                        key={sl}
                        type="button"
                        onClick={() =>
                          setRfpServiceLines((prev) =>
                            prev.includes(sl) ? prev.filter((x) => x !== sl) : [...prev, sl]
                          )
                        }
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          rfpServiceLines.includes(sl)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {sl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scope Summary */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" /> Scope Summary / Notes
                  </label>
                  <Textarea
                    value={rfpSummary}
                    onChange={(e) => setRfpSummary(e.target.value)}
                    placeholder="Brief description of the project scope, requirements, or notes on fit…"
                    rows={4}
                    className="resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-4">
              <Button variant="ghost" size="sm" onClick={() => setEntryMode("choose")} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
              <Button
                size="lg"
                onClick={handleManualSubmit}
                disabled={!rfpTitle.trim() || !rfpAgency.trim()}
                className="gap-2"
              >
                Continue to Go/No-Go
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — Upload Drop Zone + File Queue                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "upload" && entryMode === "upload" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Upload RFP Package
                </CardTitle>
                <CardDescription>
                  Drop one or more files here — PDF, Word (.docx), Excel (.xlsx), or ZIP. ZIP files are automatically extracted. Each file can be labeled individually.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
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
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.zip"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
                      <Package className={`w-6 h-6 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {isDragging ? "Drop files here" : "Drag & drop your RFP package"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF · DOCX · XLSX · ZIP — multiple files OK, up to 50 MB each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">PDF</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">DOCX</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">XLSX</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">ZIP</span>
                    </div>
                  </div>
                </div>

                {/* File queue */}
{queue.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {queue.length} file{queue.length !== 1 ? "s" : ""} queued
                      </p>
                      {queue.some((f) => f.pass2Running) && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-600 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Gemini reviewing {queue.filter((f) => f.pass2Running).length} file{queue.filter((f) => f.pass2Running).length !== 1 ? "s" : ""}…
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {queue.map((entry) => {
                        const conf = entry.confidence ?? "medium";
                        const badge = CONFIDENCE_BADGE[conf];
                        const tier = LABEL_TIER_MAP[entry.label as RfpFileLabel] ?? "metadata_only";
                        const { label: tierLabel, className: tierClass } = TIER_BADGE[tier];
                        return (
                          <div
                            key={entry.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border bg-background transition-colors ${
                              conf === "low" || conf === "unclassified"
                                ? "border-amber-300 bg-amber-50/40"
                                : "border-border"
                            }`}
                          >
                            <FileTypeIcon type={entry.type} className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate max-w-[200px]">{entry.file.name}</span>
                                <FileTypeBadge type={entry.type} />
                                <span className="text-xs text-muted-foreground">
                                  {(entry.file.size / 1024).toFixed(0)} KB
                                  {entry.pageCount !== undefined && ` · ${entry.pageCount}pp`}
                                </span>
                              </div>
                              {/* Key evidence subtitle */}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {entry.pass2Running ? (
                                  <span className="flex items-center gap-1 text-[11px] text-blue-500">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Analyzing with Gemini…
                                  </span>
                                ) : (
                                  <>
                                    <span className="text-[11px]" title={badge.label}>{badge.icon}</span>
                                    <span className="text-[11px] text-muted-foreground">{entry.keyEvidence}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* Label selector */}
                            <Select
                              value={entry.label}
                              onValueChange={(v) => updateLabel(entry.id, v as FileLabel)}
                            >
                              <SelectTrigger className="w-36 h-7 text-xs shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FILE_LABELS.map((l) => (
                                  <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Confidence badge */}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap ${badge.className}`}>
                              {badge.label}
                            </span>
                            {/* Extraction tier badge */}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierClass} shrink-0 whitespace-nowrap`}>
                              {tierLabel}
                            </span>
                            {/* Remove */}
                            <button
                              onClick={() => removeFromQueue(entry.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Signal Card — shown after Pass 2 returns quickSignals */}
            {quickSignals && (() => {
              const score = computeQuickSignal(quickSignals, firmProfile);
              const cfg = SIGNAL_STRENGTH_CONFIG[score.strength];
              return (
                <div className={`rounded-xl border-2 p-5 space-y-4 ${cfg.borderClass} bg-background`}>
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <p className="font-bold text-sm">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}>
                      {score.favorableCount}/6 favorable
                    </span>
                  </div>

                  {/* Extracted signal values */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                    {quickSignals.agency && <span><span className="font-medium text-foreground">Agency:</span> {quickSignals.agency}</span>}
                    {quickSignals.projectType && <span><span className="font-medium text-foreground">Type:</span> {quickSignals.projectType}</span>}
                    {quickSignals.estimatedValue && <span><span className="font-medium text-foreground">Value:</span> {quickSignals.estimatedValue}</span>}
                    {quickSignals.dueDate && <span><span className="font-medium text-foreground">Due:</span> {quickSignals.dueDate}</span>}
                    {quickSignals.location && <span><span className="font-medium text-foreground">Location:</span> {quickSignals.location}</span>}
                    {quickSignals.prequalRequired && <span><span className="font-medium text-foreground">Prequal:</span> {quickSignals.prequalType ?? "Required"}</span>}
                  </div>

                  {/* Factor checklist */}
                  <div className="space-y-1.5 border-t pt-3">
                    {score.factors.map((f) => {
                      const rc = SIGNAL_RATING_CONFIG[f.rating];
                      return (
                        <div key={f.label} className="flex items-start gap-2 text-sm">
                          <span className={`shrink-0 mt-0.5 ${rc.className}`}>{rc.icon}</span>
                          <span>
                            <span className="font-medium">{f.label}:</span>{" "}
                            <span className="text-muted-foreground">{f.detail}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Red flag chips */}
                  {quickSignals.immediateRedFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t pt-3">
                      {quickSignals.immediateRedFlags.map((flag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200">
                          ⚠ {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      onClick={handleProcess}
                      disabled={queue.length === 0}
                      className="flex-1 gap-1.5"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Process &amp; Full Analysis
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleQuickSignalArchive}
                      disabled={createOpportunity.isPending}
                      className="flex-1 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                    >
                      {createOpportunity.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Archive This RFP
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* CTA */}
            <div className="flex items-center justify-between gap-4">
              <Button variant="ghost" size="sm" onClick={() => setEntryMode("choose")} className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
              {!quickSignals && (
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={queue.length === 0}
                  className="gap-2"
                >
                  Process Package
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PROCESSING — Upload + Extraction progress                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "processing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                Processing RFP Package
              </CardTitle>
              <CardDescription>
                Uploading files and running AI extraction — this takes about 20–60 seconds depending on package size.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex-1 mr-2 text-foreground font-medium truncate">{processingStatus || "Starting…"}</span>
                  <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>

              {/* Per-file status */}
              <div className="space-y-2">
                {queue.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                    <FileTypeIcon type={entry.type} className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.file.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.label}</p>
                    </div>
                    <div className="shrink-0">
                      {entry.status === "pending" && (
                        <span className="text-xs text-muted-foreground">Waiting…</span>
                      )}
                      {entry.status === "uploading" && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                      {entry.status === "extracting" && (
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      )}
                      {entry.status === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {entry.status === "error" && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* REVIEW — Extracted Info + File Manifest                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === "review" && (
          <div className="space-y-6">
            {/* File manifest — only shown for upload mode */}
            {entryMode !== "manual" && <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Package Processed — {queue.length} file{queue.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {queue.map((entry) => {
                    const tier = LABEL_TIER_MAP[entry.label as RfpFileLabel] ?? "metadata_only";
                    const { label: tierLabel, className: tierClass } = TIER_BADGE[tier];
                    return (
                      <div key={entry.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/50 last:border-0">
                        <FileTypeIcon type={entry.type} className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{entry.file.name}</span>
                        <FileTypeBadge type={entry.type} />
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{entry.label}</Badge>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierClass} shrink-0 whitespace-nowrap`}>
                          {tierLabel}
                        </span>
                        {entry.status === "done"
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        }
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>}

            {/* Extracted RFP data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Extracted RFP Information
                </CardTitle>
                <CardDescription>
                  Review and edit the extracted details before running the Go/No-Go analysis.
                </CardDescription>
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
        {/* SCORING spinner                                                    */}
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
        {/* DECISION                                                           */}
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

            {/* Win Themes */}
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
        {/* ARCHIVED                                                           */}
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

      {/* Pre-process warning: low-confidence or unclassified files */}
      <AlertDialog open={showProcessWarning} onOpenChange={setShowProcessWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Files Need Your Review
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {queue.filter((f) => f.confidence === "unclassified" || f.confidence === "low").length} file
                  {queue.filter((f) => f.confidence === "unclassified" || f.confidence === "low").length !== 1 ? "s" : ""} could not be classified with high confidence.
                  Unreviewed files will be stored but not extracted.
                </p>
                <ul className="space-y-1">
                  {queue
                    .filter((f) => f.confidence === "unclassified" || f.confidence === "low")
                    .map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium truncate max-w-[260px]">{f.file.name}</span>
                        <span className="text-muted-foreground text-xs">— {f.keyEvidence}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowProcessWarning(false)}>
              Review Now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowProcessWarning(false);
                doProcess();
              }}
            >
              Process Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
