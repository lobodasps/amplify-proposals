/**
 * client/src/components/AssetMatchingPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Proposal Launchpad Step 3 — Asset Matching
 *
 * Three sections:
 *   A) Relevant Project Sheets (top 10, top 3 pre-checked)
 *   B) Relevant Staff / Resumes (top 10, none pre-checked, role field required)
 *   C) Relevant Past Proposals (top 5, top 1 pre-checked)
 *
 * Each section has a manual search bar to find DAM docs by title/tag.
 * "Confirm Selections and Open Workspace" saves to pursuit and navigates.
 */

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetMatchingPanelProps {
  pursuitId: string;
  serviceLines: string[];
  onComplete: () => void; // Navigate to workspace
  onBack?: () => void;
}

interface SelectedPerson {
  damDocumentId: string;
  staffName: string;
  role: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssetMatchingPanel({
  pursuitId,
  serviceLines,
  onComplete,
  onBack,
}: AssetMatchingPanelProps) {
  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: projectSheets = [], isLoading: loadingProjects } =
    trpc.dam.matchProjectSheets.useQuery(
      { serviceLines },
      { enabled: serviceLines.length > 0 }
    );

  const { data: resumes = [], isLoading: loadingResumes } =
    trpc.dam.matchResumes.useQuery(
      { serviceLines },
      { enabled: serviceLines.length > 0 }
    );

  const { data: pastProposals = [], isLoading: loadingProposals } =
    trpc.dam.matchPastProposals.useQuery(
      { serviceLines },
      { enabled: serviceLines.length > 0 }
    );

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
      const top3 = new Set(projectSheets.slice(0, 3).map((p) => p.id));
      setSelectedProjectIds(top3);
    }
  }, [projectSheets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pastProposals.length > 0 && selectedProposalIds.size === 0) {
      const top1 = new Set(pastProposals.slice(0, 1).map((p) => p.id));
      setSelectedProposalIds(top1);
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
    // Build personnel array from selected resumes + roles
    const selectedPersonnel: SelectedPerson[] = Array.from(selectedResumeIds).map(
      (id) => {
        const doc = [...resumes, ...resumeSearchResults].find((r) => r.id === id);
        return {
          damDocumentId: id,
          staffName: doc?.staffName ?? doc?.title ?? "Unknown",
          role: personnelRoles[id] ?? "",
        };
      }
    );

    saveMutation.mutate({
      pursuitId,
      selectedProjectIds: Array.from(selectedProjectIds),
      selectedPastProposalIds: Array.from(selectedProposalIds),
      selectedPersonnel,
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleResume = (id: string) => {
    setSelectedResumeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProposal = (id: string) => {
    setSelectedProposalIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Merge auto-matched + search results, deduplicate
  const allProjects = useMemo(() => {
    const map = new Map<string, typeof projectSheets[0]>();
    projectSheets.forEach((p) => map.set(p.id, p));
    if (projectSearch.length >= 2) {
      projectSearchResults.forEach((p) => map.set(p.id, p as any));
    }
    return Array.from(map.values());
  }, [projectSheets, projectSearchResults, projectSearch]);

  const allResumes = useMemo(() => {
    const map = new Map<string, typeof resumes[0]>();
    resumes.forEach((r) => map.set(r.id, r));
    if (resumeSearch.length >= 2) {
      resumeSearchResults.forEach((r) => map.set(r.id, r as typeof resumes[0]));
    }
    return Array.from(map.values());
  }, [resumes, resumeSearchResults, resumeSearch]);

  const allProposals = useMemo(() => {
    const map = new Map<string, typeof pastProposals[0]>();
    pastProposals.forEach((p) => map.set(p.id, p));
    if (proposalSearch.length >= 2) {
      proposalSearchResults.forEach((p) => map.set(p.id, p as any));
    }
    return Array.from(map.values());
  }, [pastProposals, proposalSearchResults, proposalSearch]);

  const isLoading = loadingProjects || loadingResumes || loadingProposals;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
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
        <div className="space-y-6">
          {/* ═══ Section A — Project Sheets ═══ */}
          <Card>
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
              {allProjects.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No matching project sheets found — upload project sheets to Knowledge Hub
                </div>
              ) : (
                <ScrollArea className="max-h-[280px]">
                  <div className="space-y-2">
                    {allProjects.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedProjectIds.has(doc.id)}
                          onCheckedChange={() => toggleProject(doc.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {doc.projectName || doc.title}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {doc.clientName && <span>Client: {doc.clientName}</span>}
                            {doc.ownerName && <span>Owner: {doc.ownerName}</span>}
                            {doc.contractValue && <span>Value: {doc.contractValue}</span>}
                          </div>
                          {doc.tags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {doc.tags.split(",").slice(0, 5).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {tag.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* ═══ Section B — Resumes / Staff ═══ */}
          <Card>
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
              {allResumes.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No matching resumes found — upload base resumes to Knowledge Hub
                </div>
              ) : (
                <ScrollArea className="max-h-[320px]">
                  <div className="space-y-2">
                    {allResumes.map((doc) => {
                      const isSelected = selectedResumeIds.has(doc.id);
                      const meta = doc.extractedMeta as Record<string, any> | null;
                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <label className="flex items-start gap-3 cursor-pointer">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleResume(doc.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">
                                {doc.staffName || doc.title}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                {meta?.title && <span>{meta.title}</span>}
                                {meta?.certifications && (
                                  <span>Certs: {Array.isArray(meta.certifications) ? meta.certifications.join(", ") : meta.certifications}</span>
                                )}
                              </div>
                              {doc.tags && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {doc.tags.split(",").slice(0, 5).map((tag, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                      {tag.trim()}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                          {isSelected && (
                            <div className="mt-2 ml-8">
                              <Input
                                placeholder="Role in this proposal (required)"
                                value={personnelRoles[doc.id] ?? ""}
                                onChange={(e) =>
                                  setPersonnelRoles((prev) => ({
                                    ...prev,
                                    [doc.id]: e.target.value,
                                  }))
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* ═══ Section C — Past Proposals ═══ */}
          <Card>
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
              {allProposals.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No matching past proposals found
                </div>
              ) : (
                <ScrollArea className="max-h-[220px]">
                  <div className="space-y-2">
                    {allProposals.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedProposalIds.has(doc.id)}
                          onCheckedChange={() => toggleProposal(doc.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {doc.title}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {doc.clientName && <span>Client: {doc.clientName}</span>}
                            {doc.contractValue && <span>Value: {doc.contractValue}</span>}
                            {doc.createdAt && (
                              <span>
                                Submitted: {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {doc.tags && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {doc.tags.split(",").slice(0, 5).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {tag.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* ═══ Action Buttons ═══ */}
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
