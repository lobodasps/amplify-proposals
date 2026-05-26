import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import {
  FileSignature, Search, Plus, DollarSign, AlertCircle,
  Calendar, Building2, Zap, CheckCircle2, Clock, FileText, ExternalLink
} from "lucide-react";

// Supabase company IDs (from your live database)
const SUPABASE_COMPANIES = [
  { id: "fddf0d5c-6199-4986-8e91-cb38d96d16bb", name: "JPCL" },
  { id: "e45a26d6-2e04-4358-9129-959ba4c55c45", name: "Strans" },
];

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closeout: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  complete: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  expired:  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  on_hold:  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", active: "Active", closeout: "Closeout",
  complete: "Complete", expired: "Expired", on_hold: "On Hold",
};

// ── Activate Contract Dialog ───────────────────────────────────────────────────
function ActivateContractDialog({
  contract,
  open,
  onClose,
}: {
  contract: any;
  open: boolean;
  onClose: () => void;
}) {
  const [companyId, setCompanyId] = useState(SUPABASE_COMPANIES[0].id);
  const [billingMethod, setBillingMethod] = useState("hourly");
  const utils = trpc.useUtils();

  const activateMutation = trpc.contracts.activateContract.useMutation({
    onSuccess: (data) => {
      if (data.supabaseError) {
        toast.warning("Contract activated — Supabase sync issue", {
          description: `Contract #${data.contractNumber} is active in Amplify. Supabase project creation failed: ${data.supabaseError}. You can create the project manually in the timekeeping app.`,
          duration: 8000,
        });
      } else {
        toast.success("Contract activated and project created!", {
          description: `Contract ${data.contractNumber} · Project ${data.projectNumber} is now live in both Amplify and your timekeeping app.`,
          duration: 6000,
        });
      }
      utils.contracts.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error("Failed to activate contract", { description: err.message });
    },
  });

  const value = contract.value ?? contract.computedContractValue;
  const valueFormatted = value ? `$${(value / 1000000).toFixed(2)}M` : "—";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            Activate Contract & Create Project
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
          <div className="font-semibold text-foreground leading-snug">{contract.title}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{contract.clientName ?? "—"}</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{valueFormatted}</span>
            {contract.contractNumber && <span className="font-mono text-xs">{contract.contractNumber}</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Performing Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="mt-1.5 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPABASE_COMPANIES.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Which firm will track time against this project?</p>
          </div>

          <div>
            <Label className="text-xs font-medium">Default Billing Method</Label>
            <Select value={billingMethod} onValueChange={setBillingMethod}>
              <SelectTrigger className="mt-1.5 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="unit">Unit Price</SelectItem>
                <SelectItem value="lump_sum">Lump Sum</SelectItem>
                <SelectItem value="cost_plus">Cost Plus</SelectItem>
                <SelectItem value="no_charge">No Charge</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Can be overridden per phase in the timekeeping app.</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              This will: <strong>generate a Contract Number and Project Number</strong>, set the contract to <strong>Active</strong>,
              and create a matching <strong>project record in your timekeeping app</strong> so your team can start logging time immediately.
              Phases, tasks, and billing rules are defined in the timekeeping app.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
            onClick={() => activateMutation.mutate({
              id: contract.id,
              supabaseCompanyId: companyId,
              defaultBillingMethod: billingMethod as any,
            })}
            disabled={activateMutation.isPending}
          >
            <Zap className="w-4 h-4" />
            {activateMutation.isPending ? "Activating..." : "Activate Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Contracts Page ────────────────────────────────────────────────────────
export default function Contracts() {
  const [search, setSearch] = useState("");
  const [activateTarget, setActivateTarget] = useState<any | null>(null);
  const { data: dbContracts, isLoading } = trpc.contracts.list.useQuery();

  const contracts = dbContracts ?? [];

  const filtered = contracts.filter((c: any) =>
    !search ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    (c.clientName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.contractNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const activeContracts = contracts.filter((c: any) => c.status === "active");
  const draftContracts = contracts.filter((c: any) => c.status === "draft");
  const totalActiveValue = activeContracts.reduce((sum: number, c: any) => sum + (c.value ?? 0), 0);

  const formatValue = (v: number) => {
    if (!v) return "—";
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const KPI_CARDS = [
    { label: "Active Contracts", value: String(activeContracts.length), sub: formatValue(totalActiveValue) + " total value", icon: FileSignature, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Draft Contracts", value: String(draftContracts.length), sub: "Pending activation", icon: FileText, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Total Portfolio", value: String(contracts.length), sub: "All contract records", icon: Building2, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { label: "Timekeeping Sync", value: activeContracts.length > 0 ? "Live" : "—", sub: "Supabase connected", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Contract Management</h1>
            <p className="text-muted-foreground mt-1">Manage contracts and sync active projects to your timekeeping app</p>
          </div>
          <Button className="bg-amplify-gradient text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> New Contract
          </Button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map(k => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="text-2xl font-display font-bold text-foreground">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                <div className="text-[10px] text-muted-foreground/70">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contracts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Contract List */}
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileSignature className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No contracts yet</p>
            <p className="text-sm mt-1">Convert an awarded pursuit to create your first contract</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c: any) => {
              const isDraft = c.status === "draft";
              const isActive = c.status === "active";
              const value = formatValue(c.value ?? c.computedContractValue ?? 0);
              const startDate = c.startDate ? new Date(c.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
              const endDate = c.endDate ? new Date(c.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;

              return (
                <Card key={c.id} className={`border-border/60 transition-all ${isDraft ? "ring-1 ring-amber-300/50" : ""} ${isActive ? "ring-1 ring-emerald-400/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-emerald-100 dark:bg-emerald-900/40" : isDraft ? "bg-amber-100 dark:bg-amber-900/40" : "bg-primary/10"}`}>
                        <FileSignature className={`w-5 h-5 ${isActive ? "text-emerald-600" : isDraft ? "text-amber-600" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h3 className="font-semibold text-foreground text-sm leading-snug">{c.title}</h3>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLES[c.status] ?? STATUS_STYLES.draft}`}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {c.clientName && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.clientName}</span>}
                          {c.contractNumber && <span className="font-mono font-medium text-foreground">{c.contractNumber}</span>}
                          {c.projectNumber && <span className="font-mono text-xs">Proj: {c.projectNumber}</span>}
                          {value !== "—" && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{value}</span>}
                          {startDate && endDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{startDate} – {endDate}</span>}
                          {c.contractVehicle && <Badge variant="outline" className="text-xs">{c.contractVehicle}</Badge>}
                          {c.companyRole && <Badge variant="outline" className="text-xs capitalize">{c.companyRole}</Badge>}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isDraft && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs"
                            onClick={() => setActivateTarget(c)}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Activate
                          </Button>
                        )}
                        {isActive && c.projectNumber && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>In Timekeeping</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Activate Contract Dialog */}
      {activateTarget && (
        <ActivateContractDialog
          contract={activateTarget}
          open={!!activateTarget}
          onClose={() => setActivateTarget(null)}
        />
      )}
    </AppLayout>
  );
}
