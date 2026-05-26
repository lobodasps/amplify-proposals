import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, BookOpen, FileText, BarChart3, Shield, Calendar, ScanText, Settings, HelpCircle, ChevronRight } from "lucide-react";

const SECTIONS = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    color: "text-blue-600",
    bg: "bg-blue-50",
    articles: [
      { title: "Platform Overview", content: "Amplify Proposals is an end-to-end AEC proposal intelligence platform. It covers the full pursuit lifecycle from opportunity identification through contract execution. The platform is organized into six core modules: Opportunities/Pipeline, Proposals, Contracts, Compliance, Analytics, and Settings." },
      { title: "Navigating the Sidebar", content: "The left sidebar provides access to all modules. The top section shows primary navigation (Dashboard, Opportunities, Proposals, Contracts). The middle section shows tools (Analytics, Compliance, Contract Analyzer, Bid Calendar, Glossary). The bottom section shows Settings and Help." },
      { title: "Your First Pursuit", content: "To create your first pursuit: 1) Click 'Opportunities' in the sidebar. 2) Click 'New Pursuit' in the top right. 3) Fill in the project name, agency, due date, and estimated value. 4) Set the initial status to 'Identify'. 5) Click Save. You can then add team members, upload documents, and track progress through the pipeline stages." },
    ],
  },
  {
    id: "opportunities",
    icon: BarChart3,
    title: "Opportunities & Pipeline",
    color: "text-violet-600",
    bg: "bg-violet-50",
    articles: [
      { title: "Pipeline Stages", content: "Pursuits move through six stages: Identify (potential opportunity spotted), Qualify (go/no-go decision in progress), Pursue (actively pursuing), Submit (proposal submitted), Award (contract awarded), Lost (not selected). Use the Kanban board for a visual overview or the table view for detailed filtering." },
      { title: "Go/No-Go Scoring", content: "Each pursuit has a Go/No-Go score based on 10 weighted criteria: Client relationship, Past performance, Technical capability, Teaming, Competition, Profitability, Strategic fit, Resources, Risk, and Timeline. Scores above 70 are recommended Go; below 40 are recommended No-Go." },
      { title: "Bid Calendar", content: "The Bid Calendar shows all upcoming submission deadlines, contract end dates, and COI expirations in a unified view. Color coding: Red = overdue or within 7 days, Amber = within 30 days, Green = more than 30 days out." },
    ],
  },
  {
    id: "contracts",
    icon: FileText,
    title: "Contracts",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    articles: [
      { title: "Contract Hierarchy", content: "Contracts follow a parent-child hierarchy: Master Agreements (IDIQ, MSA) sit at the top. Task Orders and Delivery Orders are children of master agreements. Amendments and Change Orders modify existing contracts. The hierarchy view in Contract Detail shows the full tree." },
      { title: "Financial Summary Card", content: "The Financial Summary Card on each contract shows: Contract Value (authorized amount), Billed to Date, Remaining Balance, and Draw-Down percentage. The draw-down bar turns amber above 75% and red above 90% to signal budget alerts." },
      { title: "Contract Number Format", content: "Contract numbers follow the format: [COMPANY]-[YEAR]-[TYPE]-[SEQUENCE]. Example: JPCL-2025-MSA-001. The system auto-generates the next available number when creating a new contract. You can override the auto-generated number if needed." },
    ],
  },
  {
    id: "compliance",
    icon: Shield,
    title: "Compliance",
    color: "text-rose-600",
    bg: "bg-rose-50",
    articles: [
      { title: "Compliance Exceptions", content: "Compliance exceptions are flagged issues that require attention. Severity levels: BLOCKER (contract cannot proceed), WARN (action required soon), INFO (informational only). Status: OPEN (unresolved), RESOLVED (addressed). Use the 'Resolve' button to mark an exception as resolved." },
      { title: "Running a Compliance Scan", content: "Click 'Run Compliance Scan' on the Compliance page to check all active contracts for: missing COI certificates, expired agreements, missing billing information, and contracts approaching end date. New exceptions are created for any issues found." },
      { title: "COI Tracking", content: "Certificate of Insurance (COI) tracking is integrated into contract compliance. Each contract can have a COI expiration date. The system flags contracts with expired or soon-to-expire COIs as compliance exceptions." },
    ],
  },
  {
    id: "contract-analyzer",
    icon: ScanText,
    title: "Contract Analyzer",
    color: "text-amber-600",
    bg: "bg-amber-50",
    articles: [
      { title: "Uploading a Contract for Analysis", content: "The Contract Analyzer uses AI to extract key information from contract PDFs. To analyze a contract: 1) Click 'Upload & Analyze'. 2) Select a PDF, DOC, or DOCX file (max 16 MB). 3) The AI will extract parties, dates, values, contract type, billing method, key clauses, risk flags, and compliance flags. 4) Results appear in the Past Analyses list." },
      { title: "Understanding Analysis Results", content: "Each analysis extracts: Parties (all signatories with roles and addresses), Dates (execution, start, end, NTP), Values (base contract, NTE ceiling, retainage), Contract Type (IDIQ/MSA/Standalone/Task Order), Billing Method (Lump Sum/T&M/Cost Plus), Key Clauses (summaries of important provisions), Risk Flags (HIGH/MEDIUM/LOW severity issues), and a plain-English summary." },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    color: "text-slate-600",
    bg: "bg-slate-100",
    articles: [
      { title: "Managing Entities", content: "Entities represent your legal business entities (e.g., JPCL, Strans). Each entity has a name, short code, EIN, address, and primary contact. Contracts are assigned to a performing entity. The entity switcher in the header filters the view to show only contracts for the selected entity." },
      { title: "Organizations & People", content: "Organizations are client agencies and teaming partners. People are individual contacts associated with organizations. Both can be tagged with roles (Client, Prime, Sub, Teaming Partner, etc.) and linked to pursuits and contracts." },
      { title: "Form 254 / SF-330 Data", content: "The Form 254 tab stores your firm's standard qualification data: project experience, key personnel, disciplines, and certifications. This data is used to auto-populate proposal templates and SF-330 submissions." },
    ],
  },
];

const FAQ = [
  { q: "How do I add a new team member to a pursuit?", a: "Open the pursuit, go to the Team tab, and click 'Add Team Member'. You can search for existing people in your contacts or add a new person on the fly." },
  { q: "Can I import contracts from a spreadsheet?", a: "Yes. In the Contracts list, click the Import button and download the CSV template. Fill in the required fields and upload the completed file." },
  { q: "How is the win rate calculated?", a: "Win rate = Awarded / (Awarded + Lost). Pursuits in Identify, Qualify, Pursue, or Submit status are excluded from the calculation as they haven't been decided yet." },
  { q: "What file formats does the Contract Analyzer support?", a: "The Contract Analyzer supports PDF, DOC, and DOCX files up to 16 MB. For best results, use searchable PDFs rather than scanned images." },
  { q: "How do I export data to Excel?", a: "Most list views (Contracts, Pursuits, Compliance) have an 'Export CSV' button in the top right. The Analytics page also has per-chart CSV export. Open the CSV in Excel for further analysis." },
  { q: "How do I set up email reminders for contract renewals?", a: "Go to Settings > Reminders. You can configure reminder rules based on contract end dates, COI expirations, and other date fields. Reminders are sent to the contract owner's email." },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = SECTIONS.map(s => ({
    ...s,
    articles: s.articles.filter(a =>
      !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => !search || s.articles.length > 0);

  const filteredFAQ = FAQ.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Help & User Guide">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 py-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Amplify Proposals Help Center</h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">Find answers, learn features, and get the most out of your AEC proposal intelligence platform.</p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help articles..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Section Cards */}
        {!search && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className={`text-left p-4 rounded-lg border transition-all hover:shadow-sm ${activeSection === s.id ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"}`}
              >
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.articles.length} articles</p>
              </button>
            ))}
          </div>
        )}

        {/* Articles */}
        <div className="space-y-4">
          {filteredSections
            .filter(s => search || activeSection === null || activeSection === s.id)
            .map(s => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className={`w-6 h-6 rounded ${s.bg} flex items-center justify-center`}>
                      <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                    </div>
                    {s.title}
                    <Badge variant="secondary" className="ml-auto text-xs">{s.articles.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible>
                    {s.articles.map((a, i) => (
                      <AccordionItem key={i} value={`${s.id}-${i}`}>
                        <AccordionTrigger className="text-sm py-2 hover:no-underline">
                          <span className="flex items-center gap-2">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {a.title}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground pl-6 pb-3">
                          {a.content}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* FAQ */}
        {filteredFAQ.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion type="single" collapsible>
                {filteredFAQ.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-sm py-2 hover:no-underline text-left">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-3">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {filteredSections.length === 0 && filteredFAQ.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No results found for "{search}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
