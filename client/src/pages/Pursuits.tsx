import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Plus, Search, Filter, Target, Calendar, DollarSign, User } from "lucide-react";

const PURSUITS = [
  { id: 1, title: "NJDOT Route 9 Bridge Inspection Services", client: "NJDOT", status: "pursue", statusLabel: "Pursue", statusColor: "status-pursue", due: "2026-06-15", value: "$2.4M", service: "Special Inspections", lead: "M. Torres", probability: 65 },
  { id: 2, title: "NYC DDC Community Center CM Services", client: "NYC DDC", status: "submit", statusLabel: "Submitted", statusColor: "status-submit", due: "2026-06-03", value: "$5.1M", service: "Construction Management", lead: "J. Rivera", probability: 80 },
  { id: 3, title: "NYCDOT Traffic Signal Modernization", client: "NYC DOT", status: "qualify", statusLabel: "Qualify", statusColor: "status-qualify", due: "2026-07-08", value: "$890K", service: "Traffic Engineering", lead: "A. Patel", probability: 40 },
  { id: 4, title: "NJ Transit Station Streetscape Design", client: "NJ Transit", status: "identify", statusLabel: "Identify", statusColor: "status-identify", due: "2026-08-01", value: "$1.2M", service: "Landscape / Streetscape", lead: "S. Chen", probability: 30 },
  { id: 5, title: "NJDEP Wetlands Assessment Program", client: "NJDEP", status: "pursue", statusLabel: "Pursue", statusColor: "status-pursue", due: "2026-06-28", value: "$650K", service: "Environmental", lead: "R. Kim", probability: 55 },
  { id: 6, title: "PANYNJ Terminal Expansion Inspection", client: "Port Authority NY/NJ", status: "award", statusLabel: "Awarded", statusColor: "status-award", due: "2026-05-01", value: "$3.8M", service: "Special Inspections", lead: "M. Torres", probability: 100 },
  { id: 7, title: "NYC Parks Greenway Landscape Study", client: "NYC Parks", status: "lost", statusLabel: "Lost", statusColor: "status-lost", due: "2026-04-15", value: "$420K", service: "Landscape / Streetscape", lead: "S. Chen", probability: 0 },
];

export default function Pursuits() {
  return (
    <AppLayout title="Pursuits">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search pursuits..." className="pl-9" />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" /> Filter
            </Button>
          </div>
          <Button className="bg-amplify-gradient text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> New Pursuit
          </Button>
        </div>

        <div className="grid gap-3">
          {PURSUITS.map((p) => (
            <Link key={p.id} href={`/pursuits/${p.id}`}>
              <Card className="card-hover border-border/60 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-foreground text-sm leading-snug">{p.title}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${p.statusColor}`}>{p.statusLabel}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.client}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {p.due}</span>
                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{p.value}</span>
                        <Badge variant="outline" className="text-xs font-medium">{p.service}</Badge>
                        <span className="text-muted-foreground">Lead: {p.lead}</span>
                        <span className="font-semibold text-foreground">P(win): {p.probability}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
