import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, FileText, Users, FolderOpen, Download,
  CheckCircle2, AlertCircle, Clock, Plus, Wand2, RefreshCw,
  ChevronRight, BookOpen, Image, Send
} from "lucide-react";

const SECTIONS = [
  { id: 1, title: "Cover Letter", status: "approved", aiGenerated: false, assignee: "J. Rivera", compliance: "compliant" },
  { id: 2, title: "Executive Summary", status: "in_review", aiGenerated: true, assignee: "S. Chen", compliance: "compliant" },
  { id: 3, title: "Firm Qualifications", status: "draft", aiGenerated: true, assignee: "M. Torres", compliance: "partial" },
  { id: 4, title: "Technical Approach", status: "draft", aiGenerated: false, assignee: "A. Patel", compliance: "missing" },
  { id: 5, title: "Project Experience (SF 330 Part II)", status: "draft", aiGenerated: false, assignee: "J. Rivera", compliance: "partial" },
  { id: 6, title: "Key Personnel Resumes (SF 330 Part I)", status: "draft", aiGenerated: false, assignee: "J. Rivera", compliance: "missing" },
  { id: 7, title: "DBE/MBE Participation Plan", status: "draft", aiGenerated: false, assignee: "M. Torres", compliance: "missing" },
];

const PERSONNEL = [
  { id: 1, name: "A. Patel, PE", role: "Lead Inspector", tailored: true },
  { id: 2, name: "R. Kim, PE", role: "Structural Engineer", tailored: false },
  { id: 3, name: "D. Johnson", role: "Field Inspector", tailored: false },
];

const sectionStatusColor = (s: string) => s === "approved" ? "text-emerald-600 bg-emerald-50" : s === "in_review" ? "text-amber-600 bg-amber-50" : "text-muted-foreground bg-muted";
const complianceIcon = (c: string) => c === "compliant" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : c === "partial" ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;

export default function ProposalWorkspace() {
  const [activeSection, setActiveSection] = useState(SECTIONS[3]);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("Our team brings over 20 years of bridge inspection experience across NJDOT, PANYNJ, and NJ Transit projects...");

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setContent("Our team brings a proven track record of delivering high-quality bridge inspection services for NJDOT and other NJ public agencies. We have successfully completed over 150 bridge inspections across the Route 9 corridor, including load rating, scour evaluation, and AASHTO-compliant reporting. Our approach integrates the latest inspection technologies — including drone-assisted visual inspection and 3D scanning — with rigorous QA/QC protocols to ensure accuracy and compliance with NJDOT standards.\n\nKey differentiators:\n• NJDOT-prequalified inspection team with PE-licensed lead inspector\n• Rapid mobilization within 48 hours of notice to proceed\n• Proven experience with similar bridge types along Route 9\n• Integrated reporting system for real-time data delivery to NJDOT");
      setGenerating(false);
      toast.success("AI draft generated from firm knowledge hub");
    }, 2200);
  };

  return (
    <AppLayout title="Proposal Workspace">
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left: Section Navigator */}
        <div className="w-64 border-r border-border bg-muted/20 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Proposal</div>
            <div className="text-sm font-semibold text-foreground leading-snug">NJDOT Route 9 Bridge Inspection</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-amber-500 w-[40%]" />
              </div>
              <span className="text-xs text-muted-foreground">40%</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 group ${activeSection.id === s.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground/70"}`}>
                {complianceIcon(s.compliance)}
                <span className="text-xs font-medium flex-1 truncate">{s.title}</span>
                {activeSection.id === s.id && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            ))}
            <button className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground flex items-center gap-2 mt-2">
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Add Section</span>
            </button>
          </div>
          <div className="p-3 border-t border-border space-y-2">
            <Button size="sm" className="w-full bg-amplify-gradient text-white font-semibold gap-2 text-xs" onClick={() => toast.success("InDesign export package generated!")}>
              <Download className="w-3.5 h-3.5" /> Export for InDesign
            </Button>
            <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={() => toast.success("Word document exported!")}>
              <FileText className="w-3.5 h-3.5" /> Export Word / PDF
            </Button>
          </div>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-700 text-base text-foreground">{activeSection.title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sectionStatusColor(activeSection.status)}`}>
                {activeSection.status.replace("_", " ")}
              </span>
              {activeSection.aiGenerated && <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200"><Sparkles className="w-3 h-3 mr-1" />AI Draft</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={handleGenerate} disabled={generating}>
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-violet-500" />}
                {generating ? "Generating..." : "AI Generate"}
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs" onClick={() => toast.success("Section approved!")}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] text-sm leading-relaxed resize-none border-border/60 focus:ring-primary/30"
              placeholder="Start writing or click AI Generate to create a draft from your firm knowledge..."
            />
            <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-violet-700 font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5" /> AI Suggestion
              </div>
              <p className="text-xs text-violet-600">Consider adding your NJDOT prequalification number and referencing the Route 1&9 corridor inspection project from 2023 to strengthen this section.</p>
            </div>
          </div>
        </div>

        {/* Right: Context Panel */}
        <div className="w-72 border-l border-border bg-muted/10 flex flex-col flex-shrink-0 overflow-hidden">
          <Tabs defaultValue="assets" className="flex flex-col h-full">
            <TabsList className="mx-3 mt-3 bg-muted/60 flex-shrink-0">
              <TabsTrigger value="assets" className="text-xs flex-1">Assets</TabsTrigger>
              <TabsTrigger value="resumes" className="text-xs flex-1">Resumes</TabsTrigger>
              <TabsTrigger value="library" className="text-xs flex-1">Library</TabsTrigger>
            </TabsList>

            <TabsContent value="assets" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Relevant Assets</div>
              {[
                { name: "Route 9 Bridge Photo 1.jpg", type: "image" },
                { name: "NJDOT Prequalification Letter.pdf", type: "document" },
                { name: "Bridge Inspection Methodology.pdf", type: "document" },
                { name: "Firm Org Chart 2026.png", type: "image" },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/60 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.success(`${a.name} inserted into section`)}>
                  {a.type === "image" ? <Image className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                  <span className="text-xs text-foreground truncate">{a.name}</span>
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full gap-2 text-xs mt-2">
                <FolderOpen className="w-3.5 h-3.5" /> Browse All Assets
              </Button>
            </TabsContent>

            <TabsContent value="resumes" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Personnel</div>
              {PERSONNEL.map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-card border border-border/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-foreground">{p.name}</span>
                    {p.tailored ? <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 px-1.5 py-0"><Sparkles className="w-2.5 h-2.5 mr-0.5" />Tailored</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{p.role}</div>
                  {!p.tailored && (
                    <Button size="sm" className="w-full h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1" onClick={() => toast.success(`AI tailoring resume for ${p.name}...`)}>
                      <Wand2 className="w-3 h-3" /> Tailor Resume
                    </Button>
                  )}
                  {p.tailored && (
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => toast.success(`${p.name} resume inserted`)}>
                      <Plus className="w-3 h-3" /> Insert Resume
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full gap-2 text-xs mt-2">
                <Users className="w-3.5 h-3.5" /> Add Personnel
              </Button>
            </TabsContent>

            <TabsContent value="library" className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Content Library</div>
              {[
                { title: "NJDOT Boilerplate — Qualifications", category: "boilerplate" },
                { title: "Bridge Inspection Methodology", category: "methodology" },
                { title: "QA/QC Program Description", category: "approach" },
                { title: "DBE Participation Statement", category: "certifications" },
              ].map((l) => (
                <div key={l.title} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/60 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toast.success(`"${l.title}" inserted into section`)}>
                  <BookOpen className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{l.title}</div>
                    <div className="text-xs text-muted-foreground">{l.category}</div>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
