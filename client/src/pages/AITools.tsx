import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { Sparkles, FileText, Users, Target, Zap, CheckCircle2, AlertCircle, ArrowRight, Upload, Download, RefreshCw, Brain, BarChart3, BookOpen } from "lucide-react";
import { Streamdown } from "streamdown";

const SHRED_RESULT = `## RFP Shredding Analysis — NYC DDC Community Center CM Services

### Key Evaluation Criteria
| # | Criterion | Weight | Notes |
|---|---|---|---|
| 1 | Technical Approach & Methodology | 30% | Must address phased construction, occupied building protocols |
| 2 | Relevant Experience | 25% | Min 3 NYC agency CM projects >$5M in last 7 years |
| 3 | Key Personnel Qualifications | 20% | PM must hold CCM or PMP; Resident Engineer required |
| 4 | Management Plan | 15% | Include QA/QC, safety, and community outreach plans |
| 5 | M/WBE Participation | 10% | Min 30% M/WBE subcontracting goal |

### Compliance Matrix
- [x] SF 330 required — Sections A–G
- [x] Project experience: minimum 3 comparable NYC agency projects
- [x] Key personnel resumes: PM, Resident Engineer, Safety Officer
- [x] M/WBE participation plan required (30% goal)
- [x] Certificate of Insurance — $2M general liability
- [ ] **MISSING:** NYC Vendor ID required — confirm registration

### Win Themes Identified
1. Emphasize occupied-building CM experience (schools, community centers)
2. Lead with NYC DDC past performance — highlight PS 142 and Bronx Community Center
3. Differentiate on community outreach and minority workforce development
4. Highlight CCM-certified PM and co-located site team approach

### Recommended Section Outline
1. Cover Letter & Executive Summary
2. Firm Qualifications & NYC Agency Experience
3. Key Personnel — Resumes Tailored to RFP Criteria
4. Technical Approach: Phased CM Methodology
5. Management Plan (QA/QC, Safety, Community Outreach)
6. M/WBE Participation Plan
7. Fee Schedule (if requested)
`;

const RESUME_RESULT = `## Tailored Resume — James Park, PE, CCM
**Role: Construction Manager / Project Manager**
*Tailored for: NYC DDC Community Center CM Services RFP*

---

### Professional Summary
Registered Professional Engineer and Certified Construction Manager with 18 years of experience managing complex construction projects for NYC agencies. Specializes in occupied-building construction management, phased delivery, and community facility projects for NYC DDC, NYC SCA, and NYC Parks. Proven track record delivering projects on time and within budget with exceptional client satisfaction.

### Relevant NYC Agency Experience
| Project | Client | Value | Role | Dates |
|---|---|---|---|---|
| PS 142 Renovation | NYC SCA | $6.2M | Project Manager | 2023–2025 |
| Bronx Community Center | NYC DDC | $8.4M | Construction Manager | 2021–2023 |
| East River Park Pavilion | NYC Parks | $3.1M | Resident Engineer | 2020–2021 |

### Certifications & Licenses
- Professional Engineer (PE) — New York State #123456
- Certified Construction Manager (CCM) — CMAA #78901
- OSHA 30-Hour Construction Safety
- NYC DDC Approved Vendor

### Education
B.S. Civil Engineering, Rutgers University, 2006
`;

const CONTENT_RESULT = `## Technical Approach — Construction Management Services
### NYC DDC Community Center CM Services

Our firm brings a proven, community-centered construction management methodology refined through 15+ years of NYC agency work. Our approach prioritizes **zero disruption to adjacent occupied spaces**, rigorous **QA/QC oversight**, and proactive **community stakeholder engagement**.

**Phase 1: Pre-Construction (Months 1–3)**
We will conduct a comprehensive constructability review of 100% construction documents, develop the project-specific QA/QC plan, establish the community outreach protocol with the local CB, and prepare the detailed CPM baseline schedule.

**Phase 2: Construction Administration (Months 4–18)**
Our co-located Resident Engineer will provide daily on-site oversight, conduct weekly OAC meetings, manage RFIs and submittals within 5-business-day turnaround, and maintain real-time cost tracking against the approved GMP.

**Phase 3: Closeout (Months 19–21)**
We will manage the punch list process, coordinate all agency inspections and approvals, compile the complete closeout package including as-builts, warranties, and O&M manuals, and facilitate the community ribbon-cutting event.
`;

export default function AITools() {
  const [rfpText, setRfpText] = useState("");
  const [shredding, setShredding] = useState(false);
  const [shredResult, setShredResult] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");
  const [selectedPersonnel, setSelectedPersonnel] = useState("James Park, PE, CCM");
  const [selectedSection, setSelectedSection] = useState("Technical Approach");

  const handleShred = async () => {
    if (!rfpText.trim()) {
      toast.error("Please paste RFP text to shred.");
      return;
    }
    setShredding(true);
    setShredResult("");
    await new Promise(r => setTimeout(r, 2500));
    setShredResult(SHRED_RESULT);
    setShredding(false);
    toast.success("RFP shredded — compliance matrix and win themes generated.");
  };

  const handleTailor = async () => {
    setTailoring(true);
    setTailorResult("");
    await new Promise(r => setTimeout(r, 2000));
    setTailorResult(RESUME_RESULT);
    setTailoring(false);
    toast.success("Resume tailored to RFP key-personnel requirements.");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult("");
    await new Promise(r => setTimeout(r, 2000));
    setGenResult(CONTENT_RESULT);
    setGenerating(false);
    toast.success("Section draft generated from firm knowledge base.");
  };

  return (
    <AppLayout title="AI Tools">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="rounded-xl bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-teal-500/10 border border-violet-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-700 text-foreground">Amplify AI Suite</h2>
              <p className="text-xs text-muted-foreground">RFP shredding, compliance matrix generation, AI resume tailoring, rich content generation, and go/no-go scoring — all grounded in your firm's knowledge base.</p>
            </div>
          </div>
        </div>

        {/* AI Tool Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: FileText, label: "RFP Shredder", desc: "Extract criteria, weights, compliance items, and win themes", color: "text-blue-500", bg: "bg-blue-50" },
            { icon: Users, label: "Resume Tailor", desc: "Reformat resumes to match RFP key-personnel requirements", color: "text-violet-500", bg: "bg-violet-50" },
            { icon: BookOpen, label: "Content Generator", desc: "Draft proposal sections from your firm's knowledge base", color: "text-teal-500", bg: "bg-teal-50" },
            { icon: Target, label: "Go/No-Go Scorer", desc: "AI-score opportunities against your strategic criteria", color: "text-amber-500", bg: "bg-amber-50" },
          ].map(t => (
            <Card key={t.label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center mb-2`}>
                  <t.icon className={`w-4 h-4 ${t.color}`} />
                </div>
                <div className="text-sm font-semibold text-foreground mb-1">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="shred">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="shred" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" /> RFP Shredder</TabsTrigger>
            <TabsTrigger value="resume" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5" /> Resume Tailor</TabsTrigger>
            <TabsTrigger value="content" className="text-xs gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Content Generator</TabsTrigger>
            <TabsTrigger value="gonogo" className="text-xs gap-1.5"><Target className="w-3.5 h-3.5" /> Go/No-Go</TabsTrigger>
          </TabsList>

          {/* RFP Shredder */}
          <TabsContent value="shred" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Paste RFP / Solicitation Text</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Paste the full RFP, RFQ, or solicitation text here. The AI will extract evaluation criteria, weights, compliance requirements, key personnel requirements, and generate win themes..."
                    className="min-h-[220px] text-xs resize-none"
                    value={rfpText}
                    onChange={e => setRfpText(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button className="bg-amplify-gradient text-white gap-2 text-xs" onClick={handleShred} disabled={shredding}>
                      {shredding ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Shredding...</> : <><Sparkles className="w-3.5 h-3.5" /> Shred RFP</>}
                    </Button>
                    <Button variant="outline" className="gap-1.5 text-xs" onClick={() => { setRfpText("NYC DDC Community Center CM Services — Request for Proposals\n\nScope: Construction Management services for a new 24,000 SF community center in Brooklyn, NY. Estimated construction value: $8.4M. The selected firm will provide pre-construction, construction administration, and closeout services.\n\nEvaluation Criteria: Technical Approach (30%), Relevant Experience (25%), Key Personnel (20%), Management Plan (15%), M/WBE Participation (10%).\n\nMinimum Qualifications: Minimum 3 NYC agency CM projects over $5M in the last 7 years. PM must hold CCM or PMP certification. M/WBE participation goal: 30%."); toast.info("Sample RFP loaded"); }}>
                      Load Sample RFP
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Analysis Results</CardTitle></CardHeader>
                <CardContent>
                  {shredding && (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">Analyzing RFP structure...</div>
                      <Progress value={65} className="h-1.5" />
                      <div className="text-[10px] text-muted-foreground">Extracting evaluation criteria, compliance items, and win themes...</div>
                    </div>
                  )}
                  {shredResult ? (
                    <div className="prose prose-xs max-w-none max-h-[320px] overflow-y-auto text-xs">
                      <Streamdown>{shredResult}</Streamdown>
                    </div>
                  ) : !shredding && (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-xs text-muted-foreground">Paste RFP text and click Shred RFP to generate your compliance matrix, evaluation criteria breakdown, and win themes.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Resume Tailor */}
          <TabsContent value="resume" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Resume Tailoring Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Select Personnel</label>
                    <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3" value={selectedPersonnel} onChange={e => setSelectedPersonnel(e.target.value)}>
                      <option>James Park, PE, CCM</option>
                      <option>Maria Santos, PE</option>
                      <option>David Chen, SE</option>
                      <option>Sarah Kim, LA</option>
                      <option>Alex Torres, AICP</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Target Pursuit</label>
                    <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3">
                      <option>NYC DDC Community Center CM Services</option>
                      <option>NJDOT Route 9 Bridge Inspection</option>
                      <option>NYCDOT Traffic Signal Modernization</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Target Role in Proposal</label>
                    <Input className="text-xs h-9" placeholder="e.g., Construction Manager / Project Manager" defaultValue="Construction Manager / Project Manager" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Key RFP Requirements to Emphasize</label>
                    <Textarea className="text-xs min-h-[80px] resize-none" placeholder="e.g., NYC agency experience, CCM certification, occupied building CM..." defaultValue="NYC DDC experience, CCM certification, occupied-building construction management, M/WBE coordination" />
                  </div>
                  <Button className="bg-amplify-gradient text-white gap-2 text-xs w-full" onClick={handleTailor} disabled={tailoring}>
                    {tailoring ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Tailoring Resume...</> : <><Sparkles className="w-3.5 h-3.5" /> Tailor Resume</>}
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Tailored Resume Preview</CardTitle>
                    {tailorResult && <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => toast.success("Resume exported to Word")}><Download className="w-3 h-3" /> Export</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  {tailoring && <div className="space-y-2"><Progress value={50} className="h-1.5" /><div className="text-xs text-muted-foreground">Matching experience to RFP criteria...</div></div>}
                  {tailorResult ? (
                    <div className="prose prose-xs max-w-none max-h-[340px] overflow-y-auto text-xs">
                      <Streamdown>{tailorResult}</Streamdown>
                    </div>
                  ) : !tailoring && (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-xs text-muted-foreground">Configure the tailoring options and click Tailor Resume to generate an RFP-optimized resume.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Content Generator */}
          <TabsContent value="content" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Content Generation Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Proposal Section</label>
                    <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                      <option>Technical Approach</option>
                      <option>Firm Qualifications</option>
                      <option>Project Experience</option>
                      <option>Management Plan</option>
                      <option>M/WBE Participation Plan</option>
                      <option>Executive Summary</option>
                      <option>Cover Letter</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Pursuit</label>
                    <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3">
                      <option>NYC DDC Community Center CM Services</option>
                      <option>NJDOT Route 9 Bridge Inspection</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Key Points to Include</label>
                    <Textarea className="text-xs min-h-[100px] resize-none" placeholder="Specific differentiators, past projects, certifications, or methodology points to emphasize..." defaultValue="Emphasize occupied-building experience, co-located team, NYC DDC past performance, community outreach approach" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Tone</label>
                    <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3">
                      <option>Professional / Government Proposal</option>
                      <option>Technical / Engineering</option>
                      <option>Client-Focused / Relationship</option>
                    </select>
                  </div>
                  <Button className="bg-amplify-gradient text-white gap-2 text-xs w-full" onClick={handleGenerate} disabled={generating}>
                    {generating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Section</>}
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Generated Content</CardTitle>
                    {genResult && <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => toast.success("Content inserted into proposal")}><ArrowRight className="w-3 h-3" /> Insert</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  {generating && <div className="space-y-2"><Progress value={40} className="h-1.5" /><div className="text-xs text-muted-foreground">Generating from firm knowledge base...</div></div>}
                  {genResult ? (
                    <div className="prose prose-xs max-w-none max-h-[380px] overflow-y-auto text-xs">
                      <Streamdown>{genResult}</Streamdown>
                    </div>
                  ) : !generating && (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-xs text-muted-foreground">Configure the section and click Generate to create a first draft from your firm's knowledge base.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Go/No-Go */}
          <TabsContent value="gonogo" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Go/No-Go Scoring Matrix</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { criterion: "Relevant Experience Match", weight: 25, score: 90, note: "Strong NYC DDC and NJDOT CM experience" },
                    { criterion: "Key Personnel Available", weight: 20, score: 85, note: "PM and RE available; Safety Officer TBD" },
                    { criterion: "Client Relationship", weight: 20, score: 75, note: "Existing DDC relationship from PS 142" },
                    { criterion: "Win Probability", weight: 15, score: 70, note: "2-3 strong competitors expected" },
                    { criterion: "Strategic Value", weight: 10, score: 95, note: "High-profile NYC project, great reference" },
                    { criterion: "Resource Capacity", weight: 10, score: 60, note: "Tight — 2 other proposals in progress" },
                  ].map(c => (
                    <div key={c.criterion} className="p-3 rounded-xl border border-border/60 bg-muted/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{c.criterion}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Weight: {c.weight}%</span>
                          <span className={`text-xs font-bold ${c.score >= 80 ? "text-emerald-600" : c.score >= 65 ? "text-amber-600" : "text-rose-600"}`}>{c.score}</span>
                        </div>
                      </div>
                      <Progress value={c.score} className="h-1.5 mb-1" />
                      <div className="text-[10px] text-muted-foreground">{c.note}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Go/No-Go Decision</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                      <div className="text-center">
                        <div className="text-3xl font-display font-800 text-emerald-700">82</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">/ 100</div>
                      </div>
                    </div>
                    <div className="text-xl font-display font-800 text-emerald-700 mb-1">PURSUE</div>
                    <div className="text-xs text-muted-foreground mb-4">Strong go recommendation based on weighted criteria</div>
                    <div className="space-y-2 text-left">
                      <div className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>Strong experience match with NYC DDC and comparable CM projects</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>Existing client relationship from PS 142 project</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>Confirm Safety Officer availability before committing</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>Resource capacity is tight — consider teaming arrangement</span>
                      </div>
                    </div>
                    <Button className="bg-amplify-gradient text-white gap-2 text-xs mt-4 w-full" onClick={() => toast.success("Pursuit created and assigned to BD team")}>
                      <Zap className="w-3.5 h-3.5" /> Create Pursuit & Assign Team
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
