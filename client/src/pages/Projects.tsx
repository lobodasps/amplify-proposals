import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Plus, MapPin, DollarSign, Calendar, Users, FileText, Filter, Building2 } from "lucide-react";

const SERVICE_BADGE: Record<string, string> = {
  "Special Inspections": "bg-violet-100 text-violet-700 border-violet-200",
  "Construction Management": "bg-blue-100 text-blue-700 border-blue-200",
  "Traffic Engineering": "bg-teal-100 text-teal-700 border-teal-200",
  "Landscape / Streetscape": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Environmental": "bg-amber-100 text-amber-700 border-amber-200",
};

const PROJECTS = [
  { id: 1, name: "PANYNJ Bayonne Bridge Special Inspection Program", client: "Port Authority NY/NJ", service: "Special Inspections", value: "$1.2M", year: "2024", location: "Bayonne, NJ / Staten Island, NY", pm: "A. Patel, PE", status: "complete", description: "Comprehensive inspection of primary and secondary structural elements of the Bayonne Bridge, including fatigue-prone details, scour evaluation, and load rating updates. Delivered AASHTO-compliant inspection reports and NJDOT Element-Level data.", tags: ["bridge", "PANYNJ", "structural", "scour"] },
  { id: 2, name: "NYC DDC Bronx Community Center — CM Services", client: "NYC DDC", service: "Construction Management", value: "$4.2M", year: "2026", location: "Bronx, NY", pm: "M. Torres, PE", status: "active", description: "Construction management services for a 45,000 SF community center including resident engineering, inspection, schedule monitoring, RFI/submittal management, and commissioning support.", tags: ["NYC DDC", "community", "CM", "Bronx"] },
  { id: 3, name: "NYCDOT Queens Boulevard Traffic Signal Modernization", client: "NYC DOT", service: "Traffic Engineering", value: "$680K", year: "2023", location: "Queens, NY", pm: "L. Nguyen, PE", status: "complete", description: "Traffic signal design and timing optimization for 18 intersections along Queens Boulevard. Included pedestrian safety improvements, accessible pedestrian signals (APS), and SCOOT adaptive control integration.", tags: ["NYCDOT", "signals", "Queens", "pedestrian"] },
  { id: 4, name: "NJ Transit Newark Broad Street Streetscape", client: "NJ Transit", service: "Landscape / Streetscape", value: "$920K", year: "2025", location: "Newark, NJ", pm: "S. Chen, ASLA", status: "active", description: "Streetscape design and construction administration for 0.8 miles of Broad Street adjacent to NJ Transit rail corridor. Included planting, paving, lighting, and stormwater management features.", tags: ["NJ Transit", "streetscape", "Newark", "planting"] },
  { id: 5, name: "NJDEP Meadowlands Wetland Assessment & Permitting", client: "NJDEP", service: "Environmental", value: "$340K", year: "2024", location: "Meadowlands, NJ", pm: "R. Kim, PE", status: "complete", description: "Phase I/II environmental site assessment, wetland delineation, and NJDEP freshwater wetlands permit application for a 42-acre industrial redevelopment site in the Meadowlands District.", tags: ["NJDEP", "wetlands", "ESA", "permitting"] },
  { id: 6, name: "NJDOT Route 1&9 Bridge Inspection Program", client: "NJDOT", service: "Special Inspections", value: "$1.8M", year: "2023", location: "Hudson County, NJ", pm: "A. Patel, PE", status: "complete", description: "Routine and in-depth inspection of 42 bridge structures along the Route 1&9 corridor. Delivered NBI-compliant inspection reports, load ratings, and maintenance recommendations.", tags: ["NJDOT", "bridge", "NBI", "Route 1&9"] },
  { id: 7, name: "NYC Parks Prospect Park Landscape Restoration", client: "NYC Parks", service: "Landscape / Streetscape", value: "$560K", year: "2025", location: "Brooklyn, NY", pm: "S. Chen, ASLA", status: "active", description: "Landscape architecture and construction administration for restoration of 3.2 acres of degraded parkland including native planting, trail improvements, and stormwater bioswales.", tags: ["NYC Parks", "landscape", "restoration", "Brooklyn"] },
  { id: 8, name: "NJDOT Route 9 Bridge Inspection Services", client: "NJDOT", service: "Special Inspections", value: "$2.4M", year: "2026", location: "Monmouth County, NJ", pm: "A. Patel, PE", status: "active", description: "Ongoing routine inspection program for 28 bridge structures along the Route 9 corridor. Includes biennial routine inspections, element-level data collection, and underwater inspection services.", tags: ["NJDOT", "bridge", "Route 9", "underwater"] },
];

export default function Projects() {
  const [search, setSearch] = useState("");
  const [activeService, setActiveService] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");

  const filtered = PROJECTS.filter(p =>
    (activeService === "all" || p.service === activeService) &&
    (activeStatus === "all" || p.status === activeStatus) &&
    (search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <AppLayout title="Project Experience">
      <div className="p-6 space-y-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by name, client, agency, keyword..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><Filter className="w-4 h-4" /> Filter</Button>
            <Button
              className="bg-gradient-to-r from-amplify-blue to-amplify-violet text-white font-semibold gap-2"
              onClick={() => toast.info("Add project form — connect to DB in production")}
            >
              <Plus className="w-4 h-4" /> Add Project
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["all", "Special Inspections", "Construction Management", "Traffic Engineering", "Landscape / Streetscape", "Environmental"].map(s => (
            <button key={s} onClick={() => setActiveService(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${activeService === s ? "bg-primary text-white border-primary" : "bg-card border-border hover:bg-muted text-foreground"}`}>
              {s === "all" ? "All Services" : s}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {["all", "active", "complete"].map(s => (
            <button key={s} onClick={() => setActiveStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${activeStatus === s ? "bg-primary text-white border-primary" : "bg-card border-border hover:bg-muted text-foreground"}`}>
              {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Projects", value: `${PROJECTS.length}`, color: "text-blue-600" },
            { label: "Active Projects", value: `${PROJECTS.filter(p => p.status === "active").length}`, color: "text-emerald-600" },
            { label: "Total Value", value: "$12.9M", color: "text-violet-600" },
            { label: "Agencies Served", value: "7", color: "text-amber-600" },
          ].map(s => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4">
                <div className={`text-2xl font-bold mb-0.5 ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Project List */}
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="border-border/60 cursor-pointer hover:shadow-md transition-all" onClick={() => toast.info(`Opening project: ${p.name}`)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-foreground text-sm leading-snug">{p.name}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.client}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{p.value}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.year}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />PM: {p.pm}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${SERVICE_BADGE[p.service] || "bg-muted text-foreground border-border"}`}>
                        {p.service}
                      </span>
                      {p.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast.success(`${p.name} added to proposal`)}>
                      <Plus className="w-3 h-3" /> Use in Proposal
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => toast.info("Generating project sheet...")}>
                      <FileText className="w-3 h-3" /> Project Sheet
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
