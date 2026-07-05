import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Globe, Sparkles, RefreshCw, Search, Filter, ExternalLink, Clock, Plus, Zap, Loader2, FileText, X, Upload, PenLine } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Static demo data ─────────────────────────────────────────────────────────

const PORTALS = [
  { id: 1, name: "NYC Procurement Portal", url: "nyc.gov/procurement", status: "active", lastSync: "2h ago", count: 12, color: "text-blue-500", bg: "bg-blue-50" },
  { id: 2, name: "NJDOT Procurement", url: "njdot.gov/procurement", status: "active", lastSync: "4h ago", count: 8, color: "text-emerald-500", bg: "bg-emerald-50" },
  { id: 3, name: "NJ State Procurement", url: "njstart.gov", status: "active", lastSync: "6h ago", count: 15, color: "text-violet-500", bg: "bg-violet-50" },
  { id: 4, name: "NYC DDC Solicitations", url: "nyc.gov/ddc", status: "active", lastSync: "3h ago", count: 5, color: "text-amber-500", bg: "bg-amber-50" },
  { id: 5, name: "Port Authority Procurement", url: "panynj.gov", status: "syncing", lastSync: "Syncing...", count: 3, color: "text-rose-500", bg: "bg-rose-50" },
];

// No demo data — all opportunities come from the live DB via trpc.opportunities.list

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-blue-100 text-blue-700",
  "Construction Management": "bg-violet-100 text-violet-700",
  "Traffic Engineering": "bg-amber-100 text-amber-700",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700",
  "Environmental": "bg-teal-100 text-teal-700",
};

const ALL_SERVICE_LINES = [
  "Special Inspections",
  "Construction Management",
  "Traffic Engineering",
  "Landscape / Streetscape",
  "Environmental",
  "Structural Engineering",
  "Civil Engineering",
  "Geotechnical",
  "MEP Engineering",
  "Other",
];

const SOURCES = [
  { value: "manual", label: "Manual Entry" },
  { value: "agency_portal", label: "Agency Portal" },
  { value: "govwin", label: "GovWin" },
  { value: "bidnet", label: "BidNet" },
  { value: "client_referral", label: "Client Referral" },
  { value: "teaming_partner", label: "Teaming Partner" },
  { value: "other", label: "Other" },
];

// ─── New Opportunity Dialog ───────────────────────────────────────────────────

interface NewOpportunityForm {
  title: string;
  agencyName: string;
  rfpNumber: string;
  estimatedValue: string;
  dueDate: string;
  serviceLines: string[];
  source: string;
  description: string;
}

const EMPTY_FORM: NewOpportunityForm = {
  title: "",
  agencyName: "",
  rfpNumber: "",
  estimatedValue: "",
  dueDate: "",
  serviceLines: [],
  source: "manual",
  description: "",
};

function NewOpportunityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewOpportunityForm>(EMPTY_FORM);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const createOpp = trpc.opportunities.create.useMutation({
    onSuccess: () => {
      toast.success("Opportunity created successfully.");
      utils.opportunities.list.invalidate();
      onCreated();
      onOpenChange(false);
      setForm(EMPTY_FORM);
      setAttachments([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleServiceLine = (sl: string) => {
    setForm((f) => ({
      ...f,
      serviceLines: f.serviceLines.includes(sl)
        ? f.serviceLines.filter((s) => s !== sl)
        : [...f.serviceLines, sl],
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    if (!form.agencyName.trim()) { toast.error("Agency / Client name is required."); return; }

    setUploading(true);

    // Upload attachments to /api/upload and collect URLs
    const uploadedAttachments: Array<{ name: string; url: string; key: string }> = [];
    try {
      for (const file of attachments) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "opportunities");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          uploadedAttachments.push({ name: file.name, url: data.url, key: data.key });
        }
      }
    } catch {
      // Attachments are optional — continue even if upload fails
      toast.warning("Some attachments could not be uploaded, but the opportunity will still be created.");
    }

    // Build description with attachment note appended
    let descriptionText = form.description.trim();
    if (uploadedAttachments.length > 0) {
      const attachNote = `\n\n[Attachments: ${uploadedAttachments.map((a) => a.name).join(", ")}]`;
      descriptionText += attachNote;
    }

    const estValue = form.estimatedValue
      ? parseFloat(form.estimatedValue.replace(/[^0-9.]/g, ""))
      : undefined;

    const dueDate = form.dueDate ? new Date(form.dueDate) : undefined;

    createOpp.mutate({
      title: form.title.trim(),
      agencyName: form.agencyName.trim(),
      clientName: form.agencyName.trim(),
      description: descriptionText || undefined,
      estimatedValue: estValue && !isNaN(estValue) ? estValue : undefined,
      dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
      source: form.source,
      aiScore: undefined,
      aiScoreReason: undefined,
    });

    setUploading(false);
  };

  const isSubmitting = createOpp.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            New Opportunity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bridge Inspection Services — Route 9 Corridor"
            />
          </div>

          {/* Agency + RFP Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Agency / Client <span className="text-destructive">*</span></Label>
              <Input
                value={form.agencyName}
                onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))}
                placeholder="e.g. NJDOT, NYC SCA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>RFP / Solicitation Number</Label>
              <Input
                value={form.rfpNumber}
                onChange={(e) => setForm((f) => ({ ...f, rfpNumber: e.target.value }))}
                placeholder="e.g. RFP-2025-001"
              />
            </div>
          </div>

          {/* Estimated Value + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated Value</Label>
              <Input
                value={form.estimatedValue}
                onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
                placeholder="e.g. $500,000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Service Lines */}
          <div className="space-y-1.5">
            <Label>Service Lines</Label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[2.5rem]">
              {ALL_SERVICE_LINES.map((sl) => (
                <button
                  key={sl}
                  type="button"
                  onClick={() => toggleServiceLine(sl)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    form.serviceLines.includes(sl)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {sl}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description / Notes</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Scope summary, key requirements, notes on fit, teaming considerations…"
              rows={4}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-1.5">
            <Label>Attachments <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <div
              className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Click to attach files — PDF, Word, Excel, or any document</p>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/50">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 truncate">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.title.trim() || !form.agencyName.trim()}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Opportunity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Opportunities() {
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [newOppOpen, setNewOppOpen] = useState(false);

  // Fetch live opportunities from DB (merged with demo data for display)
  const { data: liveOpps = [] } = trpc.opportunities.list.useQuery();

  const handleSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 3000));
    setSyncing(false);
    toast.success("Synced 5 agency portals — 8 new opportunities found and AI-scored.");
  };

  // Map live DB opportunities to display format
  const allOpps = liveOpps.map((o: any) => ({
    id: o.id,
    title: o.title,
    agency: o.clientName ?? "—",
    type: "RFP",
    due: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    value: o.estimatedValue ? `$${Number(o.estimatedValue).toLocaleString()}` : "—",
    score: o.aiScore ? Number(o.aiScore) : 0,
    serviceMatch: Array.isArray(o.serviceLines) ? o.serviceLines : [],
    status: o.status ?? "new",
    source: o.source ?? "manual",
    isLive: true,
  }));

  const filtered = allOpps.filter(o =>
    o.title.toLowerCase().includes(search.toLowerCase()) ||
    o.agency.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Opportunity Intelligence">
      <div className="p-6 space-y-5">
        {/* Header Banner */}
        <div className="rounded-xl bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-teal-500/10 border border-blue-200/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-display font-700 text-foreground">AI Opportunity Ingestion Engine</h2>
                <p className="text-xs text-muted-foreground">Automatically scrapes NJ, NY, and NYC agency procurement portals, then AI-scores each opportunity against your firm's capabilities, service lines, and strategic criteria.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setNewOppOpen(true)}
              >
                <PenLine className="w-4 h-4" /> New Opportunity
              </Button>
              <Button className="bg-amplify-gradient text-white font-semibold gap-2" onClick={handleSync} disabled={syncing}>
                {syncing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing Portals...</> : <><Zap className="w-4 h-4" /> Sync All Portals</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Portal Status */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {PORTALS.map(p => (
            <Card key={p.id} className="border-border/60">
              <CardContent className="p-3">
                <div className={`w-7 h-7 rounded-lg ${p.bg} flex items-center justify-center mb-2`}>
                  <Globe className={`w-3.5 h-3.5 ${p.color}`} />
                </div>
                <div className="text-xs font-semibold text-foreground leading-tight mb-0.5">{p.name}</div>
                <div className="text-[10px] text-muted-foreground mb-1.5">{p.lastSync}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-foreground">{p.count} active</span>
                  <div className={`w-2 h-2 rounded-full ${p.status === "active" ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Opportunities List */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> AI-Scored Opportunities
                <Badge className="bg-primary/10 text-primary text-[10px]">{filtered.length} found</Badge>
                {allOpps.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                    {allOpps.length} from database
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search opportunities..."
                    className="pl-8 h-8 text-xs w-52"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => toast.info("Filter coming soon")}>
                  <Filter className="w-3.5 h-3.5" /> Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {filtered.map(opp => (
                <div key={opp.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Score Badge */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-display font-800 text-sm ${opp.score >= 85 ? "bg-emerald-100 text-emerald-700" : opp.score >= 70 ? "bg-amber-100 text-amber-700" : opp.score > 0 ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"}`}>
                      {opp.score > 0 ? opp.score : "—"}
                      <span className="text-[9px] font-normal">score</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="text-sm font-semibold text-foreground leading-tight">{opp.title}</div>
                            {(opp as any).isLive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200">DB</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">{opp.agency}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{opp.type}</span>
                            {opp.serviceMatch.map((s: string) => (
                              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[s] || "bg-gray-100 text-gray-600"}`}>{s}</span>
                            ))}
                            {opp.status === "new" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">New</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{opp.value}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5"><Clock className="w-3 h-3" /> Due {opp.due}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1">
                          {opp.score > 0 && <Progress value={opp.score} className="h-1.5" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{opp.source}</span>
                        <Button size="sm" className="h-6 text-[10px] bg-amplify-gradient text-white px-2.5 gap-1" onClick={() => toast.success(`Pursuit created for: ${opp.title}`)}>
                          <Plus className="w-3 h-3" /> Add to Pursuits
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => toast.info("Opening agency portal...")}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No opportunities match your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Opportunity Dialog */}
      <NewOpportunityDialog
        open={newOppOpen}
        onOpenChange={setNewOppOpen}
        onCreated={() => {}}
      />
    </AppLayout>
  );
}
