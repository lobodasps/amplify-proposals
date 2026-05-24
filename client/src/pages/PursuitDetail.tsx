import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  ArrowLeft, Target, Calendar, DollarSign, User, FileText,
  CheckCircle2, AlertCircle, Sparkles, Users, MessageSquare, Plus, TrendingUp
} from "lucide-react";

const PURSUIT = {
  id: 1,
  title: "NJDOT Route 9 Bridge Inspection Services",
  rfpNumber: "NJDOT-2026-SI-0042",
  client: "NJDOT",
  status: "pursue",
  statusLabel: "Pursue",
  statusColor: "status-pursue",
  due: "June 15, 2026",
  value: "$2.4M",
  service: "Special Inspections",
  lead: "M. Torres",
  coordinator: "J. Rivera",
  probability: 65,
  goNoGoScore: 78,
  winThemes: "Proven NJDOT experience, certified inspection team, local presence, rapid mobilization.",
  description: "NJDOT is seeking a qualified firm to provide bridge inspection services along Route 9 corridor. Services include routine inspection, load rating, scour evaluation, and reporting per AASHTO standards.",
};

const TASKS = [
  { id: 1, title: "Draft Technical Approach — Section 3", assignee: "A. Patel", due: "Jun 8", status: "in_progress", priority: "high" },
  { id: 2, title: "Tailor resumes for Key Personnel", assignee: "J. Rivera", due: "Jun 9", status: "open", priority: "high" },
  { id: 3, title: "Select 5 relevant bridge inspection projects", assignee: "M. Torres", due: "Jun 7", status: "done", priority: "medium" },
  { id: 4, title: "Prepare SF 330 Part I", assignee: "J. Rivera", due: "Jun 10", status: "open", priority: "high" },
  { id: 5, title: "Review and approve executive summary", assignee: "S. Chen", due: "Jun 12", status: "open", priority: "medium" },
];

const REQUIREMENTS = [
  { id: 1, req: "Firm must hold NJDOT prequalification in Bridge Inspection", status: "compliant", section: "Qualifications" },
  { id: 2, req: "Lead Inspector must have PE license in NJ", status: "compliant", section: "Key Personnel" },
  { id: 3, req: "Minimum 5 similar bridge inspection projects in last 10 years", status: "partial", section: "Experience" },
  { id: 4, req: "Subconsultant plan required if work is subcontracted", status: "missing", section: "Team Structure" },
  { id: 5, req: "DBE participation goal: 15%", status: "partial", section: "DBE/MBE" },
];

const statusIcon = (s: string) => s === "compliant" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : s === "partial" ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />;
const taskStatusColor = (s: string) => s === "done" ? "text-emerald-600 bg-emerald-50" : s === "in_progress" ? "text-blue-600 bg-blue-50" : "text-muted-foreground bg-muted";
const priorityColor = (p: string) => p === "high" ? "text-rose-600" : p === "medium" ? "text-amber-600" : "text-muted-foreground";

export default function PursuitDetail() {
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
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PURSUIT.statusColor}`}>{PURSUIT.statusLabel}</span>
                  <Badge variant="outline" className="text-xs">{PURSUIT.service}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{PURSUIT.rfpNumber}</span>
                </div>
                <h1 className="text-xl font-display font-800 text-foreground mb-3">{PURSUIT.title}</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {PURSUIT.client}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due {PURSUIT.due}</span>
                  <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {PURSUIT.value}</span>
                  <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> Lead: {PURSUIT.lead}</span>
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
                <div className="text-2xl font-display font-800 text-emerald-600">{PURSUIT.goNoGoScore}/100</div>
                <Progress value={PURSUIT.goNoGoScore} className="h-1.5 mt-1" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Win Probability</div>
                <div className="text-2xl font-display font-800 text-blue-600">{PURSUIT.probability}%</div>
                <Progress value={PURSUIT.probability} className="h-1.5 mt-1" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tasks Complete</div>
                <div className="text-2xl font-display font-800 text-foreground">1/5</div>
                <Progress value={20} className="h-1.5 mt-1" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Compliance</div>
                <div className="text-2xl font-display font-800 text-amber-600">60%</div>
                <Progress value={60} className="h-1.5 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tasks">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="requirements">Requirements Matrix</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="notes">Notes & Win Themes</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4 space-y-2">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-foreground">Proposal Tasks</span>
              <Button size="sm" variant="outline" className="gap-2"><Plus className="w-3.5 h-3.5" /> Add Task</Button>
            </div>
            {TASKS.map((t) => (
              <Card key={t.id} className="border-border/60">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground mb-0.5">{t.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.assignee}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {t.due}</span>
                      <span className={`font-semibold ${priorityColor(t.priority)}`}>{t.priority}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${taskStatusColor(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="requirements" className="mt-4 space-y-2">
            {REQUIREMENTS.map((r) => (
              <Card key={r.id} className="border-border/60">
                <CardContent className="p-4 flex items-start gap-3">
                  {statusIcon(r.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{r.req}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Section: {r.section}</div>
                  </div>
                  <Badge variant="outline" className={`text-xs flex-shrink-0 ${r.status === "compliant" ? "border-emerald-300 text-emerald-700" : r.status === "partial" ? "border-amber-300 text-amber-700" : "border-rose-300 text-rose-700"}`}>
                    {r.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <Card className="border-border/60">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { role: "Pursuit Lead", name: "M. Torres", title: "Sr. Project Manager" },
                    { role: "Proposal Coordinator", name: "J. Rivera", title: "Proposal Manager" },
                    { role: "Lead Inspector (Key Personnel)", name: "A. Patel, PE", title: "Bridge Inspection Engineer" },
                    { role: "QA/QC Reviewer", name: "S. Chen", title: "Technical Director" },
                  ].map((m) => (
                    <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {m.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.title}</div>
                        <div className="text-xs text-primary font-medium">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Win Themes</div>
                  <p className="text-sm text-foreground leading-relaxed">{PURSUIT.winThemes}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">RFP Description</div>
                  <p className="text-sm text-foreground leading-relaxed">{PURSUIT.description}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
