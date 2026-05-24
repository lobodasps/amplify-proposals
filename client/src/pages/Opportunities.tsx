import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { Globe, Sparkles, RefreshCw, Search, Filter, ExternalLink, CheckCircle2, Clock, DollarSign, Building2, Target, Plus, ArrowRight, Zap, AlertCircle } from "lucide-react";

const PORTALS = [
  { id: 1, name: "NYC Procurement Portal", url: "nyc.gov/procurement", status: "active", lastSync: "2h ago", count: 12, color: "text-blue-500", bg: "bg-blue-50" },
  { id: 2, name: "NJDOT Procurement", url: "njdot.gov/procurement", status: "active", lastSync: "4h ago", count: 8, color: "text-emerald-500", bg: "bg-emerald-50" },
  { id: 3, name: "NJ State Procurement", url: "njstart.gov", status: "active", lastSync: "6h ago", count: 15, color: "text-violet-500", bg: "bg-violet-50" },
  { id: 4, name: "NYC DDC Solicitations", url: "nyc.gov/ddc", status: "active", lastSync: "3h ago", count: 5, color: "text-amber-500", bg: "bg-amber-50" },
  { id: 5, name: "Port Authority Procurement", url: "panynj.gov", status: "syncing", lastSync: "Syncing...", count: 3, color: "text-rose-500", bg: "bg-rose-50" },
];

const OPPORTUNITIES = [
  { id: 1, title: "Bridge Inspection Services — Route 9 Corridor", agency: "NJDOT", type: "RFP", due: "Jun 15, 2026", value: "$2.4M", score: 92, serviceMatch: ["Special Inspections"], status: "new", source: "NJDOT Procurement" },
  { id: 2, title: "Construction Management — PS 142 Renovation", agency: "NYC SCA", type: "RFQ", due: "Jun 22, 2026", value: "$4.8M", score: 88, serviceMatch: ["Construction Management"], status: "new", source: "NYC Procurement" },
  { id: 3, title: "Traffic Engineering Study — Route 35 Corridor", agency: "Monmouth County", type: "RFP", due: "Jul 8, 2026", value: "$620K", score: 81, serviceMatch: ["Traffic Engineering"], status: "reviewed", source: "NJ State Procurement" },
  { id: 4, title: "Streetscape Design — Downtown Revitalization", agency: "City of Newark", type: "RFQ", due: "Jul 15, 2026", value: "$1.1M", score: 76, serviceMatch: ["Landscape / Streetscape"], status: "new", source: "NJ State Procurement" },
  { id: 5, title: "Phase I/II Environmental Site Assessment", agency: "NJDEP", type: "RFP", due: "Jul 30, 2026", value: "$480K", score: 84, serviceMatch: ["Environmental"], status: "new", source: "NJ State Procurement" },
  { id: 6, title: "Structural Inspection — Pulaski Skyway Approaches", agency: "NJDOT", type: "RFP", due: "Aug 5, 2026", value: "$3.2M", score: 95, serviceMatch: ["Special Inspections"], status: "new", source: "NJDOT Procurement" },
  { id: 7, title: "CM Services — NYC Parks Greenway Phase 2", agency: "NYC Parks", type: "RFQ", due: "Aug 12, 2026", value: "$2.9M", score: 79, serviceMatch: ["Construction Management", "Landscape / Streetscape"], status: "reviewed", source: "NYC Procurement" },
  { id: 8, title: "Traffic Signal Modernization Program", agency: "NYCDOT", type: "RFP", due: "Aug 20, 2026", value: "$1.8M", score: 72, serviceMatch: ["Traffic Engineering"], status: "new", source: "NYC Procurement" },
];

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-blue-100 text-blue-700",
  "Construction Management": "bg-violet-100 text-violet-700",
  "Traffic Engineering": "bg-amber-100 text-amber-700",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700",
  "Environmental": "bg-teal-100 text-teal-700",
};

export default function Opportunities() {
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 3000));
    setSyncing(false);
    toast.success("Synced 5 agency portals — 8 new opportunities found and AI-scored.");
  };

  const filtered = OPPORTUNITIES.filter(o =>
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
            <Button className="bg-amplify-gradient text-white font-semibold gap-2 flex-shrink-0" onClick={handleSync} disabled={syncing}>
              {syncing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing Portals...</> : <><Zap className="w-4 h-4" /> Sync All Portals</>}
            </Button>
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
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-display font-800 text-sm ${opp.score >= 85 ? "bg-emerald-100 text-emerald-700" : opp.score >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {opp.score}
                      <span className="text-[9px] font-normal">score</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground leading-tight mb-1">{opp.title}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">{opp.agency}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{opp.type}</span>
                            {opp.serviceMatch.map(s => (
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
                          <Progress value={opp.score} className="h-1.5" />
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
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
