import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useState } from "react";
import { Package, Download, CheckCircle2, FileText, Users, FolderOpen, Image, Table, Layers, ArrowRight, Sparkles, RefreshCw } from "lucide-react";

const EXPORT_SECTIONS = [
  { id: "cover", label: "Cover Letter", type: "text", size: "2KB" },
  { id: "exec", label: "Executive Summary", type: "text", size: "4KB" },
  { id: "firm", label: "Firm Qualifications", type: "text", size: "6KB" },
  { id: "projects", label: "Project Experience Sheets (3)", type: "data", size: "18KB" },
  { id: "resumes", label: "Key Personnel Resumes (4)", type: "data", size: "24KB" },
  { id: "technical", label: "Technical Approach", type: "text", size: "8KB" },
  { id: "mgmt", label: "Management Plan", type: "text", size: "5KB" },
  { id: "mwbe", label: "M/WBE Participation Plan", type: "text", size: "3KB" },
];

const EXPORT_ASSETS = [
  { id: "logo", label: "Firm Logo (PNG, 300dpi)", type: "image", size: "420KB" },
  { id: "project1", label: "PS 142 Renovation — Site Photo", type: "image", size: "2.1MB" },
  { id: "project2", label: "Bronx Community Center — Aerial", type: "image", size: "1.8MB" },
  { id: "map", label: "NYC Agency Coverage Map", type: "image", size: "890KB" },
  { id: "org", label: "Project Organization Chart", type: "graphic", size: "340KB" },
  { id: "schedule", label: "Preliminary Project Schedule", type: "table", size: "120KB" },
];

export default function InDesignExport() {
  const [selectedSections, setSelectedSections] = useState<string[]>(EXPORT_SECTIONS.map(s => s.id));
  const [selectedAssets, setSelectedAssets] = useState<string[]>(EXPORT_ASSETS.map(a => a.id));
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState("json");

  const toggleSection = (id: string) => {
    setSelectedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };
  const toggleAsset = (id: string) => {
    setSelectedAssets(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleExport = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 2500));
    setExporting(false);
    toast.success(`InDesign package exported — ${selectedSections.length} sections, ${selectedAssets.length} assets, ${format.toUpperCase()} data format.`);
  };

  return (
    <AppLayout title="InDesign Export Center">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-rose-500/10 border border-purple-200/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display font-700 text-foreground">InDesign Export Center</h2>
              <p className="text-xs text-muted-foreground">Assemble a complete InDesign-ready data package with structured JSON/XML/CSV content, linked high-resolution assets, field mappings, and layout tokens for Adobe Data Merge. Future: Adobe UXP plugin integration.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Section Selector */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Proposal Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXPORT_SECTIONS.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <Checkbox checked={selectedSections.includes(s.id)} onCheckedChange={() => toggleSection(s.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.type} · {s.size}</div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s.type === "data" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{s.type}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Asset Selector */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Image className="w-4 h-4 text-primary" /> Digital Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXPORT_ASSETS.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <Checkbox checked={selectedAssets.includes(a.id)} onCheckedChange={() => toggleAsset(a.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground">{a.type} · {a.size}</div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${a.type === "image" ? "bg-emerald-100 text-emerald-700" : a.type === "graphic" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>{a.type}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Export Configuration */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Export Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Data Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {["json", "xml", "csv"].map(f => (
                    <button key={f} onClick={() => setFormat(f)} className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${format === f ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:bg-muted/30"}`}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">InDesign Template Target</label>
                <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3">
                  <option>Standard AEC Proposal (8.5×11)</option>
                  <option>SF 330 Format</option>
                  <option>NYC Agency Qualifications</option>
                  <option>Project Sheet Template</option>
                  <option>Resume Template</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Image Resolution</label>
                <select className="w-full h-9 rounded-lg border border-border/60 bg-background text-xs px-3">
                  <option>300 DPI (Print Quality)</option>
                  <option>150 DPI (Digital/Screen)</option>
                  <option>72 DPI (Web Preview)</option>
                </select>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                <div className="text-xs font-semibold text-foreground">Package Summary</div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Sections selected</span><span className="font-semibold text-foreground">{selectedSections.length} / {EXPORT_SECTIONS.length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Assets selected</span><span className="font-semibold text-foreground">{selectedAssets.length} / {EXPORT_ASSETS.length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Data format</span><span className="font-semibold text-foreground">{format.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Est. package size</span><span className="font-semibold text-foreground">~8.4 MB</span>
                </div>
              </div>
              <Button className="bg-amplify-gradient text-white gap-2 text-xs w-full" onClick={handleExport} disabled={exporting}>
                {exporting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Building Package...</> : <><Download className="w-3.5 h-3.5" /> Export InDesign Package</>}
              </Button>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200/60">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-700">Coming Soon: Adobe UXP Plugin</span>
                </div>
                <p className="text-[10px] text-purple-600">Search and pull Amplify-Proposals content directly inside InDesign. Live content refresh, brand compliance checks, and missing-asset alerts.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
