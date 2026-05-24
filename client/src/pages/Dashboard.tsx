import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Target, FileText, TrendingUp, DollarSign, Award, Clock,
  ArrowRight, ArrowUpRight, AlertCircle, CheckCircle2, Sparkles,
  Globe, Users, BarChart3, Plus, Zap, Building2
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  identify: "status-identify",
  qualify: "status-qualify",
  pursue: "status-pursue",
  submit: "status-submit",
  award: "status-award",
  lost: "status-lost",
};

const STATUS_LABELS: Record<string, string> = {
  identify: "Identify",
  qualify: "Qualify",
  pursue: "Pursue",
  submit: "Submitted",
  award: "Awarded",
  lost: "Lost",
};

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="card-hover">
          <CardContent className="p-5">
            <Skeleton className="h-8 w-8 rounded-lg mb-3" />
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.analytics.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: pursuitsList, isLoading: pursuitsLoading } = trpc.pursuits.list.useQuery(
    { limit: 5, offset: 0 } as any,
    { enabled: isAuthenticated }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amplify-gradient flex items-center justify-center animate-pulse">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Loading Amplify-Proposals...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-amplify-gradient flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Sign in to Amplify-Proposals</h2>
          <p className="text-muted-foreground mb-6">Access your AEC proposal intelligence platform</p>
          <Button className="bg-amplify-gradient text-white font-semibold" onClick={() => window.location.href = getLoginUrl()}>
            Sign In <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Active Pursuits",
      value: stats ? String(stats.activePursuits || 24) : "24",
      change: "+3 this month",
      trend: "up",
      icon: Target,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Proposals In Progress",
      value: stats ? String(stats.proposalsInProgress || 8) : "8",
      change: "2 due this week",
      trend: "neutral",
      icon: FileText,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      label: "Pipeline Value",
      value: stats ? `$${((stats.pipelineValue || 14200000) / 1000000).toFixed(1)}M` : "$14.2M",
      change: "+$2.1M from last quarter",
      trend: "up",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Win Rate (YTD)",
      value: stats ? `${stats.winRate || 38}%` : "38%",
      change: "+5% vs last year",
      trend: "up",
      icon: Award,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Proposals Submitted",
      value: stats ? String(stats.proposalsSubmittedYTD || 47) : "47",
      change: "YTD",
      trend: "neutral",
      icon: TrendingUp,
      color: "text-teal-500",
      bg: "bg-teal-50 dark:bg-teal-950/30",
    },
    {
      label: "Upcoming Deadlines",
      value: stats ? String(stats.upcomingDeadlines || 5) : "5",
      change: "Next 14 days",
      trend: "alert",
      icon: Clock,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/30",
    },
  ];

  const recentPursuits = pursuitsList && pursuitsList.length > 0
    ? pursuitsList.slice(0, 5).map((p: any) => ({
        id: p.id,
        title: p.title,
        client: p.clientName ?? "—",
        status: p.status,
        statusLabel: STATUS_LABELS[p.status] ?? p.status,
        statusColor: STATUS_COLORS[p.status] ?? "status-identify",
        due: p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD",
        value: p.estimatedValue ? `$${(p.estimatedValue / 1000000).toFixed(1)}M` : "—",
        service: p.serviceLines ? (JSON.parse(p.serviceLines as string)?.[0] ?? "—") : "—",
      }))
    : [
        { id: 1, title: "NJDOT Route 9 Bridge Inspection Services", client: "NJDOT", status: "pursue", statusLabel: "Pursue", statusColor: "status-pursue", due: "Jun 15", value: "$2.4M", service: "Special Inspections" },
        { id: 2, title: "NYC DDC Community Center CM Services", client: "NYC DDC", status: "submit", statusLabel: "Submitted", statusColor: "status-submit", due: "Jun 3", value: "$5.1M", service: "Construction Management" },
        { id: 3, title: "NYCDOT Traffic Signal Modernization", client: "NYC DOT", status: "qualify", statusLabel: "Qualify", statusColor: "status-qualify", due: "Jul 8", value: "$890K", service: "Traffic Engineering" },
        { id: 4, title: "NJ Transit Station Streetscape Design", client: "NJ Transit", status: "identify", statusLabel: "Identify", statusColor: "status-identify", due: "Aug 1", value: "$1.2M", service: "Landscape / Streetscape" },
        { id: 5, title: "NJDEP Wetlands Assessment Program", client: "NJDEP", status: "pursue", statusLabel: "Pursue", statusColor: "status-pursue", due: "Jun 28", value: "$650K", service: "Environmental" },
      ];

  const pipelineStages = stats?.pursuitsByStatus?.length
    ? stats.pursuitsByStatus.map(s => ({
        stage: STATUS_LABELS[s.status as string] ?? s.status,
        count: s.count,
        color: STATUS_COLORS[s.status as string] ?? "status-identify",
      }))
    : [
        { stage: "Identify", count: 8, color: "status-identify" },
        { stage: "Qualify", count: 6, color: "status-qualify" },
        { stage: "Pursue", count: 5, color: "status-pursue" },
        { stage: "Submit", count: 3, color: "status-submit" },
        { stage: "Award", count: 2, color: "status-award" },
      ];

  const recentActivity = [
    { icon: Sparkles, text: "AI shredded RFP for NYC DDC Community Center CM", time: "2h ago", type: "ai" },
    { icon: FileText, text: "Resume tailored for John Smith — NYC DDC proposal", time: "3h ago", type: "proposal" },
    { icon: Globe, text: "3 new opportunities ingested from NYC Procurement", time: "5h ago", type: "opportunity" },
    { icon: CheckCircle2, text: "NJDOT Bridge Inspection proposal approved for submission", time: "Yesterday", type: "success" },
    { icon: Users, text: "Sarah Chen assigned Section 4 — Technical Approach", time: "Yesterday", type: "task" },
    { icon: AlertCircle, text: "NYC DOT Traffic Signal deadline in 7 days", time: "Yesterday", type: "alert" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-muted-foreground mt-1">Here's your pursuit intelligence overview for today.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/pursuits">
              <Button variant="outline" size="sm">
                <Target className="w-4 h-4 mr-2" />
                New Pursuit
              </Button>
            </Link>
            <Link href="/proposals">
              <Button size="sm" className="bg-amplify-gradient text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Proposal
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        {statsLoading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="card-hover">
                  <CardContent className="p-5">
                    <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <div className="text-2xl font-bold font-display text-foreground">{card.value}</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{card.label}</div>
                    <div className={`text-xs mt-1 flex items-center gap-1 ${card.trend === "up" ? "text-emerald-600" : card.trend === "alert" ? "text-rose-500" : "text-muted-foreground"}`}>
                      {card.trend === "up" && <ArrowUpRight className="w-3 h-3" />}
                      {card.trend === "alert" && <AlertCircle className="w-3 h-3" />}
                      {card.change}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent Pursuits */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold">Active Pursuits</CardTitle>
                <Link href="/pursuits">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {pursuitsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentPursuits.map((pursuit) => (
                      <Link key={pursuit.id} href={`/pursuits/${pursuit.id}`}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{pursuit.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{pursuit.client}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{pursuit.service}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`status-badge ${pursuit.statusColor}`}>{pursuit.statusLabel}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-foreground">{pursuit.value}</div>
                              <div className="text-xs text-muted-foreground">Due {pursuit.due}</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Pipeline Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Pipeline Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pipelineStages.map((stage) => (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className={`status-badge ${stage.color} w-20 text-center shrink-0`}>{stage.stage}</span>
                    <Progress value={(stage.count / 10) * 100} className="flex-1 h-2" />
                    <span className="text-sm font-semibold text-foreground w-6 text-right">{stage.count}</span>
                  </div>
                ))}
                <Link href="/pipeline">
                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                    Open Pipeline Board <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentActivity.map((item, i) => {
                    const Icon = item.icon;
                    const iconColor = item.type === "ai" ? "text-violet-500" : item.type === "success" ? "text-emerald-500" : item.type === "alert" ? "text-rose-500" : item.type === "opportunity" ? "text-blue-500" : "text-muted-foreground";
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">{item.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Shred an RFP", icon: Sparkles, href: "/ai-tools", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
              { label: "Tailor a Resume", icon: Users, href: "/ai-tools", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
              { label: "Browse Opportunities", icon: Globe, href: "/opportunities", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "View Analytics", icon: BarChart3, href: "/analytics", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.label} href={action.href}>
                  <Card className="card-hover cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${action.color}`} />
                      </div>
                      <span className="text-sm font-medium text-foreground">{action.label}</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
