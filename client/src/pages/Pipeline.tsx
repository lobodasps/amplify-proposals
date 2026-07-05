import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, DollarSign, Target, Award, Plus, Clock, ChevronRight,
  Kanban, List, LayoutList,
} from "lucide-react";

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES = [
  { id: "identify",  label: "Identify",    color: "bg-slate-100 text-slate-700",   dot: "bg-slate-400",   border: "border-slate-200" },
  { id: "qualify",   label: "Qualify",     color: "bg-blue-100 text-blue-700",     dot: "bg-blue-400",    border: "border-blue-200" },
  { id: "pursue",    label: "Pursue",      color: "bg-violet-100 text-violet-700", dot: "bg-violet-400",  border: "border-violet-200" },
  { id: "submit",    label: "Submit",      color: "bg-amber-100 text-amber-700",   dot: "bg-amber-400",   border: "border-amber-200" },
  { id: "award",     label: "Award",       color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400", border: "border-emerald-200" },
  { id: "lost",      label: "Lost/No-Go",  color: "bg-rose-100 text-rose-700",     dot: "bg-rose-400",    border: "border-rose-200" },
];

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections":      "bg-blue-50 text-blue-600",
  "Construction Management":  "bg-violet-50 text-violet-600",
  "Traffic Engineering":      "bg-amber-50 text-amber-600",
  "Landscape / Streetscape":  "bg-emerald-50 text-emerald-600",
  "Environmental":            "bg-teal-50 text-teal-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseServiceLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return []; }
}

function formatValue(val: string | number | null | undefined): string {
  if (!val) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function numericValue(val: string | number | null | undefined): number {
  if (!val) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function formatDueDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Pursuit Card ─────────────────────────────────────────────────────────────

function PursuitCard({ pursuit }: { pursuit: any }) {
  const serviceLines = parseServiceLines(pursuit.serviceLines);
  const score = pursuit.goNoGoScore ? Math.round(Number(pursuit.goNoGoScore)) : null;

  return (
    <Link href={`/pursuits/${pursuit.id}`}>
      <div className="bg-card border border-border/60 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 group">
        <div className="text-xs font-semibold text-foreground leading-tight mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
          {pursuit.title}
        </div>
        {pursuit.clientName && (
          <div className="text-[10px] text-muted-foreground mb-2">{pursuit.clientName}</div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-foreground">{formatValue(pursuit.estimatedValue)}</span>
          {score !== null && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${score >= 85 ? "bg-emerald-100 text-emerald-700" : score >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
              {score}
            </span>
          )}
        </div>
        {serviceLines.length > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[serviceLines[0]] || "bg-gray-100 text-gray-600"}`}>
            {serviceLines[0]}
          </span>
        )}
        {pursuit.dueDate && (
          <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground">
            <Clock className="w-3 h-3" /> Due {formatDueDate(pursuit.dueDate)}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const { data: allPursuits = [], isLoading } = trpc.pursuits.list.useQuery();

  // ── KPI calculations ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = allPursuits.filter((p: any) => !["lost", "no_go"].includes(p.status ?? ""));
    const totalValue = active.reduce((sum: number, p: any) => sum + numericValue(p.estimatedValue), 0);
    const weightedValue = active.reduce((sum: number, p: any) => {
      const prob = p.probability ? Number(p.probability) / 100 : 0.5;
      return sum + numericValue(p.estimatedValue) * prob;
    }, 0);
    const awarded = allPursuits.filter((p: any) => p.isWon === true);
    const competed = allPursuits.filter((p: any) => ["award", "lost"].includes(p.status ?? ""));
    const winRate = competed.length > 0 ? Math.round((awarded.length / competed.length) * 100) : 0;
    const scored = allPursuits.filter((p: any) => p.goNoGoScore);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s: number, p: any) => s + Number(p.goNoGoScore), 0) / scored.length)
      : null;

    return { totalValue, weightedValue, winRate, avgScore, activeCount: active.length };
  }, [allPursuits]);

  const byStage = (stageId: string) =>
    allPursuits.filter((p: any) => (p.status ?? "identify") === stageId);

  const stageValue = (stageId: string) => {
    const total = byStage(stageId).reduce((sum: number, p: any) => sum + numericValue(p.estimatedValue), 0);
    return formatValue(total);
  };

  const kpiCards = [
    {
      label: "Total Pipeline Value",
      value: formatValue(kpis.totalValue),
      sub: `${kpis.activeCount} active pursuit${kpis.activeCount !== 1 ? "s" : ""}`,
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "Weighted Pipeline",
      value: formatValue(kpis.weightedValue),
      sub: "Probability-adjusted",
      icon: TrendingUp,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Win Rate (all time)",
      value: `${kpis.winRate}%`,
      sub: "Awarded vs. competed",
      icon: Award,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "Avg Go/No-Go Score",
      value: kpis.avgScore !== null ? `${kpis.avgScore}/100` : "—",
      sub: "AI go/no-go score",
      icon: Target,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
  ];

  return (
    <AppLayout title="Pursuit Pipeline">
      <div className="p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(k => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-7 w-20 mb-1" />
                ) : (
                  <div className="text-2xl font-display font-800 text-foreground">{k.value}</div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                <div className="text-[10px] text-muted-foreground/70">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Pursuit Board
            {!isLoading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({allPursuits.length} total)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              List
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(s => (
              <div key={s.id} className="flex-shrink-0 w-64">
                <Skeleton className="h-10 rounded-t-xl mb-0" />
                <div className="space-y-2 p-2 border border-t-0 rounded-b-xl min-h-[200px]">
                  {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allPursuits.length === 0 && (
          <div className="text-center py-16">
            <LayoutList className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No pursuits yet</h3>
            <p className="text-muted-foreground text-sm">
              Create your first pursuit from the Opportunities page or the Proposal Launchpad.
            </p>
          </div>
        )}

        {/* Kanban Board */}
        {!isLoading && allPursuits.length > 0 && view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <div key={stage.id} className="flex-shrink-0 w-64">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${stage.border} bg-white mb-0`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-bold text-foreground">{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                      {byStage(stage.id).length}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{stageValue(stage.id)}</span>
                </div>
                <div className={`min-h-[400px] rounded-b-xl border border-t-0 ${stage.border} bg-muted/20 p-2 space-y-2`}>
                  {byStage(stage.id).map((p: any) => (
                    <PursuitCard key={p.id} pursuit={p} />
                  ))}
                  <button
                    className="w-full py-2 rounded-xl border border-dashed border-border/60 text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1"
                    onClick={() => toast.info("Create a pursuit from the Opportunities page or Proposal Launchpad")}
                  >
                    <Plus className="w-3 h-3" /> Add Pursuit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {!isLoading && allPursuits.length > 0 && view === "list" && (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {allPursuits.map((p: any) => {
                  const stage = STAGES.find(s => s.id === (p.status ?? "identify"));
                  const serviceLines = parseServiceLines(p.serviceLines);
                  const score = p.goNoGoScore ? Math.round(Number(p.goNoGoScore)) : null;
                  return (
                    <Link key={p.id} href={`/pursuits/${p.id}`}>
                      <div className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground mb-1">{p.title}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.clientName && <span className="text-xs text-muted-foreground">{p.clientName}</span>}
                            {serviceLines.length > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SERVICE_COLORS[serviceLines[0]] || "bg-gray-100 text-gray-600"}`}>
                                {serviceLines[0]}
                              </span>
                            )}
                            {stage && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${stage.color}`}>
                                {stage.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-foreground">{formatValue(p.estimatedValue)}</div>
                          {p.dueDate && (
                            <div className="text-[10px] text-muted-foreground">Due {formatDueDate(p.dueDate)}</div>
                          )}
                        </div>
                        {score !== null && (
                          <div className={`text-xs font-bold w-10 text-center ${score >= 85 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600"}`}>
                            {score}
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
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
