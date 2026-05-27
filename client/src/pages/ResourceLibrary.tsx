import { useState, useRef, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Upload, FileText, Image, Presentation, Table2, Video, File,
  Download, Loader2, Plus, Trash2, Eye, FolderOpen, Tag, Settings2, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { TagBadge, type TagDef } from "@/components/TagBadge";
import { TagFilterBar } from "@/components/TagFilterBar";

// ─── Constants ───────────────────────────────────────────────────────────────

const TAB_CONFIGS = [
  { value: "all", label: "All", folder: null },
  { value: "proposal-templates", label: "Proposal Templates", folder: "proposal-templates" },
  { value: "boilerplate", label: "Boilerplate Text", folder: "boilerplate" },
  { value: "rate-sheets", label: "Rate Sheets", folder: "rate-sheets" },
  { value: "project-sheets", label: "Project Sheets", folder: "project-sheets" },
  { value: "staff-profiles", label: "Staff Profiles", folder: "staff-profiles" },
  { value: "digital-assets", label: "Digital Assets", folder: "digital-assets" },
  { value: "content-blocks", label: "Content Blocks", folder: "content-blocks" },
];

const ASSET_TYPE_ICONS: Record<string, any> = {
  image: Image, document: FileText, presentation: Presentation,
  spreadsheet: Table2, video: Video, other: File,
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  image: "text-rose-500 bg-rose-50",
  document: "text-blue-500 bg-blue-50",
  presentation: "text-amber-500 bg-amber-50",
  spreadsheet: "text-emerald-500 bg-emerald-50",
  video: "text-violet-500 bg-violet-50",
  other: "text-slate-500 bg-slate-100",
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTagIds(raw: unknown): number[] {
  if (!raw) return [];
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p.map(Number).filter(Boolean) : [];
  } catch { return []; }
}

// ─── Asset Card ──────────────────────────────────────────────────────────────

function AssetCard({
  asset, allTags, onDelete, onTagsChange,
}: {
  asset: any;
  allTags: TagDef[];
  onDelete: () => void;
  onTagsChange: (tagIds: number[]) => void;
}) {
  const Icon = ASSET_TYPE_ICONS[asset.assetType ?? "other"] ?? File;
  const colorClass = ASSET_TYPE_COLORS[asset.assetType ?? "other"] ?? "text-slate-500 bg-slate-100";
  const tagIds = parseTagIds(asset.tags);
  const assetTagDefs = allTags.filter((t) => tagIds.includes(t.id));
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [localTagIds, setLocalTagIds] = useState<number[]>(tagIds);

  const handleTagToggle = (id: number) => {
    setLocalTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSaveTags = () => {
    onTagsChange(localTagIds);
    setTagPopoverOpen(false);
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{asset.name}</p>
            {asset.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{asset.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">{asset.assetType ?? "document"}</Badge>
              {asset.folder && asset.folder !== "root" && (
                <Badge variant="outline" className="text-xs">
                  <FolderOpen className="h-2.5 w-2.5 mr-1" />{asset.folder}
                </Badge>
              )}
              {asset.fileSize && (
                <span className="text-xs text-muted-foreground">{formatBytes(asset.fileSize)}</span>
              )}
            </div>
            {/* Tag badges */}
            {assetTagDefs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {assetTagDefs.map((t) => (
                  <TagBadge key={t.id} tag={t} size="sm" />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Tag editor popover */}
            <Popover open={tagPopoverOpen} onOpenChange={(o) => { setTagPopoverOpen(o); if (o) setLocalTagIds(tagIds); }}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit tags">
                  <Tag className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <p className="text-xs font-semibold mb-2">Edit Tags</p>
                {allTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tags defined yet. Create tags in Tag Manager.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {allTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTagToggle(t.id)}
                        className="flex items-center gap-1"
                      >
                        <TagBadge tag={t} size="sm" active={localTagIds.includes(t.id)} />
                        {localTagIds.includes(t.id) && <Check className="h-3 w-3 text-emerald-500 -ml-1" />}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setTagPopoverOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveTags}>Save</Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
              <a href={asset.fileUrl} download={asset.name}><Download className="h-3.5 w-3.5" /></a>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tag Manager Panel ───────────────────────────────────────────────────────

function TagManagerPanel({ allTags, onClose }: { allTags: TagDef[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const createTag = trpc.assets.createTag.useMutation({
    onSuccess: () => { toast.success("Tag created"); utils.assets.listTags.invalidate(); setNewName(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTag = trpc.assets.deleteTag.useMutation({
    onSuccess: () => { toast.success("Tag deleted"); utils.assets.listTags.invalidate(); utils.assets.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Tag Manager</CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new tag */}
        <div className="space-y-2">
          <Label className="text-xs">Create New Tag</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createTag.mutate({ name: newName.trim(), color: newColor }); }}
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createTag.isPending}
              onClick={() => createTag.mutate({ name: newName.trim(), color: newColor })}
            >
              {createTag.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {/* Color picker */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: newColor === c ? "#000" : "transparent" }}
                onClick={() => setNewColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Existing tags */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Existing Tags</Label>
          {allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tags yet. Create your first tag above.</p>
          ) : (
            <div className="space-y-1.5">
              {allTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagBadge tag={tag} size="sm" />
                    <span className="text-xs text-muted-foreground">{tag.usageCount ?? 0} assets</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteTag.mutate({ id: tag.id })}
                    disabled={deleteTag.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ResourceLibrary() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", assetType: "document", folder: "root", tagIds: [] as number[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const utils = trpc.useUtils();
  const { data: allTags = [] } = trpc.assets.listTags.useQuery();
  const { data: assetRows = [], isLoading } = trpc.assets.list.useQuery({
    search: search || undefined,
    assetType: assetType !== "all" ? assetType : undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  });

  const createAsset = trpc.assets.create.useMutation({
    onSuccess: () => {
      toast.success("Asset uploaded");
      utils.assets.list.invalidate();
      utils.assets.listTags.invalidate();
      setShowUpload(false);
      setPendingFile(null);
      setForm({ name: "", description: "", assetType: "document", folder: "root", tagIds: [] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAsset = trpc.assets.delete.useMutation({
    onSuccess: () => { toast.success("Asset deleted"); utils.assets.list.invalidate(); utils.assets.listTags.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const updateAssetTags = trpc.assets.updateAssetTags.useMutation({
    onSuccess: () => { utils.assets.list.invalidate(); utils.assets.listTags.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const handleTagToggle = useCallback((id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleClearFilters = () => {
    setSearch("");
    setAssetType("all");
    setSelectedTagIds([]);
  };

  const tabConfig = TAB_CONFIGS.find((t) => t.value === activeTab);
  const rows = (assetRows as any[]).filter((a) => {
    if (!tabConfig?.folder) return true;
    return a.folder === tabConfig.folder;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50 MB)"); return; }
    setPendingFile(file);
    setForm((f) => ({
      ...f,
      name: f.name || file.name.replace(/\.[^.]+$/, ""),
      assetType: file.type.startsWith("image/") ? "image"
        : file.type.includes("pdf") || file.type.includes("word") ? "document"
        : file.type.includes("sheet") || file.type.includes("excel") ? "spreadsheet"
        : file.type.includes("presentation") || file.type.includes("powerpoint") ? "presentation"
        : file.type.startsWith("video/") ? "video" : "document",
      folder: tabConfig?.folder ?? "root",
    }));
    setShowUpload(true);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!pendingFile) { toast.error("No file selected"); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("folder", form.folder);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url, key } = await res.json();
      await createAsset.mutateAsync({
        name: form.name || pendingFile.name,
        description: form.description || undefined,
        assetType: form.assetType,
        fileKey: key,
        fileUrl: url,
        mimeType: pendingFile.type,
        fileSize: pendingFile.size,
        folder: form.folder,
        tagIds: form.tagIds,
      });
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Resource Library">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Resource Library</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Proposal templates, boilerplate text, rate sheets, and supporting assets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTagManager((v) => !v)}
              className={showTagManager ? "bg-accent" : ""}
            >
              <Settings2 className="h-4 w-4 mr-1.5" /> Tag Manager
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          </div>
        </div>

        {/* Tag Manager panel */}
        {showTagManager && (
          <TagManagerPanel allTags={allTags as TagDef[]} onClose={() => setShowTagManager(false)} />
        )}

        {/* Filter bar */}
        <TagFilterBar
          search={search}
          onSearchChange={setSearch}
          assetType={assetType}
          onAssetTypeChange={setAssetType}
          allTags={allTags as TagDef[]}
          selectedTagIds={selectedTagIds}
          onTagToggle={handleTagToggle}
          onClearAll={handleClearFilters}
        />

        {/* Folder tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 flex-wrap h-auto">
            {TAB_CONFIGS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
                {t.folder && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5">
                    {(assetRows as any[]).filter((a) => a.folder === t.folder).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_CONFIGS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No assets found</p>
                  <p className="text-xs mt-1">
                    {selectedTagIds.length > 0 || search || assetType !== "all"
                      ? "Try adjusting your filters"
                      : "Upload files to get started"}
                  </p>
                  {selectedTagIds.length === 0 && !search && assetType === "all" && (
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Upload First Asset
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">{rows.length} asset{rows.length !== 1 ? "s" : ""}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rows.map((a: any) => (
                      <AssetCard
                        key={a.id}
                        asset={a}
                        allTags={allTags as TagDef[]}
                        onDelete={() => deleteAsset.mutate({ id: a.id })}
                        onTagsChange={(tagIds) => updateAssetTags.mutate({ assetId: a.id, tagIds })}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={(v) => { if (!v) { setShowUpload(false); setPendingFile(null); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Asset</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {pendingFile && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{pendingFile.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{formatBytes(pendingFile.size)}</span>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Asset Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Enter asset name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Asset Type</Label>
                  <Select value={form.assetType} onValueChange={(v) => setForm((f) => ({ ...f, assetType: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="presentation">Presentation</SelectItem>
                      <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Folder</Label>
                  <Select value={form.folder} onValueChange={(v) => setForm((f) => ({ ...f, folder: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">General</SelectItem>
                      <SelectItem value="project-sheets">Project Sheets</SelectItem>
                      <SelectItem value="staff-profiles">Staff Profiles</SelectItem>
                      <SelectItem value="rate-sheets">Rate Sheets</SelectItem>
                      <SelectItem value="proposal-templates">Proposal Templates</SelectItem>
                      <SelectItem value="digital-assets">Digital Assets</SelectItem>
                      <SelectItem value="content-blocks">Content Blocks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Tag assignment on upload */}
              {(allTags as TagDef[]).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(allTags as TagDef[]).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          tagIds: f.tagIds.includes(t.id)
                            ? f.tagIds.filter((x) => x !== t.id)
                            : [...f.tagIds, t.id],
                        }))}
                      >
                        <TagBadge tag={t} size="sm" active={form.tagIds.includes(t.id)} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUpload(false); setPendingFile(null); }}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || createAsset.isPending}>
                {(uploading || createAsset.isPending)
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Uploading…</>
                  : <><Upload className="h-4 w-4 mr-1.5" />Upload</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
