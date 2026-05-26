import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getCompanyBadgeClass, getBadgeColorById, KNOWN_COMPANIES } from "../../../shared/contractNumbers";
import {
  ArrowLeft, Building2, Calendar, DollarSign, FileText, Plus,
  ChevronRight, AlertTriangle, CheckCircle2, Clock, FolderOpen,
  GitBranch, Pencil, Shield, Layers
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Add Child Dialog ─────────────────────────────────────────────────────────

function AddChildDialog({
  parentId, parentNumber, parentLevel, open, onClose, onSuccess,
}: {
  parentId: number; parentNumber: string; parentLevel: number;
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const createChild = trpc.contracts.createChild.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.contractNumber}`);
      onSuccess();
      onClose();
      setTitle(""); setValue(""); setNotes("");
    },
    onError: (e) => toast.error(e.message),
  });
  const childLabel = parentLevel === 1 ? "Task Order" : "Sub-Project";
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {childLabel} to {parentNumber}</DialogTitle>
        </DialogHeader>
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
          <Button
            disabled={!title.trim() || createChild.isPending}
            onClick={() => createChild.mutate({
              parentId, title: title.trim(),
              contractValue: value ? parseFloat(value) : undefined,
              notes: notes || undefined,
            })}
          >
            {createChild.isPending ? "Creating…" : `Add ${childLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Amendment / Change Order Dialog ─────────────────────────────────────

function AddAmendmentDialog({
  contractId, contractNumber, type, open, onClose, onSuccess,
}: {
  contractId: number; contractNumber: string;
  type: "amendment" | "change_order";
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const label = type === "amendment" ? "Amendment" : "Change Order";
  const addAmendment = trpc.contracts.addAmendment.useMutation({
    onSuccess: (data) => {
      toast.success(`${label} ${data.amendmentNumber} added`);
      onSuccess();
      onClose();
      setAmount(""); setDescription("");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {label} to {contractNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Amount (+ add / − deduct) *</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 25000 or -5000" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Scope change description…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!amount || addAmendment.isPending}
            onClick={() => addAmendment.mutate({
              contractId, type,
              amount: parseFloat(amount),
              description: description || undefined,
            })}
          >
            {addAmendment.isPending ? "Saving…" : `Add ${label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Compliance Panel ─────────────────────────────────────────────────────────

function CompliancePanel({ contract, onRefresh }: { contract: any; onRefresh: () => void }) {
  const update = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("Compliance updated"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (field: string, val: boolean) => update.mutate({ id: contract.id, [field]: val } as any);

  const flags = [
    { key: "coiRequired", label: "COI Required", value: contract.coiRequired },
    { key: "coiReceived", label: "COI Received", value: contract.coiReceived },
    { key: "fullyExecutedContractReceived", label: "Fully Executed Contract Received", value: contract.fullyExecutedContractReceived },
    { key: "primeAgreementRequired", label: "Prime Agreement Required", value: contract.primeAgreementRequired },
    { key: "primeAgreementOnFile", label: "Prime Agreement on File", value: contract.primeAgreementOnFile },
    { key: "clientBillingInfoOnFile", label: "Client Billing Info on File", value: contract.clientBillingInfoOnFile },
  ];

  const allGood = flags.every(f => !f.value || (f.key === "coiRequired" ? contract.coiReceived : true));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Compliance Checklist
          {allGood
            ? <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-emerald-300">All Clear</Badge>
            : <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-300">Action Needed</Badge>
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map(f => (
          <div key={f.key} className="flex items-center justify-between">
            <span className="text-sm">{f.label}</span>
            <Switch
              checked={!!f.value}
              onCheckedChange={v => toggle(f.key, v)}
              disabled={update.isPending}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Hierarchy Tree ───────────────────────────────────────────────────────────

function HierarchyNode({
  node, depth = 0, onAddChild, onAddAmendment,
}: {
  node: any; depth?: number;
  onAddChild: (id: number, num: string, level: number) => void;
  onAddAmendment: (id: number, num: string, type: "amendment" | "change_order") => void;
}) {
  const [, navigate] = useLocation();
  const indent = depth * 20;
  const nodeLabel = NODE_LABELS[node.nodeType ?? "contract"] ?? "Contract";
  const canHaveChildren = (node.level ?? 1) < 3;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer group"
        style={{ marginLeft: indent }}
        onClick={() => navigate(`/contracts/${node.id}`)}
      >
        {depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium">{node.contractNumber ?? `#${node.id}`}</span>
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[node.status ?? "draft"]}`}>
              {STATUS_LABELS[node.status ?? "draft"]}
            </Badge>
            <span className="text-xs text-muted-foreground">{nodeLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{node.title}</p>
        </div>
        <span className="text-sm font-medium shrink-0">{formatCurrency(node.computedContractValue)}</span>
        <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {canHaveChildren && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
              onClick={() => onAddChild(node.id, node.contractNumber ?? "", node.level ?? 1)}>
              <Plus className="h-3 w-3 mr-1" />
              {(node.level ?? 1) === 1 ? "Task Order" : "Sub-Project"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => onAddAmendment(node.id, node.contractNumber ?? "", "amendment")}>
            A
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => onAddAmendment(node.id, node.contractNumber ?? "", "change_order")}>
            CO
          </Button>
        </div>
      </div>
      {node.subProjects?.map((sub: any) => (
        <HierarchyNode key={sub.id} node={sub} depth={depth + 1}
          onAddChild={onAddChild} onAddAmendment={onAddAmendment} />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const contractId = parseInt(params.id ?? "0");

  const { data, isLoading, refetch } = trpc.contracts.getWithChildren.useQuery(
    { id: contractId },
    { enabled: !!contractId }
  );

  const updateStatus = trpc.contracts.update.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [addChildTarget, setAddChildTarget] = useState<{ id: number; num: string; level: number } | null>(null);
  const [addAmendTarget, setAddAmendTarget] = useState<{ id: number; num: string; type: "amendment" | "change_order" } | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Contract not found.
        <Button variant="link" onClick={() => navigate("/contracts")}>Back to Contracts</Button>
      </div>
    );
  }

  const { contract, children, amendments } = data;
  const companyName = contract.performingCompanyName ||
    (contract.companyRole === "subconsultant" ? "Strans" : "JPCL");
  const companyInfo = KNOWN_COMPANIES.find(c => c.abbreviation === companyName);
  const badgeColor = companyInfo?.badgeColor ?? "blue";
  const badgeClass = getCompanyBadgeClass(badgeColor);

  const totalAmendments = amendments.filter(a => a.amendmentType === "amendment").reduce((s, a) => s + (a.amount ?? 0), 0);
  const totalChangeOrders = amendments.filter(a => a.amendmentType === "change_order").reduce((s, a) => s + (a.amount ?? 0), 0);
  const nodeLabel = NODE_LABELS[contract.nodeType ?? "contract"] ?? "Contract";

  const STATUS_FLOW: Record<string, string[]> = {
    draft: ["negotiation", "active"],
    negotiation: ["executed", "draft"],
    executed: ["active", "on_hold"],
    active: ["on_hold", "completed", "terminated"],
    on_hold: ["active", "terminated"],
    completed: [],
    terminated: [],
  };
  const nextStatuses = STATUS_FLOW[contract.status ?? "draft"] ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/contracts")} className="mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Contracts
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-2xl font-bold">{contract.contractNumber ?? `Contract #${contract.id}`}</span>
            <Badge variant="outline" className={`text-sm px-2 py-0.5 ${STATUS_COLORS[contract.status ?? "draft"]}`}>
              {STATUS_LABELS[contract.status ?? "draft"]}
            </Badge>
            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${badgeClass}`}>
              {companyInfo?.abbreviation ?? "JPCL"}
            </Badge>
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-300">
              {nodeLabel}
            </Badge>
          </div>
          <h1 className="text-lg font-medium mt-1 text-foreground">{contract.title}</h1>
          <p className="text-sm text-muted-foreground">{contract.clientName ?? "No client"}</p>
        </div>
        {/* Status transition buttons */}
        <div className="flex gap-2 shrink-0">
          {nextStatuses.map(s => (
            <Button key={s} size="sm" variant="outline"
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ id: contract.id, status: s })}>
              → {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Original Value", value: formatCurrency(contract.value), icon: DollarSign, color: "text-blue-600" },
          { label: "Amendments", value: formatCurrency(totalAmendments), icon: FileText, color: totalAmendments > 0 ? "text-emerald-600" : "text-muted-foreground" },
          { label: "Change Orders", value: formatCurrency(totalChangeOrders), icon: Pencil, color: totalChangeOrders > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Total Contract Value", value: formatCurrency(contract.computedContractValue), icon: Layers, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">
            Hierarchy
            {children.length > 0 && <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 rounded-full">{children.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="amendments">
            Amendments & COs
            {amendments.length > 0 && <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 rounded-full">{amendments.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ["Contract Number", contract.contractNumber ?? "—"],
                  ["Project Number", contract.projectNumber ?? "—"],
                  ["Contract Vehicle", contract.contractVehicle ?? "—"],
                  ["Company Role", contract.companyRole ?? "—"],
                  ["Owner / Agency", contract.ownerName ?? "—"],
                  ["Prime Contractor", contract.primeName ?? "—"],
                  ["QB Name", contract.qbName ?? "—"],
                  ["Time Code", contract.timeCode ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Dates & Team</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ["Start Date", formatDate(contract.startDate)],
                  ["End Date", formatDate(contract.endDate)],
                  ["Execution Date", formatDate(contract.executionDate)],
                  ["Project Manager", contract.projectManagerName ?? "—"],
                  ["Accounting Contact", contract.accountingContactName ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {contract.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{contract.notes}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Contract Hierarchy
              </CardTitle>
              {(contract.level ?? 1) < 3 && (
                <Button size="sm" variant="outline"
                  onClick={() => setAddChildTarget({ id: contract.id, num: contract.contractNumber ?? "", level: contract.level ?? 1 })}>
                  <Plus className="h-3 w-3 mr-1" />
                  {(contract.level ?? 1) === 1 ? "Add Task Order" : "Add Sub-Project"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Root node */}
              <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-muted/30 mb-1">
                <GitBranch className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold">{contract.contractNumber ?? `#${contract.id}`}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[contract.status ?? "draft"]}`}>
                      {STATUS_LABELS[contract.status ?? "draft"]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Primary Contract</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contract.title}</p>
                </div>
                <span className="text-sm font-bold shrink-0">{formatCurrency(contract.computedContractValue)}</span>
              </div>

              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No task orders yet. Click "Add Task Order" to create one.</p>
              ) : (
                children.map(child => (
                  <HierarchyNode key={child.id} node={child} depth={1}
                    onAddChild={(id, num, level) => setAddChildTarget({ id, num, level })}
                    onAddAmendment={(id, num, type) => setAddAmendTarget({ id, num, type })}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Amendments & Change Orders Tab */}
        <TabsContent value="amendments" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              onClick={() => setAddAmendTarget({ id: contract.id, num: contract.contractNumber ?? "", type: "amendment" })}>
              <Plus className="h-3 w-3 mr-1" /> Add Amendment
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => setAddAmendTarget({ id: contract.id, num: contract.contractNumber ?? "", type: "change_order" })}>
              <Plus className="h-3 w-3 mr-1" /> Add Change Order
            </Button>
          </div>

          {amendments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No amendments or change orders yet.
              </CardContent>
            </Card>
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
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amendments.map(a => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono font-medium">{a.amendmentNumber}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={a.amendmentType === "amendment"
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"}>
                            {a.amendmentType === "amendment" ? "Amendment" : "Change Order"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDate(a.amendmentDate)}</td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">{a.description ?? "—"}</td>
                        <td className={`p-3 text-right font-medium ${(a.amount ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {(a.amount ?? 0) >= 0 ? "+" : ""}{formatCurrency(a.amount)}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={
                            a.approvalStatus === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                            a.approvalStatus === "rejected" ? "bg-rose-50 text-rose-700 border-rose-300" :
                            "bg-amber-50 text-amber-700 border-amber-300"
                          }>
                            {a.approvalStatus ?? "pending"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-medium">
                      <td colSpan={4} className="p-3 text-right text-muted-foreground">Total Adjustments</td>
                      <td className={`p-3 text-right ${(totalAmendments + totalChangeOrders) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {(totalAmendments + totalChangeOrders) >= 0 ? "+" : ""}{formatCurrency(totalAmendments + totalChangeOrders)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-4">
          <CompliancePanel contract={contract} onRefresh={refetch} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {addChildTarget && (
        <AddChildDialog
          parentId={addChildTarget.id}
          parentNumber={addChildTarget.num}
          parentLevel={addChildTarget.level}
          open={!!addChildTarget}
          onClose={() => setAddChildTarget(null)}
          onSuccess={() => refetch()}
        />
      )}
      {addAmendTarget && (
        <AddAmendmentDialog
          contractId={addAmendTarget.id}
          contractNumber={addAmendTarget.num}
          type={addAmendTarget.type}
          open={!!addAmendTarget}
          onClose={() => setAddAmendTarget(null)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
