/**
 * client/src/pages/KnowledgeHub.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Knowledge Hub — DAM upload and document library.
 *
 * Three panels:
 *  1. Stats bar   — counts by doc type and processing status
 *  2. Upload zone — drag-and-drop with metadata form
 *  3. Library     — filterable grid with inline preview and actions
 */

import AppLayout from "@/components/AppLayout";
import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload, FileText, Users, Building2, Award, File, Search,
  MoreVertical, Trash2, Eye, Sparkles, CheckCircle2, Clock,
  AlertCircle, Loader2, CloudUpload, X, Filter,
  BookOpen, FolderOpen, ImageIcon, Layers, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, ListChecks, Square, SquareCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType =
  | "past_proposal" | "project_sheet" | "resume"
  | "certification" | "rfp" | "contract" | "boilerplate" | "other";

type CompanyTag = "JPCL" | "Strans" | "Both";

type ProcessingStatus = "uploaded" | "processing" | "indexed" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<DocType, { label: string; icon: any; color: string; bg: string }> = {
  past_proposal: { label: "Past Proposal",  icon: FileText,  color: "text-violet-600", bg: "bg-violet-50" },
  project_sheet: { label: "Project Sheet",  icon: Building2, color: "text-blue-600",   bg: "bg-blue-50" },
  resume:        { label: "Resume / CV",    icon: Users,     color: "text-emerald-600",bg: "bg-emerald-50" },
  certification: { label: "Certification",  icon: Award,     color: "text-amber-600",  bg: "bg-amber-50" },
  rfp:           { label: "RFP Package",    icon: FolderOpen,color: "text-rose-600",   bg: "bg-rose-50" },
  contract:      { label: "Contract",       icon: FileText,  color: "text-slate-600",  bg: "bg-slate-50" },
  boilerplate:   { label: "Boilerplate",    icon: BookOpen,  color: "text-teal-600",   bg: "bg-teal-50" },
  other:         { label: "Other",          icon: File,      color: "text-gray-500",   bg: "bg-gray-50" },
};

const STATUS_CONFIG: Record<ProcessingStatus, { label: string; icon: any; color: string }> = {
  uploaded:   { label: "Uploaded",   icon: Clock,         color: "text-slate-500" },
  processing: { label: "Processing", icon: Loader2,       color: "text-blue-500" },
  indexed:    { label: "Indexed",    icon: CheckCircle2,  color: "text-emerald-500" },
  error:      { label: "Error",      icon: AlertCircle,   color: "text-rose-500" },
};

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: Date | string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Upload Form State ────────────────────────────────────────────────────────

interface UploadFormState {
  docType: DocType;
  title: string;
  description: string;
  companyTag: CompanyTag | "";
  staffName: string;
  projectName: string;
  projectNumber: string;
  clientName: string;
  ownerName: string;
  firmRole: string;
  resumeVersion: string;
  pursuitContext: string;
  contractValue: string;
  awardYear: string;
  tags: string;
}

const DEFAULT_FORM: UploadFormState = {
  docType: "other",
  title: "",
  description: "",
  companyTag: "",
  staffName: "",
  projectName: "",
  projectNumber: "",
  clientName: "",
  ownerName: "",
  firmRole: "",
  resumeVersion: "",
  pursuitContext: "",
  contractValue: "",
  awardYear: "",
  tags: "",
};

// ─── Multi-project split types ───────────────────────────────────────────────

interface SplitProject {
  projectName: string;
  owner: string;       // comma-separated public agency/asset owners
  client: string;      // direct contracting party
  firmRole: string;    // prime | sub | joint-venture | ""
  location: string;
  contractValue: string;
  startDate: string;
  endDate: string;
  serviceLines: string;
  scope: string;
  description: string;
  // shared with source file
  companyTag: CompanyTag | "";
  tags: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeHub() {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterDocType, setFilterDocType] = useState<DocType | "all">("all");
  const [filterCompany, setFilterCompany] = useState<CompanyTag | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ProcessingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // ── Upload state ────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Staged upload result — file is already in storage, waiting for user to confirm metadata
  const [stagedUpload, setStagedUpload] = useState<{ url: string; key: string; fileName: string; size: number } | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [form, setForm] = useState<UploadFormState>(DEFAULT_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Multi-file queue — files are processed one at a time through the metadata form
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);

  // Multi-project split state
  const [splitProjects, setSplitProjects] = useState<SplitProject[]>([]);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [expandedSplitIdx, setExpandedSplitIdx] = useState<number | null>(0);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  // Shared resume metadata for split mode (entered once, applied to all records)
  const [splitStaffName, setSplitStaffName] = useState("");
  const [splitCompanyTag, setSplitCompanyTag] = useState<CompanyTag | "">("");

  // Duplicate detection state
  const [fileDuplicate, setFileDuplicate] = useState<{ id: string; title: string; fileName: string; createdAt: string } | null>(null);
  const [contentDuplicate, setContentDuplicate] = useState<{ id: string; title: string; docType: string; fileName: string; resumeVersion?: string | null; createdAt: string } | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<"pending" | "replace" | "keep_both" | "dismissed">("dismissed");

  // ── Bulk extract state ────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    total: number;
    current: number;
    currentTitle: string;
    errors: { id: string; title: string; message: string }[];
  }>({ active: false, total: 0, current: 0, currentTitle: "", errors: [] });

  // ── Preview state ───────────────────────────────────────────────────────────
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UploadFormState>(DEFAULT_FORM);

  // ── tRPC ────────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.dam.getStats.useQuery();

  const { data: listData, isLoading: listLoading } = trpc.dam.list.useQuery({
    docType: filterDocType !== "all" ? filterDocType : undefined,
    companyTag: filterCompany !== "all" ? filterCompany : undefined,
    processingStatus: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const { data: previewDoc } = trpc.dam.getById.useQuery(
    { id: previewDocId! },
    { enabled: previewDocId !== null }
  );

  const createMutation = trpc.dam.create.useMutation({
    onSuccess: () => {
      utils.dam.list.invalidate();
      utils.dam.getStats.invalidate();
    },
  });

  const deleteMutation = trpc.dam.delete.useMutation({
    onSuccess: () => {
      utils.dam.list.invalidate();
      utils.dam.getStats.invalidate();
      toast.success("Document deleted");
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const autoExtractMutation = trpc.dam.autoExtract.useMutation();

  const replaceFileMutation = trpc.dam.replaceFile.useMutation({
    onSuccess: () => {
      utils.dam.list.invalidate();
      utils.dam.getStats.invalidate();
      toast.success("File replaced successfully");
    },
    onError: (err: any) => toast.error(`Replace failed: ${err.message}`),
  });

  const updateMetaMutation = trpc.dam.updateMeta.useMutation({
    onSuccess: () => {
      utils.dam.list.invalidate();
      utils.dam.getStats.invalidate();
      if (previewDocId) utils.dam.getById.invalidate({ id: previewDocId });
      setIsEditing(false);
      toast.success("Document updated");
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const extractMutation = trpc.dam.triggerExtract.useMutation({
    onSuccess: (result) => {
      utils.dam.list.invalidate();
      utils.dam.getStats.invalidate();
      if (previewDocId) utils.dam.getById.invalidate({ id: previewDocId });
      const imgMsg = result.imageCount > 0 ? ` (${result.imageCount} images found)` : "";
      toast.success(`Document indexed successfully${imgMsg}`);
    },
    onError: (err) => toast.error(`Extraction failed: ${err.message}`),
  });

  // Bulk extract: sequential, one at a time, 1.5s delay between calls, errors don't stop batch
  async function handleBulkExtract(ids: string[]) {
    // Only extract docs that aren't already indexed
    const targets = (listData?.docs ?? []).filter(
      (d: any) => ids.includes(d.id) && d.processingStatus !== "indexed"
    );
    if (targets.length === 0) {
      toast.info("All selected documents are already indexed");
      setSelectionMode(false);
      setSelectedIds(new Set());
      return;
    }
    setBulkProgress({ active: true, total: targets.length, current: 0, currentTitle: "", errors: [] });
    const errors: { id: string; title: string; message: string }[] = [];

    for (let i = 0; i < targets.length; i++) {
      const doc = targets[i];
      setBulkProgress((prev) => ({ ...prev, current: i + 1, currentTitle: doc.title }));
      try {
        await new Promise<void>((resolve, reject) => {
          extractMutation.mutate({ id: doc.id }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
        utils.dam.list.invalidate();
        utils.dam.getStats.invalidate();
      } catch (err: any) {
        errors.push({ id: doc.id, title: doc.title, message: err.message ?? "Unknown error" });
        setBulkProgress((prev) => ({ ...prev, errors: [...prev.errors, { id: doc.id, title: doc.title, message: err.message ?? "Unknown error" }] }));
      }
      // 1.5s delay between calls to avoid LLM rate limits
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setBulkProgress((prev) => ({ ...prev, active: false }));
    utils.dam.list.invalidate();
    utils.dam.getStats.invalidate();
    setSelectionMode(false);
    setSelectedIds(new Set());

    if (errors.length === 0) {
      toast.success(`Successfully extracted ${targets.length} document${targets.length !== 1 ? "s" : ""}`);
    } else {
      toast.warning(`Extracted ${targets.length - errors.length} of ${targets.length} — ${errors.length} failed (see progress panel)`);
    }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 10) {
      toast.error("Maximum 10 files at a time. Please split into batches.");
      return;
    }
    if (files.length === 0) return;
    const [first, ...rest] = files;
    if (rest.length > 0) {
      setUploadQueue((prev) => [...prev, ...rest]);
      toast.info(`${files.length} files selected — processing one at a time.`);
    }
    prepareUpload(first);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > 10) {
      toast.error("Maximum 10 files at a time. Please split into batches.");
      return;
    }
    const [first, ...rest] = files;
    if (rest.length > 0) {
      setUploadQueue((prev) => [...prev, ...rest]);
      toast.info(`${files.length} files selected — processing one at a time.`);
    }
    prepareUpload(first);
  }, []);

  // New flow: upload to storage immediately, then call autoExtract to pre-fill form
  async function prepareUpload(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50 MB limit");
      return;
    }
    setUploadFile(file);
    setIsAnalyzing(true);
    setShowUploadForm(true);
    setFileDuplicate(null);
    setContentDuplicate(null);
    setDuplicateAction("dismissed");
    // Pre-fill title from filename as fallback while LLM runs
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    setForm({ ...DEFAULT_FORM, title: baseName });

    try {
      // Step 0: File-level duplicate check
      try {
        const fileDup = await utils.dam.checkFileDuplicate.fetch({ fileName: file.name });
        if (fileDup) {
          setFileDuplicate({ id: fileDup.id, title: fileDup.title, fileName: fileDup.fileName, createdAt: fileDup.createdAt as any });
          setDuplicateAction("pending");
        }
      } catch { /* ignore check failures */ }

      // Step 1: Upload file to storage
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "dam");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const { url, key, fileName, size } = await uploadRes.json();
      setStagedUpload({ url, key, fileName, size });

      // Step 2: Ask LLM to read the file and extract metadata
      const meta = await autoExtractMutation.mutateAsync({
        fileUrl: url,
        fileKey: key,
        mimeType: file.type || "application/pdf",
        fileName: file.name,
      });

      // Step 3a: Multi-project split mode
      // Only applies to project_sheet and past_proposal — resumes always save as a single record
      const splitEligible = meta.docType === "project_sheet" || meta.docType === "past_proposal";
      if (meta.multiProject && meta.projects.length >= 2 && splitEligible) {
        setIsSplitMode(true);
        // Pre-fill shared resume fields from autoExtract
        setSplitStaffName(meta.staffName ?? "");
        setSplitCompanyTag((meta.companyTag as CompanyTag) ?? "");
        setSplitProjects(
          meta.projects.map((p) => ({
            projectName: p.projectName ?? "",
            owner: p.owner ?? "",
            client: p.client ?? "",
            firmRole: p.firmRole ?? "",
            location: p.location ?? "",
            contractValue: p.contractValue ?? "",
            startDate: p.startDate ?? "",
            endDate: p.endDate ?? "",
            serviceLines: p.serviceLines ?? "",
            scope: p.scope ?? "",
            description: p.description ?? "",
            companyTag: (meta.companyTag as CompanyTag) ?? "",
            tags: meta.tags ?? "",
          }))
        );
        setExpandedSplitIdx(0);
        return;
      }

      // Step 3b: Single-record pre-fill
      const extractedDocType = (meta.docType as DocType) ?? "other";
      setForm({
        docType: extractedDocType,
        companyTag: (meta.companyTag as CompanyTag) ?? "",
        title: meta.title || baseName,
        description: meta.description ?? "",
        staffName: meta.staffName ?? "",
        clientName: meta.clientName ?? "",
        ownerName: meta.ownerName ?? "",
        firmRole: meta.firmRole ?? "",
        resumeVersion: meta.resumeVersion ?? "",
        pursuitContext: meta.pursuitContext ?? "",
        projectName: meta.projectName ?? "",
        projectNumber: meta.projectNumber ?? "",
        contractValue: meta.contractValue ?? "",
        awardYear: meta.awardYear ? String(meta.awardYear) : "",
        tags: meta.tags ?? "",
      });

      // Step 4: Content-level duplicate check
      try {
        const contentDup = await utils.dam.checkContentDuplicate.fetch({
          docType: extractedDocType,
          projectName: meta.projectName ?? undefined,
          projectNumber: meta.projectNumber ?? undefined,
          clientName: meta.clientName ?? undefined,
          staffName: meta.staffName ?? undefined,
          resumeVersion: meta.resumeVersion ?? undefined,
          title: meta.title ?? undefined,
          fileName: file.name,
        });
        if (contentDup) {
          setContentDuplicate({
            id: contentDup.id,
            title: contentDup.title ?? "",
            docType: contentDup.docType ?? "",
            fileName: contentDup.fileName ?? "",
            resumeVersion: contentDup.resumeVersion,
            createdAt: contentDup.createdAt as any,
          });
        }
      } catch { /* ignore check failures */ }
    } catch (err: any) {
      // LLM failed — form stays with filename-derived defaults, user fills in manually
      toast.warning("Auto-fill could not read this file. Please fill in the details manually.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  // ── Save handler — file is already in storage, just create the DB record ──────
  async function handleUpload() {
    if (!stagedUpload) return;
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsUploading(true);
    setUploadProgress(50);

    try {
      // If user chose "replace" and we have a file-level duplicate, replace the file on the existing record
      if (duplicateAction === "replace" && fileDuplicate) {
        await replaceFileMutation.mutateAsync({
          id: fileDuplicate.id,
          fileName: stagedUpload.fileName,
          fileKey: stagedUpload.key,
          fileUrl: stagedUpload.url,
          mimeType: uploadFile?.type || "application/octet-stream",
          fileSizeBytes: stagedUpload.size,
        });
      } else {
        // Create new record (keep_both or no duplicate)
        await createMutation.mutateAsync({
          fileName: stagedUpload.fileName,
          fileKey: stagedUpload.key,
          fileUrl: stagedUpload.url,
          mimeType: uploadFile?.type || "application/octet-stream",
          fileSizeBytes: stagedUpload.size,
          docType: form.docType,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          companyTag: (form.companyTag as CompanyTag) || undefined,
          staffName: form.staffName.trim() || undefined,
          projectName: form.projectName.trim() || undefined,
          projectNumber: form.projectNumber.trim() || undefined,
          clientName: form.clientName.trim() || undefined,
          ownerName: form.ownerName.trim() || undefined,
          firmRole: form.firmRole.trim() || undefined,
          resumeVersion: form.resumeVersion.trim() || undefined,
          pursuitContext: form.pursuitContext.trim() || undefined,
          contractValue: form.contractValue.trim() || undefined,
          awardYear: form.awardYear ? parseInt(form.awardYear) : undefined,
          tags: form.tags.trim() || undefined,
        });
      }

      setUploadProgress(100);
      toast.success(`"${form.title}" saved to Knowledge Hub`);
      resetUploadState();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  function updateForm(key: keyof UploadFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSplitProject(idx: number, key: keyof SplitProject, value: string) {
    setSplitProjects((prev) => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  }

  function resetUploadState(processNext = true) {
    setShowUploadForm(false);
    setUploadFile(null);
    setStagedUpload(null);
    setForm(DEFAULT_FORM);
    setIsSplitMode(false);
    setSplitProjects([]);
    setExpandedSplitIdx(null);
    setSplitStaffName("");
    setSplitCompanyTag("");
    setFileDuplicate(null);
    setContentDuplicate(null);
    setDuplicateAction("dismissed");
    // Process next file in queue if any
    if (processNext) {
      setUploadQueue((prev) => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          // Slight delay so state resets fully before the next form opens
          setTimeout(() => prepareUpload(next), 100);
          return rest;
        }
        return prev;
      });
    }
  }

  async function handleSaveSplit() {
    if (!stagedUpload) return;
    const invalid = splitProjects.findIndex((p) => !p.projectName.trim());
    if (invalid !== -1) {
      toast.error(`Project ${invalid + 1} is missing a project name.`);
      setExpandedSplitIdx(invalid);
      return;
    }
    setIsSavingSplit(true);
    let saved = 0;
    for (const p of splitProjects) {
      try {
        await createMutation.mutateAsync({
          fileName: stagedUpload.fileName,
          fileKey: stagedUpload.key,
          fileUrl: stagedUpload.url,
          mimeType: uploadFile?.type || "application/octet-stream",
          fileSizeBytes: stagedUpload.size,
          docType: "project_sheet",
          title: p.projectName.trim(),
          description: [p.scope, p.description].filter(Boolean).join(" ") || undefined,
          companyTag: (splitCompanyTag as CompanyTag) || (p.companyTag as CompanyTag) || undefined,
          staffName: splitStaffName.trim() || undefined,
          clientName: p.client.trim() || undefined,
          ownerName: p.owner.trim() || undefined,
          firmRole: p.firmRole.trim() || undefined,
          contractValue: p.contractValue.trim() || undefined,
          tags: [
            p.serviceLines,
            p.location,
            p.tags,
          ].filter(Boolean).join(", ") || undefined,
        });
        saved++;
      } catch (err: any) {
        toast.error(`Failed to save "${p.projectName}": ${err.message}`);
      }
    }
    setIsSavingSplit(false);
    if (saved > 0) {
      toast.success(`${saved} project record${saved !== 1 ? "s" : ""} saved to Knowledge Hub`);
      resetUploadState();
    }
  }

  const docs = listData?.docs ?? [];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Knowledge Hub">
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Knowledge Hub</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload and manage past proposals, project sheets, resumes, and certifications
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload Document
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={handleFileSelect}
          />
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {statsLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))
            : (Object.entries(DOC_TYPE_CONFIG) as [DocType, typeof DOC_TYPE_CONFIG[DocType]][]).map(
                ([type, cfg]) => {
                  const count = (stats?.byType as Record<string, number>)?.[type] ?? 0;
                  const Icon = cfg.icon;
                  const isActive = filterDocType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilterDocType(isActive ? "all" : type)}
                      className={`
                        flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border
                        transition-all text-center cursor-pointer
                        ${isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
                        }
                      `}
                    >
                      <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <span className="text-lg font-bold leading-none">{count}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{cfg.label}</span>
                    </button>
                  );
                }
              )}
        </div>

        {/* ── Drop zone ──────────────────────────────────────────────────────── */}
        {!showUploadForm && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed
              cursor-pointer transition-all
              ${isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border bg-card/50 hover:border-primary/50 hover:bg-accent/30"
              }
            `}
          >
            <div className="p-3 rounded-full bg-primary/10">
              <CloudUpload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Drop a file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, Word, Excel, PowerPoint, TXT — up to 50 MB &bull; max 10 files per batch
              </p>
            </div>
          </div>
        )}

        {/* ── Upload form ────────────────────────────────────────────────────── */}
        {showUploadForm && uploadFile && (
          <Card className="border-primary/30 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Document Details</CardTitle>
                    {uploadQueue.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                        {uploadQueue.length} more in queue
                      </span>
                    )}
                    {isAnalyzing && (
                      <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Reading document…
                      </span>
                    )}
                    {!isAnalyzing && stagedUpload && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Auto-filled
                      </span>
                    )}
                  </div>
                  <CardDescription className="mt-0.5">
                    {uploadFile.name} — {formatBytes(uploadFile.size)}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => resetUploadState()}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File-level duplicate banner */}
              {fileDuplicate && duplicateAction === "pending" && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Duplicate filename detected</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        "{fileDuplicate.fileName}" already exists as "{fileDuplicate.title}" (uploaded {new Date(fileDuplicate.createdAt).toLocaleDateString()})
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400" onClick={() => setDuplicateAction("replace")}>
                          Replace existing
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400" onClick={() => setDuplicateAction("keep_both")}>
                          Keep both
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDuplicateAction("dismissed"); resetUploadState(); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {duplicateAction === "replace" && fileDuplicate && (
                <div className="p-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replacing "{fileDuplicate.title}" — the existing record's file will be updated.
                </div>
              )}

              {/* Content-level duplicate warning */}
              {contentDuplicate && (
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Similar content already exists</p>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                        Found existing {contentDuplicate.docType.replace("_", " ")}: "{contentDuplicate.title}"
                        {contentDuplicate.resumeVersion && ` (${contentDuplicate.resumeVersion} version)`}
                        {" "}— uploaded {new Date(contentDuplicate.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        You can still save this as a new record if it's a different version or update.
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 text-xs shrink-0" onClick={() => setContentDuplicate(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {/* Row 1: type + company */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Document Type <span className="text-rose-500">*</span></Label>
                  <Select value={form.docType} onValueChange={(v) => updateForm("docType", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(DOC_TYPE_CONFIG) as [DocType, any][]).map(([type, cfg]) => (
                        <SelectItem key={type} value={type}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Company / Entity</Label>
                  <Select value={form.companyTag} onValueChange={(v) => updateForm("companyTag", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JPCL">JPCL</SelectItem>
                      <SelectItem value="Strans">Strans</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label>Title <span className="text-rose-500">*</span></Label>
                <Input
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="Descriptive title for this document"
                />
              </div>

              {/* Conditional fields */}
              {(form.docType === "resume" || form.docType === "certification") && (
                <div className="space-y-1.5">
                  <Label>Staff Name</Label>
                  <Input
                    value={form.staffName}
                    onChange={(e) => updateForm("staffName", e.target.value)}
                    placeholder="e.g. John Smith"
                  />
                </div>
              )}

              {(form.docType === "past_proposal" || form.docType === "project_sheet") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Client / Agency</Label>
                    <Input
                      value={form.clientName}
                      onChange={(e) => updateForm("clientName", e.target.value)}
                      placeholder="e.g. NJDOT, PANYNJ"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contract Value</Label>
                    <Input
                      value={form.contractValue}
                      onChange={(e) => updateForm("contractValue", e.target.value)}
                      placeholder="e.g. $1,250,000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Project Name</Label>
                    <Input
                      value={form.projectName}
                      onChange={(e) => updateForm("projectName", e.target.value)}
                      placeholder="Project name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Award Year</Label>
                    <Input
                      value={form.awardYear}
                      onChange={(e) => updateForm("awardYear", e.target.value)}
                      placeholder="e.g. 2023"
                      type="number"
                    />
                  </div>
                </div>
              )}

              {/* Resume version — shown for resume docType */}
              {form.docType === "resume" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Resume Version</Label>
                    <Select value={form.resumeVersion} onValueChange={(v) => updateForm("resumeVersion", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select version…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1-page)</SelectItem>
                        <SelectItem value="long">Long (full CV)</SelectItem>
                        <SelectItem value="project_specific">Project-Specific</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pursuit Context</Label>
                    <Input
                      value={form.pursuitContext}
                      onChange={(e) => updateForm("pursuitContext", e.target.value)}
                      placeholder="e.g. NYSDOT Bridge Inspection 2024"
                    />
                  </div>
                </div>
              )}

              {/* Owner / Client / Firm Role — shown for project_sheet and past_proposal */}
              {(form.docType === "project_sheet" || form.docType === "past_proposal") && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Owner(s)</Label>
                    <Input
                      value={form.ownerName}
                      onChange={(e) => updateForm("ownerName", e.target.value)}
                      placeholder="e.g. NYSDOT, FHWA"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client</Label>
                    <Input
                      value={form.clientName}
                      onChange={(e) => updateForm("clientName", e.target.value)}
                      placeholder="Direct contracting party"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Our Role</Label>
                    <Select value={form.firmRole} onValueChange={(v) => updateForm("firmRole", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prime">Prime</SelectItem>
                        <SelectItem value="sub">Subconsultant</SelectItem>
                        <SelectItem value="joint-venture">Joint Venture</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => updateForm("tags", e.target.value)}
                  placeholder="Comma-separated keywords, e.g. bridge, NJDOT, geotechnical"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Notes / Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Optional notes about this document"
                  rows={2}
                />
              </div>

              {/* Analyzing overlay */}
              {isAnalyzing && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Reading your document…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The AI is extracting client, project, value, and other details automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* Save progress */}
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Saving…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              {/* Actions */}
              {isSplitMode ? (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 flex items-start gap-2">
                  <Layers className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Multi-project resume detected.</span>{" "}
                    Scroll down to the Split Panel to review each project and click <span className="font-medium">Create {splitProjects.length} Records</span>.
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isAnalyzing || !form.title.trim() || !stagedUpload}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                    ) : isAnalyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Reading…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" />Confirm &amp; Save</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => resetUploadState()}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Multi-project Split Panel ──────────────────────────────────────────── */}
        {isSplitMode && uploadFile && stagedUpload && (
          <Card className="border-amber-300/60 shadow-sm bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                      Multi-Project Experience Sheet Detected
                    </CardTitle>
                  </div>
                  <CardDescription className="mt-0.5">
                    {splitProjects.length} projects found in <span className="font-medium">{uploadFile.name}</span>.
                    Review and edit each project, then create {splitProjects.length} separate records.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => resetUploadState()}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Shared resume metadata — entered once, applied to all project records */}
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applied to all {splitProjects.length} records</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Staff Name <span className="text-rose-500">*</span></Label>
                    <Input
                      value={splitStaffName}
                      onChange={(e) => setSplitStaffName(e.target.value)}
                      placeholder="e.g. Jane Smith, PE"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Company / Entity</Label>
                    <Select value={splitCompanyTag} onValueChange={(v) => setSplitCompanyTag(v as CompanyTag | "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JPCL">JPCL</SelectItem>
                        <SelectItem value="Strans">Strans</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {splitProjects.map((proj, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                  {/* Accordion header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                    onClick={() => setExpandedSplitIdx(expandedSplitIdx === idx ? null : idx)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {proj.projectName || <span className="text-muted-foreground italic">Unnamed project</span>}
                      </span>
                      {proj.client && (
                        <span className="text-xs text-muted-foreground truncate">— {proj.client}</span>
                      )}
                    </div>
                    {expandedSplitIdx === idx
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Accordion body */}
                  {expandedSplitIdx === idx && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 col-span-2">
                          <Label>Project Name <span className="text-rose-500">*</span></Label>
                          <Input
                            value={proj.projectName}
                            onChange={(e) => updateSplitProject(idx, "projectName", e.target.value)}
                            placeholder="Project name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Owner(s)</Label>
                          <Input
                            value={proj.owner}
                            onChange={(e) => updateSplitProject(idx, "owner", e.target.value)}
                            placeholder="e.g. NYSDOT, FHWA (comma-separated)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Client</Label>
                          <Input
                            value={proj.client}
                            onChange={(e) => updateSplitProject(idx, "client", e.target.value)}
                            placeholder="Direct contracting party (prime or prime contractor)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Our Role</Label>
                          <Select
                            value={proj.firmRole}
                            onValueChange={(v) => updateSplitProject(idx, "firmRole", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prime">Prime</SelectItem>
                              <SelectItem value="sub">Subconsultant</SelectItem>
                              <SelectItem value="joint-venture">Joint Venture</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Location</Label>
                          <Input
                            value={proj.location}
                            onChange={(e) => updateSplitProject(idx, "location", e.target.value)}
                            placeholder="e.g. Newark, NJ"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Contract Value</Label>
                          <Input
                            value={proj.contractValue}
                            onChange={(e) => updateSplitProject(idx, "contractValue", e.target.value)}
                            placeholder="e.g. $1,250,000"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Service Lines</Label>
                          <Input
                            value={proj.serviceLines}
                            onChange={(e) => updateSplitProject(idx, "serviceLines", e.target.value)}
                            placeholder="e.g. Traffic Engineering, Inspection"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Start Date</Label>
                          <Input
                            value={proj.startDate}
                            onChange={(e) => updateSplitProject(idx, "startDate", e.target.value)}
                            placeholder="e.g. 2021"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>End Date</Label>
                          <Input
                            value={proj.endDate}
                            onChange={(e) => updateSplitProject(idx, "endDate", e.target.value)}
                            placeholder="e.g. 2023 or Ongoing"
                          />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <Label>Scope</Label>
                          <Textarea
                            value={proj.scope}
                            onChange={(e) => updateSplitProject(idx, "scope", e.target.value)}
                            placeholder="1-2 sentence scope description"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <Label>Additional Notes</Label>
                          <Textarea
                            value={proj.description}
                            onChange={(e) => updateSplitProject(idx, "description", e.target.value)}
                            placeholder="Any additional detail"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Company / Entity</Label>
                          <Select
                            value={proj.companyTag}
                            onValueChange={(v) => updateSplitProject(idx, "companyTag", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select entity…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="JPCL">JPCL</SelectItem>
                              <SelectItem value="Strans">Strans</SelectItem>
                              <SelectItem value="Both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Tags</Label>
                          <Input
                            value={proj.tags}
                            onChange={(e) => updateSplitProject(idx, "tags", e.target.value)}
                            placeholder="Comma-separated keywords"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSaveSplit}
                  disabled={isSavingSplit}
                  className="gap-2"
                >
                  {isSavingSplit ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" />Create {splitProjects.length} Records</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => resetUploadState()} disabled={isSavingSplit}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Library ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search title, client, project, staff…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
              />
            </div>

            <Select
              value={filterCompany}
              onValueChange={(v) => setFilterCompany(v as CompanyTag | "all")}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                <SelectItem value="JPCL">JPCL</SelectItem>
                <SelectItem value="Strans">Strans</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as ProcessingStatus | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="indexed">Indexed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            {(filterDocType !== "all" || filterCompany !== "all" || filterStatus !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDocType("all");
                  setFilterCompany("all");
                  setFilterStatus("all");
                  setSearch("");
                  setSearchInput("");
                }}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">
              {listData?.total ?? 0} document{(listData?.total ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Bulk progress panel */}
          {bulkProgress.active && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Extracting documents…</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {bulkProgress.current} of {bulkProgress.total}
                </span>
              </div>
              <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
              {bulkProgress.currentTitle && (
                <p className="text-xs text-muted-foreground truncate">
                  Processing: <span className="text-foreground font-medium">{bulkProgress.currentTitle}</span>
                </p>
              )}
              {bulkProgress.errors.length > 0 && (
                <div className="space-y-1">
                  {bulkProgress.errors.map((e) => (
                    <div key={e.id} className="flex items-start gap-2 text-xs text-rose-600">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-medium">{e.title}</span>: {e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bulk extract toolbar */}
          {selectionMode ? (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const unindexed = (listData?.docs ?? []).filter((d: any) => d.processingStatus !== "indexed").map((d: any) => d.id);
                  setSelectedIds(new Set(unindexed));
                }}
                className="text-xs h-7"
              >
                Select all unextracted
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set((listData?.docs ?? []).map((d: any) => d.id)))}
                className="text-xs h-7"
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs h-7"
              >
                Clear
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleBulkExtract(Array.from(selectedIds))}
                  disabled={selectedIds.size === 0 || bulkProgress.active}
                  className="gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Extract {selectedIds.size > 0 ? selectedIds.size : ""} Selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="gap-1.5 self-start"
              disabled={bulkProgress.active}
            >
              <ListChecks className="w-4 h-4" />
              Bulk Extract
            </Button>
          )}

          {/* Document grid */}
          {listLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">No documents yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first past proposal, project sheet, or resume above
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {docs.map((doc) => {
                const cfg = DOC_TYPE_CONFIG[doc.docType as DocType] ?? DOC_TYPE_CONFIG.other;
                const statusCfg = STATUS_CONFIG[doc.processingStatus as ProcessingStatus] ?? STATUS_CONFIG.uploaded;
                const Icon = cfg.icon;
                const StatusIcon = statusCfg.icon;
                const isExtracting = extractMutation.isPending && extractMutation.variables?.id === doc.id;

                const isSelected = selectedIds.has(doc.id);
                return (
                  <Card
                    key={doc.id}
                    className={`group relative flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
                      selectionMode && isSelected ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(doc.id)) next.delete(doc.id);
                          else next.add(doc.id);
                          return next;
                        });
                      } else {
                        setPreviewDocId(doc.id);
                      }
                    }}
                  >
                    <CardContent className="flex flex-col gap-3 p-4 flex-1">
                      {/* Selection checkbox overlay */}
                      {selectionMode && (
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(doc.id)) next.delete(doc.id);
                                else next.add(doc.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-background shadow-sm"
                          />
                        </div>
                      )}
                      {/* Header */}
                      <div className={`flex items-start gap-3 ${selectionMode ? "pl-6" : ""}`}>
                        <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-tight line-clamp-2">{doc.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.companyTag && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {doc.companyTag}
                              </Badge>
                            )}
                            {(doc as any).resumeVersion && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                {(doc as any).resumeVersion === "short" ? "Short" : (doc as any).resumeVersion === "long" ? "Long" : (doc as any).resumeVersion === "project_specific" ? "Project-Specific" : (doc as any).resumeVersion}
                              </Badge>
                            )}
                            {(doc as any).firmRole && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {(doc as any).firmRole === "prime" ? "Prime" : (doc as any).firmRole === "sub" ? "Sub" : "JV"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setPreviewDocId(doc.id)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {doc.processingStatus !== "indexed" && (
                              <DropdownMenuItem
                                onClick={() => extractMutation.mutate({ id: doc.id })}
                                disabled={isExtracting || doc.processingStatus === "processing"}
                              >
                                <Sparkles className="w-4 h-4 mr-2" />
                                {isExtracting ? "Extracting…" : "Extract Content"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => {
                                if (confirm(`Delete "${doc.title}"?`)) {
                                  deleteMutation.mutate({ id: doc.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Meta */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {(doc as any).ownerName && (
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Owner:</span> {(doc as any).ownerName}
                          </p>
                        )}
                        {doc.clientName && (
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Client:</span> {doc.clientName}
                          </p>
                        )}
                        {doc.staffName && (
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Staff:</span> {doc.staffName}
                          </p>
                        )}
                        {doc.docType === "resume" && (doc as any).extractedMeta?.projects?.length > 0 && (
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Projects:</span>{" "}
                            {(doc as any).extractedMeta.projects.length} in resume
                          </p>
                        )}
                        {doc.projectName && (
                          <p className="truncate">
                            <span className="font-medium text-foreground/70">Project:</span> {doc.projectName}
                          </p>
                        )}
                        {doc.contractValue && (
                          <p>
                            <span className="font-medium text-foreground/70">Value:</span> {doc.contractValue}
                          </p>
                        )}
                      </div>

                      {/* Tags */}
                      {doc.tags && (
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.split(",").slice(0, 3).map((tag) => (
                            <Badge key={tag.trim()} variant="secondary" className="text-[10px] h-4 px-1.5">
                              {tag.trim()}
                            </Badge>
                          ))}
                          {doc.tags.split(",").length > 3 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              +{doc.tags.split(",").length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                        <div className={`flex items-center gap-1 text-[11px] ${statusCfg.color}`}>
                          <StatusIcon className={`w-3 h-3 ${doc.processingStatus === "processing" ? "animate-spin" : ""}`} />
                          {statusCfg.label}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewDocId !== null} onOpenChange={(open) => { if (!open) { setPreviewDocId(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {previewDoc ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {(() => {
                      const cfg = DOC_TYPE_CONFIG[previewDoc.docType as DocType] ?? DOC_TYPE_CONFIG.other;
                      const Icon = cfg.icon;
                      return (
                        <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                          <Icon className={`w-5 h-5 ${cfg.color}`} />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <DialogTitle className="text-lg truncate">{previewDoc.title}</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {DOC_TYPE_CONFIG[previewDoc.docType as DocType]?.label ?? previewDoc.docType}
                        {previewDoc.companyTag && ` · ${previewDoc.companyTag}`}
                      </p>
                    </div>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => {
                        setEditForm({
                          docType: (previewDoc.docType as DocType) ?? "other",
                          companyTag: (previewDoc.companyTag as CompanyTag) ?? "",
                          title: previewDoc.title ?? "",
                          description: previewDoc.description ?? "",
                          staffName: previewDoc.staffName ?? "",
                          clientName: previewDoc.clientName ?? "",
                          ownerName: (previewDoc as any).ownerName ?? "",
                          firmRole: (previewDoc as any).firmRole ?? "",
                          resumeVersion: (previewDoc as any).resumeVersion ?? "",
                          pursuitContext: (previewDoc as any).pursuitContext ?? "",
                          projectName: previewDoc.projectName ?? "",
                          projectNumber: previewDoc.projectNumber ?? "",
                          contractValue: previewDoc.contractValue ?? "",
                          awardYear: previewDoc.awardYear ? String(previewDoc.awardYear) : "",
                          tags: previewDoc.tags ?? "",
                        });
                        setIsEditing(true);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {/* ── EDIT MODE ─────────────────────────────────────────────────── */}
              {isEditing ? (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Title</Label>
                      <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Document Type</Label>
                      <Select value={editForm.docType} onValueChange={(v) => setEditForm((f) => ({ ...f, docType: v as DocType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DOC_TYPE_CONFIG) as DocType[]).map((t) => (
                            <SelectItem key={t} value={t}>{DOC_TYPE_CONFIG[t].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Company / Entity</Label>
                      <Select value={editForm.companyTag || ""} onValueChange={(v) => setEditForm((f) => ({ ...f, companyTag: v as CompanyTag | "" }))}>
                        <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="JPCL">JPCL</SelectItem>
                          <SelectItem value="Strans">Strans</SelectItem>
                          <SelectItem value="Both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Client / Agency</Label>
                      <Input value={editForm.clientName} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} placeholder="e.g. NYCDOT" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Project Name</Label>
                      <Input value={editForm.projectName} onChange={(e) => setEditForm((f) => ({ ...f, projectName: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Project Number</Label>
                      <Input value={editForm.projectNumber} onChange={(e) => setEditForm((f) => ({ ...f, projectNumber: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contract Value</Label>
                      <Input value={editForm.contractValue} onChange={(e) => setEditForm((f) => ({ ...f, contractValue: e.target.value }))} placeholder="e.g. $2,400,000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Award Year</Label>
                      <Input value={editForm.awardYear} onChange={(e) => setEditForm((f) => ({ ...f, awardYear: e.target.value }))} placeholder="e.g. 2023" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Staff Name</Label>
                      <Input value={editForm.staffName} onChange={(e) => setEditForm((f) => ({ ...f, staffName: e.target.value }))} placeholder="For resumes / certifications" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                      <Input value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} placeholder="e.g. bridges, NYCDOT, inspection" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Description / Notes</Label>
                      <Textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      className="gap-2"
                      disabled={updateMetaMutation.isPending || !editForm.title.trim()}
                      onClick={() => updateMetaMutation.mutate({
                        id: previewDoc.id,
                        title: editForm.title.trim(),
                        description: editForm.description.trim() || undefined,
                        docType: editForm.docType,
                        companyTag: (editForm.companyTag as CompanyTag) || undefined,
                        staffName: editForm.staffName.trim() || undefined,
                        clientName: editForm.clientName.trim() || undefined,
                        projectName: editForm.projectName.trim() || undefined,
                        projectNumber: editForm.projectNumber.trim() || undefined,
                        contractValue: editForm.contractValue.trim() || undefined,
                        awardYear: editForm.awardYear ? parseInt(editForm.awardYear) : undefined,
                        tags: editForm.tags.trim() || undefined,
                      })}
                    >
                      {updateMetaMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={updateMetaMutation.isPending}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">File</p>
                    <p className="mt-0.5 truncate">{previewDoc.fileName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Size</p>
                    <p className="mt-0.5">{formatBytes(previewDoc.fileSizeBytes ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Uploaded</p>
                    <p className="mt-0.5">{formatDate(previewDoc.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                    <p className={`mt-0.5 ${STATUS_CONFIG[previewDoc.processingStatus as ProcessingStatus]?.color}`}>
                      {STATUS_CONFIG[previewDoc.processingStatus as ProcessingStatus]?.label ?? previewDoc.processingStatus}
                    </p>
                  </div>
                </div>

                {(previewDoc.clientName || previewDoc.staffName || previewDoc.projectName || previewDoc.contractValue) && (
                  <div className="grid grid-cols-2 gap-3 text-sm border-t pt-4">
                    {previewDoc.clientName && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Client</p>
                        <p className="mt-0.5">{previewDoc.clientName}</p>
                      </div>
                    )}
                    {previewDoc.staffName && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Staff</p>
                        <p className="mt-0.5">{previewDoc.staffName}</p>
                      </div>
                    )}
                    {previewDoc.projectName && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Project</p>
                        <p className="mt-0.5">{previewDoc.projectName}</p>
                      </div>
                    )}
                    {previewDoc.contractValue && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Contract Value</p>
                        <p className="mt-0.5">{previewDoc.contractValue}</p>
                      </div>
                    )}
                    {previewDoc.awardYear && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Award Year</p>
                        <p className="mt-0.5">{previewDoc.awardYear}</p>
                      </div>
                    )}
                  </div>
                )}

                {previewDoc.tags && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewDoc.tags.split(",").map((tag) => (
                        <Badge key={tag.trim()} variant="secondary">{tag.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {previewDoc.extractedText && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                      Extracted Summary
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed max-h-48 overflow-y-auto">
                      {previewDoc.extractedText}
                    </div>
                  </div>
                )}

                {/* ── Extracted Images ─────────────────────────────────────────── */}
                {(() => {
                  const meta = previewDoc.extractedMeta as Record<string, unknown> | null;
                  const images = Array.isArray(meta?.images) ? (meta!.images as Array<{
                    description?: string;
                    type?: string;
                    page?: number;
                    tags?: string[];
                  }>) : [];
                  if (images.length === 0) return null;
                  return (
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Extracted Images ({images.length})
                      </p>
                      <div className="space-y-2.5">
                        {images.map((img, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5"
                          >
                            {/* Type badge + page */}
                            <div className="flex items-center gap-2">
                              {img.type && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                  {img.type}
                                </Badge>
                              )}
                              {img.page != null && (
                                <span className="text-[11px] text-muted-foreground">p. {img.page}</span>
                              )}
                            </div>
                            {/* Description */}
                            {img.description && (
                              <p className="text-sm leading-snug">{img.description}</p>
                            )}
                            {/* Tags */}
                            {Array.isArray(img.tags) && img.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {(img.tags as string[]).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <DialogFooter className="flex gap-2 pt-2">
                {previewDoc.processingStatus !== "indexed" && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => extractMutation.mutate({ id: previewDoc.id })}
                    disabled={extractMutation.isPending || previewDoc.processingStatus === "processing"}
                  >
                    {extractMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Extracting…</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />Extract Content</>
                    )}
                  </Button>
                )}
                <Button asChild variant="outline" className="gap-2">
                  <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-4 h-4" />
                    Open File
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => {
                    if (confirm(`Delete "${previewDoc.title}"?`)) {
                      deleteMutation.mutate({ id: previewDoc.id });
                      setPreviewDocId(null);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </DialogFooter>
              </>
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Loading document…</DialogTitle>
              </DialogHeader>
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
