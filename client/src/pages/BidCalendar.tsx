import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

function formatDate(v?: Date | string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDaysUntil(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

const STAGE_COLORS: Record<string, string> = {
  rfq: "bg-blue-100 text-blue-700 border-blue-300",
  rfp: "bg-violet-100 text-violet-700 border-violet-300",
  shortlisted: "bg-amber-100 text-amber-700 border-amber-300",
  proposal_submitted: "bg-orange-100 text-orange-700 border-orange-300",
  interview: "bg-purple-100 text-purple-700 border-purple-300",
  awarded: "bg-emerald-100 text-emerald-700 border-emerald-300",
  not_awarded: "bg-rose-100 text-rose-700 border-rose-300",
  no_bid: "bg-slate-100 text-slate-600 border-slate-300",
};

export default function BidCalendar() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"list" | "upcoming">("upcoming");

  const { data: pursuits = [], isLoading } = trpc.pursuits.list.useQuery({});

  const withDeadlines = (pursuits as any[])
    .filter((p: any) => p.submissionDeadline)
    .sort((a: any, b: any) => new Date(a.submissionDeadline).getTime() - new Date(b.submissionDeadline).getTime());

  const upcoming = withDeadlines.filter((p: any) => {
    const d = getDaysUntil(p.submissionDeadline);
    return d !== null && d >= 0 && d <= 90;
  });

  const overdue = withDeadlines.filter((p: any) => {
    const d = getDaysUntil(p.submissionDeadline);
    return d !== null && d < 0 && !["awarded", "not_awarded", "no_bid"].includes(p.stage ?? "");
  });

  const renderRow = (p: any) => {
    const days = getDaysUntil(p.submissionDeadline);
    const urgency = days !== null && days <= 7 ? "text-red-600 font-semibold" : days !== null && days <= 14 ? "text-orange-600 font-medium" : days !== null && days <= 30 ? "text-amber-600" : "text-muted-foreground";
    return (
      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/pursuits/${p.id}`)}>
        <td className="p-3">
          <div className="font-medium text-sm">{p.projectName ?? p.title}</div>
          <div className="text-xs text-muted-foreground">{p.agency ?? p.clientName ?? "—"}</div>
        </td>
        <td className="p-3">
          <Badge variant="outline" className={`text-xs ${STAGE_COLORS[p.stage ?? "rfq"] ?? ""}`}>{p.stage?.replace(/_/g, " ") ?? "—"}</Badge>
        </td>
        <td className="p-3 text-sm">{formatDate(p.submissionDeadline)}</td>
        <td className={`p-3 text-sm ${urgency}`}>
          {days !== null ? (days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today!" : `${days}d`) : "—"}
        </td>
        <td className="p-3 text-right">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); navigate(`/pursuits/${p.id}`); }}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" />Bid Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Track submission deadlines and upcoming bid dates across all active pursuits.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={view === "upcoming" ? "default" : "outline"} onClick={() => setView("upcoming")}>Upcoming (90d)</Button>
          <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>All with Deadlines</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Due This Week", value: withDeadlines.filter(p => { const d = getDaysUntil(p.submissionDeadline); return d !== null && d >= 0 && d <= 7; }).length, color: "text-red-600" },
          { label: "Due This Month", value: withDeadlines.filter(p => { const d = getDaysUntil(p.submissionDeadline); return d !== null && d >= 0 && d <= 30; }).length, color: "text-amber-600" },
          { label: "Due Next 90 Days", value: upcoming.length, color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-700 flex items-center gap-2"><Clock className="h-4 w-4" />Overdue ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-red-100/50"><th className="text-left p-3 font-medium text-red-700">Pursuit</th><th className="text-left p-3 font-medium text-red-700">Stage</th><th className="text-left p-3 font-medium text-red-700">Deadline</th><th className="text-left p-3 font-medium text-red-700">Overdue By</th><th className="w-10" /></tr></thead>
              <tbody>{overdue.map(renderRow)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {view === "upcoming" ? `Upcoming Deadlines (next 90 days)` : "All Pursuits with Deadlines"}
              <span className="text-xs font-normal text-muted-foreground ml-1">({(view === "upcoming" ? upcoming : withDeadlines).length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(view === "upcoming" ? upcoming : withDeadlines).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No pursuits with deadlines in this range.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium text-muted-foreground">Pursuit</th><th className="text-left p-3 font-medium text-muted-foreground">Stage</th><th className="text-left p-3 font-medium text-muted-foreground">Deadline</th><th className="text-left p-3 font-medium text-muted-foreground">Days Remaining</th><th className="w-10" /></tr></thead>
                <tbody>{(view === "upcoming" ? upcoming : withDeadlines).map(renderRow)}</tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
