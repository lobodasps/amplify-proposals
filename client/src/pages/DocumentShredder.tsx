/**
 * Document Shredder Page — Karpathy Pattern 1
 *
 * Upload any document (RFP PDF, contract, spec) and compile it into
 * structured semantic XML. The XML becomes the authoritative context
 * source for all downstream AI tasks (wiki compilation, proposal writing,
 * contract analysis, compliance scoring).
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
  FileText, Upload, Loader2, CheckCircle2, AlertCircle, Code2,
  BookOpen, Zap, ChevronRight, Trash2, RefreshCw, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShredResult {
  id: number;
  xmlContent: string;
  metadata: string;
  sectionCount: number;
  requirementCount: number;
  criteriaCount: number;
  _provider: string;
  _model: string;
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
  const [uploading, setUploading] = useState(false);
  const [shredding, setShredding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedShredId, setSelectedShredId] = useState<number | null>(null);
  const [shredResult, setShredResult] = useState<ShredResult | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const utils = trpc.useUtils();
  const { data: shreds = [], isLoading: shredsLoading } = trpc.xmlShredder.list.useQuery(undefined);
  const shredMutation = trpc.xmlShredder.shred.useMutation();
  const deleteMutation = trpc.xmlShredder.delete.useMutation();

  // Load a specific shred
  const { data: selectedShred } = trpc.xmlShredder.getById.useQuery(
    { id: selectedShredId! },
    { enabled: !!selectedShredId }
  );

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setShredResult(null);

    try {
      // Step 1: Upload to S3
      toast.info(`Uploading ${file.name}...`);
      const { fileUrl, fileKey } = await uploadFile(file);
      setProgress(30);

      // Step 2: Shred the document
      setShredding(true);
      toast.info("Compiling XML structure — this may take 30-60 seconds for large PDFs...");
      setProgress(50);

      const result = await shredMutation.mutateAsync({
        fileName: file.name,
        fileUrl,
        fileKey,
        mimeType: file.type,
        fileSize: file.size,
      });

      setProgress(100);
      setShredResult(result);
      setSelectedShredId(result.id);
      setActiveTab("result");
      utils.xmlShredder.list.invalidate();

      toast.success(
        `Shredded! Found ${result.sectionCount} sections, ${result.requirementCount} requirements, ${result.criteriaCount} evaluation criteria.`,
        { duration: 6000 }
      );
    } catch (err: any) {
      toast.error(`Shredding failed: ${err.message}`);
    } finally {
      setUploading(false);
      setShredding(false);
      setProgress(0);
    }
  }, [shredMutation, utils]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxFiles: 1,
    disabled: uploading || shredding,
  });

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    utils.xmlShredder.list.invalidate();
    if (selectedShredId === id) {
      setSelectedShredId(null);
      setShredResult(null);
    }
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Code2 className="h-6 w-6 text-violet-500" />
            XML Document Shredder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Karpathy Pattern 1 — Compile any document into structured semantic XML for precise AI context
          </p>
        </div>
      </div>

      {/* Pattern explanation */}
      <Card className="border-violet-200 bg-violet-50/50 dark:bg-violet-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-6 text-sm">
            <div className="flex items-start gap-2 flex-1">
              <Zap className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Why XML instead of raw text?</p>
                <p className="text-muted-foreground">Semantic tags give the LLM navigable structure — it can find requirements, criteria, and dates without guessing.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <BookOpen className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">What happens next?</p>
                <p className="text-muted-foreground">The XML feeds the Wiki Compiler (Pattern 2), which synthesizes a living Markdown wiki used by all proposal AI tasks.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <ChevronRight className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Supported formats</p>
                <p className="text-muted-foreground">PDF (native LLM reading), Word (.docx), plain text, Markdown</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + History */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload Document</CardTitle>
              <CardDescription>Drop an RFP, contract, or specification</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                    : "border-border hover:border-violet-300 hover:bg-muted/30"
                } ${uploading || shredding ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input {...getInputProps()} />
                {uploading || shredding ? (
                  <div className="space-y-3">
                    <Loader2 className="h-8 w-8 mx-auto text-violet-500 animate-spin" />
                    <p className="text-sm font-medium text-foreground">
                      {uploading ? "Uploading..." : "Compiling XML..."}
                    </p>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {shredding ? "Large PDFs may take 30-60 seconds" : ""}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {isDragActive ? "Drop to shred" : "Drop document here"}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shred History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {shredsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : shreds.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No documents shredded yet</div>
              ) : (
                <ScrollArea className="h-64">
                  <div className="divide-y">
                    {shreds.map((shred) => {
                      const meta = parseMetadata(shred.metadata);
                      return (
                        <div
                          key={shred.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedShredId === shred.id ? "bg-violet-50 dark:bg-violet-950/20" : ""
                          }`}
                          onClick={() => {
                            setSelectedShredId(shred.id);
                            setActiveTab("result");
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{shred.fileName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDistanceToNow(new Date(shred.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor(shred.status)}`}>
                                {shred.status}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => { e.stopPropagation(); handleDelete(shred.id); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {shred.status === "complete" && meta.sectionCount && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{meta.sectionCount}§</span>
                              <span className="text-xs text-muted-foreground">{meta.requirementCount}req</span>
                              <span className="text-xs text-muted-foreground">{meta.criteriaCount}crit</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Result */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="upload">Guide</TabsTrigger>
              <TabsTrigger value="result" disabled={!displayShred}>XML Output</TabsTrigger>
              <TabsTrigger value="stats" disabled={!displayShred}>Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How the Shredder Works</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="space-y-3">
                    {[
                      { step: "1", title: "Upload", desc: "Drop your RFP PDF or Word document. It uploads to secure storage." },
                      { step: "2", title: "Compile", desc: "The AI reads the document and compiles it into structured XML with semantic tags: <section>, <requirement>, <evaluation_criterion>, <key_date>, <key_personnel>." },
                      { step: "3", title: "Review", desc: "Inspect the XML output. Every requirement and criterion should be captured." },
                      { step: "4", title: "Build Wiki", desc: "Go to the RFP Wiki page and compile a living Markdown wiki from this XML. The wiki becomes the context source for all proposal AI tasks." },
                      { step: "5", title: "Generate", desc: "Use the wiki context in proposal section generation, resume tailoring, and compliance scoring." },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex gap-3">
                        <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0">
                          {step}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{title}</p>
                          <p>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="result" className="mt-4">
              {displayShred && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Structured XML Output
                        </CardTitle>
                        <CardDescription>
                          {shredResult
                            ? `${shredResult.sectionCount} sections · ${shredResult.requirementCount} requirements · ${shredResult.criteriaCount} evaluation criteria`
                            : "Select a shred from history to view its XML"}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const xml = shredResult?.xmlContent ?? selectedShred?.xmlContent ?? "";
                          navigator.clipboard.writeText(xml);
                          toast.success("XML copied to clipboard");
                        }}
                      >
                        Copy XML
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] rounded-md border bg-slate-950 p-4">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {shredResult?.xmlContent ?? selectedShred?.xmlContent ?? ""}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              {(shredResult ?? selectedShred) && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Sections", value: shredResult?.sectionCount ?? parseMetadata(selectedShred?.metadata ?? null).sectionCount ?? "—", icon: FileText, color: "text-blue-500" },
                    { label: "Requirements", value: shredResult?.requirementCount ?? parseMetadata(selectedShred?.metadata ?? null).requirementCount ?? "—", icon: CheckCircle2, color: "text-emerald-500" },
                    { label: "Eval Criteria", value: shredResult?.criteriaCount ?? parseMetadata(selectedShred?.metadata ?? null).criteriaCount ?? "—", icon: Eye, color: "text-amber-500" },
                    { label: "Provider", value: shredResult?._provider ?? parseMetadata(selectedShred?.metadata ?? null).provider ?? "—", icon: Zap, color: "text-violet-500" },
                    { label: "Model", value: shredResult?._model ?? parseMetadata(selectedShred?.metadata ?? null).model ?? "—", icon: RefreshCw, color: "text-slate-500" },
                    { label: "Status", value: selectedShred?.status ?? "complete", icon: AlertCircle, color: "text-slate-500" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${color}`} />
                          <div>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-lg font-bold text-foreground">{String(value)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
