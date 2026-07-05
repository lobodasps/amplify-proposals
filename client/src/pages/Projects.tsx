import AppLayout from "@/components/AppLayout";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Plus, Search, Building2, MapPin, DollarSign, Calendar,
  Paperclip, Upload, Trash2, FileText, Image, File, Download,
  ChevronRight, Filter, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-violet-100 text-violet-700 border-violet-200",
  "Construction Management": "bg-blue-100 text-blue-700 border-blue-200",
  "Traffic Engineering": "bg-teal-100 text-teal-700 border-teal-200",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Environmental": "bg-amber-100 text-amber-700 border-amber-200",
  special_inspections: "bg-violet-100 text-violet-700 border-violet-200",
  construction_management: "bg-blue-100 text-blue-700 border-blue-200",
  traffic_engineering: "bg-teal-100 text-teal-700 border-teal-200",
  landscape_streetscape: "bg-emerald-100 text-emerald-700 border-emerald-200",
  environmental: "bg-amber-100 text-amber-700 border-amber-200",
};

const SERVICE_LABELS: Record<string, string> = {
  special_inspections: "Special Inspections",
  construction_management: "Construction Management",
  traffic_engineering: "Traffic Engineering",
  landscape_streetscape: "Landscape / Streetscape",
  environmental: "Environmental",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  complete: "bg-gray-100 text-gray-600 border-gray-200",
  on_hold: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

// No demo data — all projects come from the live DB via trpc.projects.list

function parseTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function formatCurrency(val?: number | null) {
  if (!val) return null;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf" || mimeType.includes("document")) return FileText;
  return File;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AddProjectDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [contractValue, setContractValue] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Project added!");
      utils.projects.list.invalidate();
      onAdded();
      setOpen(false);
      setName(""); setClientName(""); setDescription(""); setContractValue("");
    },
    onError: () => toast.error("Failed to add project."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-amplify-gradient text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Project Experience</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Project Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NJDOT Route 9 Bridge Inspection" className="mt-1.5" />
          </div>
          <div>
            <Label>Client / Agency</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. NJDOT" className="mt-1.5" />
          </div>
          <div>
            <Label>Contract Value ($)</Label>
            <Input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="e.g. 1200000" className="mt-1.5" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Scope of services, key deliverables..." className="mt-1.5" rows={3} />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, clientName, description, contractValue: contractValue ? parseFloat(contractValue) : undefined })}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full bg-amplify-gradient text-white"
          >
            {createMutation.isPending ? "Adding..." : "Add Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentPanel({ project, onClose }: { project: any; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: hubDocs = [], isLoading: hubLoading } = trpc.dam.listByProject.useQuery(
    { projectId: project.id },
    { enabled: project.id > 0 }
  );

  const { data: attachments = [], isLoading } = trpc.projects.listAttachments.useQuery(
    { projectId: project.id },
    { enabled: project.id > 0 }
  );

  const addAttachment = trpc.projects.addAttachment.useMutation({
    onSuccess: () => { utils.projects.listAttachments.invalidate({ projectId: project.id }); toast.success("File attached."); },
    onError: () => toast.error("Failed to attach file."),
  });

  const deleteAttachment = trpc.projects.deleteAttachment.useMutation({
    onSuccess: () => { utils.projects.listAttachments.invalidate({ projectId: project.id }); toast.success("Attachment removed."); },
    onError: () => toast.error("Failed to remove attachment."),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "projects");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = await res.json();
      await addAttachment.mutateAsync({ projectId: project.id, name: file.name, fileKey: key, fileUrl: url, mimeType: file.type, fileSize: file.size, assetType: file.type.startsWith("image/") ? "image" : "document" });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const serviceLabel = SERVICE_LABELS[project.serviceLine ?? ""] ?? project.serviceLine ?? "";

  return (
    <SheetContent className="w-[420px] sm:w-[480px] flex flex-col">
      <SheetHeader className="border-b pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amplify-blue/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-amplify-blue" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="text-sm leading-snug">{project.name}</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{project.clientName}</p>
            {serviceLabel && (
              <Badge variant="outline" className={cn("text-[10px] mt-1 border", SERVICE_COLORS[project.serviceLine ?? ""] ?? "")}>
                {serviceLabel}
              </Badge>
            )}
          </div>
        </div>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* ── Project details ── */}
        {(project.description || project.contractValue || project.location || project.awardYear) && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/40 border">
            {project.description && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scope</p>
                <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {project.contractValue && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Value</p>
                  <p className="text-sm mt-0.5">{formatCurrency(project.contractValue)}</p>
                </div>
              )}
              {project.awardYear && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Award Year</p>
                  <p className="text-sm mt-0.5">{project.awardYear}</p>
                </div>
              )}
              {project.location && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</p>
                  <p className="text-sm mt-0.5">{project.location}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tags / keywords ── */}
        {(() => {
          const tgs = parseTags(project.tags);
          return tgs.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Keywords</p>
              <div className="flex flex-wrap gap-1">
                {tgs.map((tag: string) => (
                  <span key={tag} className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">{tag}</span>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        <div className="border-t pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Files &amp; Documents</p>
        </div>

        <div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.zip" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload File (Photos, Drawings, Reports)"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">PDF, Word, PNG, JPG, DWG, ZIP up to 16 MB</p>
        </div>
        {/* Knowledge Hub documents */}
        {(hubLoading || hubDocs.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Knowledge Hub</p>
              <a href="/knowledge-hub" className="text-xs text-primary hover:underline">Open Hub</a>
            </div>
            {hubLoading ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : (
              <div className="space-y-2">
                {hubDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <div className="w-9 h-9 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {doc.docType?.replace(/_/g, " ")}
                        {doc.companyTag ? ` · ${doc.companyTag}` : ""}
                        {doc.processingStatus === "indexed" ? " · Indexed" : ""}
                      </p>
                    </div>
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No files attached yet.</p>
            <p className="text-xs mt-1">Upload project photos, drawings, or reports above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{attachments.length} Attachment{attachments.length !== 1 ? "s" : ""}</p>
            {attachments.map((att: any) => {
              const Icon = getFileIcon(att.mimeType);
              return (
                <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors group">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(att.fileSize)}{att.createdAt && ` · ${new Date(att.createdAt).toLocaleDateString()}`}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="w-3.5 h-3.5" /></Button>
                    </a>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteAttachment.mutate({ assetId: att.id })} disabled={deleteAttachment.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SheetContent>
  );
}

function ProjectCard({ project, onOpenAttachments }: { project: any; onOpenAttachments: (p: any) => void }) {
  const tags = parseTags(project.tags);
  const serviceLabel = SERVICE_LABELS[project.serviceLine ?? ""] ?? project.serviceLine ?? "";
  const statusLabel = (project.status ?? "").replace(/_/g, " ");

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onOpenAttachments(project)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2">{project.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{project.clientName}</p>
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border flex-shrink-0 capitalize", STATUS_COLORS[project.status ?? ""] ?? "")}>
            {statusLabel}
          </Badge>
        </div>
        {project.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {serviceLabel && (
            <Badge variant="outline" className={cn("text-[10px] border", SERVICE_COLORS[project.serviceLine ?? ""] ?? "")}>
              {serviceLabel}
            </Badge>
          )}
          {project.contractValue && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />{formatCurrency(project.contractValue)}
            </span>
          )}
          {project.location && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{project.location}
            </span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 4).map((tag: string) => (
              <span key={tag} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); toast.success(`${project.name} added to proposal`); }}>
            <Plus className="w-3 h-3" /> Use in Proposal
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            View Details <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const SERVICE_FILTER_OPTIONS = [
  { value: "all", label: "All Services" },
  { value: "special_inspections", label: "Special Inspections" },
  { value: "construction_management", label: "Construction Management" },
  { value: "traffic_engineering", label: "Traffic Engineering" },
  { value: "landscape_streetscape", label: "Landscape / Streetscape" },
  { value: "environmental", label: "Environmental" },
];

export default function Projects() {
  const [search, setSearch] = useState("");
  const [activeService, setActiveService] = useState("all");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const { data: dbProjects, isLoading, refetch } = trpc.projects.list.useQuery();

  const filtered = (dbProjects ?? []).filter((p: any) =>
    (activeService === "all" || p.serviceLine === activeService) &&
    (!search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.clientName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      parseTags(p.tags).some((t: string) => t.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <AppLayout title="Projects">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display font-700 text-xl text-foreground">Projects</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Past project experience, photos, drawings, and reports</p>
          </div>
          <AddProjectDialog onAdded={refetch} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, client, or tag..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {SERVICE_FILTER_OPTIONS.map(opt => (
              <Button key={opt.value} variant={activeService === opt.value ? "default" : "outline"} size="sm"
                className={cn("text-xs h-8", activeService === opt.value ? "bg-amplify-blue text-white" : "")}
                onClick={() => setActiveService(opt.value)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <span>{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>Click <Paperclip className="w-3 h-3 inline" /> Files to attach photos, drawings, or reports</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No projects found</p>
            <p className="text-sm mt-1">Try adjusting your search or add a new project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project: any) => (
              <ProjectCard key={project.id} project={project} onOpenAttachments={setSelectedProject} />
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedProject} onOpenChange={(open) => !open && setSelectedProject(null)}>
        {selectedProject && <AttachmentPanel project={selectedProject} onClose={() => setSelectedProject(null)} />}
      </Sheet>
    </AppLayout>
  );
}
