import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Award, DollarSign, Target, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";

const WIN_LOSS_DATA = [
  { month: "Jan", wins: 2, losses: 3, submitted: 5 },
  { month: "Feb", wins: 3, losses: 2, submitted: 5 },
  { month: "Mar", wins: 1, losses: 4, submitted: 5 },
  { month: "Apr", wins: 4, losses: 2, submitted: 6 },
  { month: "May", wins: 3, losses: 3, submitted: 6 },
  { month: "Jun", wins: 2, losses: 1, submitted: 3 },
];

const PIPELINE_TREND = [
  { month: "Jan", value: 8.2 },
  { month: "Feb", value: 9.5 },
  { month: "Mar", value: 11.0 },
  { month: "Apr", value: 13.4 },
  { month: "May", value: 15.8 },
  { month: "Jun", value: 14.2 },
];

const SERVICE_MIX = [
  { name: "Special Inspections", value: 35, color: "#3b82f6" },
  { name: "Construction Mgmt", value: 28, color: "#8b5cf6" },
  { name: "Traffic Engineering", value: 18, color: "#f59e0b" },
  { name: "Landscape / Streetscape", value: 12, color: "#10b981" },
  { name: "Environmental", value: 7, color: "#14b8a6" },
];

const AGENCY_PERFORMANCE = [
  { agency: "NJDOT", proposals: 12, wins: 5, value: 8.4 },
  { agency: "NYC DDC", proposals: 9, wins: 3, value: 6.2 },
  { agency: "NYC SCA", proposals: 7, wins: 3, value: 5.8 },
  { agency: "NJDEP", proposals: 6, wins: 2, value: 1.9 },
  { agency: "NYC Parks", proposals: 5, wins: 2, value: 3.1 },
  { agency: "Port Auth.", proposals: 4, wins: 1, value: 4.5 },
];

const HIT_RATE_BY_SERVICE = [
  { service: "Special Inspections", rate: 45 },
  { service: "Construction Mgmt", rate: 33 },
  { service: "Traffic Engineering", rate: 38 },
  { service: "Landscape / Streetscape", rate: 40 },
  { service: "Environmental", rate: 50 },
];

const KPI_CARDS = [
  { label: "Overall Win Rate", value: "38%", sub: "+5% vs last year", icon: Award, color: "text-amber-500", bg: "bg-amber-50", trend: "up" },
  { label: "YTD Proposals Submitted", value: "47", sub: "vs 39 last year", icon: Target, color: "text-blue-500", bg: "bg-blue-50", trend: "up" },
  { label: "Revenue Won (YTD)", value: "$12.4M", sub: "From 18 wins", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50", trend: "up" },
  { label: "Avg Proposal Value", value: "$1.8M", sub: "Per submission", icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-50", trend: "neutral" },
];

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "11px",
  padding: "8px 12px",
};

export default function Analytics() {
  return (
    <AppLayout title="Analytics & Intelligence">
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

        <Tabs defaultValue="performance">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="performance" className="text-xs gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Win/Loss</TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs gap-1.5"><Activity className="w-3.5 h-3.5" /> Pipeline Trend</TabsTrigger>
            <TabsTrigger value="service" className="text-xs gap-1.5"><PieIcon className="w-3.5 h-3.5" /> Service Mix</TabsTrigger>
            <TabsTrigger value="agency" className="text-xs gap-1.5"><Target className="w-3.5 h-3.5" /> Agency Performance</TabsTrigger>
          </TabsList>

          {/* Win/Loss */}
          <TabsContent value="performance" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Monthly Win/Loss Performance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={WIN_LOSS_DATA} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="wins" name="Wins" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="losses" name="Losses" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="submitted" name="Submitted" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Hit Rate by Service Line</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 mt-2">
                    {HIT_RATE_BY_SERVICE.map(s => (
                      <div key={s.service}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground font-medium">{s.service}</span>
                          <span className="text-xs font-bold text-foreground">{s.rate}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="h-2 rounded-full bg-amplify-gradient transition-all" style={{ width: `${s.rate}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pipeline Trend */}
          <TabsContent value="pipeline" className="mt-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline Value Trend ($M)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={PIPELINE_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}M`} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: number) => [`$${v}M`, "Pipeline Value"]} />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Service Mix */}
          <TabsContent value="service" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Pipeline by Service Line</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={SERVICE_MIX} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                        {SERVICE_MIX.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Share"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Service Line Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 mt-2">
                    {SERVICE_MIX.map(s => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground font-medium">{s.name}</span>
                            <span className="text-xs font-bold text-foreground">{s.value}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Agency Performance */}
          <TabsContent value="agency" className="mt-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Agency Performance — Proposals vs Wins</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={AGENCY_PERFORMANCE} layout="vertical" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="agency" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="proposals" name="Proposals" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="wins" name="Wins" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
