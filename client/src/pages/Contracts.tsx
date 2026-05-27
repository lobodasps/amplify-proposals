import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, AlertTriangle, Clock, Search, Download,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, ChevronDown,
  FileText, Plus, Building2, Zap, CheckCircle2, RefreshCw,
  FileSignature, ArrowRight,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getCompanyBadgeClass, getStatusConfig, fmtCurrency, fmtCurrencyCompact } from "@/lib/contractUtils";
import { EntitySwitcher } from "@/components/EntitySwitcher";
import { KNOWN_COMPANIES } from "../../../shared/contractNumbers";

// ─── Types ────────────────────────────────────────────────────────────────────
type SortColumn =
  | "projectNumber" | "title" | "clientName" | "ownerName"
  | "startDate" | "endDate" | "value" | "computedContractValue"
  | "totalBilledAmount" | "status";
type SortDir = "asc" | "desc";

const CONTRACT_STATUSES = [
  "draft", "negotiation", "executed", "active", "on_hold", "completed", "terminated",
];

const SUPABASE_COMPANIES = KNOWN_COMPANIES.map(c => ({ id: c.id, name: c.abbreviation, color: c.badgeColor }));

// ─── CSV Export ───────────────────────────────────────────────────────────────
function downloadCsv(filename: string, rows: any[]) {
  if (!rows.length) { toast.error("No data to export"); return; }
  const headers = [
    "Contract #", "Project #", "Title", "Client", "Owner", "PM",
    "Start Date", "End Date", "Contract Value", "Authorized Value",
    "Billed to Date", "Remaining", "Status", "Company", "Vehicle",
  ];
  const lines = [
    headers.join(","),
    ...rows.map(c => [
      c.contractNumber ?? "",
      c.projectNumber ?? "",
      `"${(c.title ?? "").replace(/"/g, '""')}"`,
      `"${(c.clientName ?? "").replace(/"/g, '""')}"`,
      `"${(c.ownerName ?? "").replace(/"/g, '""')}"`,
      `"${(c.projectManagerName ?? "").replace(/"/g, '""')}"`,
      c.startDate ? format(new Date(c.startDate), "yyyy-MM-dd") : "",
      c.endDate ? format(new Date(c.endDate), "yyyy-MM-dd") : "",
      ((c.value ?? 0) / 100).toFixed(2),
      ((c.computedContractValue ?? c.value ?? 0) / 100).toFixed(2),
      ((c.totalBilledAmount ?? 0) / 100).toFixed(2),
      (((c.computedContractValue ?? c.value ?? 0) - (c.totalBilledAmount ?? 0)) / 100).toFixed(2),
      c.status ?? "",
      c.performingCompanyName ?? "",
      c.contractVehicle ?? "",
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} contracts`);
}

// ─── Create Contract Dialog ──────────────────────────────────────────────────
function CreateContractDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: people } = trpc.people.list.useQuery();
  const { data: orgs } = trpc.organizations.list.useQuery();
  const [title, setTitle] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientOrgId, setClientOrgId] = useState<number | undefined>();
  const [ownerName, setOwnerName] = useState("");
  const [ownerOrgId, setOwnerOrgId] = useState<number | undefined>();
  const [contractValue, setContractValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectManagerId, setProjectManagerId] = useState<number | undefined>();
  const [projectAccountantId, setProjectAccountantId] = useState<number | undefined>();
  const [notes, setNotes] = useState("");
  const [contractVehicle, setContractVehicle] = useState("standalone");
  const [companyRole, setCompanyRole] = useState("prime");

  const createMutation = trpc.contracts.create.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
      toast.success("Contract created successfully");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const pms = (people ?? []).filter((p: any) => p.role === "PM" || p.role === "PRINCIPAL");
  const accountants = (people ?? []).filter((p: any) => p.role === "ACCOUNTANT");

  function handleSubmit() {
    if (!title.trim()) { toast.error("Contract title is required"); return; }
    createMutation.mutate({
      title: title.trim(),
      contractNumber: contractNumber.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientOrgId,
      ownerName: ownerName.trim() || undefined,
      ownerOrgId,
      contractValue: contractValue ? parseFloat(contractValue) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      projectManagerId,
      projectAccountantId,
      notes: notes.trim() || undefined,
      contractVehicle,
      companyRole,
    });
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-500" /> New Contract
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Contract Title <span className="text-destructive">*</span></Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Route 9 Bridge Inspection Services" className="h-9" />
        </div>
        {/* Contract # and Vehicle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Contract Number</Label>
            <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="e.g. JPCL-2024-001" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Contract Vehicle</Label>
            <Select value={contractVehicle} onValueChange={setContractVehicle}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">Standalone</SelectItem>
                <SelectItem value="idiq">IDIQ</SelectItem>
                <SelectItem value="msa">MSA</SelectItem>
                <SelectItem value="on_call">On-Call</SelectItem>
                <SelectItem value="task_order">Task Order</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Client and Owner */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Client</Label>
            <Select
              value={clientOrgId ? String(clientOrgId) : "__manual__"}
              onValueChange={v => {
                if (v === "__manual__") { setClientOrgId(undefined); }
                else {
                  const id = parseInt(v);
                  setClientOrgId(id);
                  const org = (orgs ?? []).find((o: any) => o.id === id);
                  if (org) setClientName(org.name);
                }
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Select or type below" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">— Enter manually —</SelectItem>
                {(orgs ?? []).map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!clientOrgId && (
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" className="h-8 text-xs" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Owner</Label>
            <Select
              value={ownerOrgId ? String(ownerOrgId) : "__manual__"}
              onValueChange={v => {
                if (v === "__manual__") { setOwnerOrgId(undefined); }
                else {
                  const id = parseInt(v);
                  setOwnerOrgId(id);
                  const org = (orgs ?? []).find((o: any) => o.id === id);
                  if (org) setOwnerName(org.name);
                }
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Select or type below" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">— Enter manually —</SelectItem>
                {(orgs ?? []).map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!ownerOrgId && (
              <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner name" className="h-8 text-xs" />
            )}
          </div>
        </div>
        {/* Value and Role */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Contract Value ($)</Label>
            <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0.00" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Company Role</Label>
            <Select value={companyRole} onValueChange={setCompanyRole}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prime">Prime Consultant</SelectItem>
                <SelectItem value="sub">Subconsultant</SelectItem>
                <SelectItem value="joint_venture">Joint Venture</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
          </div>
        </div>
        {/* PM and Accountant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Project Manager</Label>
            <Select value={projectManagerId ? String(projectManagerId) : ""} onValueChange={v => setProjectManagerId(v ? parseInt(v) : undefined)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select PM" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {pms.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Accountant</Label>
            <Select value={projectAccountantId ? String(projectAccountantId) : ""} onValueChange={v => setProjectAccountantId(v ? parseInt(v) : undefined)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select Accountant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {accountants.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} className="text-sm" />
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Contract will be created in <strong>Draft</strong> status. Use the Activate action to assign a contract number and create the timekeeping project.</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!title.trim() || createMutation.isPending} onClick={handleSubmit}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {createMutation.isPending ? "Creating..." : "Create Contract"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Activate Contract Dialog ─────────────────────────────────────────────────
function ActivateContractDialog({ contract, onClose }: { contract: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [companyId, setCompanyId] = useState(SUPABASE_COMPANIES[0]?.id ?? "");
  const [billingMethod, setBillingMethod] = useState<"hourly" | "lump_sum" | "unit" | "cost_plus">("hourly");

  const activate = trpc.contracts.activateContract.useMutation({
    onSuccess: (result) => {
      utils.contracts.list.invalidate();
      if (result.supabaseError) {
        toast.warning(`Contract activated as ${result.contractNumber}. Note: Supabase project creation failed — ${result.supabaseError}. Create the project manually in your timekeeping app.`, { duration: 8000 });
      } else {
        toast.success(`Contract activated! Number: ${result.contractNumber}. Project created in timekeeping system.`);
      }
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const value = contract.value ?? contract.computedContractValue ?? 0;

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" /> Activate Contract
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
          <p className="font-medium">{contract.title}</p>
          <p className="text-muted-foreground text-xs">{contract.clientName} · {fmtCurrencyCompact(value)}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Performing Entity</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select JPCL or Strans" />
            </SelectTrigger>
            <SelectContent>
              {SUPABASE_COMPANIES.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border",
                    c.color === "blue" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"
                  )}>{c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Default Billing Method</Label>
          <Select value={billingMethod} onValueChange={(v) => setBillingMethod(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly / Time & Materials</SelectItem>
              <SelectItem value="lump_sum">Lump Sum</SelectItem>
              <SelectItem value="unit">Unit Price</SelectItem>
              <SelectItem value="cost_plus">Cost Plus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Generates a contract/project number and creates a project record in your Supabase timekeeping database.</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          disabled={!companyId || activate.isPending}
          onClick={() => activate.mutate({ id: contract.id, supabaseCompanyId: companyId, defaultBillingMethod: billingMethod })}
        >
          <Zap className="w-3.5 h-3.5" />
          {activate.isPending ? "Activating..." : "Activate Contract"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────
function SortHeader({ col, label, sortColumn, sortDir, onSort, className }: {
  col: SortColumn; label: string; sortColumn: SortColumn; sortDir: SortDir;
  onSort: (c: SortColumn) => void; className?: string;
}) {
  return (
    <button
      className={cn("flex items-center gap-1 hover:text-foreground transition-colors whitespace-nowrap", className)}
      onClick={() => onSort(col)}
    >
      {label}
      {sortColumn === col
        ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        : <ArrowUpDown className="h-3 w-3 opacity-40" />}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Contracts() {
  const [, navigate] = useLocation();
  const { data: dbContracts, isLoading, refetch } = trpc.contracts.list.useQuery();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterClient, setFilterClient] = useState("ALL");
  const [filterOwner, setFilterOwner] = useState("ALL");
  const [filterPM, setFilterPM] = useState("ALL");
  const [filterAccountant, setFilterAccountant] = useState("ALL");

  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn>("projectNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Hierarchy expansion
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());

  // Activate dialog
  const [activatingContract, setActivatingContract] = useState<any | null>(null);
  // Create contract dialog
  const [createOpen, setCreateOpen] = useState(false);

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(col); setSortDir("asc"); }
  }

  function toggleExpand(id: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allContracts = dbContracts ?? [];

  // Unique filter options
  const uniqueClients = useMemo(() =>
    Array.from(new Set(allContracts.map(c => c.clientName).filter(Boolean))) as string[], [allContracts]);
  const uniqueOwners = useMemo(() =>
    Array.from(new Set(allContracts.map(c => c.ownerName).filter(Boolean))) as string[], [allContracts]);
  const uniquePMs = useMemo(() =>
    Array.from(new Set(allContracts.map(c => (c as any).projectManagerName).filter(Boolean))) as string[], [allContracts]);
  const uniqueAccountants = useMemo(() =>
    Array.from(new Set(allContracts.map(c => (c as any).projectAccountantName).filter(Boolean))) as string[], [allContracts]);

  // Parent → children map
  const childrenByParent = useMemo(() => {
    const map = new Map<number, any[]>();
    allContracts.forEach(c => {
      if (c.parentContractId) {
        const arr = map.get(c.parentContractId) ?? [];
        arr.push(c);
        map.set(c.parentContractId, arr);
      }
    });
    return map;
  }, [allContracts]);

  // Rolled-up financials for parent contracts
  function getRolledUp(contractId: number): { value: number; authorized: number; billed: number } {
    const children = childrenByParent.get(contractId) ?? [];
    if (!children.length) {
      const c = allContracts.find(x => x.id === contractId);
      return {
        value: c?.value ?? 0,
        authorized: c?.computedContractValue ?? c?.value ?? 0,
        billed: c?.totalBilledAmount ?? 0,
      };
    }
    return children.reduce((acc, child) => {
      const sub = getRolledUp(child.id);
      return { value: acc.value + sub.value, authorized: acc.authorized + sub.authorized, billed: acc.billed + sub.billed };
    }, { value: 0, authorized: 0, billed: 0 });
  }

  // Filter top-level contracts
  const filteredTopLevel = useMemo(() => {
    const topLevel = allContracts.filter(c => !c.parentContractId);
    return topLevel.filter(c => {
      const q = searchTerm.toLowerCase();
      if (q && !`${c.contractNumber} ${c.projectNumber} ${c.title} ${c.clientName} ${c.ownerName}`.toLowerCase().includes(q)) return false;
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
      if (filterClient !== "ALL" && c.clientName !== filterClient) return false;
      if (filterOwner !== "ALL" && c.ownerName !== filterOwner) return false;
      if (filterPM !== "ALL" && (c as any).projectManagerName !== filterPM) return false;
      if (filterAccountant !== "ALL" && (c as any).projectAccountantName !== filterAccountant) return false;
      return true;
    });
  }, [allContracts, searchTerm, filterStatus, filterClient, filterOwner, filterPM, filterAccountant]);

  // Sort
  const sortedTopLevel = useMemo(() => {
    return [...filteredTopLevel].sort((a, b) => {
      let av: any, bv: any;
      switch (sortColumn) {
        case "projectNumber": av = a.projectNumber ?? ""; bv = b.projectNumber ?? ""; break;
        case "title": av = a.title ?? ""; bv = b.title ?? ""; break;
        case "clientName": av = a.clientName ?? ""; bv = b.clientName ?? ""; break;
        case "ownerName": av = a.ownerName ?? ""; bv = b.ownerName ?? ""; break;
        case "startDate": av = a.startDate ?? ""; bv = b.startDate ?? ""; break;
        case "endDate": av = a.endDate ?? ""; bv = b.endDate ?? ""; break;
        case "value": av = a.value ?? 0; bv = b.value ?? 0; break;
        case "computedContractValue": av = a.computedContractValue ?? 0; bv = b.computedContractValue ?? 0; break;
        case "totalBilledAmount": av = a.totalBilledAmount ?? 0; bv = b.totalBilledAmount ?? 0; break;
        case "status": av = a.status ?? ""; bv = b.status ?? ""; break;
        default: av = ""; bv = "";
      }
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredTopLevel, sortColumn, sortDir]);

  // Build flat hierarchy rows
  const hierarchyRows = useMemo(() => {
    const rows: { contract: any; depth: number }[] = [];
    sortedTopLevel.forEach(parent => {
      rows.push({ contract: parent, depth: 0 });
      if (expandedParents.has(parent.id)) {
        const children = childrenByParent.get(parent.id) ?? [];
        children.forEach(child => {
          rows.push({ contract: child, depth: 1 });
          if (expandedParents.has(child.id)) {
            const subs = childrenByParent.get(child.id) ?? [];
            subs.forEach(sub => rows.push({ contract: sub, depth: 2 }));
          }
        });
      }
    });
    return rows;
  }, [sortedTopLevel, expandedParents, childrenByParent]);

  // KPI stats
  const stats = useMemo(() => {
    const active = allContracts.filter(c => c.status === "active");
    const draft = allContracts.filter(c => c.status === "draft");
    const totalAuthorized = active.reduce((s, c) => s + (c.computedContractValue ?? c.value ?? 0), 0);
    const totalBilled = active.reduce((s, c) => s + (c.totalBilledAmount ?? 0), 0);
    const now = new Date();
    const in90 = addDays(now, 90);
    const expiring = allContracts.filter(c =>
      c.endDate && new Date(c.endDate) <= in90 && new Date(c.endDate) >= now && c.status === "active"
    );
    const in30 = expiring.filter(c => new Date(c.endDate!) <= addDays(now, 30));
    const in60 = expiring.filter(c => new Date(c.endDate!) > addDays(now, 30) && new Date(c.endDate!) <= addDays(now, 60));
    const in90d = expiring.filter(c => new Date(c.endDate!) > addDays(now, 60));
    const atRisk = allContracts.filter(c => {
      const remaining = (c.computedContractValue ?? c.value ?? 0) - (c.totalBilledAmount ?? 0);
      return remaining < 0 && c.status === "active";
    });
    return { active: active.length, draft: draft.length, totalAuthorized, totalBilled, expiring, in30, in60, in90: in90d, atRisk: atRisk.length };
  }, [allContracts]);

  const hasFilters = searchTerm || filterStatus !== "ALL" || filterClient !== "ALL" || filterOwner !== "ALL" || filterPM !== "ALL" || filterAccountant !== "ALL";

  const sortProps = { sortColumn, sortDir, onSort: toggleSort };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contract Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {allContracts.length} contracts · {stats.active} active · {stats.draft} draft
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EntitySwitcher />
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("contracts.csv", filteredTopLevel)}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Contract
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Authorized</p>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrencyCompact(stats.totalAuthorized)}</p>
                  <p className="text-[10px] text-muted-foreground">Active contracts only</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Billed to Date</p>
                  <p className="text-xl font-bold tabular-nums">{fmtCurrencyCompact(stats.totalBilled)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.totalAuthorized > 0 ? `${((stats.totalBilled / stats.totalAuthorized) * 100).toFixed(0)}% draw-down` : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">At-Risk (Over-Billed)</p>
                  <p className={cn("text-xl font-bold", stats.atRisk > 0 ? "text-destructive" : "")}>{stats.atRisk}</p>
                  <p className="text-[10px] text-muted-foreground">Remaining &lt; $0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expiring (90 days)</p>
                  <p className={cn("text-xl font-bold", stats.expiring.length > 0 ? "text-amber-600" : "")}>{stats.expiring.length}</p>
                  <p className="text-[10px] text-muted-foreground">{stats.in30.length} critical (&lt;30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expiration Alerts */}
        {stats.expiring.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Contract Expiration Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.in30.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <p className="font-semibold text-red-700 dark:text-red-400 text-sm mb-2">Within 30 Days ({stats.in30.length})</p>
                    <ul className="space-y-1 text-xs">
                      {stats.in30.slice(0, 4).map(c => (
                        <li key={c.id}>
                          <span
                            className="hover:underline text-red-600 dark:text-red-400 cursor-pointer"
                            onClick={() => navigate(`/contracts/${c.id}`)}
                          >
                            {c.projectNumber || c.contractNumber} — {c.title}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            ({c.endDate ? format(new Date(c.endDate), "MMM d") : ""})
                          </span>
                        </li>
                      ))}
                      {stats.in30.length > 4 && <li className="text-muted-foreground">+{stats.in30.length - 4} more</li>}
                    </ul>
                  </div>
                )}
                {stats.in60.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-2">31–60 Days ({stats.in60.length})</p>
                    <ul className="space-y-1 text-xs">
                      {stats.in60.slice(0, 4).map(c => (
                        <li key={c.id}>
                          <span className="hover:underline text-amber-600 cursor-pointer" onClick={() => navigate(`/contracts/${c.id}`)}>
                            {c.projectNumber || c.contractNumber} — {c.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stats.in90.length > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <p className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm mb-2">61–90 Days ({stats.in90.length})</p>
                    <ul className="space-y-1 text-xs">
                      {stats.in90.slice(0, 4).map(c => (
                        <li key={c.id}>
                          <span className="hover:underline text-yellow-700 cursor-pointer" onClick={() => navigate(`/contracts/${c.id}`)}>
                            {c.projectNumber || c.contractNumber} — {c.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter & Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by contract #, project #, title, client, or owner..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {CONTRACT_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger><SelectValue placeholder="All Clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Clients</SelectItem>
                  {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterOwner} onValueChange={setFilterOwner}>
                <SelectTrigger><SelectValue placeholder="All Owners" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Owners</SelectItem>
                  {uniqueOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPM} onValueChange={setFilterPM}>
                <SelectTrigger><SelectValue placeholder="All Project Managers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Project Managers</SelectItem>
                  {uniquePMs.map(pm => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAccountant} onValueChange={setFilterAccountant}>
                <SelectTrigger><SelectValue placeholder="All Accountants" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Accountants</SelectItem>
                  {uniqueAccountants.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredTopLevel.length} of {allContracts.filter(c => !c.parentContractId).length} top-level contracts
                </p>
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchTerm(""); setFilterStatus("ALL");
                  setFilterClient("ALL"); setFilterOwner("ALL");
                  setFilterPM("ALL"); setFilterAccountant("ALL");
                }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Contracts</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {hasFilters
                    ? `${filteredTopLevel.length} of ${allContracts.filter(c => !c.parentContractId).length} contracts`
                    : `${allContracts.filter(c => !c.parentContractId).length} total contracts`}
                  {" · Click a row to open contract detail · Click "}
                  <ChevronRight className="inline w-3 h-3" />
                  {" to expand task orders"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allContracts.length === 0 ? (
              <div className="text-center py-16 px-6">
                <FileSignature className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium">No contracts yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Convert an awarded pursuit to create your first contract.</p>
                <Button variant="outline" onClick={() => navigate("/pursuits")}>Go to Pursuits</Button>
              </div>
            ) : filteredTopLevel.length === 0 ? (
              <div className="text-center py-16 px-6">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium">No contracts match your filters</h3>
                <Button variant="outline" onClick={() => {
                  setSearchTerm(""); setFilterStatus("ALL");
                  setFilterClient("ALL"); setFilterOwner("ALL");
                  setFilterPM("ALL"); setFilterAccountant("ALL");
                }}>Clear Filters</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="pl-4 w-[170px] text-xs text-muted-foreground font-medium">
                        <SortHeader col="projectNumber" label="Contract #" {...sortProps} />
                      </TableHead>
                      <TableHead className="min-w-[200px] text-xs text-muted-foreground font-medium">
                        <SortHeader col="title" label="Contract Name" {...sortProps} />
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">
                        <SortHeader col="clientName" label="Client" {...sortProps} />
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">
                        <SortHeader col="ownerName" label="Owner" {...sortProps} />
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">
                        <SortHeader col="startDate" label="Start" {...sortProps} />
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">
                        <SortHeader col="endDate" label="End" {...sortProps} />
                      </TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground font-medium">
                        <SortHeader col="value" label="Contract Value" {...sortProps} className="ml-auto" />
                      </TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground font-medium">
                        <SortHeader col="computedContractValue" label="Authorized" {...sortProps} className="ml-auto" />
                      </TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground font-medium whitespace-nowrap">Remaining</TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground font-medium">
                        <SortHeader col="totalBilledAmount" label="Billed" {...sortProps} className="ml-auto" />
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">
                        <SortHeader col="status" label="Status" {...sortProps} />
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hierarchyRows.map(({ contract: c, depth }) => {
                      const children = childrenByParent.get(c.id) ?? [];
                      const hasChildren = children.length > 0;
                      const isExpanded = expandedParents.has(c.id);
                      const rolled = hasChildren ? getRolledUp(c.id) : null;
                      const authorized = rolled ? rolled.authorized : (c.computedContractValue ?? c.value ?? 0);
                      const billed = rolled ? rolled.billed : (c.totalBilledAmount ?? 0);
                      const remaining = authorized - billed;
                      const statusCfg = getStatusConfig(c.status ?? "draft");
                      const badgeClass = getCompanyBadgeClass(c.performingCompanyName ?? "");
                      const isDraft = c.status === "draft";

                      return (
                        <TableRow
                          key={c.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/30 transition-colors",
                            depth === 1 && "bg-muted/5",
                            depth === 2 && "bg-muted/10",
                          )}
                          onClick={() => navigate(`/contracts/${c.id}`)}
                        >
                          {/* Contract # */}
                          <TableCell className="pl-4 font-mono text-sm whitespace-nowrap">
                            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
                              {hasChildren ? (
                                <button
                                  onClick={(e) => toggleExpand(c.id, e)}
                                  className="p-0.5 rounded hover:bg-muted transition-colors"
                                >
                                  {isExpanded
                                    ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                </button>
                              ) : depth > 0 ? (
                                <span className="text-muted-foreground text-xs w-4">↳</span>
                              ) : null}
                              <div>
                                <div className="font-semibold">{c.projectNumber || c.contractNumber || "—"}</div>
                                {hasChildren && (
                                  <div className="text-[10px] text-muted-foreground">{children.length} task order{children.length !== 1 ? "s" : ""}</div>
                                )}
                              </div>
                            </div>
                            {c.performingCompanyName && (
                              <span className={cn("inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-1 ml-1", badgeClass)}>
                                {c.performingCompanyName}
                              </span>
                            )}
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <div className="font-medium text-sm truncate max-w-[220px]">{c.title}</div>
                            {c.contractVehicle && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">{c.contractVehicle.replace(/_/g, " ")}</div>
                            )}
                          </TableCell>

                          {/* Client */}
                          <TableCell className="text-sm text-muted-foreground">{c.clientName || "—"}</TableCell>

                          {/* Owner */}
                          <TableCell className="text-sm text-muted-foreground">{c.ownerName || "—"}</TableCell>

                          {/* Start */}
                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                            {c.startDate ? format(new Date(c.startDate), "MMM d, yyyy") : "—"}
                          </TableCell>

                          {/* End */}
                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                            {c.endDate ? format(new Date(c.endDate), "MMM d, yyyy") : "—"}
                          </TableCell>

                          {/* Contract Value */}
                          <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                            {fmtCurrency(rolled ? rolled.value : (c.value ?? 0))}
                          </TableCell>

                          {/* Authorized */}
                          <TableCell className="text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
                            {fmtCurrency(authorized)}
                          </TableCell>

                          {/* Remaining */}
                          <TableCell className={cn(
                            "text-right font-mono text-sm tabular-nums whitespace-nowrap",
                            remaining < 0 ? "text-destructive font-semibold" : ""
                          )}>
                            {fmtCurrency(remaining)}
                          </TableCell>

                          {/* Billed */}
                          <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                            {fmtCurrency(billed)}
                          </TableCell>

                          {/* Status */}
                          <TableCell onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={cn("text-xs whitespace-nowrap", statusCfg.color)}>
                                {statusCfg.label}
                              </Badge>
                              {isDraft && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  onClick={(e) => { e.stopPropagation(); setActivatingContract(c); }}
                                >
                                  <Zap className="w-2.5 h-2.5 mr-0.5" /> Activate
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Arrow */}
                          <TableCell>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activate Dialog */}
        {activatingContract && (
          <Dialog open onOpenChange={() => setActivatingContract(null)}>
            <ActivateContractDialog contract={activatingContract} onClose={() => setActivatingContract(null)} />
          </Dialog>
        )}
        {/* Create Contract Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <CreateContractDialog onClose={() => setCreateOpen(false)} />
        </Dialog>
      </div>
    </AppLayout>
  );
}
