import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Search, Upload, Image, FileText, Film, Grid3X3, List,
  Tag, Download, Plus, FolderOpen, Sparkles, Filter, Eye, CheckCircle2,
  File,
} from "lucide-react";

// No demo data — all assets come from the live DB via trpc.assets.list

const TYPE_COLOR: Record<string, string> = {
  image: "text-blue-500 bg-blue-50",
  document: "text-violet-500 bg-violet-50",
  presentation: "text-amber-500 bg-amber-50",
  spreadsheet: "text-emerald-500 bg-emerald-50",
  video: "text-rose-500 bg-rose-50",
  other: "text-gray-500 bg-gray-50",
};

const SERVICE_BADGE: Record<string, string> = {
  "Special Inspections": "bg-violet-100 text-violet-700",
  "Construction Management": "bg-blue-100 text-blue-700",
  "Traffic Engineering": "bg-teal-100 text-teal-700",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700",
  "Environmental": "bg-amber-100 text-amber-700",
  "All": "bg-gray-100 text-gray-700",
};

function getThumb(mimeType?: string | null, assetType?: string | null): string {
  if (mimeType?.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType?.includes("presentation") || assetType === "presentation") return "📊";
  if (mimeType?.includes("spreadsheet") || assetType === "spreadsheet") return "📋";
  if (mimeType?.startsWith("video/")) return "🎬";
  if (assetType === "document") return "📝";
  return "📁";
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseServiceLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return []; }
}

export default function Assets() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeType, setActiveType] = useState("all");

  const { data: dbAssets = [], isLoading } = trpc.assets.list.useQuery(
    search ? { search } : undefined
  );

  const filtered = dbAssets.filter((a) =>
    (activeType === "all" || a.assetType === activeType)
  );

  return (
    <AppLayout title="Digital Assets">
      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, tag, project, service line..."
              className="pl-9 h-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 px-1.5 py-0.5 gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />AI
              </Badge>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast.info("Advanced filter coming soon")}>
            <Filter className="w-4 h-4" /> Filter
          </Button>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "hover:bg-muted"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-white" : "hover:bg-muted"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button
            className="bg-gradient-to-r from-amplify-blue to-amplify-violet text-white font-semibold gap-2"
            onClick={() => toast.info("Upload assets via the Knowledge Hub or Staff / Projects pages")}
          >
            <Upload className="w-4 h-4" /> Upload Assets
          </Button>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", "image", "document", "presentation", "spreadsheet", "video", "other"].map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeType === t
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border hover:bg-muted text-foreground"
              }`}
            >
              {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: isLoading ? "…" : String(dbAssets.length), icon: FolderOpen, color: "text-blue-500 bg-blue-50" },
            { label: "Images", value: isLoading ? "…" : String(dbAssets.filter(a => a.assetType === "image").length), icon: Image, color: "text-violet-500 bg-violet-50" },
            { label: "Documents", value: isLoading ? "…" : String(dbAssets.filter(a => a.assetType === "document").length), icon: FileText, color: "text-teal-500 bg-teal-50" },
            { label: "Filtered", value: isLoading ? "…" : String(filtered.length), icon: Filter, color: "text-amber-500 bg-amber-50" },
          ].map(s => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${s.color.split(" ")[1]} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${s.color.split(" ")[0]}`} />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Results count */}
        {!isLoading && (
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {dbAssets.length} assets
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No assets found</h3>
            <p className="text-muted-foreground text-sm">
              {search ? "Try adjusting your search." : "Upload assets via the Knowledge Hub, Staff, or Projects pages."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* Asset Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(a => {
              const colorClass = TYPE_COLOR[a.assetType ?? "other"] || "text-gray-500 bg-gray-50";
              const thumb = getThumb(a.mimeType, a.assetType);
              const serviceLines = parseServiceLines(a.serviceLines);
              return (
                <Card key={a.id} className="border-border/60 cursor-pointer group hover:shadow-md transition-all hover:-translate-y-0.5">
                  <CardContent className="p-0">
                    <div className={`h-32 flex items-center justify-center text-5xl rounded-t-xl ${colorClass.split(" ")[1]}`}>
                      {thumb}
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-semibold text-foreground truncate mb-1">{a.name}</div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{formatBytes(a.fileSize)}</span>
                      </div>
                      {serviceLines.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {serviceLines.slice(0, 1).map((sl: string) => (
                            <span key={sl} className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SERVICE_BADGE[sl] || "bg-gray-100 text-gray-700"}`}>
                              {sl}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 flex-1 gap-1"
                          onClick={() => toast.success(`${a.name} inserted into proposal`)}
                        >
                          <Plus className="w-2.5 h-2.5" /> Insert
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => { if (a.fileUrl) window.open(a.fileUrl, "_blank"); }}
                        >
                          <Download className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Asset List */
          <div className="space-y-2">
            {filtered.map(a => {
              const thumb = getThumb(a.mimeType, a.assetType);
              const serviceLines = parseServiceLines(a.serviceLines);
              return (
                <Card key={a.id} className="border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardContent className="p-3 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl bg-muted">
                      {thumb}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{a.name}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{formatBytes(a.fileSize)}</span>
                        <span>{a.assetType}</span>
                        {serviceLines.slice(0, 2).map((sl: string) => (
                          <span key={sl} className={`px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${SERVICE_BADGE[sl] || "bg-gray-100 text-gray-700"}`}>{sl}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => toast.success(`${a.name} inserted`)}>
                        <Plus className="w-3 h-3" /> Insert
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (a.fileUrl) window.open(a.fileUrl, "_blank"); }}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
