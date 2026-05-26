import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Award, DollarSign, Target, BarChart3,
  PieChart as PieIcon, Activity, Download, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#14b8a6", "#f43f5e"];
const TOOLTIP_STYLE = { backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", padding: "8px 12px" };

function formatM(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function exportCSV(rows: any[], filename: string) {
  if (!rows.length) { toast.error("No data to export"); return; }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} rows`);
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("performance");
  const { data: dashboard, isLoading: loadingDash } = trpc.analytics.dashboard.useQuery();
  const { data: winLoss = [], isLoading: loadingWL } = trpc.analytics.winLossTrend.useQuery();
  const { data: serviceMix = [], isLoading: loadingSM } = trpc.analytics.serviceLineMix.useQuery();
  const { data: agencyPerf = [], isLoading: loadingAP } = trpc.analytics.agencyPerformance.useQuery();
  const { data: pipelineTrend = [], isLoading: loadingPT } = trpc.analytics.pipelineTrend.useQuery();

  const dash = dashboard as any;
  const wlData = winLoss as any[];
  const smData = serviceMix as any[];
  const apData = agencyPerf as any[];
  const ptData = pipelineTrend as any[];

  const kpiCards = [
    { label: "Overall Win Rate", value: dash ? `${dash.winRate ?? 0}%` : "—", sub: "Awarded / (Awarded + Lost)", icon: Award, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Active Pursuits", value: dash ? String(dash.activePursuits ?? 0) : "—", sub: `of ${dash?.totalPursuits ?? 0} total`, icon: Target, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Pipeline Value", value: dash ? formatM(dash.pipelineValue ?? 0) : "—", sub: "Estimated total", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Proposals In Progress", value: dash ? String(dash.proposalsInProgress ?? 0) : "—", sub: "Draft + In Review", icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-50" },
  ];

  const exportMap: Record<string, any[]> = { performance: wlData, pipeline: ptData, service: smData, agency: apData, contracts: [] };

  return (
    <AppLayout title="Analytics & Intelligence">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(k => (
            <Card key={k.label} className="border-border/60">
              <CardContent className="p-4">
                {loadingDash ? <div className="h-16 flex items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> : (
                  <>
                    <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}><k.icon className={`w-4 h-4 ${k.color}`} /></div>
                    <div className="text-2xl font-bold text-foreground">{k.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                    <div className="text-[10px] text-muted-foreground/70">{k.sub}</div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {dash?.pursuitsByStatus && dash.pursuitsByStatus.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(["identify", "qualify", "pursue", "submit", "award", "lost"] as string[]).map(s => {
              const item = dash.pursuitsByStatus.find((r: any) => r.status === s);
              const labels: Record<string, string> = { identify: "Identify", qualify: "Qualify", pursue: "Pursue", submit: "Submit", award: "Award", lost: "Lost" };
              const colors: Record<string, string> = { identify: "bg-slate-100 text-slate-700", qualify: "bg-blue-100 text-blue-700", pursue: "bg-violet-100 text-violet-700", submit: "bg-amber-100 text-amber-700", award: "bg-emerald-100 text-emerald-700", lost: "bg-rose-100 text-rose-700" };
              return (
                <Card key={s} className={`border-0 ${colors[s]}`}>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{item?.count ?? 0}</div>
                    <div className="text-xs font-medium mt-0.5">{labels[s]}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList className="bg-muted/60 flex-wrap h-auto">
              <TabsTrigger value="performance" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Win/Loss</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Pipeline Trend</TabsTrigger>
              <TabsTrigger value="service" className="text-xs gap-1.5"><PieIcon className="w-3.5 h-3.5" /> Service Mix</TabsTrigger>
              <TabsTrigger value="agency" className="text-xs gap-1.5"><Target className="w-3.5 h-3.5" /> Agency Performance</TabsTrigger>
              <TabsTrigger value="contracts" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" /> Contracts</TabsTrigger>
            </TabsList>
            {activeTab !== "contracts" && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => exportCSV(exportMap[activeTab] ?? [], `analytics-${activeTab}.csv`)}>
                <Download className="h-3 w-3 mr-1" />Export CSV
              </Button>
            )}
          </div>

          <TabsContent value="performance" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Monthly Win/Loss Performance</CardTitle></CardHeader>
                <CardContent>
                  {loadingWL ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={wlData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Bar dataKey="won" fill="#10b981" name="Won" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="lost" fill="#f43f5e" name="Lost" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="submitted" fill="#3b82f6" name="Submitted" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pursuit Status Distribution</CardTitle></CardHeader>
                <CardContent>
                  {loadingDash ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dash?.pursuitsByStatus ?? []} layout="vertical" margin={{ top: 4, right: 8, left: 40, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline Value Trend</CardTitle></CardHeader>
              <CardContent>
                {loadingPT ? <div className="h-64 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={ptData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={v => formatM(v)} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatM(v), "Pipeline Value"]} />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline by Service Line</CardTitle></CardHeader>
                <CardContent>
                  {loadingSM ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={smData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {smData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Service Line Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {loadingSM ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie data={smData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                            {smData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5">
                        {smData.map((s: any, i: number) => (
                          <div key={s.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-muted-foreground truncate">{s.name}</span>
                            <span className="ml-auto font-medium">{s.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agency" className="mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Agency Performance — Proposals vs Wins</CardTitle></CardHeader>
              <CardContent>
                {loadingAP ? <div className="h-64 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={apData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="agency" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="proposals" fill="#3b82f6" name="Proposals" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="wins" fill="#10b981" name="Wins" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4">
            <ContractsAnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ContractsAnalyticsTab() {
  const { data: contracts = [], isLoading } = trpc.contracts.list.useQuery();
  const rows = contracts as any[];

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalValue = rows.reduce((s, c) => s + (c.computedContractValue ?? c.value ?? 0), 0);
  const activeContracts = rows.filter(c => c.status === "active");
  const activeValue = activeContracts.reduce((s, c) => s + (c.computedContractValue ?? c.value ?? 0), 0);

  const byStatus = Object.entries(
    rows.reduce((acc: Record<string, number>, c) => { acc[c.status ?? "draft"] = (acc[c.status ?? "draft"] ?? 0) + 1; return acc; }, {})
  ).map(([status, count]) => ({ status, count }));

  const byCompany = Object.entries(
    rows.reduce((acc: Record<string, number>, c) => {
      const co = c.performingCompanyName ?? "JPCL";
      acc[co] = (acc[co] ?? 0) + (c.computedContractValue ?? c.value ?? 0);
      return acc;
    }, {})
  ).map(([company, value]) => ({ company, value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contracts", value: String(rows.length), color: "text-blue-600" },
          { label: "Active Contracts", value: String(activeContracts.length), color: "text-emerald-600" },
          { label: "Total Portfolio Value", value: formatM(totalValue), color: "text-violet-600" },
          { label: "Active Portfolio Value", value: formatM(activeValue), color: "text-amber-600" },
        ].map(k => (
          <Card key={k.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Contracts by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatus} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Portfolio Value by Company</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCompany} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="company" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => formatM(v)} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [formatM(v), "Value"]} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {byCompany.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-8 text-xs"
          onClick={() => exportCSV(rows.map(c => ({
            contractNumber: c.contractNumber ?? "",
            title: c.title ?? "",
            status: c.status ?? "",
            company: c.performingCompanyName ?? "",
            client: c.clientName ?? "",
            value: c.computedContractValue ?? c.value ?? 0,
            startDate: c.startDate ? new Date(c.startDate).toLocaleDateString() : "",
            endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "",
          })), "contracts-export.csv")}>
          <Download className="h-3 w-3 mr-1" />Export Contracts CSV
        </Button>
      </div>
    </div>
  );
}
