/**
 * Document Shredder Page — Karpathy Pattern 1
 *
 * Upload one or more RFP files (PDF, DOCX, XLSX, CSV, TXT, XML, images)
 * and compile them into a single structured semantic XML <rfp-package>.
 *
 * Supported formats:
 *   PDF (text or scanned) · DOCX/DOC · XLSX/XLS · CSV · TXT · XML · PNG/JPG/WEBP
 */
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText, Upload, Loader2, CheckCircle2, AlertCircle, Code2,
  BookOpen, Zap, ChevronRight, Trash2, RefreshCw, Eye, X,
  FileSpreadsheet, Image, FileCode, FileType2, Package,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { RfpContextSelector, useRfpContext } from "@/components/RfpContextSelector";
import AppLayout from "@/components/AppLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileRole = "primary" | "addendum" | "exhibit" | "form" | "attachment";

interface QueuedFile {
  id: string;
  file: File;
  role: FileRole;
  status: "pending" | "uploading" | "uploaded" | "error";
  fileUrl?: string;
  fileKey?: string;
  error?: string;
}

interface ShredResult {
  id: string;
  xmlContent: string;
  sectionCount?: number;
  requirementCount?: number;
  criteriaCount?: number;
  fileCount?: number;
  files?: Array<{ fileName: string; fileType: string; wordCount: number; extractionMethod?: string }>;
}

const FILE_ROLE_LABELS: Record<FileRole, string> = {
  primary: "Primary RFP",
  addendum: "Addendum",
  exhibit: "Exhibit",
  form: "Form",
  attachment: "Attachment",
};

const FILE_ROLE_COLORS: Record<FileRole, string> = {
  primary: "bg-indigo-100 text-indigo-700 border-indigo-200",
  addendum: "bg-amber-100 text-amber-700 border-amber-200",
  exhibit: "bg-teal-100 text-teal-700 border-teal-200",
  form: "bg-purple-100 text-purple-700 border-purple-200",
  attachment: "bg-slate-100 text-slate-700 border-slate-200",
};

const SUPPORTED_ACCEPT = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "text/xml": [".xml"],
  "application/xml": [".xml"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (ext === "docx" || ext === "doc") return <FileText className="h-4 w-4 text-blue-500" />;
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (ext === "xml") return <FileCode className="h-4 w-4 text-violet-500" />;
  if (["png", "jpg", "jpeg", "webp"].includes(ext ?? "")) return <Image className="h-4 w-4 text-pink-500" />;
  return <FileType2 className="h-4 w-4 text-slate-500" />;
}

function getFileTypeLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const labels: Record<string, string> = {
    pdf: "PDF", docx: "Word", doc: "Word", xlsx: "Excel", xls: "Excel",
    csv: "CSV", txt: "Text", xml: "XML", png: "Image", jpg: "Image",
    jpeg: "Image", webp: "Image",
  };
  return labels[ext ?? ""] ?? "File";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadFile(file: File): Promise<{ fileUrl: string; fileKey: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentShredder() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [packageName, setPackageName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [selectedShredId, setSelectedShredId] = useState<string | null>(null);
  const [shredResult, setShredResult] = useState<ShredResult | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const utils = trpc.useUtils();
  const { pursuitId } = useRfpContext();
  const { data: shreds = [], isLoading: shredsLoading } = trpc.xmlShredder.list.useQuery(
    pursuitId ? { pursuitId } : undefined
  );
  const shredMutation = trpc.xmlShredder.shred.useMutation();
  const shredPackageMutation = trpc.xmlShredder.shredPackage.useMutation();
  const deleteMutation = trpc.xmlShredder.delete.useMutation();

  const { data: selectedShred } = trpc.xmlShredder.getById.useQuery(
    { id: selectedShredId! },
    { enabled: !!selectedShredId }
  );

  // ─── Drop handler ──────────────────────────────────────────────────────────

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: QueuedFile[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      role: "attachment" as FileRole,
      status: "pending" as const,
    }));
    setQueue((prev) => {
      const updated = [...prev, ...newItems];
      // Auto-assign first PDF as primary if none set
      const hasPrimary = updated.some((f) => f.role === "primary");
      if (!hasPrimary) {
        const firstPdf = updated.find((f) => f.file.name.toLowerCase().endsWith(".pdf"));
        if (firstPdf) firstPdf.role = "primary";
      }
      return updated;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_ACCEPT,
    maxFiles: 20,
    disabled: processing,
  });

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const updateRole = (id: string, role: FileRole) => {
    setQueue((prev) => prev.map((f) => f.id === id ? { ...f, role } : f));
  };

  // ─── Process queue ─────────────────────────────────────────────────────────

  const handleShred = async () => {
    if (queue.length === 0) return;
    setProcessing(true);
    setProgress(0);

    try {
      // Step 1: Upload all files
      const uploadedFiles: Array<{
        fileName: string; fileUrl: string; fileKey: string;
        mimeType?: string; fileSize?: number; fileRole: FileRole;
      }> = [];

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        setProgressLabel(`Uploading ${item.file.name} (${i + 1}/${queue.length})...`);
        setProgress(Math.round((i / queue.length) * 40));

        setQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: "uploading" } : f));
        try {
          const { fileUrl, fileKey } = await uploadFile(item.file);
          setQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: "uploaded", fileUrl, fileKey } : f));
          uploadedFiles.push({
            fileName: item.file.name,
            fileUrl,
            fileKey,
            mimeType: item.file.type || undefined,
            fileSize: item.file.size,
            fileRole: item.role,
          });
        } catch (err: any) {
          setQueue((prev) => prev.map((f) => f.id === item.id ? { ...f, status: "error", error: err.message } : f));
          toast.error(`Failed to upload ${item.file.name}: ${err.message}`);
        }
      }

      if (uploadedFiles.length === 0) throw new Error("No files uploaded successfully");

      // Step 2: Shred
      setProgress(50);
      const name = packageName.trim() || (queue.length === 1 ? queue[0].file.name : `RFP Package — ${new Date().toLocaleDateString()}`);

      if (uploadedFiles.length === 1) {
        setProgressLabel(`Shredding ${uploadedFiles[0].fileName}...`);
        const result = await shredMutation.mutateAsync({
          fileName: uploadedFiles[0].fileName,
          fileUrl: uploadedFiles[0].fileUrl,
          fileKey: uploadedFiles[0].fileKey,
          mimeType: uploadedFiles[0].mimeType,
          fileSize: uploadedFiles[0].fileSize,
          ...(pursuitId ? { pursuitId } : {}),
        });
        setProgress(100);
        setShredResult(result);
        setSelectedShredId(result.id);
        toast.success(
          `Shredded! Found ${result.sectionCount ?? 0} sections, ${result.requirementCount ?? 0} requirements, ${result.criteriaCount ?? 0} evaluation criteria.`,
          { duration: 6000 }
        );
      } else {
        setProgressLabel(`Compiling ${uploadedFiles.length} files into XML package...`);
        const result = await shredPackageMutation.mutateAsync({
          packageName: name,
          files: uploadedFiles,
          ...(pursuitId ? { pursuitId } : {}),
        });
        setProgress(100);
        setShredResult(result);
        setSelectedShredId(result.id);
        toast.success(
          `Package shredded! ${result.fileCount} files compiled — ${result.sectionCount ?? 0} sections, ${result.requirementCount ?? 0} requirements.`,
          { duration: 6000 }
        );
      }

      setActiveTab("result");
      utils.xmlShredder.list.invalidate();
      setQueue([]);
      setPackageName("");
    } catch (err: any) {
      toast.error(`Shredding failed: ${err.message}`);
    } finally {
      setProcessing(false);
      setProgress(0);
      setProgressLabel("");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    utils.xmlShredder.list.invalidate();
    if (selectedShredId === id) { setSelectedShredId(null); setShredResult(null); }
    toast.success("Shred deleted");
  };

  const parseMetadata = (metaStr: string | null) => {
    try { return JSON.parse(metaStr ?? "{}"); } catch { return {}; }
  };

  const statusColor = (status: string) => {
    if (status === "complete") return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    if (status === "processing") return "bg-amber-500/10 text-amber-600 border-amber-200";
    if (status === "error") return "bg-red-500/10 text-red-600 border-red-200";
    return "bg-slate-500/10 text-slate-600 border-slate-200";
  };

  const displayShred = shredResult ?? (selectedShred?.xmlContent ? selectedShred : null);

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <RfpContextSelector />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Code2 className="h-6 w-6 text-violet-500" />
              XML Document Shredder
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Karpathy Pattern 1 — Compile any RFP package into structured semantic XML for precise AI context
            </p>
          </div>
        </div>

        {/* Pattern explanation */}
        <Card className="border-violet-200 bg-violet-50/50 dark:bg-violet-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Multi-file support</p>
                  <p className="text-muted-foreground">Upload the full RFP package — main doc, addenda, exhibits, forms, spreadsheets, and images all in one pass.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Smart extraction</p>
                  <p className="text-muted-foreground">Text PDFs → pdf-parse. Scanned PDFs & images → vision LLM. DOCX → mammoth. XLSX/CSV → markdown tables. XML → preserved.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Supported formats</p>
                  <p className="text-muted-foreground">PDF · DOCX · XLSX · CSV · TXT · XML · PNG · JPG · WEBP — up to 20 files per package, 16 MB each.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload + Queue */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="result" disabled={!displayShred}>Result</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 mt-4">
                {/* Drop zone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                      : "border-muted-foreground/25 hover:border-violet-300 hover:bg-violet-50/30"
                  } ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 text-violet-400 mx-auto mb-3" />
                  <p className="font-medium text-foreground">
                    {isDragActive ? "Drop files here" : "Drop RFP files here or click to browse"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF · DOCX · XLSX · CSV · TXT · XML · Images — up to 20 files
                  </p>
                </div>

                {/* File queue */}
                {queue.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4 text-violet-500" />
                          File Queue ({queue.length} file{queue.length !== 1 ? "s" : ""})
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setQueue([])} className="text-xs text-muted-foreground">
                          Clear all
                        </Button>
                      </div>
                      {queue.length > 1 && (
                        <div className="mt-2">
                          <Label className="text-xs text-muted-foreground">Package name (optional)</Label>
                          <Input
                            value={packageName}
                            onChange={(e) => setPackageName(e.target.value)}
                            placeholder="e.g. NJDOT-2024-001 RFP Package"
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {queue.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                          <div className="shrink-0">{getFileIcon(item.file.name)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getFileTypeLabel(item.file.name)} · {formatBytes(item.file.size)}
                            </p>
                          </div>
                          <Select value={item.role} onValueChange={(v) => updateRole(item.id, v as FileRole)}>
                            <SelectTrigger className="h-7 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(FILE_ROLE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className={`text-xs shrink-0 ${FILE_ROLE_COLORS[item.role]}`}>
                            {FILE_ROLE_LABELS[item.role]}
                          </Badge>
                          {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-violet-500 shrink-0" />}
                          {item.status === "uploaded" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                          {item.status === "error" && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                          {item.status === "pending" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFromQueue(item.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Progress */}
                {processing && (
                  <Card className="border-violet-200">
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-violet-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {progressLabel || "Processing..."}
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Large PDFs and scanned documents may take 30–90 seconds. Vision extraction is used for image-based files.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Shred button */}
                <Button
                  onClick={handleShred}
                  disabled={queue.length === 0 || processing}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                  size="lg"
                >
                  {processing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" />
                    {queue.length === 0 ? "Add files to shred" : queue.length === 1 ? `Shred ${queue[0].file.name}` : `Shred Package (${queue.length} files)`}
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="result" className="mt-4">
                {displayShred && (
                  <div className="space-y-4">
                    {/* Stats */}
                    {(() => {
                      const meta = parseMetadata(
                        typeof displayShred === "object" && "metadata" in displayShred
                          ? (displayShred as any).metadata
                          : null
                      );
                      const sc = (displayShred as any).sectionCount ?? meta.sectionCount ?? 0;
                      const rc = (displayShred as any).requirementCount ?? meta.requirementCount ?? 0;
                      const cc = (displayShred as any).criteriaCount ?? meta.criteriaCount ?? 0;
                      const fc = (displayShred as any).fileCount ?? meta.fileCount;
                      const files = (displayShred as any).files ?? meta.files;
                      return (
                        <div className="grid grid-cols-3 gap-3">
                          <Card className="text-center p-3">
                            <p className="text-2xl font-bold text-violet-600">{sc}</p>
                            <p className="text-xs text-muted-foreground">Sections</p>
                          </Card>
                          <Card className="text-center p-3">
                            <p className="text-2xl font-bold text-indigo-600">{rc}</p>
                            <p className="text-xs text-muted-foreground">Requirements</p>
                          </Card>
                          <Card className="text-center p-3">
                            <p className="text-2xl font-bold text-teal-600">{cc}</p>
                            <p className="text-xs text-muted-foreground">Eval Criteria</p>
                          </Card>
                          {fc && (
                            <Card className="col-span-3 p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Files in package ({fc})</p>
                              <div className="flex flex-wrap gap-2">
                                {(files ?? []).map((f: any, i: number) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs bg-muted rounded px-2 py-1">
                                    {getFileIcon(f.fileName)}
                                    <span className="truncate max-w-[120px]">{f.fileName}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground">{f.fileType}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground">{f.wordCount?.toLocaleString()} words</span>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )}
                        </div>
                      );
                    })()}

                    {/* XML viewer */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-violet-500" />
                          Compiled XML
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ScrollArea className="h-96 rounded border bg-slate-950 p-3">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                            {(displayShred as any).xmlContent ?? ""}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: History */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-slate-500" />
                  Shred History
                  {pursuitId && <Badge variant="outline" className="text-xs ml-auto">This RFP</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {shredsLoading ? (
                  <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
                ) : shreds.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No shreds yet</p>
                ) : (
                  <div className="space-y-2">
                    {shreds.map((shred) => {
                      const meta = parseMetadata(shred.metadata);
                      const isSelected = selectedShredId === shred.id;
                      return (
                        <div
                          key={shred.id}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected ? "border-violet-300 bg-violet-50 dark:bg-violet-950/20" : "hover:bg-muted/50"
                          }`}
                          onClick={() => { setSelectedShredId(shred.id); setActiveTab("result"); }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {getFileIcon(shred.fileName ?? "")}
                              <p className="text-xs font-medium truncate">{shred.fileName}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={`text-xs ${statusColor(shred.status ?? "")}`}>
                                {shred.status}
                              </Badge>
                              <Button
                                variant="ghost" size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-red-500"
                                onClick={(e) => { e.stopPropagation(); handleDelete(shred.id); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {shred.status === "complete" && (
                            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span>{meta.sectionCount ?? 0} sections</span>
                              <span>{meta.requirementCount ?? 0} req.</span>
                              {meta.fileCount && <span>{meta.fileCount} files</span>}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {shred.createdAt ? formatDistanceToNow(new Date(shred.createdAt), { addSuffix: true }) : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
