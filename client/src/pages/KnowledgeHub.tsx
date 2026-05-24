import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BookOpen, Building2, Users, FileText, Sparkles, Tag, Filter } from "lucide-react";

const SERVICE_LINES = [
  { key: "all", label: "All" },
  { key: "special_inspections", label: "Special Inspections", color: "badge-special-inspections" },
  { key: "construction_management", label: "Construction Mgmt", color: "badge-construction-management" },
  { key: "traffic_engineering", label: "Traffic Engineering", color: "badge-traffic-engineering" },
  { key: "landscape_streetscape", label: "Landscape / Streetscape", color: "badge-landscape-streetscape" },
  { key: "environmental", label: "Environmental", color: "badge-environmental" },
];

const PROJECTS = [
  { id: 1, name: "NJDOT Route 1&9 Bridge Inspection", client: "NJDOT", year: "2023", value: "$1.8M", service: "special_inspections", tags: ["bridge", "NJDOT", "inspection"] },
  { id: 2, name: "NYC DDC Bronx Community Center CM", client: "NYC DDC", year: "2022", value: "$4.2M", service: "construction_management", tags: ["NYC", "community", "CM"] },
  { id: 3, name: "NYCDOT Queens Blvd Signal Upgrade", client: "NYC DOT", year: "2024", value: "$750K", service: "traffic_engineering", tags: ["signals", "NYC", "traffic"] },
  { id: 4, name: "NJ Transit Newark Streetscape", client: "NJ Transit", year: "2023", value: "$980K", service: "landscape_streetscape", tags: ["streetscape", "NJ", "transit"] },
  { id: 5, name: "NJDEP Meadowlands Wetland Assessment", client: "NJDEP", year: "2022", value: "$420K", service: "environmental", tags: ["wetlands", "NJDEP", "assessment"] },
  { id: 6, name: "PANYNJ Bayonne Bridge Inspection", client: "Port Authority NY/NJ", year: "2024", value: "$2.1M", service: "special_inspections", tags: ["bridge", "PANYNJ", "inspection"] },
];

const BOILERPLATE = [
  { id: 1, title: "NJDOT Prequalification Statement", category: "qualifications", service: "special_inspections", approved: true },
  { id: 2, title: "Firm Overview — AEC Services", category: "boilerplate", service: "all", approved: true },
  { id: 3, title: "Bridge Inspection Methodology", category: "methodology", service: "special_inspections", approved: true },
  { id: 4, title: "Construction Management Approach", category: "approach", service: "construction_management", approved: true },
  { id: 5, title: "Environmental Assessment Framework", category: "methodology", service: "environmental", approved: false },
  { id: 6, title: "DBE/MBE Participation Statement", category: "certifications", service: "all", approved: true },
];

const SERVICE_COLOR: Record<string, string> = {
  special_inspections: "badge-special-inspections",
  construction_management: "badge-construction-management",
  traffic_engineering: "badge-traffic-engineering",
  landscape_streetscape: "badge-landscape-streetscape",
  environmental: "badge-environmental",
};

export default function KnowledgeHub() {
  const [search, setSearch] = useState("");
  const [activeService, setActiveService] = useState("all");

  const filteredProjects = PROJECTS.filter(p =>
    (activeService === "all" || p.service === activeService) &&
    (search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout title="Knowledge Hub">
      <div className="p-6 space-y-5">
        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search projects, resumes, boilerplate, certifications..." className="pl-9 h-11 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 px-1.5 py-0.5"><Sparkles className="w-2.5 h-2.5 mr-0.5" />AI Search</Badge>
            </div>
          </div>
          <Button variant="outline" className="gap-2"><Filter className="w-4 h-4" /> Filter</Button>
        </div>

        {/* Service Line Filter */}
        <div className="flex flex-wrap gap-2">
          {SERVICE_LINES.map(sl => (
            <button key={sl.key} onClick={() => setActiveService(sl.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeService === sl.key ? "ring-2 ring-primary ring-offset-1 " : ""}${sl.color || "bg-muted text-foreground"}`}>
              {sl.label}
            </button>
          ))}
        </div>

        <Tabs defaultValue="projects">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="projects" className="gap-2"><Building2 className="w-4 h-4" /> Projects ({filteredProjects.length})</TabsTrigger>
            <TabsTrigger value="boilerplate" className="gap-2"><BookOpen className="w-4 h-4" /> Content Library</TabsTrigger>
            <TabsTrigger value="personnel" className="gap-2"><Users className="w-4 h-4" /> Personnel</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map(p => (
                <Card key={p.id} className="card-hover border-border/60 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-foreground text-sm leading-snug">{p.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span>{p.client}</span><span>·</span><span>{p.year}</span><span>·</span><span className="font-semibold text-foreground">{p.value}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${SERVICE_COLOR[p.service] || "bg-muted text-foreground"}`}>
                        {SERVICE_LINES.find(s => s.key === p.service)?.label}
                      </span>
                      {p.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-0.5"><Tag className="w-2.5 h-2.5" />{t}</span>)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="boilerplate" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BOILERPLATE.map(b => (
                <Card key={b.id} className="card-hover border-border/60 cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4.5 h-4.5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{b.title}</span>
                        {b.approved && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 px-1.5 py-0">Approved</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{b.category}</span>
                        {b.service !== "all" && <span className={`px-1.5 py-0.5 rounded-full font-semibold ${SERVICE_COLOR[b.service] || ""}`}>{SERVICE_LINES.find(s => s.key === b.service)?.label}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="personnel" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                { name: "A. Patel, PE", title: "Bridge Inspection Engineer", services: ["special_inspections"], exp: 18, certs: ["PE-NJ", "NICET III"] },
                { name: "J. Rivera", title: "Proposal Manager", services: ["construction_management", "special_inspections"], exp: 12, certs: ["PMP"] },
                { name: "M. Torres, PE", title: "Sr. Project Manager", services: ["construction_management", "traffic_engineering"], exp: 22, certs: ["PE-NJ", "PE-NY", "PMP"] },
                { name: "S. Chen, ASLA", title: "Landscape Architect", services: ["landscape_streetscape"], exp: 15, certs: ["ASLA", "LEED AP"] },
                { name: "R. Kim, PE", title: "Environmental Engineer", services: ["environmental"], exp: 14, certs: ["PE-NJ", "LEED AP"] },
                { name: "D. Johnson", title: "Field Inspector", services: ["special_inspections"], exp: 8, certs: ["NICET II"] },
              ].map(p => (
                <Card key={p.name} className="card-hover border-border/60 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {p.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.title}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.services.map(s => <span key={s} className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${SERVICE_COLOR[s]}`}>{SERVICE_LINES.find(sl => sl.key === s)?.label}</span>)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.exp} yrs experience</span>
                      <div className="flex gap-1">{p.certs.map(c => <span key={c} className="px-1.5 py-0.5 rounded bg-muted font-medium">{c}</span>)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
