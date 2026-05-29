import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Download, RefreshCw, Loader2, Info
} from "lucide-react";

interface ParsedRow {
  contractIdentifier: string;
  billedToDate: number;
  retainageAmount?: number;
  lastInvoiceDate?: string;
  rawLine: string;
}

interface MatchResult {
  identifier: string;
  matched: boolean;
  contractId?: string;
  contractNumber?: string;
}

const QB_TEMPLATE_HEADERS = ["Contract Identifier (QB Name or Contract #)", "Billed to Date", "Retainage Amount", "Last Invoice Date (YYYY-MM-DD)"];
const QB_TEMPLATE_ROWS = [
  ["26-001", "125000.00", "6250.00", "2026-04-30"],
  ["City of New York - Engineering Services", "87500.00", "", "2026-03-31"],
];

function downloadTemplate() {
  const lines = [QB_TEMPLATE_HEADERS.join(","), ...QB_TEMPLATE_ROWS.map(r => r.join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "qb-bulk-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));

  // Map column indices
  const findCol = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = header.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const idxIdentifier = findCol("contract_identifier", "qb_name", "contract__", "project_number", "identifier");
  const idxBilled = findCol("billed_to_date", "billed", "amount", "total_billed");
  const idxRetainage = findCol("retainage");
  const idxDate = findCol("last_invoice_date", "invoice_date", "date");

  if (idxIdentifier < 0 || idxBilled < 0) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const identifier = cols[idxIdentifier] ?? "";
    const billedRaw = cols[idxBilled] ?? "0";
    const billed = parseFloat(billedRaw.replace(/[$,]/g, "")) || 0;
    if (!identifier) continue;
    rows.push({
      contractIdentifier: identifier,
      billedToDate: billed,
      retainageAmount: idxRetainage >= 0 && cols[idxRetainage] ? parseFloat(cols[idxRetainage].replace(/[$,]/g, "")) || undefined : undefined,
      lastInvoiceDate: idxDate >= 0 && cols[idxDate] ? cols[idxDate] : undefined,
      rawLine: lines[i],
    });
  }
  return rows;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
}

export default function QbSync() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");

  const bulkImport = trpc.contracts.bulkImportQb.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setStep("done");
      toast.success(`Import complete: ${data.matched} matched, ${data.unmatched} unmatched`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Could not parse CSV. Check that the file has the required columns.");
        return;
      }
      setParsedRows(rows);
      setResults(null);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    bulkImport.mutate({
      asOfDate,
      rows: parsedRows.map(r => ({
        contractIdentifier: r.contractIdentifier,
        billedToDate: r.billedToDate,
        retainageAmount: r.retainageAmount,
        lastInvoiceDate: r.lastInvoiceDate,
      })),
    });
  };

  const reset = () => {
    setParsedRows([]);
    setResults(null);
    setFileName("");
    setStep("idle");
    if (fileRef.current) fileRef.current.value = "";
  };

  const matchedCount = results?.filter(r => r.matched).length ?? 0;
  const unmatchedCount = results?.filter(r => !r.matched).length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            QuickBooks Bulk Sync
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload a CSV export from QuickBooks to update Billed to Date across all contracts at once.
            Rows are matched by <strong>QB Name</strong> or <strong>Contract #</strong>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />Download Template
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-sm">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>How matching works:</strong> Each row in your CSV must have a "Contract Identifier" column containing either the exact QB Name or Contract # of the contract in Amplify. The match is case-insensitive. Unmatched rows are flagged but do not cause the import to fail.
        </div>
      </div>

      {step === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>As-Of Date</Label>
              <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="max-w-xs mt-1" />
              <p className="text-xs text-muted-foreground mt-1">The date the billed amounts are current as of. Used as Last Invoice Date when not provided in the CSV.</p>
            </div>
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Drop your CSV here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports .csv files. Required columns: Contract Identifier, Billed to Date</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Step 2 — Review &amp; Confirm ({parsedRows.length} rows from <em>{fileName}</em>)</span>
              <Button variant="ghost" size="sm" onClick={reset}>Start Over</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>As-Of Date</Label>
              <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="max-w-xs mt-1" />
            </div>
            <div className="rounded-md border overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">Contract Identifier</th>
                    <th className="text-right px-3 py-2 font-medium">Billed to Date</th>
                    <th className="text-right px-3 py-2 font-medium">Retainage</th>
                    <th className="text-left px-3 py-2 font-medium">Last Invoice Date</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.contractIdentifier}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.billedToDate)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{row.retainageAmount != null ? formatCurrency(row.retainageAmount) : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.lastInvoiceDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleImport} disabled={bulkImport.isPending}>
                {bulkImport.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : <><RefreshCw className="h-4 w-4 mr-2" />Import &amp; Recalculate All</>}
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <p className="text-xs text-muted-foreground ml-auto">This will update Billed to Date on all matched contracts and recalculate financial KPIs.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{matchedCount}</p>
                    <p className="text-sm text-muted-foreground">Contracts Updated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={unmatchedCount > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <XCircle className={`h-8 w-8 shrink-0 ${unmatchedCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-2xl font-bold ${unmatchedCount > 0 ? "text-amber-600" : ""}`}>{unmatchedCount}</p>
                    <p className="text-sm text-muted-foreground">Unmatched Rows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{results.length}</p>
                    <p className="text-sm text-muted-foreground">Total Rows Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Import Results</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">CSV Identifier</th>
                      <th className="text-left px-3 py-2 font-medium">Matched Contract #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          {r.matched
                            ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">Updated</Badge>
                            : <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">No Match</Badge>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.identifier}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.contractNumber ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {unmatchedCount > 0 && (
                <p className="text-xs text-amber-600 mt-3">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {unmatchedCount} row{unmatchedCount > 1 ? "s" : ""} could not be matched. Check that the QB Name or Contract # in your CSV exactly matches what's in Amplify (case-insensitive).
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>Import Another File</Button>
          </div>
        </div>
      )}
    </div>
  );
}
