import AppLayout from "@/components/AppLayout";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Plus, Search, Users, Mail, Phone, Briefcase, Star,
  Paperclip, Upload, Trash2, FileText, Image, File, Download,
  ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_LINE_COLORS: Record<string, string> = {
  "Special Inspections": "bg-violet-100 text-violet-700 border-violet-200",
  "Construction Management": "bg-blue-100 text-blue-700 border-blue-200",
  "Traffic Engineering": "bg-teal-100 text-teal-700 border-teal-200",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Environmental": "bg-amber-100 text-amber-700 border-amber-200",
};

const DEMO_STAFF = [
  { id: 1, name: "Maria Torres, PE", title: "Senior Proposal Coordinator", email: "m.torres@firm.com", phone: "201-555-0101", yearsExperience: 14, serviceLines: JSON.stringify(["Special Inspections", "Construction Management"]), summary: "14 years of AEC proposal management with NJDOT, NYC DDC, and Port Authority experience." },
  { id: 2, name: "James Rivera, AICP", title: "Business Development Manager", email: "j.rivera@firm.com", phone: "212-555-0102", yearsExperience: 18, serviceLines: JSON.stringify(["Construction Management", "Traffic Engineering"]), summary: "18 years in AEC business development, specializing in NYC agency relationships." },
  { id: 3, name: "Aisha Patel, PE", title: "Traffic Engineering Lead", email: "a.patel@firm.com", phone: "973-555-0103", yearsExperience: 11, serviceLines: JSON.stringify(["Traffic Engineering"]), summary: "NYCDOT and NJDOT traffic signal and ITS project specialist." },
  { id: 4, name: "Sarah Chen, RLA", title: "Landscape Architecture Principal", email: "s.chen@firm.com", phone: "212-555-0104", yearsExperience: 16, serviceLines: JSON.stringify(["Landscape / Streetscape"]), summary: "NYC streetscape and parks design with NJ Transit and NYC Parks experience." },
  { id: 5, name: "Robert Kim, PE", title: "Environmental Practice Lead", email: "r.kim@firm.com", phone: "609-555-0105", yearsExperience: 20, serviceLines: JSON.stringify(["Environmental"]), summary: "NJDEP-licensed environmental engineer specializing in wetlands, Phase I/II ESA, and permitting." },
  { id: 6, name: "David Okafor, SE", title: "Special Inspections Manager", email: "d.okafor@firm.com", phone: "201-555-0106", yearsExperience: 12, serviceLines: JSON.stringify(["Special Inspections"]), summary: "NICET Level IV certified inspector with extensive NJDOT bridge and structural experience." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseServiceLines(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
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

// ─── Add Staff Dialog ─────────────────────────────────────────────────────────

function AddStaffDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.personnel.create.useMutation({
    onSuccess: () => {
      toast.success("Team member added!");
      utils.personnel.list.invalidate();
      onAdded();
      setOpen(false);
      setName(""); setTitle(""); setEmail(""); setSummary("");
    },
    onError: () => toast.error("Failed to add team member."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-amplify-gradient text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria Torres, PE" className="mt-1.5" />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Proposal Coordinator" className="mt-1.5" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="m.torres@firm.com" className="mt-1.5" />
          </div>
          <div>
            <Label>Summary</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brief bio and specializations..." className="mt-1.5" rows={3} />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, title, email, summary })}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full bg-amplify-gradient text-white"
          >
            {createMutation.isPending ? "Adding..." : "Add Staff Member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attachment Panel ─────────────────────────────────────────────────────────

function AttachmentPanel({ staffMember, onClose }: { staffMember: any; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: attachments = [], isLoading } = trpc.personnel.listAttachments.useQuery(
    { staffId: staffMember.id },
    { enabled: staffMember.id > 0 }
  );

  const { data: hubDocs = [], isLoading: hubLoading } = trpc.dam.listByStaff.useQuery(
    { staffId: staffMember.id },
    { enabled: staffMember.id > 0 }
  );

  const addAttachment = trpc.personnel.addAttachment.useMutation({
    onSuccess: () => {
      utils.personnel.listAttachments.invalidate({ staffId: staffMember.id });
      toast.success("File attached successfully.");
    },
    onError: () => toast.error("Failed to attach file."),
  });

  const deleteAttachment = trpc.personnel.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.personnel.listAttachments.invalidate({ staffId: staffMember.id });
      toast.success("Attachment removed.");
    },
    onError: () => toast.error("Failed to remove attachment."),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "staff");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = await res.json();
      await addAttachment.mutateAsync({
        staffId: staffMember.id,
        name: file.name,
        fileKey: key,
        fileUrl: url,
        mimeType: file.type,
        fileSize: file.size,
        assetType: file.type.startsWith("image/") ? "image" : "document",
      });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = staffMember.name
    ? staffMember.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <SheetContent className="w-[420px] sm:w-[480px] flex flex-col">
      <SheetHeader className="border-b pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-amplify-blue text-white font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="text-base">{staffMember.name}</SheetTitle>
            <p className="text-sm text-muted-foreground">{staffMember.title}</p>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {/* ── Profile details ── */}
        {(staffMember.summary || staffMember.yearsExperience || staffMember.education) && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/40 border">
            {staffMember.summary && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bio / Summary</p>
                <p className="text-sm text-foreground leading-relaxed">{staffMember.summary}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {staffMember.yearsExperience && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience</p>
                  <p className="text-sm mt-0.5">{staffMember.yearsExperience} years</p>
                </div>
              )}
              {staffMember.companyTag && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</p>
                  <p className="text-sm mt-0.5">{staffMember.companyTag}</p>
                </div>
              )}
            </div>
            {staffMember.education && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Education</p>
                <p className="text-sm text-foreground">{staffMember.education}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Disciplines ── */}
        {(() => {
          const sls = parseServiceLines(staffMember.serviceLines);
          return sls.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Disciplines</p>
              <div className="flex flex-wrap gap-1.5">
                {sls.map((sl: string) => (
                  <Badge key={sl} variant="outline" className={cn("text-xs border", SERVICE_LINE_COLORS[sl] ?? "bg-gray-100 text-gray-600")}>{sl}</Badge>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* ── Keywords / Tags ── */}
        {(() => {
          const rawTags = staffMember.tags;
          let tgs: string[] = [];
          if (Array.isArray(rawTags)) tgs = rawTags;
          else if (typeof rawTags === 'string') { try { tgs = JSON.parse(rawTags); } catch { tgs = []; } }
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

        {/* ── Contact ── */}
        {(staffMember.email || staffMember.phone) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</p>
            <div className="space-y-1 text-sm">
              {staffMember.email && (
                <a href={`mailto:${staffMember.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {staffMember.email}
                </a>
              )}
              {staffMember.phone && (
                <a href={`tel:${staffMember.phone}`} className="flex items-center gap-2 hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {staffMember.phone}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="border-t pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Files &amp; Documents</p>
        </div>

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.svg"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload File (Resume, Headshot, Cert)"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            PDF, Word, PNG, JPG up to 16 MB
          </p>
        </div>

        {/* Knowledge Hub documents */}
        {(hubLoading || hubDocs.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Knowledge Hub
              </p>
              <a href="/knowledge-hub" className="text-xs text-primary hover:underline">
                Open Hub
              </a>
            </div>
            {hubLoading ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : (
              <div className="space-y-2">
                {hubDocs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                  >
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
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attachment list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No files attached yet.</p>
            <p className="text-xs mt-1">Upload a resume, headshot, or certification above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {attachments.length} Attachment{attachments.length !== 1 ? "s" : ""}
            </p>
            {attachments.map((att: any) => {
              const Icon = getFileIcon(att.mimeType);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(att.fileSize)}
                      {att.createdAt && ` · ${new Date(att.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteAttachment.mutate({ assetId: att.id })}
                      disabled={deleteAttachment.isPending}
                    >
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

// ─── Staff Card ───────────────────────────────────────────────────────────────

function StaffCard({ member, onOpenAttachments }: { member: any; onOpenAttachments: (m: any) => void }) {
  const serviceLines = parseServiceLines(member.serviceLines);
  const initials = member.name
    ? member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpenAttachments(member)}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="w-11 h-11 flex-shrink-0">
            <AvatarFallback className="bg-amplify-blue text-white font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-sm leading-tight">{member.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{member.title}</p>
              </div>
              {member.yearsExperience && (
                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                  <Star className="w-3 h-3" />
                  {member.yearsExperience}y
                </div>
              )}
            </div>

            {member.summary && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{member.summary}</p>
            )}

            {serviceLines.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {serviceLines.slice(0, 3).map((sl: string) => (
                  <Badge
                    key={sl}
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4 border", SERVICE_LINE_COLORS[sl] ?? "bg-gray-100 text-gray-600")}
                  >
                    {sl}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {member.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {member.email}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                View Details <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Staff() {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const { data: dbStaff, isLoading, refetch } = trpc.personnel.list.useQuery(undefined as any);
  const staff = (dbStaff && dbStaff.length > 0) ? dbStaff : DEMO_STAFF;

  const filtered = staff.filter((p: any) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.summary ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Staff">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display font-700 text-xl text-foreground">Staff</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Team members, resumes, headshots, and certifications
            </p>
          </div>
          <AddStaffDialog onAdded={refetch} />
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, or specialty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>Click any card to view profile details, disciplines, keywords, and linked documents</span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No staff members found</p>
            <p className="text-sm mt-1">Try adjusting your search or add a new team member.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((member: any) => (
              <StaffCard
                key={member.id}
                member={member}
                onOpenAttachments={setSelectedMember}
              />
            ))}
          </div>
        )}
      </div>

      {/* Attachment side panel */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        {selectedMember && (
          <AttachmentPanel
            staffMember={selectedMember}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </Sheet>
    </AppLayout>
  );
}
