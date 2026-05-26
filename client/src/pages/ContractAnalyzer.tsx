import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Loader2, AlertCircle, CheckCircle2, ExternalLink, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import AppLayout from "@/components/AppLayout";

function formatDate(v?: Date | string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function RiskBadge({ level }: { level?: string }) {
  const cls = level === "high" || level === "HIGH" ? "bg-red-100 text-red-700 border-red-300" : level === "medium" || level === "MEDIUM" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-emerald-100 text-emerald-700 border-emerald-300";
  return <Badge variant="outline" className={`text-xs ${cls}`}>{level ?? "low"}</Badge>;
}

function AnalysisCard({ analysis, onDelete }: { analysis: any; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();
  let result: any = null;
  try { result = analysis.analysisResult ? (typeof analysis.analysisResult === "string" ? JSON.parse(analysis.analysisResult) : analysis.analysisResult) : null; } catch {}

  const overallRisk = result?.riskFlags?.some((f: any) => (f.severity ?? "").toUpperCase() === "HIGH") ? "high" : result?.riskFlags?.some((f: any) => (f.severity ?? "").toUpperCase() === "MEDIUM") ? "medium" : "low";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{analysis.fileName ?? "Contract Document"}</span>
              {result && <RiskBadge level={overallRisk} />}
              {analysis.status === "processing" && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">Processing…</Badge>}
              {analysis.status === "failed" && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">Failed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Analyzed {formatDate(analysis.analyzedAt ?? analysis.createdAt)}</p>
          </div>
          <div className="flex gap-1">
            {analysis.contractId && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/contracts/${analysis.contractId}`)}><ExternalLink className="h-3 w-3" /></Button>}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
            {result && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(e => !e)}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>}
          </div>
        </div>
      </CardHeader>
      {expanded && result && (
        <CardContent className="space-y-4 pt-0">
          {result.parties && result.parties.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">PARTIES</p>
              <div className="flex flex-wrap gap-2">
                {result.parties.map((p: any, i: number) => <Badge key={i} variant="outline" className="text-xs">{typeof p === "string" ? p : `${p.role}: ${p.name}`}</Badge>)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {result.values?.baseContractValue != null && <div><p className="text-xs text-muted-foreground">Contract Value</p><p className="font-medium font-mono">{formatCurrency(result.values.baseContractValue)}</p></div>}
            {result.dates?.startDate && <div><p className="text-xs text-muted-foreground">Start Date</p><p className="font-medium">{formatDate(result.dates.startDate)}</p></div>}
            {result.dates?.endDate && <div><p className="text-xs text-muted-foreground">End Date</p><p className="font-medium">{formatDate(result.dates.endDate)}</p></div>}
            {result.contractType && <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{result.contractType}</p></div>}
            {result.billingMethod && <div><p className="text-xs text-muted-foreground">Billing Method</p><p className="font-medium">{result.billingMethod}</p></div>}
          </div>
          {result.riskFlags && result.riskFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">RISK FLAGS</p>
              <div className="space-y-1">
                {result.riskFlags.map((flag: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${(flag.severity ?? "").toUpperCase() === "HIGH" ? "text-red-500" : (flag.severity ?? "").toUpperCase() === "MEDIUM" ? "text-amber-500" : "text-blue-500"}`} />
                    <span className="text-muted-foreground">{typeof flag === "string" ? flag : flag.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.keyClauseSummaries && result.keyClauseSummaries.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">KEY CLAUSES</p>
              <div className="space-y-1">
                {result.keyClauseSummaries.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="text-sm"><span className="font-medium">{c.clause}:</span> <span className="text-muted-foreground">{c.summary}</span></div>
                ))}
              </div>
            </div>
          )}
          {result.summary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">SUMMARY</p>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function ContractAnalyzer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: analyses = [], isLoading } = trpc.contractAnalyzer.list.useQuery();
  const analyze = trpc.contractAnalyzer.analyze.useMutation({
    onSuccess: () => { toast.success("Analysis complete"); utils.contractAnalyzer.list.invalidate(); setUploading(false); },
    onError: e => { toast.error(e.message); setUploading(false); },
  });
  const del = trpc.contractAnalyzer.delete.useMutation({ onSuccess: () => { toast.success("Deleted"); utils.contractAnalyzer.list.invalidate(); }, onError: e => toast.error(e.message) });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("File too large (max 16 MB)"); return; }
    setUploading(true);
    // Upload file to storage first, then analyze
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = await res.json();
      analyze.mutate({ fileName: file.name, fileUrl: url, fileKey: key });
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
      setUploading(false);
    }
    e.target.value = "";
  };

  return (
    <AppLayout>
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" />Contract Analyzer</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload contract PDFs to automatically extract key terms, parties, dates, values, and risk flags using AI.</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading || analyze.isPending}>
            {(uploading || analyze.isPending) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload & Analyze
          </Button>
        </div>
      </div>

      <Card className="border-dashed border-2 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => fileInputRef.current?.click()}>
        <CardContent className="py-10 text-center">
          {(uploading || analyze.isPending) ? (
            <div className="space-y-2">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm font-medium">Analyzing contract with AI…</p>
              <p className="text-xs text-muted-foreground">This may take 10–30 seconds</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Drop a contract PDF here or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports PDF, DOC, DOCX — max 16 MB</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Past Analyses <span className="text-xs font-normal text-muted-foreground">({(analyses as any[]).length})</span>
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (analyses as any[]).length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No analyses yet. Upload a contract to get started.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {(analyses as any[]).map((a: any) => (
              <AnalysisCard key={a.id} analysis={a} onDelete={() => del.mutate({ id: a.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
