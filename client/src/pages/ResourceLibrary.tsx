import { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Upload, FileText, Image, Presentation, Table2, Video, File,
  Download, Loader2, Plus, Trash2, Eye, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

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
  image: Image,
  document: FileText,
  presentation: Presentation,
  spreadsheet: Table2,
  video: Video,
  other: File,
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  image: "text-rose-500 bg-rose-50",
  document: "text-blue-500 bg-blue-50",
  presentation: "text-amber-500 bg-amber-50",
  spreadsheet: "text-emerald-500 bg-emerald-50",
  video: "text-violet-500 bg-violet-50",
  other: "text-slate-500 bg-slate-100",
};

function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetCard({ asset, onDelete }: { asset: any; onDelete: () => void }) {
  const Icon = ASSET_TYPE_ICONS[asset.assetType ?? "other"] ?? File;
  const colorClass = ASSET_TYPE_COLORS[asset.assetType ?? "other"] ?? "text-slate-500 bg-slate-100";
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{asset.name}</p>
            {asset.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{asset.description}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">{asset.assetType ?? "document"}</Badge>
              {asset.folder && asset.folder !== "root" && (
                <Badge variant="outline" className="text-xs"><FolderOpen className="h-2.5 w-2.5 mr-1" />{asset.folder}</Badge>
              )}
              {asset.fileSize && <span className="text-xs text-muted-foreground">{formatBytes(asset.fileSize)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

export default function ResourceLibrary() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", assetType: "document", folder: "root" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const utils = trpc.useUtils();
  const { data: assets = [], isLoading } = trpc.assets.list.useQuery();
  const createAsset = trpc.assets.create.useMutation({
    onSuccess: () => { toast.success("Asset uploaded"); utils.assets.list.invalidate(); setShowUpload(false); setPendingFile(null); setForm({ name: "", description: "", assetType: "document", folder: "root" }); },
    onError: e => toast.error(e.message),
  });

  const rows = assets as any[];
  const tabConfig = TAB_CONFIGS.find(t => t.value === activeTab);
  const filtered = rows.filter(a => {
    const matchFolder = !tabConfig?.folder || a.folder === tabConfig.folder;
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { toast.error("File too large (max 16 MB)"); return; }
    setPendingFile(file);
    setForm(f => ({
      ...f,
      name: f.name || file.name.replace(/\.[^.]+$/, ""),
      assetType: file.type.startsWith("image/") ? "image" : file.type.includes("pdf") || file.type.includes("word") ? "document" : file.type.includes("sheet") || file.type.includes("excel") ? "spreadsheet" : file.type.includes("presentation") || file.type.includes("powerpoint") ? "presentation" : file.type.startsWith("video/") ? "video" : "document",
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Resource Library</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Proposal templates, boilerplate text, rate sheets, and supporting assets for proposal writing.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets..." className="pl-9 h-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />Upload
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 flex-wrap h-auto">
            {TAB_CONFIGS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
                {t.folder && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5">
                    {rows.filter(a => a.folder === t.folder).length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TAB_CONFIGS.map(t => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No assets yet</p>
                  <p className="text-xs mt-1">Upload files to get started</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Upload First Asset
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((a: any) => (
                    <AssetCard key={a.id} asset={a} onDelete={() => toast.info("Delete coming soon")} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={showUpload} onOpenChange={v => { if (!v) { setShowUpload(false); setPendingFile(null); } }}>
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
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter asset name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Asset Type</Label>
                  <Select value={form.assetType} onValueChange={v => setForm(f => ({ ...f, assetType: v }))}>
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
                  <Select value={form.folder} onValueChange={v => setForm(f => ({ ...f, folder: v }))}>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUpload(false); setPendingFile(null); }}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || createAsset.isPending}>
                {(uploading || createAsset.isPending) ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4 mr-1.5" />Upload</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
