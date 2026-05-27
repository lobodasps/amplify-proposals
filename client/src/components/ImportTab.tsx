/**
 * ImportTab — Bulk CSV/Excel import for 8 data types.
 * Parses CSV client-side, previews rows, then calls the bulkImport tRPC procedures.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  Building2, Users, FileText, FileSignature, DollarSign,
  Settings2, BookOpen, Zap, Loader2,
} from "lucide-react";

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

// ─── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES: Record<string, { headers: string[]; example: string[] }> = {
  organizations: {
    headers: ["name", "orgType", "address", "city", "state", "zip", "phone", "email", "website", "notes"],
    example: ["NJDOT", "OWNER", "1035 Parkway Ave", "Trenton", "NJ", "08625", "609-555-0100", "info@njdot.nj.gov", "https://njdot.gov", "State DOT"],
  },
  people: {
    headers: ["firstName", "lastName", "role", "organizationName", "email", "phone", "title"],
    example: ["Jane", "Smith", "PM", "JPCL", "jsmith@jpcl.com", "201-555-0100", "Project Manager"],
  },
  contracts: {
    headers: ["title", "contractNumber", "projectNumber", "clientName", "ownerName", "status", "value", "startDate", "endDate", "performingCompanyName", "parentContractNumber", "level", "notes"],
    example: ["Route 9 Bridge Rehab", "C-2024-001", "24-001", "NJDOT", "NJDOT", "active", "250000", "2024-01-15", "2025-06-30", "JPCL", "", "1", ""],
  },
  amendments: {
    headers: ["contractNumber", "amendmentNumber", "amendmentType", "amount", "amountBehavior", "description", "amendmentDate", "approvalStatus"],
    example: ["C-2024-001", "CO-001", "change_order", "15000", "adds_to_value", "Scope addition for drainage", "2024-03-01", "approved"],
  },
  billing: {
    headers: ["contractNumber", "invoiceNumber", "invoiceDate", "amount", "billedAmount", "retainageAmount", "description"],
    example: ["C-2024-001", "INV-2024-001", "2024-02-28", "25000", "25000", "2500", "February 2024 services"],
  },
  serviceTypes: {
    headers: ["name", "code", "description"],
    example: ["Bridge Inspection", "BI", "Routine and in-depth bridge inspection services"],
  },
  glossary: {
    headers: ["term", "definition", "oneLiner", "category"],
    example: ["NTE", "Not-to-Exceed ceiling amount for a contract or task order", "Maximum billable amount", "contract"],
  },
  opportunities: {
    headers: ["title", "rfpNumber", "clientName", "description", "estimatedValue", "dueDate", "status"],
    example: ["Route 35 Corridor Study", "RFP-2024-045", "NJDOT", "Corridor safety and capacity study", "180000", "2024-04-15", "new"],
  },
};

function downloadTemplate(type: string) {
  const tpl = TEMPLATES[type];
  if (!tpl) return;
  const csv = [tpl.headers.join(","), tpl.example.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${type}_import_template.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Import Result Display ────────────────────────────────────────────────────
type ImportResult = { inserted: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

function ResultPanel({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span><strong>{result.inserted}</strong> inserted</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
          <CheckCircle2 className="h-4 w-4" />
          <span><strong>{result.updated}</strong> updated</span>
        </div>
        {result.skipped > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span><strong>{result.skipped}</strong> skipped</span>
          </div>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> {result.errors.length} row error{result.errors.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {result.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">Row {e.row}: {e.message}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single Import Panel ──────────────────────────────────────────────────────
function ImportPanel({
  title, description, icon, templateKey,
  onImport, isPending,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  templateKey: string;
  onImport: (rows: Record<string, string>[]) => void;
  isPending: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error("No data rows found in file");
      else toast.success(`Parsed ${parsed.length} rows from ${file.name}`);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleImport() {
    if (!rows.length) { toast.error("No rows to import"); return; }
    onImport(rows);
  }

  const tpl = TEMPLATES[templateKey];
  const previewRows = rows.slice(0, 5);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">{icon}</div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0" onClick={() => downloadTemplate(templateKey)}>
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Column reference */}
        <div className="flex flex-wrap gap-1">
          {tpl.headers.map(h => (
            <Badge key={h} variant="secondary" className="text-[10px] font-mono px-1.5 py-0">{h}</Badge>
          ))}
        </div>
        {/* File upload area */}
        <div
          className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
          {fileName ? (
            <p className="text-sm font-medium">{fileName}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Click to select CSV file</p>
          )}
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} rows ready</p>
          )}
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        </div>
        {/* Preview table */}
        {previewRows.length > 0 && (
          <div className="rounded-md border border-border/50 overflow-x-auto max-h-40">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  {tpl.headers.map(h => <TableHead key={h} className="py-1 px-2 text-[10px]">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {tpl.headers.map(h => (
                      <TableCell key={h} className="py-1 px-2 max-w-[120px] truncate">{row[h] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 5 && (
              <p className="text-xs text-muted-foreground text-center py-1">… and {rows.length - 5} more rows</p>
            )}
          </div>
        )}
        {/* Import button */}
        <Button
          className="w-full gap-2"
          disabled={!rows.length || isPending}
          onClick={async () => {
            setResult(null);
            onImport(rows);
          }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isPending ? "Importing…" : `Import ${rows.length > 0 ? rows.length + " rows" : ""}`}
        </Button>
        {/* Result panel — populated by parent via callback */}
        {result && <ResultPanel result={result} />}
      </CardContent>
    </Card>
  );
}

// ─── Main ImportTab ───────────────────────────────────────────────────────────
export function ImportTab() {
  const [results, setResults] = useState<Record<string, ImportResult>>({});

  const importOrgs = trpc.bulkImport.importOrganizations.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, organizations: r })); toast.success(`Organizations: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });
  const importPeople = trpc.bulkImport.importPeople.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, people: r })); toast.success(`People: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });
  const importContracts = trpc.bulkImport.importContracts.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, contracts: r })); toast.success(`Contracts: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });
  const importAmendments = trpc.bulkImport.importAmendments.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, amendments: r })); toast.success(`Amendments: ${r.inserted} inserted`); },
    onError: (e) => toast.error(e.message),
  });
  const importBilling = trpc.bulkImport.importBilling.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, billing: r })); toast.success(`Billing: ${r.inserted} inserted, ${r.skipped} skipped (duplicates)`); },
    onError: (e) => toast.error(e.message),
  });
  const importServiceTypes = trpc.bulkImport.importServiceTypes.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, serviceTypes: r })); toast.success(`Service Types: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });
  const importGlossary = trpc.bulkImport.importGlossary.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, glossary: r })); toast.success(`Glossary: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });
  const importOpportunities = trpc.bulkImport.importOpportunities.useMutation({
    onSuccess: (r) => { setResults(p => ({ ...p, opportunities: r })); toast.success(`Opportunities: ${r.inserted} inserted, ${r.updated} updated`); },
    onError: (e) => toast.error(e.message),
  });

  const PANELS = [
    {
      key: "organizations",
      title: "Organizations",
      description: "Import clients, owners, prime contractors, and vendors",
      icon: <Building2 className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importOrgs.mutate({ rows }),
      isPending: importOrgs.isPending,
    },
    {
      key: "people",
      title: "People",
      description: "Import project managers, accountants, and contract admins",
      icon: <Users className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importPeople.mutate({ rows }),
      isPending: importPeople.isPending,
    },
    {
      key: "contracts",
      title: "Contracts",
      description: "Import contracts at any tier level (set level=1/2/3 and parentContractNumber for hierarchy)",
      icon: <FileSignature className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importContracts.mutate({ rows }),
      isPending: importContracts.isPending,
    },
    {
      key: "amendments",
      title: "Amendments & Change Orders",
      description: "Import amendments and change orders linked by contract number",
      icon: <FileText className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importAmendments.mutate({ rows }),
      isPending: importAmendments.isPending,
    },
    {
      key: "billing",
      title: "Billing Entries",
      description: "Import invoice history from QuickBooks or other systems",
      icon: <DollarSign className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importBilling.mutate({ rows }),
      isPending: importBilling.isPending,
    },
    {
      key: "serviceTypes",
      title: "Service Types",
      description: "Import service type lookup values",
      icon: <Settings2 className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importServiceTypes.mutate({ rows }),
      isPending: importServiceTypes.isPending,
    },
    {
      key: "glossary",
      title: "Glossary Terms",
      description: "Import contract and billing glossary definitions",
      icon: <BookOpen className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importGlossary.mutate({ rows }),
      isPending: importGlossary.isPending,
    },
    {
      key: "opportunities",
      title: "Opportunities",
      description: "Import RFP/opportunity records",
      icon: <Zap className="h-4 w-4" />,
      onImport: (rows: Record<string, string>[]) => importOpportunities.mutate({ rows }),
      isPending: importOpportunities.isPending,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Import Guidelines:</strong> Download the template CSV for each type to see the required column names.
          Existing records are matched by name (organizations, people, service types, glossary) or by number (contracts, amendments, billing).
          Matched records are <strong>updated</strong>; unmatched records are <strong>inserted</strong>.
          For contracts, set <code>parentContractNumber</code> and <code>level=2</code> or <code>level=3</code> to build the hierarchy.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PANELS.map(panel => (
          <div key={panel.key}>
            <ImportPanel
              title={panel.title}
              description={panel.description}
              icon={panel.icon}
              templateKey={panel.key}
              onImport={panel.onImport}
              isPending={panel.isPending}
            />
            {results[panel.key] && (
              <div className="mt-2 px-1">
                <ResultPanel result={results[panel.key]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
