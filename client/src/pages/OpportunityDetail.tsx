import { useState } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, DollarSign, Calendar, Target, Users, Trophy,
  MessageSquare, Plus, Trash2, Loader2, CheckCircle2, XCircle, Clock,
  ExternalLink, Edit3, Save, FileText, Zap,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  reviewing: { label: "Reviewing", color: "bg-amber-100 text-amber-700" },
  pursuing: { label: "Pursuing", color: "bg-violet-100 text-violet-700" },
  submitted: { label: "Submitted", color: "bg-cyan-100 text-cyan-700" },
  awarded: { label: "Awarded", color: "bg-emerald-100 text-emerald-700" },
  lost: { label: "Lost", color: "bg-rose-100 text-rose-700" },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-600" },
};

function fmtCurrency(v: number | string | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const oppId = id ?? "";
  const utils = trpc.useUtils();

  const { data: opp, isLoading } = trpc.opportunities.getById.useQuery({ id: oppId }, { enabled: !!oppId });
  const { data: competitors = [] } = trpc.opportunities.listCompetitors.useQuery({ opportunityId: oppId }, { enabled: !!oppId });
  const { data: debrief } = trpc.opportunities.getDebrief.useQuery({ opportunityId: oppId }, { enabled: !!oppId });

  // Competitor dialog
  const [showAddComp, setShowAddComp] = useState(false);
  const [compForm, setCompForm] = useState({ firmName: "", role: "Prime", isWinner: false, winningFee: "", notes: "" });
  const addCompetitor = trpc.opportunities.addCompetitor.useMutation({
    onSuccess: () => { toast.success("Competitor added"); utils.opportunities.listCompetitors.invalidate({ opportunityId: oppId }); setShowAddComp(false); setCompForm({ firmName: "", role: "Prime", isWinner: false, winningFee: "", notes: "" }); },
    onError: e => toast.error(e.message),
  });
  const removeCompetitor = trpc.opportunities.removeCompetitor.useMutation({
    onSuccess: () => { toast.success("Removed"); utils.opportunities.listCompetitors.invalidate({ opportunityId: oppId }); },
    onError: e => toast.error(e.message),
  });

  // Debrief form
  const [debriefForm, setDebriefForm] = useState<any>(null);
  const [editingDebrief, setEditingDebrief] = useState(false);
  const upsertDebrief = trpc.opportunities.upsertDebrief.useMutation({
    onSuccess: () => { toast.success("Debrief saved"); utils.opportunities.getDebrief.invalidate({ opportunityId: oppId }); setEditingDebrief(false); },
    onError: e => toast.error(e.message),
  });

  // Status update
  const updateStatus = trpc.opportunities.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); utils.opportunities.getById.invalidate({ id: oppId }); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return (
    <AppLayout title="Opportunity">
      <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    </AppLayout>
  );

  if (!opp) return (
    <AppLayout title="Opportunity Not Found">
      <div className="p-6 text-center text-muted-foreground">
        <p>Opportunity not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/opportunities")}>Back to Opportunities</Button>
      </div>
    </AppLayout>
  );

  const statusCfg = STATUS_CONFIG[opp.status ?? "new"] ?? STATUS_CONFIG.new;
  const compRows = competitors as any[];
  const winner = compRows.find(c => c.isWinner);

  return (
    <AppLayout title={opp.title}>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5" onClick={() => navigate("/opportunities")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{opp.title}</h1>
              <Badge className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</Badge>
              {opp.aiScore && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1 text-amber-500" />AI Score: {Math.round(Number(opp.aiScore))}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
              {opp.clientName && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{opp.clientName}</span>}
              {opp.estimatedValue && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{fmtCurrency(opp.estimatedValue)}</span>}
              {opp.dueDate && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Due {format(new Date(opp.dueDate), "MMM d, yyyy")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={opp.status ?? "new"} onValueChange={v => updateStatus.mutate({ id: oppId, status: v })}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {opp.sourceUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={opp.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Source
                </a>
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="competitors">
              Competitors
              {compRows.length > 0 && <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5">{compRows.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="debrief">Post-Award Debrief</TabsTrigger>
            <TabsTrigger value="proposal">Proposal Builder</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Opportunity Details</p>
                  <div className="space-y-2 text-sm">
                    {opp.rfpNumber && <div className="flex justify-between"><span className="text-muted-foreground">RFP #</span><span className="font-medium">{opp.rfpNumber}</span></div>}
                    {opp.source && <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{opp.source.replace(/_/g, " ")}</span></div>}
                    {opp.publishedDate && <div className="flex justify-between"><span className="text-muted-foreground">Published</span><span className="font-medium">{format(new Date(opp.publishedDate), "MMM d, yyyy")}</span></div>}
                    {opp.dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-medium">{format(new Date(opp.dueDate), "MMM d, yyyy")}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Go/No-Go</span>
                      <Badge className={cn("text-xs", opp.goNoGoDecision === "go" ? "bg-emerald-100 text-emerald-700" : opp.goNoGoDecision === "no_go" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600")}>
                        {opp.goNoGoDecision === "go" ? "Go" : opp.goNoGoDecision === "no_go" ? "No-Go" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{opp.description || "No description provided."}</p>
                  {opp.aiScoreReason && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" />AI Score Rationale</p>
                      <p className="text-xs text-amber-700">{opp.aiScoreReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Competitors Tab */}
          <TabsContent value="competitors" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Competitor Tracking</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Track known competitors and their roles for this opportunity.</p>
              </div>
              <Button size="sm" onClick={() => setShowAddComp(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Competitor
              </Button>
            </div>
            {winner && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <Trophy className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Winner: {winner.firmName}</p>
                  {winner.winningFee && <p className="text-xs text-emerald-700">Winning fee: {fmtCurrency(winner.winningFee)}</p>}
                </div>
              </div>
            )}
            {compRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No competitors tracked yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {compRows.map((c: any) => (
                  <Card key={c.id} className={cn(c.isWinner && "border-emerald-300 bg-emerald-50/50")}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{c.firmName}</p>
                          {c.isWinner && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0"><Trophy className="h-2.5 w-2.5 mr-0.5" />Winner</Badge>}
                          {c.role && <Badge variant="secondary" className="text-[10px]">{c.role}</Badge>}
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>}
                        {c.winningFee && <p className="text-xs text-muted-foreground">Fee: {fmtCurrency(c.winningFee)}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeCompetitor.mutate({ id: c.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Debrief Tab */}
          <TabsContent value="debrief" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Post-Award Debrief</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Record lessons learned and outcome details after the award decision.</p>
              </div>
              {!editingDebrief && (
                <Button size="sm" variant="outline" onClick={() => { setDebriefForm(debrief ?? {}); setEditingDebrief(true); }}>
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />{debrief ? "Edit Debrief" : "Add Debrief"}
                </Button>
              )}
            </div>
            {editingDebrief && debriefForm !== null ? (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Outcome</Label>
                      <Select value={debriefForm.outcome ?? ""} onValueChange={v => setDebriefForm((f: any) => ({ ...f, outcome: v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="no_bid">No Bid</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Winning Firm</Label>
                      <Input value={debriefForm.winningFirm ?? ""} onChange={e => setDebriefForm((f: any) => ({ ...f, winningFirm: e.target.value }))} placeholder="Firm name" className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Winning Fee ($)</Label>
                      <Input type="number" value={debriefForm.winningFee ?? ""} onChange={e => setDebriefForm((f: any) => ({ ...f, winningFee: parseFloat(e.target.value) || undefined }))} placeholder="0" className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Our Fee ($)</Label>
                      <Input type="number" value={debriefForm.ourFee ?? ""} onChange={e => setDebriefForm((f: any) => ({ ...f, ourFee: parseFloat(e.target.value) || undefined }))} placeholder="0" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Debrief Notes</Label>
                    <Textarea value={debriefForm.debriefNotes ?? ""} onChange={e => setDebriefForm((f: any) => ({ ...f, debriefNotes: e.target.value }))} placeholder="What feedback was received from the agency?" rows={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lessons Learned</Label>
                    <Textarea value={debriefForm.lessonsLearned ?? ""} onChange={e => setDebriefForm((f: any) => ({ ...f, lessonsLearned: e.target.value }))} placeholder="What would we do differently next time?" rows={3} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingDebrief(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => upsertDebrief.mutate({ opportunityId: oppId, ...debriefForm })} disabled={upsertDebrief.isPending}>
                      {upsertDebrief.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}Save Debrief
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : debrief ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Outcome", value: debrief.outcome ? debrief.outcome.replace("_", " ").toUpperCase() : "—", icon: debrief.outcome === "won" ? CheckCircle2 : debrief.outcome === "lost" ? XCircle : Clock },
                    { label: "Winning Firm", value: debrief.winningFirm ?? "—", icon: Building2 },
                    { label: "Winning Fee", value: fmtCurrency(debrief.winningFee), icon: DollarSign },
                    { label: "Our Fee", value: fmtCurrency(debrief.ourFee), icon: Target },
                  ].map(item => (
                    <Card key={item.label}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {debrief.debriefNotes && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Debrief Notes</p>
                      <p className="text-sm text-muted-foreground">{debrief.debriefNotes}</p>
                    </CardContent>
                  </Card>
                )}
                {debrief.lessonsLearned && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lessons Learned</p>
                      <p className="text-sm text-muted-foreground">{debrief.lessonsLearned}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No debrief recorded yet</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setDebriefForm({}); setEditingDebrief(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Debrief
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Proposal Builder Tab */}
          <TabsContent value="proposal" className="mt-4">
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                <p className="text-sm font-medium">Proposal Builder</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Convert this opportunity into a full proposal with cover letter, team roster, project experience, and fee schedule.
                </p>
                <Button size="sm" onClick={() => navigate("/proposals")}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Start Proposal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Competitor Dialog */}
        <Dialog open={showAddComp} onOpenChange={setShowAddComp}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Competitor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Firm Name *</Label>
                <Input value={compForm.firmName} onChange={e => setCompForm(f => ({ ...f, firmName: e.target.value }))} placeholder="e.g., AECOM, Jacobs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={compForm.role} onValueChange={v => setCompForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prime">Prime</SelectItem>
                      <SelectItem value="Sub">Sub</SelectItem>
                      <SelectItem value="JV">JV Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Winning Fee ($)</Label>
                  <Input type="number" value={compForm.winningFee} onChange={e => setCompForm(f => ({ ...f, winningFee: e.target.value }))} placeholder="0" className="h-9" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isWinner" checked={compForm.isWinner} onChange={e => setCompForm(f => ({ ...f, isWinner: e.target.checked }))} className="rounded" />
                <Label htmlFor="isWinner" className="text-xs cursor-pointer">Mark as winner</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any intelligence about their approach or pricing" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddComp(false)}>Cancel</Button>
              <Button onClick={() => addCompetitor.mutate({ opportunityId: oppId, firmName: compForm.firmName, role: compForm.role, isWinner: compForm.isWinner, winningFee: compForm.winningFee ? parseFloat(compForm.winningFee) : undefined, notes: compForm.notes || undefined })} disabled={!compForm.firmName || addCompetitor.isPending}>
                {addCompetitor.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
