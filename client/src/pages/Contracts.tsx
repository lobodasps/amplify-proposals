import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { FileSignature, Search, Plus, Clock, DollarSign, AlertCircle, CheckCircle2, Calendar, Building2, ExternalLink, Filter } from "lucide-react";

const CONTRACTS = [
  { id: 1, title: "NJDOT Route 9 Bridge Inspection Services", client: "NJDOT", value: "$2.4M", status: "active", startDate: "Jan 15, 2026", endDate: "Dec 31, 2026", pctComplete: 38, service: "Special Inspections", pm: "Maria Santos", nextMilestone: "Interim Report — Jun 30", daysLeft: 221 },
  { id: 2, title: "NYC DDC Community Center CM Services", client: "NYC DDC", value: "$5.1M", status: "active", startDate: "Mar 1, 2026", endDate: "Feb 28, 2028", pctComplete: 12, service: "Construction Management", pm: "James Park", nextMilestone: "Design Review — Jul 15", daysLeft: 645 },
  { id: 3, title: "PANYNJ Terminal Expansion Inspection", client: "Port Authority", value: "$3.8M", status: "active", startDate: "Nov 1, 2025", endDate: "Oct 31, 2027", pctComplete: 52, service: "Special Inspections", pm: "David Chen", nextMilestone: "Phase 2 Kickoff — Jun 15", daysLeft: 525 },
  { id: 4, title: "NYC Parks Greenway Streetscape Phase 1", client: "NYC Parks", value: "$1.8M", status: "closeout", startDate: "Apr 1, 2025", endDate: "May 31, 2026", pctComplete: 95, service: "Landscape / Streetscape", pm: "Sarah Kim", nextMilestone: "Final Deliverable — Jun 10", daysLeft: 17 },
  { id: 5, title: "NJDEP Wetlands Assessment Program", client: "NJDEP", value: "$650K", status: "active", startDate: "Feb 1, 2026", endDate: "Jan 31, 2027", pctComplete: 28, service: "Environmental", pm: "Alex Torres", nextMilestone: "Field Work Phase 2 — Jul 1", daysLeft: 252 },
  { id: 6, title: "Bergen County Traffic Signal Study", client: "Bergen County", value: "$420K", status: "complete", startDate: "Jun 1, 2025", endDate: "Mar 31, 2026", pctComplete: 100, service: "Traffic Engineering", pm: "Maria Santos", nextMilestone: "Closed", daysLeft: 0 },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  closeout: "bg-amber-100 text-amber-700",
  complete: "bg-slate-100 text-slate-600",
  pending: "bg-blue-100 text-blue-700",
};

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-blue-100 text-blue-700",
  "Construction Management": "bg-violet-100 text-violet-700",
  "Traffic Engineering": "bg-amber-100 text-amber-700",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700",
  "Environmental": "bg-teal-100 text-teal-700",
};

const KPI_CARDS = [
  { label: "Active Contracts", value: "5", sub: "$13.6M total value", icon: FileSignature, color: "text-blue-500", bg: "bg-blue-50" },
  { label: "Total Contract Value", value: "$14.2M", sub: "YTD", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
  { label: "Upcoming Milestones", value: "4", sub: "Next 30 days", icon: Calendar, color: "text-amber-500", bg: "bg-amber-50" },
  { label: "In Closeout", value: "1", sub: "Pending final delivery", icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
];

export default function Contracts() {
  const [search, setSearch] = useState("");

  const filtered = CONTRACTS.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.client.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = CONTRACTS.filter(c => c.status === "active" || c.status === "closeout")
    .reduce((sum, c) => sum + parseFloat(c.value.replace(/[$MK]/g, "")) * (c.value.includes("M") ? 1000000 : 1000), 0);

  return (
    <AppLayout title="Contract Management">
      <div className="p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map(k => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="text-2xl font-display font-800 text-foreground">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                <div className="text-[10px] text-muted-foreground/70">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contracts Table */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">Contract Register</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search contracts..." className="pl-8 h-8 text-xs w-52" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Button size="sm" className="bg-amplify-gradient text-white gap-1.5 text-xs h-8" onClick={() => toast.info("New contract form coming soon")}>
                  <Plus className="w-3.5 h-3.5" /> New Contract
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {filtered.map(c => (
                <div key={c.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-foreground leading-tight mb-1">{c.title}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-medium">{c.client}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[c.status]}`}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[c.service] || "bg-gray-100 text-gray-600"}`}>{c.service}</span>
                            <span className="text-[10px] text-muted-foreground">PM: {c.pm}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{c.value}</div>
                          <div className="text-[10px] text-muted-foreground">{c.startDate} → {c.endDate}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">Progress</span>
                            <span className="text-[10px] font-semibold text-foreground">{c.pctComplete}%</span>
                          </div>
                          <Progress value={c.pctComplete} className="h-1.5" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{c.nextMilestone}</span>
                        </div>
                        {c.daysLeft > 0 && c.daysLeft <= 30 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {c.daysLeft}d left
                          </span>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2.5 gap-1" onClick={() => toast.info("Contract detail view coming soon")}>
                          View <ExternalLink className="w-3 h-3" />
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
