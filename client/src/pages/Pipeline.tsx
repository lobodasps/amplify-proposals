import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { TrendingUp, DollarSign, Target, Award, Plus, ArrowRight, Clock, ChevronRight } from "lucide-react";

const STAGES = [
  { id: "identify", label: "Identify", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400", border: "border-slate-200" },
  { id: "qualify", label: "Qualify", color: "bg-blue-100 text-blue-700", dot: "bg-blue-400", border: "border-blue-200" },
  { id: "pursue", label: "Pursue", color: "bg-violet-100 text-violet-700", dot: "bg-violet-400", border: "border-violet-200" },
  { id: "submit", label: "Submit", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400", border: "border-amber-200" },
  { id: "award", label: "Award", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", border: "border-emerald-200" },
  { id: "lost", label: "Lost/No-Go", color: "bg-rose-100 text-rose-700", dot: "bg-rose-400", border: "border-rose-200" },
];

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-blue-50 text-blue-600",
  "Construction Management": "bg-violet-50 text-violet-600",
  "Traffic Engineering": "bg-amber-50 text-amber-600",
  "Landscape / Streetscape": "bg-emerald-50 text-emerald-600",
  "Environmental": "bg-teal-50 text-teal-600",
};

const PURSUITS = [
  { id: 1, title: "NJDOT Route 9 Bridge Inspection", client: "NJDOT", value: "$2.4M", stage: "pursue", service: "Special Inspections", due: "Jun 15", score: 92, pm: "M. Santos" },
  { id: 2, title: "NYC DDC Community Center CM", client: "NYC DDC", value: "$5.1M", stage: "submit", service: "Construction Management", due: "Jun 3", score: 85, pm: "J. Park" },
  { id: 3, title: "NYCDOT Traffic Signal Modernization", client: "NYC DOT", value: "$890K", stage: "qualify", service: "Traffic Engineering", due: "Jul 8", score: 72, pm: "M. Santos" },
  { id: 4, title: "NJ Transit Station Streetscape", client: "NJ Transit", value: "$1.2M", stage: "identify", service: "Landscape / Streetscape", due: "Aug 1", score: 68, pm: "S. Kim" },
  { id: 5, title: "NJDEP Wetlands Assessment", client: "NJDEP", value: "$650K", stage: "pursue", service: "Environmental", due: "Jun 28", score: 84, pm: "A. Torres" },
  { id: 6, title: "Pulaski Skyway Structural Inspection", client: "NJDOT", value: "$3.2M", stage: "qualify", service: "Special Inspections", due: "Aug 5", score: 95, pm: "D. Chen" },
  { id: 7, title: "NYC Parks Greenway Phase 2 CM", client: "NYC Parks", value: "$2.9M", stage: "identify", service: "Construction Management", due: "Aug 12", score: 79, pm: "J. Park" },
  { id: 8, title: "Bergen County Traffic Study", client: "Bergen County", value: "$420K", stage: "award", service: "Traffic Engineering", due: "—", score: 88, pm: "M. Santos" },
  { id: 9, title: "Newark Streetscape Revitalization", client: "City of Newark", value: "$1.1M", stage: "identify", service: "Landscape / Streetscape", due: "Jul 15", score: 76, pm: "S. Kim" },
  { id: 10, title: "PANYNJ Terminal Inspection Services", client: "Port Authority", value: "$4.5M", stage: "pursue", service: "Special Inspections", due: "Jul 20", score: 88, pm: "D. Chen" },
  { id: 11, title: "Phase I ESA — Hudson County Sites", client: "NJDEP", value: "$280K", stage: "submit", service: "Environmental", due: "Jun 10", score: 90, pm: "A. Torres" },
  { id: 12, title: "NYC SCA School Renovation CM", client: "NYC SCA", value: "$6.8M", stage: "qualify", service: "Construction Management", due: "Jul 25", score: 81, pm: "J. Park" },
];

const KPI_CARDS = [
  { label: "Total Pipeline Value", value: "$29.4M", sub: "24 active pursuits", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
  { label: "Weighted Pipeline", value: "$11.2M", sub: "Probability-adjusted", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50" },
  { label: "Win Rate (YTD)", value: "38%", sub: "+5% vs last year", icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
  { label: "Avg Pursuit Score", value: "82/100", sub: "Go/No-Go AI score", icon: Target, color: "text-violet-500", bg: "bg-violet-50" },
];

export default function Pipeline() {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const byStage = (stageId: string) => PURSUITS.filter(p => p.stage === stageId);
  const stageValue = (stageId: string) => {
    const total = byStage(stageId).reduce((sum, p) => {
      const v = parseFloat(p.value.replace(/[$MK]/g, "")) * (p.value.includes("M") ? 1 : 0.001);
      return sum + v;
    }, 0);
    return total >= 1 ? `$${total.toFixed(1)}M` : `$${(total * 1000).toFixed(0)}K`;
  };

  return (
    <AppLayout title="Pursuit Pipeline">
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

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Pursuit Board</h2>
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
            <button onClick={() => setView("kanban")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>Kanban</button>
            <button onClick={() => setView("list")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>List</button>
          </div>
        </div>

        {/* Kanban Board */}
        {view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <div key={stage.id} className="flex-shrink-0 w-64">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${stage.border} bg-white mb-0`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-bold text-foreground">{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{byStage(stage.id).length}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{stageValue(stage.id)}</span>
                </div>
                <div className={`min-h-[400px] rounded-b-xl border border-t-0 ${stage.border} bg-muted/20 p-2 space-y-2`}>
                  {byStage(stage.id).map(p => (
                    <div key={p.id} className="bg-card border border-border/60 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group" onClick={() => toast.info(`Opening ${p.title}`)}>
                      <div className="text-xs font-semibold text-foreground leading-tight mb-1.5 group-hover:text-primary transition-colors">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground mb-2">{p.client}</div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-foreground">{p.value}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${p.score >= 85 ? "bg-emerald-100 text-emerald-700" : p.score >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                          {p.score}
                        </span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[p.service] || "bg-gray-100 text-gray-600"}`}>{p.service}</span>
                      {p.due !== "—" && (
                        <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground">
                          <Clock className="w-3 h-3" /> Due {p.due}
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="w-full py-2 rounded-xl border border-dashed border-border/60 text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1" onClick={() => toast.info("Add pursuit coming soon")}>
                    <Plus className="w-3 h-3" /> Add Pursuit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {view === "list" && (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {PURSUITS.map(p => {
                  const stage = STAGES.find(s => s.id === p.stage);
                  return (
                    <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toast.info(`Opening ${p.title}`)}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground mb-1">{p.title}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{p.client}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[p.service] || "bg-gray-100 text-gray-600"}`}>{p.service}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${stage?.color}`}>{stage?.label}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-foreground">{p.value}</div>
                        {p.due !== "—" && <div className="text-[10px] text-muted-foreground">Due {p.due}</div>}
                      </div>
                      <div className={`text-xs font-bold w-10 text-center ${p.score >= 85 ? "text-emerald-600" : p.score >= 70 ? "text-amber-600" : "text-rose-600"}`}>{p.score}</div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
