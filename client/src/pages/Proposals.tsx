import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import {
  Plus, Search, FileText, Calendar, DollarSign,
  Sparkles, Brain, Clock, CheckCircle2, AlertCircle,
  Upload, Download, Eye, ChevronRight, Building2, Trash2
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_review: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  awarded: "bg-violet-100 text-violet-700 border-violet-200",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  submitted: "Submitted",
  awarded: "Awarded",
  lost: "Lost",
};

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "badge-special-inspections",
  "Construction Management": "badge-construction-management",
  "Traffic Engineering": "badge-traffic-engineering",
  "Landscape / Streetscape": "badge-landscape-streetscape",
  "Environmental": "badge-environmental",
};

// No demo data — all proposals come from the live DB via trpc.proposals.list

function ShredRfpDialog() {
  const [open, setOpen] = useState(false);
  const [rfpText, setRfpText] = useState("");
  const [result, setResult] = useState<any>(null);
  const shredMutation = trpc.proposals.shredRfp.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      toast.success("RFP successfully shredded!");
    },
    onError: () => toast.error("Failed to shred RFP. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-violet-200 text-violet-700 hover:bg-violet-50">
          <Sparkles className="w-4 h-4 mr-2" />
          Shred RFP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI RFP Shredder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Paste RFP Text or Key Requirements</Label>
            <Textarea
              placeholder="Paste the full RFP text, scope of services, or key requirements here..."
              value={rfpText}
              onChange={e => setRfpText(e.target.value)}
              rows={8}
              className="mt-1.5 font-mono text-xs"
            />
          </div>
          <Button
            onClick={() => shredMutation.mutate({ rfpText })}
            disabled={!rfpText.trim() || shredMutation.isPending}
            className="w-full bg-amplify-gradient text-white"
          >
            {shredMutation.isPending ? (
              <><Brain className="w-4 h-4 mr-2 animate-pulse" /> Analyzing RFP...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Shred This RFP</>
            )}
          </Button>
          {result && (
            <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Summary
                </h4>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
              {result.keyRequirements?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Key Requirements</h4>
                  <ul className="space-y-1">
                    {result.keyRequirements.map((req: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-violet-500 mt-0.5 shrink-0">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.evaluationCriteria?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Evaluation Criteria</h4>
                  <div className="space-y-2">
                    {result.evaluationCriteria.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{c.criterion}</span>
                        <Badge variant="outline">{c.weight}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.goNoGoScore !== undefined && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                  <div className="text-2xl font-bold font-display text-foreground">{result.goNoGoScore}/100</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Go/No-Go Score</div>
                    <div className="text-xs text-muted-foreground">{result.recommendation}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateProposalDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [rfpNumber, setRfpNumber] = useState("");
  const utils = trpc.useUtils();
  const createMutation = trpc.proposals.create.useMutation({
    onSuccess: () => {
      toast.success("Proposal created successfully!");
      utils.proposals.list.invalidate();
      onCreated();
      setOpen(false);
      setTitle(""); setClientName(""); setRfpNumber("");
    },
    onError: () => toast.error("Failed to create proposal."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-amplify-gradient text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Proposal Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NJDOT Route 9 Bridge Inspection Services" className="mt-1.5" />
          </div>
          <div>
            <Label>Client / Agency</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. NJDOT, NYC DDC, NJ Transit" className="mt-1.5" />
          </div>
          <div>
            <Label>RFP / RFQ Number</Label>
            <Input value={rfpNumber} onChange={e => setRfpNumber(e.target.value)} placeholder="e.g. NJDOT-2026-SI-0042" className="mt-1.5" />
          </div>
          <Button
            onClick={() => createMutation.mutate({ title, clientName, rfpNumber })}
            disabled={!title.trim() || createMutation.isPending}
            className="w-full bg-amplify-gradient text-white"
          >
            {createMutation.isPending ? "Creating..." : "Create Proposal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Proposals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const utils = trpc.useUtils();

  const { data: dbProposals, isLoading } = trpc.proposals.list.useQuery(undefined as any);

  const deleteMutation = trpc.proposals.delete.useMutation({
    onSuccess: () => {
      toast.success("Proposal deleted");
      utils.proposals.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const proposals = (dbProposals ?? []).map((p: any) => ({
    ...p,
    compliance: 75,
    sections: 8,
    sectionsComplete: 6,
    aiShredded: false,
    dueDate: p.dueDate ? new Date(p.dueDate) : null,
    estimatedValue: p.estimatedValue ?? 0,
  }));

  const filtered = proposals.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.clientName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Proposals</h1>
            <p className="text-muted-foreground mt-1">Manage all active and past proposals</p>
          </div>
          <div className="flex gap-2">
            <ShredRfpDialog />
            <CreateProposalDialog onCreated={() => setRefreshKey(k => k + 1)} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search proposals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="in_review">In Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="awarded">Awarded</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Proposals Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No proposals found</h3>
            <p className="text-muted-foreground text-sm">Create your first proposal to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((proposal) => (
              <div key={proposal.id} className="relative group">
              <Link href={`/proposals/${proposal.id}`}>
                <Card className="card-hover cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{proposal.title}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{proposal.clientName}</span>
                          {proposal.rfpNumber && (
                            <><span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground font-mono">{proposal.rfpNumber}</span></>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`status-badge text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[proposal.status]}`}>
                          {STATUS_LABELS[proposal.status] ?? proposal.status}
                        </span>
                        {proposal.aiShredded && (
                          <Badge variant="outline" className="text-xs border-violet-200 text-violet-600 bg-violet-50">
                            <Sparkles className="w-2.5 h-2.5 mr-1" /> AI
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Compliance Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Compliance</span>
                        <span className="text-xs font-semibold text-foreground">{proposal.compliance}%</span>
                      </div>
                      <Progress value={proposal.compliance} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {proposal.sectionsComplete}/{proposal.sections} sections
                        </span>
                        {proposal.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(proposal.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {proposal.estimatedValue > 0 && (
                          <span className="font-semibold text-foreground">
                            ${(proposal.estimatedValue / 1000000).toFixed(1)}M
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {/* Delete button — visible on hover */}
              {typeof proposal.id === "string" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm("Delete this proposal and all linked sessions? This cannot be undone.")) {
                      deleteMutation.mutate({ id: proposal.id as string });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
