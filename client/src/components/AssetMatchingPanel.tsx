/**
 * client/src/components/AssetMatchingPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Proposal Launchpad Step 3 — Asset Matching (Phase 3 hybrid retrieval)
 *
 * Layout rules (no overlapping):
 *  • The outer wrapper is a flex-col with overflow-y: auto and a max-height so
 *    the whole panel scrolls as one unit inside the page.
 *  • Each of the three sections (Project Sheets, Staff, Past Proposals) is
 *    position: static / relative — pure document flow, margin-bottom: 24px.
 *  • The Confirm footer is position: sticky, bottom: 0, so it stays visible
 *    while scrolling but never overlaps content.
 *  • No Radix ScrollArea — each card list uses a plain overflow-y: auto div
 *    with an explicit max-height so it clips internally without affecting flow.
 *  • No z-index above 10 on any section container.
 *
 * Phase 3 additions:
 *  • matchQuality banner per section: hybrid (green), tag-only (yellow), fallback (amber)
 *  • compositeScore badge per document (suppressed when corpusSize < 8)
 *  • topChunks expandable "Why this matched" section per document
 *  • isFallback replaced by matchQuality throughout
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  User,
  Briefcase,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FolderOpen,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Tag,
  HelpCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchQuality = "hybrid" | "tag-only" | "fallback";

interface ChunkPreview {
  chunkType: string;
  content: string;
  pageRef: string | null;
  relevanceScore: number;
}

interface AssetMatchingPanelProps {
  pursuitId: string;
  serviceLines: string[];
  onComplete: () => void;
  onBack?: () => void;
}

interface SelectedPerson {
  damDocumentId: string;
  staffName: string;
  role: string;
}

type ProjectSheetDoc = {
  id: string;
  title: string;
  clientName: string | null;
  ownerName: string | null;
  contractValue: string | null;
  tags: string | null;
  staffName: string | null;
  projectName: string | null;
  extractedMeta: unknown;
  compositeScore?: number;
  matchQuality?: MatchQuality;
  topChunks?: ChunkPreview[];
};

type ResumeDoc = {
  id: string;
  title: string;
  staffName: string | null;
  tags: string | null;
  extractedMeta: unknown;
  compositeScore?: number;
  matchQuality?: MatchQuality;
  topChunks?: ChunkPreview[];
};

type PastProposalDoc = {
  id: string;
  title: string;
  clientName: string | null;
  contractValue: string | null;
  tags: string | null;
  createdAt: number | Date | null;
  extractedMeta: unknown;
  compositeScore?: number;
  matchQuality?: MatchQuality;
  topChunks?: ChunkPreview[];
};

// ─── Match Quality Banner ─────────────────────────────────────────────────────

function MatchQualityBanner({ quality }: { quality: MatchQuality }) {
  if (quality === "hybrid") {
    return (
      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
        <Zap className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800">
          <strong>Hybrid match</strong> — ranked by both service line tags and full-text content
          relevance. Scores reflect how closely each asset matches this opportunity.
        </p>
      </div>
    );
  }
  if (quality === "tag-only") {
    return (
      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200">
        <Tag className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-800">
          <strong>Tag match only</strong> — matched by service line tags. Content search is
          unavailable until documents are re-extracted with chunking enabled.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        No direct service line matches found — showing all available assets.
        Select the most relevant ones manually.
      </p>
    </div>
  );
}

// ─── Composite Score Badge ────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
    pct >= 40 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {pct}% match
    </span>
  );
}

// ─── Top Chunks Expandable Preview ───────────────────────────────────────────

function TopChunksPreview({ chunks }: { chunks: ChunkPreview[] }) {
  const [open, setOpen] = useState(false);
  if (!chunks || chunks.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Why this matched ({chunks.length} excerpt{chunks.length !== 1 ? "s" : ""})
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 pl-1 border-l-2 border-muted ml-1">
          {chunks.map((chunk, i) => (
            <div key={i} className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/70 capitalize">
                {chunk.chunkType.replace(/_/g, " ")}
              </span>
              {chunk.pageRef && (
                <span className="ml-1 text-muted-foreground/60">· p.{chunk.pageRef}</span>
              )}
              <p className="mt-0.5 leading-relaxed line-clamp-3">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

// ─── Tag list ─────────────────────────────────────────────────────────────────

function TagList({ tags }: { tags: string | null }) {
  if (!tags) return null;
  const items = tags.split(",").slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {items.map((tag, i) => (
        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
          {tag.trim()}
        </Badge>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const CORPUS_SIZE_THRESHOLD = 8;

export default function AssetMatchingPanel({
  pursuitId,
  serviceLines,
  onComplete,
  onBack,
}: AssetMatchingPanelProps) {
  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: projectSheetsData, isLoading: loadingProjects } =
    trpc.dam.matchProjectSheets.useQuery({ serviceLines });

  const { data: resumesData, isLoading: loadingResumes } =
    trpc.dam.matchResumes.useQuery({ serviceLines });

  const { data: pastProposalsData, isLoading: loadingProposals } =
    trpc.dam.matchPastProposals.useQuery({ serviceLines });

  const projectSheets: ProjectSheetDoc[] = (projectSheetsData?.results ?? []) as ProjectSheetDoc[];
  const projectsQuality: MatchQuality = (projectSheetsData?.matchQuality ?? "fallback") as MatchQuality;
  const projectsCorpusSize: number = projectSheetsData?.corpusSize ?? 0;

  const resumes: ResumeDoc[] = (resumesData?.results ?? []) as ResumeDoc[];
  const resumesQuality: MatchQuality = (resumesData?.matchQuality ?? "fallback") as MatchQuality;
  const resumesCorpusSize: number = resumesData?.corpusSize ?? 0;

  const pastProposals: PastProposalDoc[] = (pastProposalsData?.results ?? []) as PastProposalDoc[];
  const proposalsQuality: MatchQuality = (pastProposalsData?.matchQuality ?? "fallback") as MatchQuality;
  const proposalsCorpusSize: number = pastProposalsData?.corpusSize ?? 0;

  // ── Search state ───────────────────────────────────────────────────────────
  const [projectSearch, setProjectSearch] = useState("");
  const [resumeSearch, setResumeSearch] = useState("");
  const [proposalSearch, setProposalSearch] = useState("");

  const { data: projectSearchResults = [] } =
    trpc.dam.searchForAssetMatching.useQuery(
      { query: projectSearch, docTypes: ["project_sheet"] },
      { enabled: projectSearch.length >= 2 }
    );

  const { data: resumeSearchResults = [] } =
    trpc.dam.searchForAssetMatching.useQuery(
      { query: resumeSearch, docTypes: ["resume"] },
      { enabled: resumeSearch.length >= 2 }
    );

  const { data: proposalSearchResults = [] } =
    trpc.dam.searchForAssetMatching.useQuery(
      { query: proposalSearch, docTypes: ["past_proposal"] },
      { enabled: proposalSearch.length >= 2 }
    );

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedResumeIds, setSelectedResumeIds] = useState<Set<string>>(new Set());
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());
  const [personnelRoles, setPersonnelRoles] = useState<Record<string, string>>({});
  const [showWarning, setShowWarning] = useState(false);

  // ── Pre-check defaults on data load ────────────────────────────────────────
  useEffect(() => {
    if (projectSheets.length > 0 && selectedProjectIds.size === 0) {
      setSelectedProjectIds(new Set(projectSheets.slice(0, 3).map((p) => p.id)));
    }
  }, [projectSheets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pastProposals.length > 0 && selectedProposalIds.size === 0) {
      setSelectedProposalIds(new Set(pastProposals.slice(0, 1).map((p) => p.id)));
    }
  }, [pastProposals]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = trpc.pursuits.saveAssetSelections.useMutation({
    onSuccess: () => {
      toast.success("Asset selections saved!");
      onComplete();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // ── Confirm & Save ─────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const totalSelected =
      selectedProjectIds.size + selectedResumeIds.size + selectedProposalIds.size;
    if (totalSelected === 0) {
      setShowWarning(true);
      return;
    }
    doSave();
  };

  const doSave = () => {
    const allResumeDocs = [...resumes, ...(resumeSearchResults as ResumeDoc[])];
    const selectedPersonnel: SelectedPerson[] = Array.from(selectedResumeIds).map((id) => {
      const doc = allResumeDocs.find((r) => r.id === id);
      return {
        damDocumentId: id,
        staffName: doc?.staffName ?? doc?.title ?? "Unknown",
        role: personnelRoles[id] ?? "",
      };
    });
    saveMutation.mutate({
      pursuitId,
      selectedProjectIds: Array.from(selectedProjectIds),
      selectedPastProposalIds: Array.from(selectedProposalIds),
      selectedPersonnel,
    });
  };

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggleProject = (id: string) =>
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleResume = (id: string) =>
    setSelectedResumeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleProposal = (id: string) =>
    setSelectedProposalIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Merged lists (auto-match + search, deduplicated) ──────────────────────
  const allProjects = useMemo(() => {
    const map = new Map<string, ProjectSheetDoc>();
    projectSheets.forEach((p) => map.set(p.id, p));
    if (projectSearch.length >= 2)
      (projectSearchResults as unknown as ProjectSheetDoc[]).forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [projectSheets, projectSearchResults, projectSearch]);

  const allResumes = useMemo(() => {
    const map = new Map<string, ResumeDoc>();
    resumes.forEach((r) => map.set(r.id, r));
    if (resumeSearch.length >= 2)
      (resumeSearchResults as ResumeDoc[]).forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }, [resumes, resumeSearchResults, resumeSearch]);

  const allProposals = useMemo(() => {
    const map = new Map<string, PastProposalDoc>();
    pastProposals.forEach((p) => map.set(p.id, p));
    if (proposalSearch.length >= 2)
      (proposalSearchResults as unknown as PastProposalDoc[]).forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [pastProposals, proposalSearchResults, proposalSearch]);

  const isLoading = loadingProjects || loadingResumes || loadingProposals;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        maxHeight: "calc(100vh - 160px)",
        padding: "0",
      }}
    >
      {/* ── Scrollable content area ── */}
      <div style={{ flex: "1 1 auto", padding: "0 0 8px 0" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Asset Matching</h2>
            <p className="text-sm text-muted-foreground">
              Select firm assets to include in proposal generation. Matching by service lines:{" "}
              {serviceLines.length > 0 ? serviceLines.join(", ") : "none specified"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Matching assets…</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* ═══ Section A — Project Sheets ═══ */}
            <Card style={{ position: "relative" }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Relevant Project Sheets
                    <Badge variant="secondary" className="text-xs">
                      {selectedProjectIds.size} selected
                    </Badge>
                  </CardTitle>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search project sheets by title or tag…"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {allProjects.length > 0 && (
                  <MatchQualityBanner quality={projectsQuality} />
                )}
                {allProjects.length === 0 ? (
                  <EmptyState message="No project sheets found — upload project sheets to Knowledge Hub" />
                ) : (
                  <div style={{ maxHeight: "280px", overflowY: "auto" }} className="space-y-2 pr-1">
                    {allProjects.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        style={{ display: "flex" }}
                      >
                        <Checkbox
                          checked={selectedProjectIds.has(doc.id)}
                          onCheckedChange={() => toggleProject(doc.id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium leading-tight truncate">
                              {doc.projectName || doc.title}
                            </p>
                            {doc.compositeScore !== undefined && projectsCorpusSize >= CORPUS_SIZE_THRESHOLD && (
                              <ScoreBadge score={doc.compositeScore} />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {doc.clientName && <span>Client: {doc.clientName}</span>}
                            {doc.ownerName && <span>Owner: {doc.ownerName}</span>}
                            {doc.contractValue && <span>Value: {doc.contractValue}</span>}
                          </div>
                          <TagList tags={doc.tags} />
                          {doc.topChunks && doc.topChunks.length > 0 && (
                            <TopChunksPreview chunks={doc.topChunks} />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ Section B — Resumes / Staff ═══ */}
            <Card style={{ position: "relative" }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    Relevant Staff
                    <Badge variant="secondary" className="text-xs">
                      {selectedResumeIds.size} selected
                    </Badge>
                  </CardTitle>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search resumes by name or tag…"
                    value={resumeSearch}
                    onChange={(e) => setResumeSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {allResumes.length > 0 && (
                  <MatchQualityBanner quality={resumesQuality} />
                )}
                {allResumes.length === 0 ? (
                  <EmptyState message="No resumes found — upload staff resumes to Knowledge Hub" />
                ) : (
                  <div style={{ maxHeight: "320px", overflowY: "auto" }} className="space-y-2 pr-1">
                    {allResumes.map((doc) => {
                      const isSelected = selectedResumeIds.has(doc.id);
                      const meta = doc.extractedMeta as Record<string, unknown> | null;
                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <label className="flex items-start gap-3 cursor-pointer" style={{ display: "flex" }}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleResume(doc.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium leading-tight">
                                  {doc.staffName || doc.title}
                                </p>
                                {doc.compositeScore !== undefined && resumesCorpusSize >= CORPUS_SIZE_THRESHOLD && (
                                  <ScoreBadge score={doc.compositeScore} />
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                {meta?.title != null && <span>{String(meta.title)}</span>}
                                {meta?.certifications != null && (
                                  <span>
                                    Certs:{" "}
                                    {Array.isArray(meta.certifications)
                                      ? (meta.certifications as string[]).join(", ")
                                      : String(meta.certifications)}
                                  </span>
                                )}
                              </div>
                              <TagList tags={doc.tags} />
                              {doc.topChunks && doc.topChunks.length > 0 && (
                                <TopChunksPreview chunks={doc.topChunks} />
                              )}
                            </div>
                          </label>
                          {isSelected && (
                            <div className="mt-2 ml-8">
                              <Input
                                placeholder="Role in this proposal (required)"
                                value={personnelRoles[doc.id] ?? ""}
                                onChange={(e) =>
                                  setPersonnelRoles((prev) => ({ ...prev, [doc.id]: e.target.value }))
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ Section C — Past Proposals ═══ */}
            <Card style={{ position: "relative" }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    Relevant Past Proposals
                    <Badge variant="secondary" className="text-xs">
                      {selectedProposalIds.size} selected
                    </Badge>
                  </CardTitle>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search past proposals by title or tag…"
                    value={proposalSearch}
                    onChange={(e) => setProposalSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {allProposals.length > 0 && (
                  <MatchQualityBanner quality={proposalsQuality} />
                )}
                {allProposals.length === 0 ? (
                  <EmptyState message="No past proposals found" />
                ) : (
                  <div style={{ maxHeight: "220px", overflowY: "auto" }} className="space-y-2 pr-1">
                    {allProposals.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        style={{ display: "flex" }}
                      >
                        <Checkbox
                          checked={selectedProposalIds.has(doc.id)}
                          onCheckedChange={() => toggleProposal(doc.id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium leading-tight truncate">
                              {doc.title}
                            </p>
                            {doc.compositeScore !== undefined && proposalsCorpusSize >= CORPUS_SIZE_THRESHOLD && (
                              <ScoreBadge score={doc.compositeScore} />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {doc.clientName && <span>Client: {doc.clientName}</span>}
                            {doc.contractValue && <span>Value: {doc.contractValue}</span>}
                            {doc.createdAt && (
                              <span>
                                Submitted: {new Date(doc.createdAt instanceof Date ? doc.createdAt.getTime() : doc.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <TagList tags={doc.tags} />
                          {doc.topChunks && doc.topChunks.length > 0 && (
                            <TopChunksPreview chunks={doc.topChunks} />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>

      {/* ── Sticky confirm footer ── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          backgroundColor: "var(--background)",
          borderTop: "1px solid var(--border)",
          padding: "16px 0 0 0",
          marginTop: "16px",
          zIndex: 10,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button
            size="lg"
            className="gap-2"
            onClick={handleConfirm}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirm Selections and Open Workspace
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ═══ No-asset warning dialog ═══ */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              No Assets Selected
            </AlertDialogTitle>
            <AlertDialogDescription>
              No assets selected — proposal will generate without firm-specific content.
              Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={doSave}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
