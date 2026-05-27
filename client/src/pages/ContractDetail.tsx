import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FinancialSummaryCard } from "@/components/FinancialSummaryCard";
import { ComplianceBar } from "@/components/ComplianceBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getCompanyBadgeClass, KNOWN_COMPANIES } from "../../../shared/contractNumbers";
import AppLayout from "@/components/AppLayout";
import {
  ArrowLeft, Building2, DollarSign, FileText, Plus,
  ChevronRight, GitBranch, Pencil, Shield, ExternalLink,
  Loader2, AlertCircle, RefreshCw, Upload, TrendingUp, TrendingDown
} from "lucide-react";

function formatCurrency(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function formatDate(v?: Date | string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  negotiation: "bg-amber-100 text-amber-700 border-amber-300",
  executed: "bg-blue-100 text-blue-700 border-blue-300",
  active: "bg-emerald-100 text-emerald-700 border-emerald-300",
  on_hold: "bg-orange-100 text-orange-700 border-orange-300",
  completed: "bg-purple-100 text-purple-700 border-purple-300",
  terminated: "bg-rose-100 text-rose-700 border-rose-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", negotiation: "Negotiation", executed: "Executed",
  active: "Active", on_hold: "On Hold", completed: "Completed", terminated: "Terminated",
};

const NODE_LABELS: Record<string, string> = {
  contract: "Primary Contract", task_order: "Task Order", sub_project: "Sub-Project",
};

function getEndDateWarning(endDate: Date | string | null | undefined) {
  if (!endDate) return null;
  const today = new Date();
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Past Due", cls: "bg-red-500 text-white" };
  if (days <= 30) return { label: `${days}d remaining`, cls: "bg-red-500 text-white" };
  if (days <= 60) return { label: `${days}d remaining`, cls: "bg-orange-500 text-white" };
  if (days <= 90) return { label: `${days}d remaining`, cls: "bg-yellow-500 text-black" };
  return null;
}

function AddChildDialog({ parentId, parentNumber, parentLevel, open, onClose, onSuccess }: {
  parentId: number; parentNumber: string; parentLevel: number;
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const createChild = trpc.contracts.createChild.useMutation({
    onSuccess: (data) => { toast.success(`Created ${data.contractNumber}`); onSuccess(); onClose(); setTitle(""); setValue(""); setNotes(""); },
    onError: (e) => toast.error(e.message),
  });
  const childLabel = parentLevel === 1 ? "Task Order" : "Sub-Project";
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add {childLabel} to {parentNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${childLabel} description`} />
          </div>
          <div className="space-y-1">
            <Label>Contract Value</Label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || createChild.isPending}
            onClick={() => createChild.mutate({ parentId, title: title.trim(), contractValue: value ? parseFloat(value) : undefined, notes: notes || undefined })}>
            {createChild.isPending ? "Creating…" : `Add ${childLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAmendmentDialog({ contractId, contractNumber, type, open, onClose, onSuccess }: {
  contractId: number; contractNumber: string; type: "amendment" | "change_order";
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [amountBehavior, setAmountBehavior] = useState<"adds_to_value" | "subtracts_from_value">("adds_to_value");
  const [amountChange, setAmountChange] = useState("");
  const [description, setDescription] = useState("");
  const label = type === "amendment" ? "Amendment" : "Change Order";
  const addAmendment = trpc.contracts.addAmendment.useMutation({
    onSuccess: (data) => { toast.success(`${label} ${data.amendmentNumber} added`); onSuccess(); onClose(); setAmountChange(""); setDescription(""); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add {label} to {contractNumber}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Effect on Contract Value</Label>
            <Select value={amountBehavior} onValueChange={v => setAmountBehavior(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adds_to_value">Add to Value / Ceiling Increase</SelectItem>
                <SelectItem value="subtracts_from_value">Deduct from Value / Ceiling Decrease</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Amount (positive number) *</Label>
            <Input type="number" min="0" value={amountChange} onChange={e => setAmountChange(e.target.value)} placeholder="e.g. 25000" />
            <p className="text-xs text-muted-foreground">
              {amountBehavior === "adds_to_value" ? "Will increase" : "Will decrease"} the contract/ceiling value by this amount.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Scope change description…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!amountChange || parseFloat(amountChange) <= 0 || addAmendment.isPending}
            onClick={() => addAmendment.mutate({ contractId, type, amountBehavior, amountChange: parseFloat(amountChange), description: description || undefined })}>
            {addAmendment.isPending ? "Saving…" : `Add ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QbImportDialog({ contractId, open, onClose, onSuccess }: { contractId: number; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const importMutation = trpc.contracts.importQbCsv.useMutation({
    onSuccess: (result) => { toast.success(`Imported ${result.imported} billing rows`); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1, 6).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
      });
      setPreview(rows);
      setStep("preview");
    };
    reader.readAsText(f);
  };

  const handleImport = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        // Try common QB column name variants
        const amountStr = row["amount"] ?? row["total"] ?? row["invoice amount"] ?? "0";
        const amount = parseFloat(amountStr.replace(/[$,]/g, "")) || 0;
        return {
          invoiceNumber: row["invoice #"] ?? row["invoice number"] ?? row["num"] ?? undefined,
          invoiceDate: row["date"] ?? row["invoice date"] ?? undefined,
          amount,
          description: row["memo"] ?? row["description"] ?? row["item description"] ?? undefined,
          qbInvoiceId: row["invoice #"] ?? row["invoice number"] ?? undefined,
        };
      }).filter(r => r.amount !== 0);
      importMutation.mutate({ contractId, rows });
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Import QuickBooks Billing CSV</DialogTitle></DialogHeader>
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Upload a QuickBooks invoice export CSV. The importer expects columns: <code className="text-xs bg-muted px-1 rounded">Date, Invoice #, Customer, Amount, Memo/Description</code>. Existing billing entries for this contract will be replaced.</p>
            <Input type="file" accept=".csv" onChange={handleFileChange} />
          </div>
        )}
        {step === "preview" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Preview (first 5 rows). Confirm to import all rows and recalculate financials.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border rounded">
                <thead className="bg-muted/50">
                  <tr>{preview[0] && Object.keys(preview[0]).map(h => <th key={h} className="p-2 text-left font-medium border-b">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Object.values(row).map((v: any, j) => <td key={j} className="p-2 text-muted-foreground">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Showing first 5 rows. All rows will be imported on confirm.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : "Confirm Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditContractDialog({ contract, open, onClose, onSuccess }: { contract: any; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: contract.title ?? "",
    clientName: contract.clientName ?? "",
    ownerName: contract.ownerName ?? "",
    contractManagerName: (contract as any).contractManagerName ?? "",
    primaryLocation: contract.primaryLocation ?? "",
    status: contract.status ?? "draft",
    startDate: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : "",
    endDate: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : "",
    qbName: contract.qbName ?? "",
    timeCode: contract.timeCode ?? "",
    notes: contract.notes ?? "",
    hasNteCeiling: contract.hasNteCeiling ?? false,
    nteCeilingAmount: contract.nteCeilingAmount ? String(contract.nteCeilingAmount) : "",
    billingBasis: contract.billingBasis ?? "authorized",
  });
  const update = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("Contract updated"); onSuccess(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Contract</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {([["Title", "title"], ["Client", "clientName"], ["Owner / Agency", "ownerName"], ["Contract Manager", "contractManagerName"], ["Location", "primaryLocation"], ["QB Name", "qbName"], ["Time Code", "timeCode"]] as [string, string][]).map(([label, key]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          {/* NTE / Billing Basis section */}
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NTE &amp; Billing Basis</p>
            <div className="flex items-center gap-3">
              <Switch checked={form.hasNteCeiling} onCheckedChange={v => setForm(f => ({ ...f, hasNteCeiling: v }))} id="nte-toggle" />
              <Label htmlFor="nte-toggle" className="cursor-pointer">This contract has an NTE Ceiling</Label>
            </div>
            {form.hasNteCeiling && (
              <>
                <div>
                  <Label>NTE Ceiling Amount</Label>
                  <Input type="number" min="0" value={form.nteCeilingAmount} onChange={e => setForm(f => ({ ...f, nteCeilingAmount: e.target.value }))} placeholder="e.g. 5000000" />
                </div>
                <div>
                  <Label>Billing Basis</Label>
                  <Select value={form.billingBasis} onValueChange={v => setForm(f => ({ ...f, billingBasis: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="authorized">Task Order Model — work issued via discrete child orders</SelectItem>
                      <SelectItem value="nte_ceiling">On-Call / Direct Bill — no child orders, bill directly against ceiling</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.billingBasis === "nte_ceiling"
                      ? "Available = Ceiling − Billed. No over-budget flag until billed exceeds ceiling."
                      : "Available = Ceiling − Committed (sum of child order values)."}
                  </p>
                </div>
              </>
            )}
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => update.mutate({
            id: contract.id, ...form,
            startDate: form.startDate ? new Date(form.startDate) : undefined,
            endDate: form.endDate ? new Date(form.endDate) : undefined,
            nteCeilingAmount: form.nteCeilingAmount ? parseFloat(form.nteCeilingAmount) : undefined,
          })} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompliancePanel({ contract, onRefresh }: { contract: any; onRefresh: () => void }) {
  const update = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("Compliance updated"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const flags = [
    { key: "coiRequired", label: "COI Required", sub: "Certificate of Insurance required for this contract" },
    { key: "coiReceived", label: "COI Received", sub: "COI has been received and is on file" },
    { key: "fullyExecutedContractReceived", label: "Fully Executed Contract Received", sub: "Signed contract received from client" },
    { key: "primeAgreementRequired", label: "Prime Agreement Required", sub: "Prime consultant agreement required" },
    { key: "primeAgreementOnFile", label: "Prime Agreement On File", sub: "Prime agreement has been executed and filed" },
    { key: "clientBillingInfoOnFile", label: "Client Billing Info On File", sub: "Client billing contact and address confirmed" },
  ];
  const issueCount = (contract.coiRequired && !contract.coiReceived ? 1 : 0) + (contract.primeAgreementRequired && !contract.primeAgreementOnFile ? 1 : 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />Compliance Checklist
          {issueCount === 0
            ? <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-300">All Clear</Badge>
            : <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-300">{issueCount} Action{issueCount > 1 ? "s" : ""} Needed</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map(f => (
          <div key={f.key} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
            <Switch checked={!!contract[f.key]} onCheckedChange={v => update.mutate({ id: contract.id, [f.key]: v } as any)} disabled={update.isPending} className="mt-0.5" />
            <div><p className="text-sm font-medium">{f.label}</p><p className="text-xs text-muted-foreground">{f.sub}</p></div>
          </div>
        ))}
        {contract.coiRequired && (
          <div className="p-3 rounded-lg border">
            <Label className="text-sm font-medium">COI Expiration Date</Label>
            <Input type="date" className="mt-1 max-w-xs" defaultValue={contract.coiExpirationDate ? new Date(contract.coiExpirationDate).toISOString().split("T")[0] : ""}
              onBlur={e => { if (e.target.value) update.mutate({ id: contract.id, coiExpirationDate: new Date(e.target.value) } as any); }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HierarchyNode({ node, depth = 0, onAddChild, onAddAmendment }: {
  node: any; depth?: number;
  onAddChild: (id: number, num: string, level: number) => void;
  onAddAmendment: (id: number, num: string, type: "amendment" | "change_order") => void;
}) {
  const [, navigate] = useLocation();
  const nodeLabel = NODE_LABELS[node.nodeType ?? "contract"] ?? "Contract";
  const canHaveChildren = (node.level ?? 1) < 3;
  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer group" style={{ marginLeft: depth * 20 }} onClick={() => navigate(`/contracts/${node.id}`)}>
        {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium">{node.contractNumber ?? `#${node.id}`}</span>
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[node.status ?? "draft"]}`}>{STATUS_LABELS[node.status ?? "draft"]}</Badge>
            <span className="text-xs text-muted-foreground">{nodeLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{node.title}</p>
        </div>
        <span className="text-sm font-medium shrink-0">{formatCurrency(node.computedContractValue)}</span>
        <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {canHaveChildren && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAddChild(node.id, node.contractNumber ?? "", node.level ?? 1)}>
              <Plus className="h-3 w-3 mr-1" />{(node.level ?? 1) === 1 ? "Task Order" : "Sub-Project"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAddAmendment(node.id, node.contractNumber ?? "", "amendment")}>A</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAddAmendment(node.id, node.contractNumber ?? "", "change_order")}>CO</Button>
        </div>
      </div>
      {node.subProjects?.map((sub: any) => (
        <HierarchyNode key={sub.id} node={sub} depth={depth + 1} onAddChild={onAddChild} onAddAmendment={onAddAmendment} />
      ))}
    </div>
  );
}

export default function ContractDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const contractId = parseInt(params.id ?? "0");

  const { data, isLoading, refetch } = trpc.contracts.getWithChildren.useQuery({ id: contractId }, { enabled: !!contractId });
  const { data: financialsData, refetch: refetchFinancials } = trpc.contracts.getFinancials.useQuery(
    { contractId },
    { enabled: !!contractId }
  );
  const updateStatus = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); refetchFinancials(); },
    onError: (e) => toast.error(e.message),
  });
  const recalculate = trpc.contracts.recalculateFinancials.useMutation({
    onSuccess: () => { toast.success("Financials recalculated"); refetch(); refetchFinancials(); },
    onError: (e) => toast.error(e.message),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [addChildTarget, setAddChildTarget] = useState<{ id: number; num: string; level: number } | null>(null);
  const [addAmendTarget, setAddAmendTarget] = useState<{ id: number; num: string; type: "amendment" | "change_order" } | null>(null);
  const [qbImportOpen, setQbImportOpen] = useState(false);

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Contract not found.</p>
        <Button variant="link" onClick={() => navigate("/contracts")}>Back to Contracts</Button>
      </div>
    );
  }

  const { contract, children, amendments } = data;
  const companyName = contract.performingCompanyName ?? "JPCL";
  const companyInfo = KNOWN_COMPANIES.find(c => c.abbreviation === companyName);
  const badgeColor = companyInfo?.badgeColor ?? "blue";
  const badgeClass = getCompanyBadgeClass(badgeColor);
  const totalAmendments = amendments.filter((a: any) => a.amendmentType === "amendment").reduce((s: number, a: any) => s + (a.amount ?? 0), 0);
  const totalChangeOrders = amendments.filter((a: any) => a.amendmentType === "change_order").reduce((s: number, a: any) => s + (a.amount ?? 0), 0);
  const nodeLabel = NODE_LABELS[contract.nodeType ?? "contract"] ?? "Contract";
  const endWarning = getEndDateWarning(contract.endDate);
  const allocatedToChildren = children.reduce((sum: number, c: any) => sum + (c.value ?? 0), 0);
  // Use server-computed financials when available; fall back to inline for non-NTE
  const financials = financialsData ?? {
    selfContractValue: contract.value ?? 0,
    authorizedValue: contract.computedContractValue ?? contract.value ?? 0,
    allocatedToChildren,
    billedToDate: contract.totalBilledAmount ?? 0,
    remaining: (contract.computedContractValue ?? contract.value ?? 0) - (contract.totalBilledAmount ?? 0),
    descendantCount: children.length,
  };
  // Attach contract dates to financials for burn-rate display
  const financialsWithDates = financialsData
    ? { ...financialsData, contract: { startDate: contract.startDate, endDate: contract.endDate } }
    : financials;
  const STATUS_FLOW: Record<string, string[]> = {
    draft: ["negotiation", "active"], negotiation: ["executed", "draft"], executed: ["active", "on_hold"],
    active: ["on_hold", "completed", "terminated"], on_hold: ["active", "terminated"], completed: [], terminated: [],
  };
  const nextStatuses = STATUS_FLOW[contract.status ?? "draft"] ?? [];

  return (
    <AppLayout>
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/contracts")} className="mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Contracts
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-2xl font-bold">{contract.contractNumber ?? `Contract #${contract.id}`}</span>
            <Badge variant="outline" className={`text-sm px-2 py-0.5 ${STATUS_COLORS[contract.status ?? "draft"]}`}>{STATUS_LABELS[contract.status ?? "draft"]}</Badge>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${badgeClass}`}>{companyInfo?.abbreviation ?? "JPCL"}</Badge>
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-300">{nodeLabel}</Badge>
            {endWarning && <span className={`text-xs font-medium px-2 py-0.5 rounded ${endWarning.cls}`}>{endWarning.label}</span>}
            {(contract as any).supabaseProjectId && <span className="text-xs font-medium px-2 py-0.5 rounded border border-violet-300 text-violet-700 bg-violet-50">In Timekeeping</span>}
          </div>
          <h1 className="text-lg font-medium mt-1 text-foreground">{contract.title}</h1>
          {contract.clientName && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3" /> {contract.clientName}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {nextStatuses.map(s => (
            <Button key={s} size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: contract.id, status: s })}>
              → {STATUS_LABELS[s]}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
        </div>
      </div>

      {/* Financial Summary Card */}
      <FinancialSummaryCard financials={financialsWithDates as any} />

      {/* Compliance Bar */}
      <ComplianceBar contract={contract} />

      {/* Task Order Portfolio (NTE + AUTHORIZED mode with children) */}
      {contract.hasNteCeiling && contract.billingBasis === "authorized" && children.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />Task Order Portfolio
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {children.length} total • {children.filter((c: any) => c.status === "active").length} active • {children.filter((c: any) => c.status === "completed").length} closed
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Contract #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name / Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Order Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Effect on Parent</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Value</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Billed to Date</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child: any) => {
                  const childValue = child.computedContractValue ?? child.value ?? 0;
                  const childBilled = child.totalBilledAmount ?? 0;
                  const childPct = childValue > 0 ? Math.round((childBilled / childValue) * 100) : 0;
                  const isOverBilled = childBilled > childValue;
                  const orderTypeLabel = child.nodeType === "task_order" ? "Task Order"
                    : child.nodeType === "sub_project" ? "Sub-Project"
                    : "Purchase Order";
                  return (
                    <tr key={child.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      onClick={() => navigate(`/contracts/${child.id}`)}
                    >
                      <td className="p-3 font-mono font-medium text-primary">{child.contractNumber ?? `#${child.id}`}</td>
                      <td className="p-3 max-w-xs">
                        <p className="font-medium truncate">{child.title}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300 text-xs">
                          {orderTypeLabel}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs font-medium">
                          Utilizes Contract Value
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[child.status ?? "draft"]}`}>
                          {STATUS_LABELS[child.status ?? "draft"]}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-medium">{formatCurrency(childValue)}</td>
                      <td className={`p-3 text-right font-mono font-medium ${isOverBilled ? "text-rose-600" : ""}`}>
                        {formatCurrency(childBilled)}
                        {isOverBilled && <span className="ml-1 text-xs">⚠️</span>}
                      </td>
                      <td className={`p-3 text-right font-mono text-sm ${isOverBilled ? "text-rose-600" : childPct >= 90 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {childPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy{children.length > 0 && <span className="ml-1 text-xs bg-primary/10 px-1 rounded">{children.length}</span>}</TabsTrigger>
          <TabsTrigger value="amendments">Amendments &amp; COs{amendments.length > 0 && <span className="ml-1 text-xs bg-primary/10 px-1 rounded">{amendments.length}</span>}</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {([["Contract #", contract.contractNumber], ["Project #", contract.projectNumber], ["Client", contract.clientName], ["Owner / Agency", contract.ownerName], ["Contract Manager", (contract as any).contractManagerName], ["Contract Vehicle", contract.contractVehicle?.replace(/_/g, " ")], ["Company Role", contract.companyRole], ["Location", contract.primaryLocation], ["QB Name", contract.qbName], ["Time Code", contract.timeCode]] as [string, string | null | undefined][]).map(([label, value]) => value ? (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right">{value}</span>
                  </div>
                ) : null)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" />Dates &amp; Value</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {([["Start Date", formatDate(contract.startDate)], ["End Date", formatDate(contract.endDate)], ["Initial Value", formatCurrency(contract.value)], ["Authorized Value", formatCurrency(contract.computedContractValue)], ["Total Billed", formatCurrency(contract.totalBilledAmount)], ["Retainage", formatCurrency(contract.retainageAmount)], ["NTE Ceiling", contract.hasNteCeiling ? formatCurrency(contract.nteCeilingAmount) : null], ["Billing Basis", contract.billingBasis?.replace(/_/g, " ")]] as [string, string | null | undefined][]).map(([label, value]) => value && value !== "—" ? (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right font-mono">{value}</span>
                  </div>
                ) : null)}
              </CardContent>
            </Card>
            {contract.notes && (
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />Contract Hierarchy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-primary/5 border border-primary/20 mb-2">
                <GitBranch className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{contract.contractNumber ?? `#${contract.id}`}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[contract.status ?? "draft"]}`}>{STATUS_LABELS[contract.status ?? "draft"]}</Badge>
                    <span className="text-xs text-muted-foreground">{nodeLabel} (current)</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contract.title}</p>
                </div>
                <span className="text-sm font-medium shrink-0">{formatCurrency(contract.computedContractValue)}</span>
              </div>
              {children.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No child contracts yet.</div>
              ) : (
                children.map((child: any) => (
                  <HierarchyNode key={child.id} node={child} depth={1}
                    onAddChild={(id, num, level) => setAddChildTarget({ id, num, level })}
                    onAddAmendment={(id, num, type) => setAddAmendTarget({ id, num, type })} />
                ))
              )}
              {!contract.parentContractId && (
                <Button size="sm" variant="outline" className="mt-3"
                  onClick={() => setAddChildTarget({ id: contract.id, num: contract.contractNumber ?? "", level: contract.level ?? 1 })}>
                  <Plus className="h-3 w-3 mr-1" /> Add Task Order
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amendments" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setAddAmendTarget({ id: contract.id, num: contract.contractNumber ?? "", type: "amendment" })}>
              <Plus className="h-3 w-3 mr-1" /> Add Amendment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddAmendTarget({ id: contract.id, num: contract.contractNumber ?? "", type: "change_order" })}>
              <Plus className="h-3 w-3 mr-1" /> Add Change Order
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setQbImportOpen(true)}>
                <Upload className="h-3 w-3 mr-1" /> Import QB CSV
              </Button>
              <Button size="sm" variant="outline" disabled={recalculate.isPending}
                onClick={() => recalculate.mutate({ contractId })}>
                <RefreshCw className={`h-3 w-3 mr-1 ${recalculate.isPending ? "animate-spin" : ""}`} /> Recalculate
              </Button>
            </div>
          </div>
          {amendments.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No amendments or change orders yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Number</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Effect</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendments.map((a: any) => {
                      const behavior = a.amountBehavior ?? ((a.amount ?? 0) >= 0 ? "adds_to_value" : "subtracts_from_value");
                      const magnitude = a.amountChange ?? Math.abs(a.amount ?? 0);
                      return (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-mono font-medium">{a.amendmentNumber}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={a.amendmentType === "amendment" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-amber-50 text-amber-700 border-amber-300"}>
                              {a.amendmentType === "amendment" ? "Amendment" : "Change Order"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatDate(a.amendmentDate)}</td>
                          <td className="p-3 text-muted-foreground max-w-xs truncate">{a.description ?? "—"}</td>
                          <td className={`p-3 text-right font-medium font-mono ${behavior === "adds_to_value" ? "text-emerald-600" : "text-rose-600"}`}>
                            {behavior === "adds_to_value" ? "+" : "−"}{formatCurrency(magnitude)}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                              behavior === "adds_to_value" ? "text-emerald-700" : "text-rose-700"
                            }`}>
                              {behavior === "adds_to_value"
                                ? <><TrendingUp className="h-3 w-3" /> Increase</>
                                : <><TrendingDown className="h-3 w-3" /> Decrease</>}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={a.approvalStatus === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : a.approvalStatus === "rejected" ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-amber-50 text-amber-700 border-amber-300"}>
                              {a.approvalStatus ?? "pending"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-medium">
                      <td colSpan={4} className="p-3 text-right text-muted-foreground">Net Adjustment</td>
                      <td className={`p-3 text-right font-mono ${
                        (totalAmendments + totalChangeOrders) >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {(totalAmendments + totalChangeOrders) >= 0 ? "+" : ""}{formatCurrency(totalAmendments + totalChangeOrders)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <CompliancePanel contract={contract} onRefresh={refetch} />
        </TabsContent>

        <TabsContent value="analyzer" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Contract Analyzer</CardTitle></CardHeader>
            <CardContent className="py-8 text-center text-muted-foreground">
              <div className="max-w-sm mx-auto space-y-3">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium text-foreground">AI-Powered Contract Analysis</p>
                <p className="text-sm">Upload a contract PDF to extract key terms, parties, dates, values, and risk flags automatically.</p>
                <Button variant="outline" onClick={() => navigate("/contract-analyzer")}>
                  <ExternalLink className="h-4 w-4 mr-2" />Open Contract Analyzer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen && <EditContractDialog contract={contract} open={editOpen} onClose={() => setEditOpen(false)} onSuccess={() => { refetch(); refetchFinancials(); }} />}
      {addChildTarget && <AddChildDialog parentId={addChildTarget.id} parentNumber={addChildTarget.num} parentLevel={addChildTarget.level} open={!!addChildTarget} onClose={() => setAddChildTarget(null)} onSuccess={() => { refetch(); refetchFinancials(); }} />}
      {addAmendTarget && <AddAmendmentDialog contractId={addAmendTarget.id} contractNumber={addAmendTarget.num} type={addAmendTarget.type} open={!!addAmendTarget} onClose={() => setAddAmendTarget(null)} onSuccess={() => { refetch(); refetchFinancials(); }} />}
      {qbImportOpen && <QbImportDialog contractId={contractId} open={qbImportOpen} onClose={() => setQbImportOpen(false)} onSuccess={() => { refetch(); refetchFinancials(); setQbImportOpen(false); }} />}
    </div>
    </AppLayout>
  );
}
