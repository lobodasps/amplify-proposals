import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Search, Users, Mail, Phone, Briefcase, Star } from "lucide-react";

const SERVICE_LINE_COLORS: Record<string, string> = {
  "Special Inspections": "badge-special-inspections",
  "Construction Management": "badge-construction-management",
  "Traffic Engineering": "badge-traffic-engineering",
  "Landscape / Streetscape": "badge-landscape-streetscape",
  "Environmental": "badge-environmental",
};

const DEMO_PERSONNEL = [
  { id: 1, name: "Maria Torres, PE", title: "Senior Proposal Coordinator", email: "m.torres@firm.com", phone: "201-555-0101", yearsExperience: 14, serviceLines: JSON.stringify(["Special Inspections", "Construction Management"]), summary: "14 years of AEC proposal management with NJDOT, NYC DDC, and Port Authority experience." },
  { id: 2, name: "James Rivera, AICP", title: "Business Development Manager", email: "j.rivera@firm.com", phone: "212-555-0102", yearsExperience: 18, serviceLines: JSON.stringify(["Construction Management", "Traffic Engineering"]), summary: "18 years in AEC business development, specializing in NYC agency relationships." },
  { id: 3, name: "Aisha Patel, PE", title: "Traffic Engineering Lead", email: "a.patel@firm.com", phone: "973-555-0103", yearsExperience: 11, serviceLines: JSON.stringify(["Traffic Engineering"]), summary: "NYCDOT and NJDOT traffic signal and ITS project specialist." },
  { id: 4, name: "Sarah Chen, RLA", title: "Landscape Architecture Principal", email: "s.chen@firm.com", phone: "212-555-0104", yearsExperience: 16, serviceLines: JSON.stringify(["Landscape / Streetscape"]), summary: "NYC streetscape and parks design with NJ Transit and NYC Parks experience." },
  { id: 5, name: "Robert Kim, PE", title: "Environmental Practice Lead", email: "r.kim@firm.com", phone: "609-555-0105", yearsExperience: 20, serviceLines: JSON.stringify(["Environmental"]), summary: "NJDEP-licensed environmental engineer specializing in wetlands, Phase I/II ESA, and permitting." },
  { id: 6, name: "David Okafor, SE", title: "Special Inspections Manager", email: "d.okafor@firm.com", phone: "201-555-0106", yearsExperience: 12, serviceLines: JSON.stringify(["Special Inspections"]), summary: "NICET Level IV certified inspector with extensive NJDOT bridge and structural experience." },
];

function AddPersonnelDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const utils = trpc.useUtils();
  const createMutation = trpc.personnel.create.useMutation({
    onSuccess: () => {
      toast.success("Team member added!");
      utils.personnel.list.invalidate();
      onAdded();
      setOpen(false);
      setName(""); setTitle(""); setEmail("");
    },
    onError: () => toast.error("Failed to add team member."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-amplify-gradient text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Team Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Full Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria Torres, PE" className="mt-1.5" /></div>
          <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Proposal Coordinator" className="mt-1.5" /></div>
          <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="m.torres@firm.com" className="mt-1.5" /></div>
          <Button onClick={() => createMutation.mutate({ name, title, email })} disabled={!name.trim() || createMutation.isPending} className="w-full bg-amplify-gradient text-white">
            {createMutation.isPending ? "Adding..." : "Add Team Member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Personnel() {
  const [search, setSearch] = useState("");
  const { data: dbPersonnel, isLoading } = trpc.personnel.list.useQuery(undefined as any);
  const personnel = (dbPersonnel && dbPersonnel.length > 0) ? dbPersonnel : DEMO_PERSONNEL;
  const filtered = personnel.filter((p: any) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.title ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Personnel</h1>
            <p className="text-muted-foreground mt-1">Team member profiles, resumes, and qualifications</p>
          </div>
          <AddPersonnelDialog onAdded={() => {}} />
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search team members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((person: any) => {
              const serviceLines = (() => { try { const sl = person.serviceLines; if (!sl) return []; if (Array.isArray(sl)) return sl; if (typeof sl === "string") return JSON.parse(sl); return []; } catch { return []; } })();
              const initials = person.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Card key={person.id} className="card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="bg-amplify-gradient text-white text-sm font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm">{person.name}</h3>
                        <p className="text-xs text-muted-foreground">{person.title}</p>
                      </div>
                      {person.yearsExperience && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          <Star className="w-2.5 h-2.5 mr-1 text-amber-500" />{person.yearsExperience}y
                        </Badge>
                      )}
                    </div>
                    {person.summary && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{person.summary}</p>}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {serviceLines.slice(0, 2).map((sl: string) => (
                        <span key={sl} className={`service-badge ${SERVICE_LINE_COLORS[sl] ?? "badge-special-inspections"}`}>{sl}</span>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {person.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{person.email}</div>}
                      {person.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{person.phone}</div>}
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
