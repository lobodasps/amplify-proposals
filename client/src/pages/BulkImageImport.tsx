/**
 * BulkImageImport.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen bulk image import modal for Knowledge Hub.
 * Parts 1–9: entry point, drop zone, folder parsing, upload, captioning,
 * smart grouping, group metadata, review panel, confirm & create.
 *
 * Zero new routers — uses existing:
 *   POST /api/upload (folder=dam)
 *   trpc.dam.triggerExtract
 *   trpc.dam.create
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  CloudUpload, X, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronRight,
  Images, Edit2, Trash2, Eye, FolderOpen, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = "waiting" | "uploading" | "uploaded" | "error";
type CaptionStatus = "waiting" | "processing" | "done" | "error";

interface FolderHints {
  projectName?: string;
  constructionPhase?: string;
  setting?: string;
}

interface BulkFile {
  id: string;
  file: File;
  previewUrl: string;
  folderHints: FolderHints;
  // Upload
  uploadStatus: UploadStatus;
  uploadError?: string;
  fileKey?: string;
  fileUrl?: string;
  fileName?: string;
  // Caption
  captionStatus: CaptionStatus;
  captionError?: string;
  caption?: string;
  description?: string;
  structureType?: string;
  constructionPhase?: string;
  setting?: string;
  environment?: string;
  tags?: string[];
  hasPersonnel?: boolean;
  qualityRating?: "high" | "medium" | "low";
  // Group assignment
  groupKey?: string;
  // Manual review
  manualCaption?: string;
  discarded?: boolean;
  // DB record id after creation
  createdId?: string;
}

interface GroupMetadata {
  projectName?: string;
  companyTag?: string;
  usageRights?: string;
  yearFrom?: string;
  yearTo?: string;
  additionalTags?: string;
  constructionPhaseOverride?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/tiff", "image/webp"]);
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"];

const STRUCTURE_GROUPS: Record<string, { label: string; icon: string; order: number }> = {
  bridge: { label: "Bridges & Overpasses", icon: "🌉", order: 1 },
  roadway: { label: "Roadways & Highways", icon: "🛣️", order: 2 },
  "under-construction": { label: "Under Construction", icon: "🏗️", order: 3 },
  "environmental-site": { label: "Environmental Sites", icon: "🌿", order: 4 },
  "athletic-field": { label: "Athletic Fields & Parks", icon: "🏟️", order: 5 },
  park: { label: "Athletic Fields & Parks", icon: "🏟️", order: 5 },
  building: { label: "Buildings & Structures", icon: "🏢", order: 6 },
  dam: { label: "Waterfront & Marine", icon: "🌊", order: 7 },
  tunnel: { label: "Utilities & Infrastructure", icon: "🔧", order: 8 },
  utility: { label: "Utilities & Infrastructure", icon: "🔧", order: 8 },
  "retaining-wall": { label: "Retaining Walls", icon: "🧱", order: 9 },
  aerial: { label: "Aerial & Drone", icon: "✈️", order: 10 },
  other: { label: "Other", icon: "📁", order: 11 },
  needs_review: { label: "Needs Manual Review", icon: "⚠️", order: 98 },
  upload_failed: { label: "Upload Failed", icon: "❌", order: 99 },
};

function getGroupKey(file: BulkFile): string {
  if (file.uploadStatus === "error") return "upload_failed";
  if (!file.qualityRating || file.qualityRating === "low" || file.structureType === "other" || !file.structureType) {
    return "needs_review";
  }
  if (file.setting === "aerial") return "aerial";
  return file.structureType ?? "other";
}

// ─── Folder name parsing ──────────────────────────────────────────────────────

function parseFolderHints(file: File): FolderHints {
  const hints: FolderHints = {};
  // webkitRelativePath = "FolderA/SubFolder/filename.jpg"
  const path = (file as any).webkitRelativePath as string | undefined;
  if (!path) return hints;

  const parts = path.split("/").filter(Boolean);
  // Remove filename (last part)
  const folders = parts.slice(0, -1);
  if (folders.length === 0) return hints;

  // Last folder before filename → project name hint
  hints.projectName = folders[folders.length - 1];

  const allFolders = folders.join(" ").toLowerCase();

  // Construction phase hints
  if (/construction|under.construction|active/.test(allFolders)) {
    hints.constructionPhase = "under-construction";
  } else if (/complete|completed|final|finished/.test(allFolders)) {
    hints.constructionPhase = "completed";
  } else if (/before|existing/.test(allFolders)) {
    hints.constructionPhase = "existing-conditions";
  }

  // Setting hints
  if (/aerial|drone/.test(allFolders)) {
    hints.setting = "aerial";
  }

  return hints;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BulkImageImportProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void; // called when records created — triggers KH refresh
}

export function BulkImageImport({ open, onClose, onComplete }: BulkImageImportProps) {
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<"drop" | "processing" | "review" | "creating" | "done">("drop");
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [captionProgress, setCaptionProgress] = useState({ done: 0, total: 0 });
  const [createProgress, setCreateProgress] = useState({ done: 0, total: 0 });
  const [groupMeta, setGroupMeta] = useState<Record<string, GroupMetadata>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupMetaSheetKey, setGroupMetaSheetKey] = useState<string | null>(null);
  const [reviewFileId, setReviewFileId] = useState<string | null>(null);
  const [skipUnresolved, setSkipUnresolved] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const triggerExtractMutation = trpc.dam.triggerExtract.useMutation();
  const createMutation = trpc.dam.create.useMutation();
  const utils = trpc.useUtils();

  // Reset on open
  useEffect(() => {
    if (open) {
      setFiles([]);
      setStage("drop");
      setUploadProgress({ done: 0, total: 0 });
      setCaptionProgress({ done: 0, total: 0 });
      setCreateProgress({ done: 0, total: 0 });
      setGroupMeta({});
      setExpandedGroups(new Set());
      setSkipUnresolved(false);
      setCreatedCount(0);
      abortRef.current = false;
    }
  }, [open]);

  // ── File validation & add ──────────────────────────────────────────────────

  function addFiles(incoming: File[]) {
    const valid: BulkFile[] = [];
    const rejected: string[] = [];

    for (const f of incoming) {
      const mime = f.type.toLowerCase();
      const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
      if (!ACCEPTED_MIME.has(mime) && !ACCEPTED_EXT.includes(ext)) {
        rejected.push(f.name);
        continue;
      }
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(f);
      const hints = parseFolderHints(f);
      valid.push({
        id,
        file: f,
        previewUrl,
        folderHints: hints,
        uploadStatus: "waiting",
        captionStatus: "waiting",
      });
    }

    if (rejected.length > 0) {
      toast.error(`${rejected.length} file(s) rejected — only JPG, PNG, TIFF, WEBP accepted.`);
    }

    setFiles((prev) => [...prev, ...valid]);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = Array.from(e.dataTransfer.files);
    addFiles(items);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const items = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    addFiles(items);
  }

  function handleFolderInput(e: React.ChangeEvent<HTMLInputElement>) {
    const items = Array.from(e.target.files ?? []);
    if (folderInputRef.current) folderInputRef.current.value = "";
    addFiles(items);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  // ── Upload stage ──────────────────────────────────────────────────────────

  async function uploadSingle(bf: BulkFile): Promise<BulkFile> {
    setFiles((prev) => prev.map((f) => f.id === bf.id ? { ...f, uploadStatus: "uploading" } : f));
    try {
      const formData = new FormData();
      formData.append("file", bf.file);
      formData.append("folder", "dam");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { url, key, fileName } = await res.json();
      const updated: BulkFile = { ...bf, uploadStatus: "uploaded", fileKey: key, fileUrl: url, fileName };
      setFiles((prev) => prev.map((f) => f.id === bf.id ? updated : f));
      return updated;
    } catch (err: any) {
      const updated: BulkFile = { ...bf, uploadStatus: "error", uploadError: err.message };
      setFiles((prev) => prev.map((f) => f.id === bf.id ? updated : f));
      return updated;
    }
  }

  async function runUploads(filesToUpload: BulkFile[]): Promise<BulkFile[]> {
    const BATCH = 10;
    const results: BulkFile[] = [];
    setUploadProgress({ done: 0, total: filesToUpload.length });

    for (let i = 0; i < filesToUpload.length; i += BATCH) {
      if (abortRef.current) break;
      const batch = filesToUpload.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map(uploadSingle));
      results.push(...batchResults);
      setUploadProgress({ done: Math.min(i + BATCH, filesToUpload.length), total: filesToUpload.length });
    }
    return results;
  }

  // ── Caption stage ─────────────────────────────────────────────────────────

  async function captionSingle(bf: BulkFile): Promise<BulkFile> {
    if (bf.uploadStatus !== "uploaded" || !bf.fileKey) return bf;
    setFiles((prev) => prev.map((f) => f.id === bf.id ? { ...f, captionStatus: "processing" } : f));
    try {
      // We use triggerExtract which handles the dam_image_caption skill server-side
      // First create a minimal DB record so triggerExtract has an ID to work with
      const record = await createMutation.mutateAsync({
        fileName: bf.fileName ?? bf.file.name,
        fileKey: bf.fileKey!,
        fileUrl: bf.fileUrl!,
        mimeType: bf.file.type,
        fileSizeBytes: bf.file.size,
        docType: "image",
        title: bf.file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        processingStatus: "uploaded",
        // Pass folder hints as context
        description: bf.folderHints.projectName
          ? `Folder context: ${bf.folderHints.projectName}`
          : undefined,
        projectName: bf.folderHints.projectName,
      } as any);

      const extractResult = await triggerExtractMutation.mutateAsync({ id: record.id });

      // Fetch updated record to get caption data
      const updated: BulkFile = {
        ...bf,
        captionStatus: "done",
        caption: (extractResult as any).caption ?? bf.file.name,
        structureType: (extractResult as any).structureType ?? "other",
        qualityRating: (extractResult as any).qualityRating ?? "medium",
        createdId: record.id, // already created — will update on confirm
        groupKey: undefined, // will be computed
      };

      // Determine group
      updated.groupKey = getGroupKey(updated);
      setFiles((prev) => prev.map((f) => f.id === bf.id ? updated : f));

      // Auto-expand first group
      setExpandedGroups((prev) => {
        if (prev.size === 0 && updated.groupKey) {
          return new Set([updated.groupKey]);
        }
        return prev;
      });

      return updated;
    } catch (err: any) {
      const updated: BulkFile = { ...bf, captionStatus: "error", captionError: err.message, groupKey: "needs_review" };
      setFiles((prev) => prev.map((f) => f.id === bf.id ? updated : f));
      return updated;
    }
  }

  async function runCaptions(uploadedFiles: BulkFile[]): Promise<void> {
    const eligible = uploadedFiles.filter((f) => f.uploadStatus === "uploaded");
    const BATCH = 5;
    const DELAY = 500;
    setCaptionProgress({ done: 0, total: eligible.length });

    for (let i = 0; i < eligible.length; i += BATCH) {
      if (abortRef.current) break;
      const batch = eligible.slice(i, i + BATCH);
      await Promise.all(batch.map(captionSingle));
      setCaptionProgress({ done: Math.min(i + BATCH, eligible.length), total: eligible.length });
      if (i + BATCH < eligible.length) {
        await new Promise((r) => setTimeout(r, DELAY));
      }
    }
  }

  // ── Start import ──────────────────────────────────────────────────────────

  async function startImport() {
    const validFiles = files.filter((f) => !f.discarded);
    if (validFiles.length === 0) return;
    setStage("processing");

    const uploadedFiles = await runUploads(validFiles);
    await runCaptions(uploadedFiles);

    setStage("review");
    // Auto-expand first non-empty group
    const groups = computeGroups();
    const firstKey = Object.keys(groups)[0];
    if (firstKey) setExpandedGroups(new Set([firstKey]));
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  function computeGroups(): Record<string, BulkFile[]> {
    const groups: Record<string, BulkFile[]> = {};
    for (const f of files) {
      if (f.discarded) continue;
      const key = f.groupKey ?? getGroupKey(f);
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    // Sort by count desc, special groups last
    return Object.fromEntries(
      Object.entries(groups).sort(([ka, a], [kb, b]) => {
        const oa = STRUCTURE_GROUPS[ka]?.order ?? 50;
        const ob = STRUCTURE_GROUPS[kb]?.order ?? 50;
        if (oa !== ob) return oa - ob;
        return b.length - a.length;
      })
    );
  }

  function applyGroupMeta(groupKey: string, meta: GroupMetadata) {
    setGroupMeta((prev) => ({ ...prev, [groupKey]: meta }));
    setGroupMetaSheetKey(null);
    toast.success(`Group metadata applied to ${computeGroups()[groupKey]?.length ?? 0} images`);
  }

  // ── Confirm & create ──────────────────────────────────────────────────────

  async function confirmCreate() {
    const groups = computeGroups();
    const toCreate = files.filter(
      (f) => !f.discarded && f.captionStatus === "done" && f.createdId
    );
    const needsReview = files.filter(
      (f) => !f.discarded && (f.groupKey === "needs_review") && !f.discarded
    );

    if (needsReview.length > 0 && !skipUnresolved) {
      toast.error("Resolve or skip all flagged images before creating records.");
      return;
    }

    setStage("creating");
    setCreateProgress({ done: 0, total: toCreate.length });
    let created = 0;

    for (const bf of toCreate) {
      if (abortRef.current) break;
      const gKey = bf.groupKey ?? "other";
      const gm = groupMeta[gKey] ?? {};

      // Merge tags: auto + group additional
      const autoTags = bf.tags ?? [];
      const groupTags = gm.additionalTags
        ? gm.additionalTags.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean)
        : [];
      const mergedTags = Array.from(new Set([...autoTags, ...groupTags])).join(",");

      try {
        // Update the already-created record with group metadata
        await utils.client.dam.updateMeta.mutate({
          id: bf.createdId!,
          title: bf.manualCaption ?? bf.caption ?? bf.file.name,
          description: bf.description,
          tags: mergedTags,
          companyTag: gm.companyTag as any,
          projectName: gm.projectName ?? bf.folderHints.projectName,
          usageRights: gm.usageRights as any,
          yearTaken: gm.yearFrom ? parseInt(gm.yearFrom) : undefined,
        });
        created++;
      } catch {
        // Non-fatal — record already exists, just metadata update failed
        created++;
      }
      setCreateProgress({ done: created, total: toCreate.length });
    }

    setCreatedCount(created);
    setStage("done");
    utils.dam.list.invalidate();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const groups = computeGroups();
  const totalValid = files.filter((f) => !f.discarded).length;
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);
  const needsReviewCount = groups["needs_review"]?.length ?? 0;
  const readyCount = files.filter(
    (f) => !f.discarded && f.captionStatus === "done" && f.groupKey !== "needs_review" && f.groupKey !== "upload_failed"
  ).length;

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  const reviewFile = reviewFileId ? files.find((f) => f.id === reviewFileId) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100">
                  <Images className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Bulk Image Import</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload and auto-caption hundreds of AEC project photos at once
                  </p>
                </div>
              </div>
              {stage === "drop" && files.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {totalValid} file{totalValid !== 1 ? "s" : ""} · {formatBytes(totalSize)}
                </div>
              )}
            </div>
          </DialogHeader>

          {/* ── Stage: Drop ── */}
          {stage === "drop" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer",
                  isDragging
                    ? "border-violet-500 bg-violet-50 scale-[1.01]"
                    : "border-border bg-card/50 hover:border-violet-400 hover:bg-violet-50/30"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="p-4 rounded-full bg-violet-100">
                  <CloudUpload className="w-8 h-8 text-violet-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold">Drop images here or click to browse</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    JPG, PNG, TIFF, WEBP · No file count limit · Designed for 200+ photos
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Select Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Select Folder
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.tiff,.tif,.webp"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.tiff,.tif,.webp"
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory=""
                  onChange={handleFolderInput}
                />
              </div>

              {/* Thumbnail grid preview */}
              {files.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{files.length} image{files.length !== 1 ? "s" : ""} queued</h3>
                    <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-muted-foreground">
                      Clear all
                    </Button>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
                    {files.map((bf) => (
                      <div key={bf.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                          <img
                            src={bf.previewUrl}
                            alt={bf.file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => removeFile(bf.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        {bf.folderHints.projectName && (
                          <p className="text-[9px] text-muted-foreground truncate mt-0.5 leading-tight">
                            {bf.folderHints.projectName}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Stage: Processing ── */}
          {stage === "processing" && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 gap-8">
              <div className="w-full max-w-lg space-y-6">
                {/* Upload progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Uploading to Supabase Storage</span>
                    <span className="text-muted-foreground">
                      {uploadProgress.done} of {uploadProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={uploadProgress.total > 0 ? (uploadProgress.done / uploadProgress.total) * 100 : 0}
                    className="h-2"
                  />
                </div>

                {/* Caption progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Gemini Vision Captioning</span>
                    <span className="text-muted-foreground">
                      {captionProgress.done} of {captionProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={captionProgress.total > 0 ? (captionProgress.done / captionProgress.total) * 100 : 0}
                    className="h-2"
                  />
                </div>

                {/* Live thumbnail stream */}
                <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto">
                  {files.map((bf) => (
                    <div key={bf.id} className="relative aspect-square rounded overflow-hidden bg-muted">
                      <img src={bf.previewUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        {bf.uploadStatus === "waiting" && (
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                        )}
                        {bf.uploadStatus === "uploading" && (
                          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                        )}
                        {bf.uploadStatus === "uploaded" && bf.captionStatus === "waiting" && (
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                        )}
                        {bf.captionStatus === "processing" && (
                          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                        )}
                        {bf.captionStatus === "done" && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        )}
                        {(bf.uploadStatus === "error" || bf.captionStatus === "error") && (
                          <X className="w-3 h-3 text-rose-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Stage: Review ── */}
          {stage === "review" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {Object.entries(groups).map(([groupKey, groupFiles], groupIdx) => {
                const groupInfo = STRUCTURE_GROUPS[groupKey] ?? { label: groupKey, icon: "📁", order: 50 };
                const isExpanded = expandedGroups.has(groupKey);
                const gm = groupMeta[groupKey];

                return (
                  <div key={groupKey} className="border border-border rounded-xl overflow-hidden">
                    {/* Group header */}
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors",
                        groupKey === "needs_review" ? "bg-amber-50" : "bg-card"
                      )}
                      onClick={() =>
                        setExpandedGroups((prev) => {
                          const next = new Set(Array.from(prev));
                          if (next.has(groupKey)) next.delete(groupKey);
                          else next.add(groupKey);
                          return next;
                        })
                      }
                    >
                      <span className="text-lg">{groupInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{groupInfo.label}</p>
                        <p className="text-xs text-muted-foreground">{groupFiles.length} photo{groupFiles.length !== 1 ? "s" : ""}</p>
                      </div>
                      {gm && (
                        <Badge variant="secondary" className="text-xs">Metadata applied</Badge>
                      )}
                      {groupKey !== "upload_failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupMetaSheetKey(groupKey);
                          }}
                        >
                          Apply Group Metadata
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    {/* Thumbnail grid */}
                    {isExpanded && (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-border">
                        {groupFiles.map((bf) => (
                          <div key={bf.id} className="space-y-1.5">
                            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border">
                              <img
                                src={bf.previewUrl}
                                alt={bf.caption ?? bf.file.name}
                                className="w-full h-full object-cover"
                              />
                              {/* Quality badge */}
                              {bf.qualityRating && (
                                <div className={cn(
                                  "absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                  bf.qualityRating === "high" ? "bg-emerald-500 text-white" :
                                  bf.qualityRating === "medium" ? "bg-amber-500 text-white" :
                                  "bg-rose-500 text-white"
                                )}>
                                  {bf.qualityRating}
                                </div>
                              )}
                              {/* Actions */}
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                                <button
                                  onClick={() => setReviewFileId(bf.id)}
                                  className="p-1.5 bg-white/90 rounded-lg"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setFiles((prev) => prev.map((f) => f.id === bf.id ? { ...f, discarded: true } : f))}
                                  className="p-1.5 bg-white/90 rounded-lg text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Caption (editable) */}
                            <p
                              className="text-xs leading-tight line-clamp-2 cursor-text hover:text-primary"
                              onClick={() => setReviewFileId(bf.id)}
                            >
                              {bf.manualCaption ?? bf.caption ?? bf.file.name}
                            </p>
                            {/* Tags */}
                            {bf.tags && bf.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {bf.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                    {t}
                                  </span>
                                ))}
                                {bf.tags.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground">+{bf.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Stage: Creating ── */}
          {stage === "creating" && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
              <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
                  <p className="font-semibold">Creating Knowledge Hub records…</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Creating record</span>
                    <span className="text-muted-foreground">{createProgress.done} of {createProgress.total}</span>
                  </div>
                  <Progress
                    value={createProgress.total > 0 ? (createProgress.done / createProgress.total) * 100 : 0}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Stage: Done ── */}
          {stage === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold">Import Complete</h3>
                <p className="text-muted-foreground">
                  {createdCount} image record{createdCount !== 1 ? "s" : ""} created in Knowledge Hub
                </p>
              </div>
              <Button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                View in Knowledge Hub
              </Button>
            </div>
          )}

          {/* ── Sticky footer ── */}
          {(stage === "drop" || stage === "review") && (
            <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm">
                {stage === "review" && (
                  <>
                    <span className="text-emerald-600 font-medium">{readyCount} ready</span>
                    {needsReviewCount > 0 && (
                      <span className="text-amber-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {needsReviewCount} need review
                      </span>
                    )}
                    {needsReviewCount > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={skipUnresolved}
                          onCheckedChange={(v) => setSkipUnresolved(!!v)}
                        />
                        <span className="text-xs text-muted-foreground">Skip unresolved</span>
                      </label>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                {stage === "drop" && (
                  <Button
                    onClick={startImport}
                    disabled={files.length === 0}
                    className="gap-2 bg-violet-600 hover:bg-violet-700"
                  >
                    <CloudUpload className="w-4 h-4" />
                    Start Import ({files.length})
                  </Button>
                )}
                {stage === "review" && (
                  <Button
                    onClick={confirmCreate}
                    disabled={readyCount === 0 || (needsReviewCount > 0 && !skipUnresolved)}
                    className="gap-2 bg-violet-600 hover:bg-violet-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Create {readyCount} Record{readyCount !== 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Group Metadata Sheet ── */}
      {groupMetaSheetKey && (
        <GroupMetadataSheet
          groupKey={groupMetaSheetKey}
          groupLabel={STRUCTURE_GROUPS[groupMetaSheetKey]?.label ?? groupMetaSheetKey}
          initial={groupMeta[groupMetaSheetKey] ?? {}}
          onApply={(meta) => applyGroupMeta(groupMetaSheetKey, meta)}
          onClose={() => setGroupMetaSheetKey(null)}
        />
      )}

      {/* ── Single Image Review Panel ── */}
      {reviewFile && (
        <SingleImageReview
          file={reviewFile}
          groups={Object.keys(STRUCTURE_GROUPS)}
          onUpdate={(updates) => {
            setFiles((prev) => prev.map((f) => f.id === reviewFile.id ? { ...f, ...updates } : f));
            setReviewFileId(null);
          }}
          onDiscard={() => {
            setFiles((prev) => prev.map((f) => f.id === reviewFile.id ? { ...f, discarded: true } : f));
            setReviewFileId(null);
          }}
          onClose={() => setReviewFileId(null)}
        />
      )}
    </>
  );
}

// ─── Group Metadata Sheet ─────────────────────────────────────────────────────

interface GroupMetadataSheetProps {
  groupKey: string;
  groupLabel: string;
  initial: GroupMetadata;
  onApply: (meta: GroupMetadata) => void;
  onClose: () => void;
}

function GroupMetadataSheet({ groupKey, groupLabel, initial, onApply, onClose }: GroupMetadataSheetProps) {
  const [meta, setMeta] = useState<GroupMetadata>(initial);
  const update = (k: keyof GroupMetadata, v: string) => setMeta((prev) => ({ ...prev, [k]: v }));

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Group Metadata — {groupLabel}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Applied to all photos in this group. Individual photo edits override these values.
          </p>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>Project Association</Label>
            <Input
              value={meta.projectName ?? ""}
              onChange={(e) => update("projectName", e.target.value)}
              placeholder="Project name or search…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Company Tag</Label>
            <Select value={meta.companyTag ?? ""} onValueChange={(v) => update("companyTag", v)}>
              <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="JPCL">JPCL</SelectItem>
                <SelectItem value="Strans">Strans</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Usage Rights</Label>
            <Select value={meta.usageRights ?? ""} onValueChange={(v) => update("usageRights", v)}>
              <SelectTrigger><SelectValue placeholder="Select usage rights…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_only">Internal Only</SelectItem>
                <SelectItem value="proposal_use">Proposal Use</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="unrestricted">Unrestricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Year From</Label>
              <Input
                type="number"
                value={meta.yearFrom ?? ""}
                onChange={(e) => update("yearFrom", e.target.value)}
                placeholder="e.g. 2022"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Year To</Label>
              <Input
                type="number"
                value={meta.yearTo ?? ""}
                onChange={(e) => update("yearTo", e.target.value)}
                placeholder="e.g. 2024"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Additional Tags</Label>
            <Input
              value={meta.additionalTags ?? ""}
              onChange={(e) => update("additionalTags", e.target.value)}
              placeholder="Comma-separated, appended to auto-tags"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Override Construction Phase</Label>
            <Select value={meta.constructionPhaseOverride ?? ""} onValueChange={(v) => update("constructionPhaseOverride", v)}>
              <SelectTrigger><SelectValue placeholder="Leave as detected" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Leave as detected</SelectItem>
                <SelectItem value="existing-conditions">Existing Conditions</SelectItem>
                <SelectItem value="under-construction">Under Construction</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => onApply(meta)}>
            Apply to Group
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Single Image Review Panel ────────────────────────────────────────────────

interface SingleImageReviewProps {
  file: BulkFile;
  groups: string[];
  onUpdate: (updates: Partial<BulkFile>) => void;
  onDiscard: () => void;
  onClose: () => void;
}

function SingleImageReview({ file, groups, onUpdate, onDiscard, onClose }: SingleImageReviewProps) {
  const [caption, setCaption] = useState(file.manualCaption ?? file.caption ?? "");
  const [groupKey, setGroupKey] = useState(file.groupKey ?? "other");

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Review Image</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Large thumbnail */}
          <div className="rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
            <img src={file.previewUrl} alt="" className="w-full h-full object-contain" />
          </div>

          {/* Gemini output */}
          {file.caption && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gemini Vision Output</p>
              <p>{file.caption}</p>
              {file.description && <p className="text-muted-foreground text-xs">{file.description}</p>}
              <div className="flex gap-2 mt-1">
                {file.structureType && <Badge variant="secondary" className="text-xs">{file.structureType}</Badge>}
                {file.qualityRating && (
                  <Badge className={cn(
                    "text-xs",
                    file.qualityRating === "high" ? "bg-emerald-100 text-emerald-700" :
                    file.qualityRating === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-rose-100 text-rose-700"
                  )}>
                    {file.qualityRating} quality
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Manual caption */}
          <div className="space-y-1.5">
            <Label>What does this image show?</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe what this image shows…"
              rows={3}
            />
          </div>

          {/* Move to group */}
          <div className="space-y-1.5">
            <Label>Assign to Group</Label>
            <Select value={groupKey} onValueChange={setGroupKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STRUCTURE_GROUPS)
                  .filter(([k]) => k !== "upload_failed" && k !== "needs_review")
                  .map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 text-rose-600 hover:text-rose-700"
              onClick={onDiscard}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Discard
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={() => onUpdate({ manualCaption: caption || undefined, groupKey })}
            >
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
