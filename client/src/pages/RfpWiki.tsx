/**
 * RFP Wiki Page — Karpathy Pattern 2
 *
 * Takes shredded XML and synthesizes a living, cross-referenced Markdown wiki.
 * Replaces naive RAG chunking — knowledge compounds over time.
 * The wiki is the primary context source for all proposal AI tasks.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Loader2, RefreshCw, CheckCircle2, Zap, FileText,
  Calendar, Users, ListChecks, Lightbulb, PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";

export default function RfpWiki() {
  const [selectedShredId, setSelectedShredId] = useState<number | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [firmContext, setFirmContext] = useState(
    "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY."
  );
  const [addendumText, setAddendumText] = useState("");
  const [addendumType, setAddendumType] = useState<"addendum" | "lesson_learned" | "clarification">("addendum");
  const [updating, setUpdating] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const utils = trpc.useUtils();
  const { data: shreds = [], isLoading: shredsLoading } = trpc.xmlShredder.list.useQuery(undefined);
  const completedShreds = shreds.filter((s) => s.status === "complete");

  const { data: wiki, isLoading: wikiLoading } = trpc.rfpWiki.getByShredId.useQuery(
    { shredId: selectedShredId! },
    { enabled: !!selectedShredId }
  );

  const compileMutation = trpc.rfpWiki.compile.useMutation();
  const updateMutation = trpc.rfpWiki.update.useMutation();

  const handleCompile = async () => {
    if (!selectedShredId) { toast.error("Select a shredded document first"); return; }
    setCompiling(true);
    try {
      await compileMutation.mutateAsync({ shredId: selectedShredId, firmContext });
      utils.rfpWiki.getByShredId.invalidate({ shredId: selectedShredId });
      toast.success("Wiki compiled! Knowledge is now ready for proposal generation.");
    } catch (err: any) {
      toast.error(`Wiki compilation failed: ${err.message}`);
    } finally {
      setCompiling(false);
    }
  };

  const handleUpdate = async () => {
    if (!wiki) return;
    if (!addendumText.trim()) { toast.error("Enter addendum text first"); return; }
    setUpdating(true);
    try {
      await updateMutation.mutateAsync({ wikiId: wiki.id, addendumText, updateType: addendumType });
      utils.rfpWiki.getByShredId.invalidate({ shredId: selectedShredId! });
      setAddendumText("");
      toast.success("Wiki updated with new information");
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Parse wiki sections for the structured view
  const parseSections = (content: string) => {
    const sections: Record<string, string> = {};
    const sectionNames = [
      "Overview", "Evaluation Criteria", "Key Requirements",
      "Key Personnel", "Key Dates", "Section-by-Section Guide",
      "Compliance Checklist", "Strategic Notes",
    ];
    sectionNames.forEach((name) => {
      const regex = new RegExp(`## ${name}([\\s\\S]*?)(?=## |$)`, "i");
      const match = content.match(regex);
      if (match) sections[name.toLowerCase().replace(/ /g, "_")] = match[1].trim();
    });
    return sections;
  };

  const sections = wiki?.wikiContent ? parseSections(wiki.wikiContent) : {};

  const sectionTabs = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "evaluation_criteria", label: "Criteria", icon: ListChecks },
    { id: "key_requirements", label: "Requirements", icon: CheckCircle2 },
    { id: "key_personnel", label: "Personnel", icon: Users },
    { id: "key_dates", label: "Dates", icon: Calendar },
    { id: "section-by-section_guide", label: "Section Guide", icon: FileText },
    { id: "compliance_checklist", label: "Checklist", icon: CheckCircle2 },
    { id: "strategic_notes", label: "Strategy", icon: Lightbulb },
    { id: "full", label: "Full Wiki", icon: BookOpen },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-500" />
          RFP Wiki Compiler
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Karpathy Pattern 2 — Synthesize shredded XML into a living, cross-referenced Markdown wiki
        </p>
      </div>

      {/* Pattern explanation */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-6 text-sm">
            <div className="flex items-start gap-2 flex-1">
              <Zap className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Replaces naive RAG</p>
                <p className="text-muted-foreground">Instead of retrieving arbitrary 500-char chunks, one synthesis pass captures all relationships between sections, criteria, and requirements.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <RefreshCw className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Knowledge compounds</p>
                <p className="text-muted-foreground">Add addenda, clarifications, and lessons learned. The wiki updates incrementally — no re-shredding required.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Powers all AI tasks</p>
                <p className="text-muted-foreground">The wiki is the context source for proposal writing, resume tailoring, compliance scoring, and the Agent Guidelines advisor.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Compile Wiki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Source Document (shredded XML)</Label>
                {shredsLoading ? (
                  <div className="text-xs text-muted-foreground">Loading...</div>
                ) : completedShreds.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No shredded documents yet. Go to Document Shredder first.
                  </div>
                ) : (
                  <Select
                    value={selectedShredId?.toString() ?? ""}
                    onValueChange={(v) => setSelectedShredId(Number(v))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select document..." />
                    </SelectTrigger>
                    <SelectContent>
                      {completedShreds.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                          {s.fileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Firm Context</Label>
                <Textarea
                  value={firmContext}
                  onChange={(e) => setFirmContext(e.target.value)}
                  className="text-xs h-20 resize-none"
                  placeholder="Describe your firm's capabilities..."
                />
              </div>

              <Button
                onClick={handleCompile}
                disabled={!selectedShredId || compiling}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {compiling ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Compiling Wiki...</>
                ) : wiki ? (
                  <><RefreshCw className="h-4 w-4 mr-2" />Recompile Wiki</>
                ) : (
                  <><BookOpen className="h-4 w-4 mr-2" />Compile Wiki</>
                )}
              </Button>

              {wiki && (
                <div className="text-xs text-muted-foreground text-center">
                  Last compiled {formatDistanceToNow(new Date(wiki.compiledAt), { addSuffix: true })}
                  {wiki.tokenEstimate && ` · ~${wiki.tokenEstimate.toLocaleString()} tokens`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Update wiki */}
          {wiki && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-emerald-500" />
                  Update Wiki
                </CardTitle>
                <CardDescription className="text-xs">Add addenda, clarifications, or lessons learned</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={addendumType}
                  onValueChange={(v) => setAddendumType(v as any)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addendum">Addendum</SelectItem>
                    <SelectItem value="clarification">Clarification</SelectItem>
                    <SelectItem value="lesson_learned">Lesson Learned</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={addendumText}
                  onChange={(e) => setAddendumText(e.target.value)}
                  placeholder="Paste addendum text or enter lesson learned..."
                  className="text-xs h-24 resize-none"
                />
                <Button
                  onClick={handleUpdate}
                  disabled={updating || !addendumText.trim()}
                  variant="outline"
                  className="w-full text-xs"
                >
                  {updating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PlusCircle className="h-3 w-3 mr-1" />}
                  Update Wiki
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Wiki content */}
        <div className="lg:col-span-3">
          {wikiLoading ? (
            <Card className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </Card>
          ) : !wiki ? (
            <Card className="flex flex-col items-center justify-center h-64 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No wiki compiled yet</p>
              <p className="text-xs text-muted-foreground mt-1">Select a shredded document and click Compile Wiki</p>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Living RFP Wiki
                    </CardTitle>
                    <CardDescription className="text-xs">
                      ~{wiki.tokenEstimate?.toLocaleString() ?? "?"} tokens · Updated {formatDistanceToNow(new Date(wiki.compiledAt), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(wiki.wikiContent ?? "");
                      toast.success("Wiki copied to clipboard");
                    }}
                  >
                    Copy Wiki
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeSection} onValueChange={setActiveSection}>
                  <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                    {sectionTabs.map(({ id, label }) => (
                      <TabsTrigger key={id} value={id} className="text-xs px-2 py-1">
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {sectionTabs.map(({ id }) => (
                    <TabsContent key={id} value={id}>
                      <ScrollArea className="h-[500px] rounded-md border p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>
                            {id === "full"
                              ? (wiki.wikiContent ?? "")
                              : (sections[id] ?? `*No ${id.replace(/_/g, " ")} section found in wiki.*`)}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
