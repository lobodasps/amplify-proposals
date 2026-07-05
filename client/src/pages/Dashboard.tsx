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
  // recentPursuits derived from analytics.dashboard — no separate pursuits.list call needed

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

  // Format pipeline value: show $0 when empty, M/K suffix when populated
  const fmtPipelineValue = (v: number) => {
    if (!v) return "$0";
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  const kpiCards = [
    {
      label: "Active Pursuits",
      value: stats ? String(stats.activePursuits) : "—",
      change: stats ? `${stats.totalPursuits} total` : "",
      trend: "up",
      icon: Target,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Proposals In Progress",
      value: stats ? String(stats.proposalsInProgress) : "—",
      change: "draft or in review",
      trend: "neutral",
      icon: FileText,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      label: "Pipeline Value",
      value: stats ? fmtPipelineValue(stats.pipelineValue) : "—",
      change: "active pursuits",
      trend: "up",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Win Rate (YTD)",
      value: stats ? (stats.winRate > 0 ? `${stats.winRate}%` : "—") : "—",
      change: stats && stats.winRate > 0 ? "awarded vs decided" : "no decided pursuits yet",
      trend: (stats?.winRate ?? 0) > 0 ? "up" : "neutral",
      icon: Award,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Proposals Submitted",
      value: stats ? String(stats.proposalsSubmittedYTD) : "—",
      change: "YTD",
      trend: "neutral",
      icon: TrendingUp,
      color: "text-teal-500",
      bg: "bg-teal-50 dark:bg-teal-950/30",
    },
    {
      label: "Upcoming Deadlines",
      value: stats ? String(stats.upcomingDeadlines) : "—",
      change: "Next 14 days",
      trend: (stats?.upcomingDeadlines ?? 0) > 0 ? "alert" : "neutral",
      icon: Clock,
      color: (stats?.upcomingDeadlines ?? 0) > 0 ? "text-rose-500" : "text-muted-foreground",
      bg: (stats?.upcomingDeadlines ?? 0) > 0 ? "bg-rose-50 dark:bg-rose-950/30" : "bg-muted/30",
    },
  ];

  // Derive recent pursuits from analytics.dashboard recentActivity (no extra DB call)
  const recentPursuits = (stats?.recentActivity ?? [])
    .filter((a: any) => a.type === "pursuit")
    .slice(0, 5)
    .map((a: any) => ({
      id: a.entityId,
      title: a.text?.replace("Pursuit updated: ", "") ?? "Untitled",
      client: "—",
      status: a.status ?? "identify",
      statusLabel: STATUS_LABELS[a.status ?? "identify"] ?? "Identify",
      statusColor: STATUS_COLORS[a.status ?? "identify"] ?? "status-identify",
      due: "TBD",
      value: "—",
      service: "—",
    }));

  // Only show the 5 active stages (not lost/no_go) in the pipeline snapshot
  const ACTIVE_STAGES = ["identify", "qualify", "pursue", "submit", "award"];
  const pipelineStages = ACTIVE_STAGES.map(stage => {
    const found = stats?.pursuitsByStatus?.find(s => s.status === stage);
    return {
      stage: STATUS_LABELS[stage] ?? stage,
      count: found?.count ?? 0,
      color: STATUS_COLORS[stage] ?? "status-identify",
    };
  });

  // Recent activity from live DB (rfp sessions + pursuit updates)
  const liveActivity = (stats?.recentActivity ?? []).map((item: any) => ({
    icon: item.type === "rfp_session" ? Sparkles : FileText,
    text: item.text,
    time: item.time ? new Date(item.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    type: item.type === "rfp_session" ? "ai" : "proposal",
    href: item.entityId ? `/pursuits/${item.entityId}` : undefined,
  }));

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
                {statsLoading ? (
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
                  {liveActivity.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No recent activity yet. Start by adding a pursuit or uploading an RFP.
                    </div>
                  ) : liveActivity.map((item, i) => {
                    const Icon = item.icon;
                    const iconColor = item.type === "ai" ? "text-violet-500" : "text-muted-foreground";
                    const content = (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug">{item.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                        </div>
                      </div>
                    );
                    return item.href ? <Link key={i} href={item.href}>{content}</Link> : content;
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
