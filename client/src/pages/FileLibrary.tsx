import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Image, Presentation, Table2, Video, File,
  Download, Eye, Trash2, HardDrive, Users, Building2, Library, Loader2,
  FolderOpen, Tag, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { TagBadge, type TagDef } from "@/components/TagBadge";
import { TagFilterBar } from "@/components/TagFilterBar";
import { TagManagerPanel } from "@/components/TagManagerPanel";

// ─── Constants ───────────────────────────────────────────────────────────────

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

const SOURCE_ICONS: Record<string, any> = {
  staff: Users,
  projects: Building2,
  "resource-library": Library,
};

const SOURCE_LABELS: Record<string, string> = {
  staff: "Staff",
  projects: "Projects",
  "proposal-templates": "Proposal Templates",
  "boilerplate": "Boilerplate",
  "rate-sheets": "Rate Sheets",
  "project-sheets": "Project Sheets",
  "staff-profiles": "Staff Profiles",
  "digital-assets": "Digital Assets",
  "content-blocks": "Content Blocks",
  root: "General",
};

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

// ─── Asset Row ───────────────────────────────────────────────────────────────

function AssetRow({
  asset, allTags, onDelete,
}: {
  asset: any;
  allTags: TagDef[];
  onDelete: () => void;
}) {
  const Icon = ASSET_TYPE_ICONS[asset.assetType ?? "other"] ?? File;
  const colorClass = ASSET_TYPE_COLORS[asset.assetType ?? "other"] ?? "text-slate-500 bg-slate-100";
  const tagIds = parseTagIds(asset.tags);
  const assetTagDefs = allTags.filter((t) => tagIds.includes(t.id));
  const SourceIcon = SOURCE_ICONS[asset.folder] ?? FolderOpen;
  const sourceLabel = SOURCE_LABELS[asset.folder ?? "root"] ?? asset.folder ?? "General";

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-muted/40 rounded-lg group transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{asset.name}</p>
          {assetTagDefs.map((t) => (
            <TagBadge key={t.id} tag={t} size="sm" />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="secondary" className="text-xs capitalize py-0">{asset.assetType ?? "document"}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <SourceIcon className="h-3 w-3" />{sourceLabel}
          </span>
          {asset.fileSize && (
            <span className="text-xs text-muted-foreground">{formatBytes(asset.fileSize)}</span>
          )}
          {asset.description && (
            <span className="text-xs text-muted-foreground truncate max-w-xs">{asset.description}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
          <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" title="Preview">
            <Eye className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
          <a href={asset.fileUrl} download={asset.name} title="Download">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FileLibrary() {
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);

  const utils = trpc.useUtils();
  const { data: allTags = [] } = trpc.assets.listTags.useQuery();
  const { data: assetRows = [], isLoading } = trpc.assets.list.useQuery({
    search: search || undefined,
    assetType: assetType !== "all" ? assetType : undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
  });

  const deleteAsset = trpc.assets.delete.useMutation({
    onSuccess: () => {
      toast.success("File deleted");
      utils.assets.list.invalidate();
      utils.assets.listTags.invalidate();
    },
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

  const rows = assetRows as any[];

  // Stats
  const totalSize = rows.reduce((sum, a) => sum + (a.fileSize ?? 0), 0);
  const byType = rows.reduce((acc: Record<string, number>, a) => {
    const t = a.assetType ?? "other";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout title="File Library">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              File Library
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All files uploaded across Staff, Projects, and Resource Library — in one place.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTagManager((v) => !v)}
            className={showTagManager ? "bg-accent" : ""}
          >
            <Settings2 className="h-4 w-4 mr-1.5" /> Tag Manager
          </Button>
        </div>

        {/* Stats bar */}
        {rows.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="font-medium text-foreground">{rows.length} files</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{formatBytes(totalSize)} total</span>
            {Object.entries(byType).map(([type, count]) => (
              <span key={type} className="capitalize">{count} {type}{count !== 1 ? "s" : ""}</span>
            ))}
          </div>
        )}

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

        {/* File list */}
        <Card>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No files found</p>
                <p className="text-xs mt-1">
                  {selectedTagIds.length > 0 || search || assetType !== "all"
                    ? "Try adjusting your filters"
                    : "Upload files via Staff records, Projects, or the Resource Library"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {rows.map((a: any) => (
                  <AssetRow
                    key={a.id}
                    asset={a}
                    allTags={allTags as TagDef[]}
                    onDelete={() => deleteAsset.mutate({ id: a.id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
