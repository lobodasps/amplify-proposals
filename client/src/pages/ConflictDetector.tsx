/**
 * RFP Conflict Detector
 *
 * Two-pass detection: structural pass (programmatic) + AI semantic pass.
 * Detects: date contradictions, value contradictions, scope conflicts,
 * page limit conflicts, evaluation weight conflicts, addendum supersession,
 * broken references, eligibility conflicts.
 */
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { RfpContextSelector, useRfpContext } from "@/components/RfpContextSelector";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2,
  FileText, Zap, Filter, RefreshCw, ChevronDown, ChevronUp,
  Calendar, DollarSign, FileSearch, Scale, Hash, GitMerge,
  Link, Shield,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConflictingFact {
  value: string;
  source: string;
  xmlPath?: string;
  fileRole?: string;
}

interface Conflict {
  id: string;
  conflictType: string;
  severity: string;
  title: string;
  description: string;
  conflictingFacts: ConflictingFact[];
  recommendation: string | null;
  status: string | null;
  resolvedNote: string | null;
  resolvedAt: Date | null;
  detectedAt: Date;
  provider?: string | null;
  model?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    cardClass: "border-l-4 border-l-red-500",
    iconClass: "text-red-500",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    cardClass: "border-l-4 border-l-amber-500",
    iconClass: "text-amber-500",
  },
  info: {
    label: "Info",
    icon: Info,
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    cardClass: "border-l-4 border-l-blue-400",
    iconClass: "text-blue-500",
  },
} as const;

const STATUS_CONFIG = {
  open: { label: "Open", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
  resolved: { label: "Resolved", badgeClass: "bg-green-100 text-green-800 border-green-200" },
  acknowledged: { label: "Acknowledged", badgeClass: "bg-purple-100 text-purple-800 border-purple-200" },
} as const;

const CONFLICT_TYPE_ICONS: Record<string, React.ElementType> = {
  date_contradiction: Calendar,
  value_contradiction: DollarSign,
  scope_contradiction: FileSearch,
  submission_format_conflict: FileText,
  evaluation_weight_conflict: Scale,
  addendum_supersession: GitMerge,
  reference_conflict: Link,
  eligibility_conflict: Shield,
};

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  date_contradiction: "Date Contradiction",
  value_contradiction: "Value Contradiction",
  scope_contradiction: "Scope Contradiction",
  submission_format_conflict: "Format Conflict",
  evaluation_weight_conflict: "Weight Conflict",
  addendum_supersession: "Addendum Supersession",
  reference_conflict: "Broken Reference",
  eligibility_conflict: "Eligibility Conflict",
};

// ─── Conflict Card ────────────────────────────────────────────────────────────

function ConflictCard({
  conflict,
  onResolve,
  onAcknowledge,
}: {
  conflict: Conflict;
  onResolve: (id: string) => void;
  onAcknowledge: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[conflict.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
  const SevIcon = sev.icon;
  const TypeIcon = CONFLICT_TYPE_ICONS[conflict.conflictType] ?? Hash;
  const status = STATUS_CONFIG[conflict.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
  const isResolved = conflict.status === "resolved";
  const isAcknowledged = conflict.status === "acknowledged";

  return (
    <Card className={`${sev.cardClass} ${isResolved ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <SevIcon className={`h-5 w-5 mt-0.5 shrink-0 ${sev.iconClass}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{conflict.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`text-xs border ${sev.badgeClass}`}>{sev.label}</Badge>
                <Badge className={`text-xs border ${status.badgeClass}`}>{status.label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {CONFLICT_TYPE_LABELS[conflict.conflictType] ?? conflict.conflictType}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Detected {new Date(conflict.detectedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground">{conflict.description}</p>

        {/* Conflicting facts side-by-side */}
        {conflict.conflictingFacts?.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Hide" : "Show"} conflicting facts ({conflict.conflictingFacts.length})
            </button>

            {expanded && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {conflict.conflictingFacts.map((fact, i) => (
                  <div key={i} className="bg-muted/50 rounded-md p-3 border">
                    <p className="text-sm font-medium">{fact.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fact.source}</p>
                    {fact.fileRole && (
                      <Badge variant="outline" className="text-xs mt-1">{fact.fileRole}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommendation */}
        {conflict.recommendation && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs font-medium text-blue-800 mb-1">Recommended Action</p>
            <p className="text-sm text-blue-700">{conflict.recommendation}</p>
          </div>
        )}

        {/* Resolved note */}
        {conflict.resolvedNote && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-xs font-medium text-green-800 mb-1">Resolution Note</p>
            <p className="text-sm text-green-700">{conflict.resolvedNote}</p>
          </div>
        )}

        {/* Actions */}
        {!isResolved && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => onResolve(conflict.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Resolve
            </Button>
            {!isAcknowledged && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                onClick={() => onAcknowledge(conflict.id)}
              >
                <Info className="h-3.5 w-3.5 text-purple-600" />
                Acknowledge
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConflictDetector() {
  const { pursuitId } = useRfpContext();
  const [selectedShredId, setSelectedShredId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [resolveDialogId, setResolveDialogId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const utils = trpc.useUtils();

  const { data: shreds = [] } = trpc.xmlShredder.list.useQuery(
    { pursuitId: pursuitId ?? undefined },
    { enabled: true }
  );

  const { data: conflicts = [], isLoading: conflictsLoading, refetch: refetchConflicts } =
    trpc.rfpConflicts.list.useQuery(
      {
        shredId: selectedShredId ?? undefined,
        status: statusFilter as "open" | "resolved" | "acknowledged" | "all",
      },
      { enabled: !!selectedShredId }
    );

  const { data: summary } = trpc.rfpConflicts.summary.useQuery(
    { shredId: selectedShredId! },
    { enabled: !!selectedShredId }
  );

  const detectMutation = trpc.rfpConflicts.detect.useMutation({
    onSuccess: (data) => {
      toast.success(`Detection complete: ${data.conflictsFound} conflict(s) found`);
      refetchConflicts();
      utils.rfpConflicts.summary.invalidate({ shredId: selectedShredId! });
    },
    onError: (err) => toast.error(`Detection failed: ${err.message}`),
  });

  const updateStatusMutation = trpc.rfpConflicts.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetchConflicts();
      utils.rfpConflicts.summary.invalidate({ shredId: selectedShredId! });
      setResolveDialogId(null);
      setResolveNote("");
    },
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  const handleDetect = () => {
    if (!selectedShredId) return;
    detectMutation.mutate({
      shredId: selectedShredId,
      pursuitId: pursuitId ?? undefined,
      replace: true,
    });
  };

  const handleResolve = (id: string) => {
    setResolveDialogId(id);
  };

  const handleAcknowledge = (id: string) => {
    updateStatusMutation.mutate({ id, status: "acknowledged" });
  };

  const confirmResolve = () => {
    if (!resolveDialogId) return;
    updateStatusMutation.mutate({
      id: resolveDialogId,
      status: "resolved",
      resolvedNote: resolveNote.trim() || undefined,
    });
  };

  const completedShreds = shreds.filter((s: any) => s.status === "complete");
  const selectedShred = shreds.find((s: any) => s.id === selectedShredId);

  const filteredConflicts = (conflicts as Conflict[]).filter((c) => {
    if (severityFilter !== "all" && c.severity !== severityFilter) return false;
    return true;
  });

  return (
    <AppLayout title="Conflict Detector">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              RFP Conflict Detector
            </h1>
            <p className="text-muted-foreground mt-1">
              Two-pass detection: structural analysis + AI semantic scan.
              Finds contradictions, date discrepancies, and scope conflicts across all files in the RFP package.
            </p>
          </div>
          <Badge variant="outline" className="text-xs gap-1 shrink-0">
            <Zap className="h-3 w-3" />
            Two-pass AI
          </Badge>
        </div>

        {/* Detection types explanation */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { icon: Calendar, label: "Date Contradictions", desc: "Conflicting deadlines, meeting times" },
                { icon: DollarSign, label: "Value Contradictions", desc: "Conflicting contract values, fees" },
                { icon: FileText, label: "Format Conflicts", desc: "Page limits, font/margin specs" },
                { icon: Scale, label: "Weight Conflicts", desc: "Eval criteria not summing to 100%" },
                { icon: FileSearch, label: "Scope Contradictions", desc: "Conflicting requirements" },
                { icon: GitMerge, label: "Addendum Supersession", desc: "Conflicting addenda" },
                { icon: Link, label: "Broken References", desc: "Missing exhibits or sections" },
                { icon: Shield, label: "Eligibility Conflicts", desc: "Contradictory qualifications" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-2 items-start">
                  <Icon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">{label}</p>
                    <p className="text-amber-700">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <RfpContextSelector />

        {/* Shred selector + Run button */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select RFP Package</CardTitle>
            <CardDescription>
              Select a shredded RFP package to scan for conflicts. The detector works best after extracting the structured index first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedShredId?.toString() ?? ""}
              onValueChange={(v) => setSelectedShredId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a completed shred…" />
              </SelectTrigger>
              <SelectContent>
                {completedShreds.length === 0 ? (
                  <SelectItem value="_none" disabled>No completed shreds found</SelectItem>
                ) : (
                  completedShreds.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.fileName} — {new Date(s.shredAt ?? s.createdAt ?? "").toLocaleDateString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedShred && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{(selectedShred as any).fileName}</span>
                {(selectedShred as any).fileCount && (
                  <Badge variant="outline" className="text-xs">{(selectedShred as any).fileCount} files in package</Badge>
                )}
              </div>
            )}

            {selectedShredId && (
              <Button
                onClick={handleDetect}
                disabled={detectMutation.isPending}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {detectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {detectMutation.isPending ? "Running detection…" : "Run Conflict Detection"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Summary cards */}
        {selectedShredId && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-red-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{summary.warning}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Info className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{summary.info}</p>
                    <p className="text-xs text-muted-foreground">Info</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Hash className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{summary.total}</p>
                    <p className="text-xs text-muted-foreground">Total Open</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters + conflict list */}
        {selectedShredId && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={() => refetchConflicts()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            {/* Conflict list */}
            {conflictsLoading && (
              <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading conflicts…
              </div>
            )}

            {!conflictsLoading && filteredConflicts.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-12 pb-12 text-center">
                  {summary?.total === 0 ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="font-medium">No conflicts detected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Run conflict detection above, or this RFP package has no detectable contradictions.
                      </p>
                    </>
                  ) : (
                    <>
                      <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium">No conflicts match current filters</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try changing the severity or status filter.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {filteredConflicts.length > 0 && (
              <div className="space-y-3">
                {/* Critical first, then warning, then info */}
                {["critical", "warning", "info"].map((sev) => {
                  const group = filteredConflicts.filter((c) => c.severity === sev);
                  if (group.length === 0) return null;
                  return (
                    <div key={sev} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground capitalize font-medium px-2">{sev}</span>
                        <Separator className="flex-1" />
                      </div>
                      {group.map((conflict) => (
                        <ConflictCard
                          key={conflict.id}
                          conflict={conflict}
                          onResolve={handleResolve}
                          onAcknowledge={handleAcknowledge}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!selectedShredId && (
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Select an RFP Package</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Choose a completed shred above and run conflict detection to find contradictions in the RFP package.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialogId} onOpenChange={() => { setResolveDialogId(null); setResolveNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Add an optional note explaining how this conflict was resolved (e.g., "Confirmed with agency via email on 5/26 — Addendum 2 supersedes original deadline").
            </p>
            <Textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Resolution note (optional)…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveDialogId(null); setResolveNote(""); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmResolve}
              disabled={updateStatusMutation.isPending}
              className="gap-2"
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
