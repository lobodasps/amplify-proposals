import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Filter, Target, Calendar, DollarSign, User, Trophy, FileText, AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  identify: "Identify", qualify: "Qualify", pursue: "Pursue",
  submit: "Submitted", award: "Awarded", lost: "Lost", no_go: "No-Go",
};
const STATUS_COLORS: Record<string, string> = {
  identify: "status-identify", qualify: "status-qualify", pursue: "status-pursue",
  submit: "status-submit", award: "status-award", lost: "status-lost", no_go: "status-no-go",
};

// ── Create Pursuit Dialog ─────────────────────────────────────────────────
function CreatePursuitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [rfpNumber, setRfpNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

  const createMutation = trpc.pursuits.create.useMutation({
    onSuccess: () => {
      utils.pursuits.list.invalidate();
      toast.success("Pursuit created successfully");
      setTitle(""); setClientName(""); setRfpNumber(""); setDueDate(""); setEstimatedValue("");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit() {
    if (!title.trim()) { toast.error("Pursuit title is required"); return; }
    createMutation.mutate({
      title: title.trim(),
      clientName: clientName.trim() || undefined,
      rfpNumber: rfpNumber.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amplify-blue" /> New Pursuit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pursuit Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Route 9 Bridge Inspection Services" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client Name</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. NJDOT" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">RFP / Solicitation #</Label>
              <Input value={rfpNumber} onChange={e => setRfpNumber(e.target.value)} placeholder="e.g. RFP-2024-001" className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Proposal Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimated Value ($)</Label>
              <Input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="0.00" className="h-9" />
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
            <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Pursuit will be created in <strong>Identify</strong> stage. Move it through the pipeline as it progresses.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!title.trim() || createMutation.isPending} onClick={handleSubmit}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            {createMutation.isPending ? "Creating..." : "Create Pursuit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Convert to Contract Dialog ─────────────────────────────────────────────────
function ConvertToContractDialog({
  pursuit,
  open,
  onClose,
}: {
  pursuit: any;
  open: boolean;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [contractVehicle, setContractVehicle] = useState("standalone");
  const [companyRole, setCompanyRole] = useState("prime");
  const [projectNumber, setProjectNumber] = useState("");
  const [notes, setNotes] = useState("");
  const utils = trpc.useUtils();

  const convertMutation = trpc.contracts.convertFromPursuit.useMutation({
    onSuccess: (data) => {
      toast.success("Draft contract created successfully!", {
        description: `Contract seeded from "${pursuit.title}". Review and complete the contract details.`,
        action: { label: "View Contracts", onClick: () => navigate("/contracts") },
      });
      utils.contracts.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error("Failed to create contract", { description: err.message });
    },
  });

  const value = pursuit.awardedValue ?? pursuit.estimatedValue;
  const valueFormatted = value ? `$${(value / 1000000).toFixed(2)}M` : "—";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Convert Awarded Pursuit to Contract
          </DialogTitle>
        </DialogHeader>

        {/* Preview card */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
          <div className="font-semibold text-foreground leading-snug">{pursuit.title}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{pursuit.clientName ?? "—"}</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{valueFormatted}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1">
            <Trophy className="w-3.5 h-3.5" /> Status will be preserved as Awarded
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Contract Vehicle</Label>
              <Select value={contractVehicle} onValueChange={setContractVehicle}>
                <SelectTrigger className="mt-1.5 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standalone">Standalone</SelectItem>
                  <SelectItem value="msa">MSA</SelectItem>
                  <SelectItem value="idiq_on_call">IDIQ / On-Call</SelectItem>
                  <SelectItem value="blanket">Blanket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Our Role</Label>
              <Select value={companyRole} onValueChange={setCompanyRole}>
                <SelectTrigger className="mt-1.5 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prime">Prime</SelectItem>
                  <SelectItem value="subconsultant">Subconsultant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Project Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={projectNumber}
              onChange={e => setProjectNumber(e.target.value)}
              placeholder="e.g. 25-440"
              className="mt-1.5 h-9 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Initial contract notes..."
              className="mt-1.5 text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>A <strong>Draft</strong> contract will be created and pre-populated with this pursuit's client, value, and service lines. You can complete all contract details in the Contracts module.</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-amplify-gradient text-white font-semibold gap-2"
            onClick={() => convertMutation.mutate({
              pursuitId: pursuit.id,
              contractVehicle,
              companyRole,
              projectNumber: projectNumber || undefined,
              notes: notes || undefined,
            })}
            disabled={convertMutation.isPending}
          >
            <FileText className="w-4 h-4" />
            {convertMutation.isPending ? "Creating Contract..." : "Create Draft Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Pursuits Page ─────────────────────────────────────────────────────────
export default function Pursuits() {
  const [search, setSearch] = useState("");
  const [convertTarget, setConvertTarget] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openingProposalFor, setOpeningProposalFor] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: dbPursuits, isLoading } = trpc.pursuits.list.useQuery(undefined as any);

  const createProposalMutation = trpc.proposals.create.useMutation();

  async function handleOpenProposal(pursuit: any) {
    setOpeningProposalFor(pursuit.id);
    try {
      // Check if a proposal already exists for this pursuit
      const existing = await utils.proposals.getByPursuitId.fetch({ pursuitId: pursuit.id });
      if (existing?.id) {
        navigate(`/proposals/${existing.id}`);
        return;
      }
      // No proposal yet — create one now
      const result = await createProposalMutation.mutateAsync({
        pursuitId: pursuit.id,
        title: pursuit.title,
        clientName: pursuit.clientName ?? undefined,
        rfpNumber: pursuit.rfpNumber ?? undefined,
      });
      if (result.proposalId) {
        navigate(`/proposals/${result.proposalId}`);
      } else {
        toast.error("Could not create proposal — please try again");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to open proposal");
    } finally {
      setOpeningProposalFor(null);
    }
  }

  const pursuits = dbPursuits && dbPursuits.length > 0 ? dbPursuits : [];

  const filtered = pursuits.filter((p: any) =>
    !search ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const safeServiceLines = (p: any): string[] => {
    try {
      const sl = p.serviceLines;
      if (!sl) return [];
      if (Array.isArray(sl)) return sl;
      if (typeof sl === "string") return JSON.parse(sl);
      return [];
    } catch { return []; }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Pursuits</h1>
            <p className="text-muted-foreground mt-1">Track every pursuit from identification through award</p>
          </div>
          <Button className="bg-amplify-gradient text-white font-semibold gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New Pursuit
          </Button>
        </div>

        <div className="flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pursuits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No pursuits found</p>
            <p className="text-sm mt-1">Add your first pursuit to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p: any) => {
              const isAwarded = p.status === "award";
              const serviceLines = safeServiceLines(p);
              const value = p.estimatedValue ? `$${(p.estimatedValue / 1000000).toFixed(1)}M` : "—";
              const due = p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD";

              const isOpening = openingProposalFor === p.id;
              return (
                <Card
                  key={p.id}
                  className={`card-hover border-border/60 cursor-pointer transition-shadow hover:shadow-md ${isAwarded ? "ring-1 ring-emerald-400/40" : ""}`}
                  onClick={() => handleOpenProposal(p)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isAwarded ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-primary/10"}`}>
                        {isAwarded
                          ? <Trophy className="w-5 h-5 text-emerald-600" />
                          : <Target className="w-5 h-5 text-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-foreground text-sm leading-snug">{p.title}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[p.status] ?? "status-identify"}`}>
                              {STATUS_LABELS[p.status] ?? p.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.clientName ?? "—"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {due}</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{value}</span>
                          {serviceLines[0] && (
                            <Badge variant="outline" className="text-xs font-medium">{serviceLines[0]}</Badge>
                          )}
                          {p.probability != null && (
                            <span className="font-semibold text-foreground">P(win): {Math.round(p.probability)}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Convert to Contract button — only shown for Awarded pursuits */}
                        {isAwarded && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConvertTarget(p);
                            }}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Convert to Contract
                          </Button>
                        )}
                        {/* Open Proposal button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs font-semibold"
                          disabled={isOpening}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProposal(p);
                          }}
                        >
                          {isOpening
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                          }
                          {isOpening ? "Opening..." : "Open Proposal"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Pursuit Dialog */}
      <CreatePursuitDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Convert to Contract Dialog */}
      {convertTarget && (
        <ConvertToContractDialog
          pursuit={convertTarget}
          open={!!convertTarget}
          onClose={() => setConvertTarget(null)}
        />
      )}
    </AppLayout>
  );
}
