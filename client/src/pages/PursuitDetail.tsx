import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Target, Calendar, DollarSign, User, FileText,
  CheckCircle2, AlertCircle, Sparkles, Users, Plus, LayoutList,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, { label: string; cls: string }> = {
  identify: { label: "Identify",    cls: "bg-slate-100 text-slate-700" },
  qualify:  { label: "Qualify",     cls: "bg-blue-100 text-blue-700" },
  pursue:   { label: "Pursue",      cls: "bg-violet-100 text-violet-700" },
  submit:   { label: "Submit",      cls: "bg-amber-100 text-amber-700" },
  award:    { label: "Award",       cls: "bg-emerald-100 text-emerald-700" },
  lost:     { label: "Lost/No-Go",  cls: "bg-rose-100 text-rose-700" },
  no_go:    { label: "No-Go",       cls: "bg-rose-100 text-rose-700" },
};

function formatValue(val: string | number | null | undefined): string {
  if (!val) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function parseServiceLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return []; }
}

const taskStatusColor = (s: string) =>
  s === "done" ? "text-emerald-600 bg-emerald-50"
  : s === "in_progress" ? "text-blue-600 bg-blue-50"
  : "text-muted-foreground bg-muted";

const priorityColor = (p: string) =>
  p === "high" || p === "urgent" ? "text-rose-600"
  : p === "medium" ? "text-amber-600"
  : "text-muted-foreground";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PursuitDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: pursuit, isLoading, error } = trpc.pursuits.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const { data: tasks = [], isLoading: tasksLoading } = trpc.pursuits.getTasks.useQuery(
    { pursuitId: id! },
    { enabled: !!id }
  );

  const utils = trpc.useUtils();
  const createTask = trpc.pursuits.createTask.useMutation({
    onSuccess: () => utils.pursuits.getTasks.invalidate({ pursuitId: id! }),
  });

  if (isLoading) {
    return (
      <AppLayout title="Pursuit Detail">
        <div className="p-6 space-y-5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (error || !pursuit) {
    return (
      <AppLayout title="Pursuit Detail">
        <div className="p-6 text-center py-16">
          <LayoutList className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Pursuit not found</h3>
          <p className="text-muted-foreground text-sm mb-4">This pursuit may have been deleted or the link is invalid.</p>
          <Button variant="outline" onClick={() => navigate("/pursuits")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pipeline
          </Button>
        </div>
      </AppLayout>
    );
  }

  const stageInfo = STAGE_LABELS[pursuit.status ?? "identify"] ?? STAGE_LABELS.identify;
  const serviceLines = parseServiceLines(pursuit.serviceLines);
  const goNoGoScore = pursuit.goNoGoScore ? Math.round(Number(pursuit.goNoGoScore)) : null;
  const probability = pursuit.probability ? Math.round(Number(pursuit.probability)) : null;
  const doneTasks = tasks.filter((t: any) => t.status === "done").length;
  const taskPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <AppLayout title="Pursuit Detail">
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/pursuits">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Pursuits
            </Button>
          </Link>
        </div>

        {/* Header Card */}
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${stageInfo.cls}`}>
                    {stageInfo.label}
                  </span>
                  {serviceLines.length > 0 && (
                    <Badge variant="outline" className="text-xs">{serviceLines[0]}</Badge>
                  )}
                  {pursuit.rfpNumber && (
                    <span className="text-xs text-muted-foreground font-mono">{pursuit.rfpNumber}</span>
                  )}
                </div>
                <h1 className="text-xl font-display font-800 text-foreground mb-3">{pursuit.title}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {pursuit.clientName && (
                    <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {pursuit.clientName}</span>
                  )}
                  {pursuit.dueDate && (
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due {formatDate(pursuit.dueDate)}</span>
                  )}
                  {pursuit.estimatedValue && (
                    <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {formatValue(pursuit.estimatedValue)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Link href="/proposals/new">
                  <Button className="bg-amplify-gradient text-white font-semibold gap-2 w-full">
                    <FileText className="w-4 h-4" /> Open Proposal
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" /> AI Shred RFP
                </Button>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border/50">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Go/No-Go Score</div>
                {goNoGoScore !== null ? (
                  <>
                    <div className="text-2xl font-display font-800 text-emerald-600">{goNoGoScore}/100</div>
                    <Progress value={goNoGoScore} className="h-1.5 mt-1" />
                  </>
                ) : (
                  <div className="text-2xl font-display font-800 text-muted-foreground">—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Win Probability</div>
                {probability !== null ? (
                  <>
                    <div className="text-2xl font-display font-800 text-blue-600">{probability}%</div>
                    <Progress value={probability} className="h-1.5 mt-1" />
                  </>
                ) : (
                  <div className="text-2xl font-display font-800 text-muted-foreground">—</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tasks Complete</div>
                <div className="text-2xl font-display font-800 text-foreground">
                  {tasksLoading ? "…" : `${doneTasks}/${tasks.length}`}
                </div>
                {!tasksLoading && tasks.length > 0 && <Progress value={taskPct} className="h-1.5 mt-1" />}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Service Lines</div>
                <div className="text-sm font-semibold text-foreground mt-1">
                  {serviceLines.length > 0 ? serviceLines.join(", ") : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tasks">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="notes">Notes & Win Themes</TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4 space-y-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-foreground">Proposal Tasks</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => createTask.mutate({ pursuitId: id!, title: "New Task" })}
                disabled={createTask.isPending}
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </div>
            {tasksLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks yet. Add the first task to track proposal progress.</p>
              </div>
            ) : (
              tasks.map((t: any) => (
                <Card key={t.id} className="border-border/60">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground mb-0.5">{t.title}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {t.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />Due {formatDate(t.dueDate)}
                          </span>
                        )}
                        {t.priority && (
                          <span className={`font-semibold ${priorityColor(t.priority)}`}>{t.priority}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${taskStatusColor(t.status ?? "open")}`}>
                      {(t.status ?? "open").replace("_", " ")}
                    </span>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Notes & Win Themes Tab */}
          <TabsContent value="notes" className="mt-4">
            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                {pursuit.winThemes ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Win Themes</div>
                    <p className="text-sm text-foreground leading-relaxed">{pursuit.winThemes}</p>
                  </div>
                ) : null}
                {pursuit.notes ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</div>
                    <p className="text-sm text-foreground leading-relaxed">{pursuit.notes}</p>
                  </div>
                ) : null}
                {pursuit.competitorNotes ? (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Competitor Notes</div>
                    <p className="text-sm text-foreground leading-relaxed">{pursuit.competitorNotes}</p>
                  </div>
                ) : null}
                {!pursuit.winThemes && !pursuit.notes && !pursuit.competitorNotes && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No notes or win themes recorded for this pursuit yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
