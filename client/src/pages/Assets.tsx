import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search, Upload, Image, FileText, Film, Grid3X3, List,
  Tag, Download, Plus, FolderOpen, Sparkles, Filter, Eye, CheckCircle2
} from "lucide-react";

const ASSETS = [
  { id: 1, name: "Route 9 Bridge Aerial.jpg", type: "image", size: "4.2 MB", tags: ["bridge", "NJDOT", "aerial"], service: "Special Inspections", project: "NJDOT Route 9", approved: true, thumb: "🌉" },
  { id: 2, name: "NYC DDC Community Center Rendering.png", type: "image", size: "8.1 MB", tags: ["rendering", "NYC DDC", "community"], service: "Construction Management", project: "NYC DDC Bronx", approved: true, thumb: "🏗️" },
  { id: 3, name: "Traffic Signal Diagram.pdf", type: "document", size: "1.2 MB", tags: ["traffic", "diagram", "NYC DOT"], service: "Traffic Engineering", project: "NYCDOT Queens Blvd", approved: true, thumb: "🚦" },
  { id: 4, name: "Streetscape Planting Plan.dwg", type: "cad", size: "12.4 MB", tags: ["planting", "streetscape", "NJ Transit"], service: "Landscape / Streetscape", project: "NJ Transit Newark", approved: false, thumb: "🌿" },
  { id: 5, name: "Wetland Assessment Map.pdf", type: "document", size: "3.8 MB", tags: ["wetlands", "map", "NJDEP"], service: "Environmental", project: "NJDEP Meadowlands", approved: true, thumb: "🗺️" },
  { id: 6, name: "Firm Logo - Full Color.svg", type: "image", size: "0.4 MB", tags: ["logo", "brand", "firm"], service: "All", project: "Brand Assets", approved: true, thumb: "🎨" },
  { id: 7, name: "PANYNJ Bayonne Bridge Photos.zip", type: "archive", size: "45.2 MB", tags: ["bridge", "PANYNJ", "photos"], service: "Special Inspections", project: "PANYNJ Bayonne", approved: true, thumb: "📦" },
  { id: 8, name: "Environmental Site Assessment Report.pdf", type: "document", size: "6.7 MB", tags: ["ESA", "environmental", "report"], service: "Environmental", project: "NJDEP Meadowlands", approved: true, thumb: "📋" },
  { id: 9, name: "Org Chart 2026.png", type: "image", size: "0.9 MB", tags: ["org chart", "firm", "personnel"], service: "All", project: "Firm Assets", approved: true, thumb: "👥" },
  { id: 10, name: "Queens Blvd Traffic Study.pdf", type: "document", size: "5.1 MB", tags: ["traffic study", "Queens", "NYCDOT"], service: "Traffic Engineering", project: "NYCDOT Queens Blvd", approved: true, thumb: "📊" },
  { id: 11, name: "Newark Streetscape Before-After.jpg", type: "image", size: "3.3 MB", tags: ["before-after", "streetscape", "Newark"], service: "Landscape / Streetscape", project: "NJ Transit Newark", approved: true, thumb: "🌳" },
  { id: 12, name: "Phase I ESA - Industrial Site.pdf", type: "document", size: "8.9 MB", tags: ["Phase I", "ESA", "industrial"], service: "Environmental", project: "Private Client", approved: false, thumb: "🏭" },
];

const TYPE_COLOR: Record<string, string> = {
  image: "text-blue-500 bg-blue-50",
  document: "text-violet-500 bg-violet-50",
  cad: "text-amber-500 bg-amber-50",
  archive: "text-gray-500 bg-gray-50",
  video: "text-rose-500 bg-rose-50"
};

const SERVICE_BADGE: Record<string, string> = {
  "Special Inspections": "bg-violet-100 text-violet-700",
  "Construction Management": "bg-blue-100 text-blue-700",
  "Traffic Engineering": "bg-teal-100 text-teal-700",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700",
  "Environmental": "bg-amber-100 text-amber-700",
  "All": "bg-gray-100 text-gray-700",
};

export default function Assets() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeType, setActiveType] = useState("all");
  const [activeService, setActiveService] = useState("all");

  const filtered = ASSETS.filter(a =>
    (activeType === "all" || a.type === activeType) &&
    (activeService === "all" || a.service === activeService) &&
    (search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      a.project.toLowerCase().includes(search.toLowerCase()))
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
          <Button variant="outline" className="gap-2"><Filter className="w-4 h-4" /> Filter</Button>
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
            onClick={() => toast.success("Upload dialog — connect to storage in production")}
          >
            <Upload className="w-4 h-4" /> Upload Assets
          </Button>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", "image", "document", "cad", "archive"].map(t => (
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
          <div className="w-px bg-border mx-1" />
          {["all", "Special Inspections", "Construction Management", "Traffic Engineering", "Landscape / Streetscape", "Environmental"].map(s => (
            <button
              key={s}
              onClick={() => setActiveService(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeService === s
                  ? "bg-primary text-white border-primary"
                  : "bg-card border-border hover:bg-muted text-foreground"
              }`}
            >
              {s === "all" ? "All Services" : s}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Assets", value: "1,247", icon: FolderOpen, color: "text-blue-500 bg-blue-50" },
            { label: "Images", value: "634", icon: Image, color: "text-violet-500 bg-violet-50" },
            { label: "Documents", value: "489", icon: FileText, color: "text-teal-500 bg-teal-50" },
            { label: "Storage Used", value: "18.4 GB", icon: Upload, color: "text-amber-500 bg-amber-50" },
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
        <div className="text-xs text-muted-foreground">
          Showing {filtered.length} of {ASSETS.length} assets
        </div>

        {/* Asset Grid */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(a => {
              const colorClass = TYPE_COLOR[a.type] || "text-gray-500 bg-gray-50";
              return (
                <Card key={a.id} className="border-border/60 cursor-pointer group hover:shadow-md transition-all hover:-translate-y-0.5">
                  <CardContent className="p-0">
                    <div className={`h-32 flex items-center justify-center text-5xl rounded-t-xl ${colorClass.split(" ")[1]}`}>
                      {a.thumb}
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-semibold text-foreground truncate mb-1">{a.name}</div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{a.size}</span>
                        {a.approved && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 px-1.5 py-0 gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />Approved
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {a.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                            <Tag className="w-2 h-2" />{t}
                          </span>
                        ))}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${SERVICE_BADGE[a.service] || "bg-gray-100 text-gray-700"}`}>
                        {a.service}
                      </span>
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
                          onClick={() => toast.success(`Downloading ${a.name}`)}
                        >
                          <Download className="w-2.5 h-2.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => toast.info(`Preview: ${a.name}`)}
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <Card key={a.id} className="border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                <CardContent className="p-3 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl bg-muted">
                    {a.thumb}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{a.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{a.size}</span>
                      <span>{a.project}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${SERVICE_BADGE[a.service] || "bg-gray-100 text-gray-700"}`}>{a.service}</span>
                      {a.tags.slice(0, 3).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.approved && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                        <CheckCircle2 className="w-3 h-3" />Approved
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => toast.success(`${a.name} inserted`)}>
                      <Plus className="w-3 h-3" /> Insert
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toast.success(`Downloading ${a.name}`)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
