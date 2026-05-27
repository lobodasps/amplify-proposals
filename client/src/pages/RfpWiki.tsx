/**
 * RFP Wiki — Hybrid Architecture
 *
 * Write time: "Extract Index" → LLM extracts structured facts with citations.
 *             No prose stored. Index is a librarian's card, not a book.
 *
 * Query time: "Ask a Question" → LLM synthesizes prose from raw XML,
 *             guided by the index as a navigation aid. Every answer cites sources.
 */
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { RfpContextSelector, useRfpContext } from "@/components/RfpContextSelector";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Sparkles, Search, Calendar, DollarSign, Users,
  FileText, CheckSquare, List, ChevronRight, AlertTriangle,
  Loader2, Info, Database, MessageSquare, Clock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CitedFact {
  value: string;
  source: string;
  xmlPath?: string;
  fileRole?: string;
}

interface EvalCriterion extends CitedFact {
  criterion: string;
  weight?: string;
}

interface KeyPersonnelEntry extends CitedFact {
  role: string;
  qualifications: string;
}

interface SectionMapEntry {
  section: string;
  description: string;
  xmlPath?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FactList({ facts, icon: Icon }: { facts: CitedFact[]; icon: React.ElementType }) {
  if (!facts?.length) return <p className="text-sm text-muted-foreground italic">None extracted</p>;
  return (
    <ul className="space-y-2">
      {facts.map((f, i) => (
        <li key={i} className="flex gap-3 items-start">
          <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{f.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.source}</p>
            {f.fileRole && (
              <Badge variant="outline" className="text-xs mt-1">{f.fileRole}</Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function EvalCriteriaTable({ criteria }: { criteria: EvalCriterion[] }) {
  if (!criteria?.length) return <p className="text-sm text-muted-foreground italic">None extracted</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-4 font-medium">Criterion</th>
            <th className="text-left py-2 pr-4 font-medium w-20">Weight</th>
            <th className="text-left py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">{c.criterion}</td>
              <td className="py-2 pr-4">
                {c.weight ? (
                  <Badge variant="secondary">{c.weight}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 text-xs text-muted-foreground">{c.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonnelTable({ personnel }: { personnel: KeyPersonnelEntry[] }) {
  if (!personnel?.length) return <p className="text-sm text-muted-foreground italic">None extracted</p>;
  return (
    <div className="space-y-3">
      {personnel.map((p, i) => (
        <div key={i} className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{p.role}</span>
          </div>
          {p.qualifications && (
            <p className="text-xs text-muted-foreground ml-6">{p.qualifications}</p>
          )}
          <p className="text-xs text-blue-600 ml-6 mt-1">{p.source}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RfpWiki() {
  const { pursuitId } = useRfpContext();
  const [selectedShredId, setSelectedShredId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [queryAnswer, setQueryAnswer] = useState<{ answer: string; question: string; _provider?: string; _model?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("index");

  const { data: shreds = [] } = trpc.xmlShredder.list.useQuery(
    { pursuitId: pursuitId ?? undefined },
    { enabled: true }
  );

  const { data: index, refetch: refetchIndex, isLoading: indexLoading } = trpc.rfpWiki.getIndex.useQuery(
    { shredId: selectedShredId! },
    { enabled: !!selectedShredId }
  );

  const extractMutation = trpc.rfpWiki.extractIndex.useMutation({
    onSuccess: () => {
      toast.success("Structured index extracted successfully");
      refetchIndex();
    },
    onError: (err) => toast.error(`Extraction failed: ${err.message}`),
  });

  const queryMutation = trpc.rfpWiki.query.useMutation({
    onSuccess: (data) => {
      setQueryAnswer(data);
      setActiveTab("query");
    },
    onError: (err) => toast.error(`Query failed: ${err.message}`),
  });

  const handleExtract = () => {
    if (!selectedShredId) return;
    extractMutation.mutate({ shredId: selectedShredId, pursuitId: pursuitId ?? undefined });
  };

  const handleQuery = () => {
    if (!selectedShredId || !question.trim()) return;
    queryMutation.mutate({ shredId: selectedShredId, question: question.trim() });
  };

  const completedShreds = shreds.filter((s: any) => s.status === "complete");
  const selectedShred = shreds.find((s: any) => s.id === selectedShredId);

  return (
    <AppLayout title="RFP Wiki">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              RFP Wiki
            </h1>
            <p className="text-muted-foreground mt-1">
              Hybrid architecture: structured index at write time, synthesis from raw XML at query time.
              Every answer cites exact sources.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              <Database className="h-3 w-3" />
              Lahoti-safe
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <Info className="h-3 w-3" />
              Pattern 2
            </Badge>
          </div>
        </div>

        {/* Architecture explanation */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Shred RFP</p>
                  <p className="text-blue-700 text-xs mt-0.5">Upload files in Document Shredder to compile into structured XML</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Extract Index</p>
                  <p className="text-blue-700 text-xs mt-0.5">LLM extracts facts + citations. No prose stored — index is a navigation guide only.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Ask Questions</p>
                  <p className="text-blue-700 text-xs mt-0.5">LLM synthesizes answers from raw XML, guided by the index. Raw XML is always the source of truth.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <RfpContextSelector />

        {/* Shred selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select RFP Package</CardTitle>
            <CardDescription>Choose a shredded RFP package to extract its index or ask questions about it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedShredId?.toString() ?? ""}
              onValueChange={(v) => {
                setSelectedShredId(Number(v));
                setQueryAnswer(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a completed shred…" />
              </SelectTrigger>
              <SelectContent>
                {completedShreds.length === 0 ? (
                  <SelectItem value="_none" disabled>No completed shreds found</SelectItem>
                ) : (
                  completedShreds.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.fileName} — {new Date(s.shredAt ?? s.createdAt ?? "").toLocaleDateString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedShred && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{(selectedShred as any).fileName}</span>
                <Badge variant="secondary" className="text-xs">{(selectedShred as any).fileType}</Badge>
                {(selectedShred as any).fileCount && (
                  <Badge variant="outline" className="text-xs">{(selectedShred as any).fileCount} files</Badge>
                )}
              </div>
            )}

            {selectedShredId && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleExtract}
                  disabled={extractMutation.isPending}
                  className="gap-2"
                >
                  {extractMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {index ? "Re-extract Index" : "Extract Index"}
                </Button>
                {index && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last extracted {new Date(index.extractedAt).toLocaleString()}
                    {index.model && ` · ${index.model}`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content area */}
        {selectedShredId && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="index" className="gap-1.5">
                <Database className="h-4 w-4" />
                Structured Index
              </TabsTrigger>
              <TabsTrigger value="query" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Ask Questions
              </TabsTrigger>
              <TabsTrigger value="legacy" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Legacy Wiki
              </TabsTrigger>
            </TabsList>

            {/* Structured Index Tab */}
            <TabsContent value="index" className="mt-4">
              {indexLoading && (
                <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading index…
                </div>
              )}
              {!indexLoading && !index && (
                <Card className="border-dashed">
                  <CardContent className="pt-8 pb-8 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">No index extracted yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Extract Index" above to extract structured facts from this RFP package.
                    </p>
                  </CardContent>
                </Card>
              )}
              {index && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-red-500" />
                        Submission Deadlines
                        <Badge variant="secondary" className="ml-auto">{index.submissionDeadlines?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.submissionDeadlines as CitedFact[]) ?? []} icon={Calendar} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        Key Dates
                        <Badge variant="secondary" className="ml-auto">{index.keyDates?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.keyDates as CitedFact[]) ?? []} icon={Clock} />
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-green-500" />
                        Evaluation Criteria
                        <Badge variant="secondary" className="ml-auto">{index.evaluationCriteria?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EvalCriteriaTable criteria={(index.evaluationCriteria as EvalCriterion[]) ?? []} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Contract Values
                        <Badge variant="secondary" className="ml-auto">{index.contractValues?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.contractValues as CitedFact[]) ?? []} icon={DollarSign} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        Page Limits
                        <Badge variant="secondary" className="ml-auto">{index.pageLimits?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.pageLimits as CitedFact[]) ?? []} icon={FileText} />
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Key Personnel Requirements
                        <Badge variant="secondary" className="ml-auto">{index.keyPersonnel?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PersonnelTable personnel={(index.keyPersonnel as KeyPersonnelEntry[]) ?? []} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-amber-500" />
                        Eligibility Requirements
                        <Badge variant="secondary" className="ml-auto">{index.eligibilityRequirements?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.eligibilityRequirements as CitedFact[]) ?? []} icon={CheckSquare} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <List className="h-4 w-4 text-slate-500" />
                        Submission Requirements
                        <Badge variant="secondary" className="ml-auto">{index.submissionRequirements?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.submissionRequirements as CitedFact[]) ?? []} icon={List} />
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-indigo-500" />
                        Scope of Services
                        <Badge variant="secondary" className="ml-auto">{index.scopeItems?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FactList facts={(index.scopeItems as CitedFact[]) ?? []} icon={ChevronRight} />
                    </CardContent>
                  </Card>

                  {(index.sectionMap?.length ?? 0) > 0 && (
                    <Card className="lg:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-teal-500" />
                          Section Map
                          <Badge variant="secondary" className="ml-auto">{index.sectionMap?.length ?? 0}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(index.sectionMap as SectionMapEntry[])?.map((s, i) => (
                            <div key={i} className="flex gap-3 items-start py-2 border-b last:border-0">
                              <Badge variant="outline" className="text-xs shrink-0">{s.section}</Badge>
                              <p className="text-sm">{s.description}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Ask Questions Tab */}
            <TabsContent value="query" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-600" />
                    Ask a Question
                  </CardTitle>
                  <CardDescription>
                    The LLM reads the raw XML and synthesizes a fresh answer with citations.
                    Nothing is cached — every query goes back to the source.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="e.g. What is the submission deadline? What are the evaluation criteria and their weights?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleQuery}
                    disabled={queryMutation.isPending || !question.trim()}
                    className="gap-2"
                  >
                    {queryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {queryMutation.isPending ? "Synthesizing answer…" : "Ask Question"}
                  </Button>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "What is the submission deadline?",
                        "What are the evaluation criteria and weights?",
                        "What key personnel are required?",
                        "What is the estimated contract value?",
                        "What are the page limits for each section?",
                        "Are there any conflicts or contradictions in the RFP?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuestion(q)}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {queryAnswer && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-sm text-muted-foreground font-normal">Question</CardTitle>
                        <p className="font-medium mt-1">{queryAnswer.question}</p>
                      </div>
                      {queryAnswer._model && (
                        <Badge variant="outline" className="text-xs shrink-0">{queryAnswer._model}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {queryAnswer.answer}
                    </pre>
                    <div className="mt-4 pt-4 border-t flex items-center gap-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Synthesized from raw RFP XML. Verify against original documents.
                        If you see ⚠️ CONFLICT DETECTED, run the Conflict Detector for a full analysis.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Legacy Wiki Tab */}
            <TabsContent value="legacy" className="mt-4">
              <LegacyWikiTab shredId={selectedShredId} pursuitId={pursuitId} />
            </TabsContent>
          </Tabs>
        )}

        {!selectedShredId && (
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Select an RFP Package</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Choose a completed shred above to extract its structured index or ask questions about the RFP.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Legacy Wiki Tab ──────────────────────────────────────────────────────────

function LegacyWikiTab({ shredId, pursuitId }: { shredId: number; pursuitId: number | null }) {
  const [firmContext, setFirmContext] = useState(
    "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, and Environmental services in NJ/NY."
  );

  const { data: wiki, refetch } = trpc.rfpWiki.getByShredId.useQuery(
    { shredId },
    { enabled: !!shredId }
  );

  const compileMutation = trpc.rfpWiki.compile.useMutation({
    onSuccess: () => {
      toast.success("Wiki compiled");
      refetch();
    },
    onError: (err) => toast.error(`Compile failed: ${err.message}`),
  });

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Deprecated:</strong> The legacy wiki compiles prose summaries that can drift from the source.
              Use the Structured Index + Ask Questions tabs instead for Lahoti-safe, citation-grounded answers.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compile Legacy Wiki</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={firmContext}
            onChange={(e) => setFirmContext(e.target.value)}
            rows={2}
            placeholder="Firm context for the wiki…"
          />
          <Button
            onClick={() => compileMutation.mutate({ shredId, firmContext, proposalId: undefined })}
            disabled={compileMutation.isPending}
            variant="outline"
            className="gap-2"
          >
            {compileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            {wiki ? "Re-compile Wiki" : "Compile Wiki"}
          </Button>
        </CardContent>
      </Card>

      {wiki && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Compiled Wiki
              <Badge variant="outline" className="text-xs ml-auto">
                ~{wiki.tokenEstimate?.toLocaleString()} tokens
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-[600px] overflow-y-auto">
              {wiki.wikiContent}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
