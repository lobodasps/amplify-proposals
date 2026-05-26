import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, Loader2, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";

function formatDate(v?: Date | string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Backend uses UPPERCASE enums: OPEN, RESOLVED, BLOCKER, WARN, INFO
const EXCEPTION_COLORS: Record<string, string> = {
  COI_MISSING: "bg-red-100 text-red-700 border-red-300",
  COI_EXPIRED: "bg-red-100 text-red-700 border-red-300",
  COI_EXPIRING: "bg-orange-100 text-orange-700 border-orange-300",
  EXECUTED_MISSING: "bg-amber-100 text-amber-700 border-amber-300",
  PRIME_AGREEMENT_MISSING: "bg-yellow-100 text-yellow-700 border-yellow-300",
  BILLING_INFO_MISSING: "bg-blue-100 text-blue-700 border-blue-300",
  CONTRACT_EXPIRED: "bg-red-100 text-red-700 border-red-300",
  CONTRACT_EXPIRING: "bg-orange-100 text-orange-700 border-orange-300",
};

const EXCEPTION_LABELS: Record<string, string> = {
  COI_MISSING: "Missing COI",
  COI_EXPIRED: "COI Expired",
  COI_EXPIRING: "COI Expiring Soon",
  EXECUTED_MISSING: "Missing Executed Contract",
  PRIME_AGREEMENT_MISSING: "Missing Prime Agreement",
  BILLING_INFO_MISSING: "Missing Billing Info",
  CONTRACT_EXPIRED: "Contract Expired",
  CONTRACT_EXPIRING: "Contract Expiring Soon",
};

const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER: "bg-red-100 text-red-700 border-red-300",
  WARN: "bg-amber-100 text-amber-700 border-amber-300",
  INFO: "bg-blue-100 text-blue-700 border-blue-300",
};

export default function Compliance() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [typeFilter, setTypeFilter] = useState("all");

  const utils = trpc.useUtils();
  const { data: exceptions = [], isLoading, refetch } = trpc.compliance.listExceptions.useQuery(
    statusFilter === "all" ? {} : { status: statusFilter }
  );
  const { data: summary } = trpc.compliance.summary.useQuery();
  const scan = trpc.compliance.scanContracts.useMutation({
    onSuccess: () => { toast.success("Compliance scan complete"); refetch(); utils.compliance.summary.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const resolve = trpc.compliance.resolveException.useMutation({
    onSuccess: () => { toast.success("Exception resolved"); refetch(); utils.compliance.summary.invalidate(); },
    onError: e => toast.error(e.message),
  });

  const summaryData = summary as any;

  const filtered = (exceptions as any[]).filter(ex => {
    const matchSearch = !search || String(ex.contractId).includes(search) || ex.description?.toLowerCase().includes(search.toLowerCase()) || ex.exceptionType?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || ex.exceptionType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <AppLayout>
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" />Compliance</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and resolve contract compliance exceptions across all active contracts.</p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Run Compliance Scan
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Open Exceptions", value: summaryData.open ?? 0, icon: AlertTriangle, color: "text-amber-600" },
            { label: "Blockers", value: summaryData.blockers ?? 0, icon: AlertTriangle, color: "text-red-600" },
            { label: "Warnings", value: summaryData.warnings ?? 0, icon: AlertTriangle, color: "text-orange-600" },
            { label: "Resolved", value: summaryData.resolved ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
          ].map(card => (
            <Card key={card.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{card.value}</p>
                  </div>
                  <card.icon className={`h-8 w-8 opacity-20 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by contract…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Exception Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(EXCEPTION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Exceptions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Compliance Exceptions
            <span className="text-xs font-normal text-muted-foreground ml-1">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30 text-emerald-500" />
              <p className="font-medium text-foreground">No exceptions found</p>
              <p className="text-sm mt-1">Run a compliance scan to check all active contracts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Contract</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Exception Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Severity</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Detected</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Notes</th>
                    <th className="text-right p-3 font-medium text-muted-foreground w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ex: any) => (
                    <tr key={ex.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <button className="text-left hover:underline" onClick={() => navigate(`/contracts/${ex.contractId}`)}>
                          <div className="font-mono font-medium text-primary">#{ex.contractId}</div>
                        </button>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${EXCEPTION_COLORS[ex.exceptionType] ?? "bg-slate-100 text-slate-700 border-slate-300"}`}>
                          {EXCEPTION_LABELS[ex.exceptionType] ?? ex.exceptionType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[ex.severity ?? "WARN"]}`}>
                          {ex.severity ?? "WARN"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(ex.createdAt)}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={ex.status === "RESOLVED" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300"}>
                          {ex.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{ex.description ?? "—"}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/contracts/${ex.contractId}`)}>
                            <ExternalLink className="h-3 w-3 mr-1" />View
                          </Button>
                          {ex.status === "OPEN" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700" disabled={resolve.isPending}
                              onClick={() => resolve.mutate({ id: ex.id })}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Resolve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  );
}
