import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Search, Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";

export default function Glossary() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const utils = trpc.useUtils();
  const { data: terms = [], isLoading } = trpc.glossary.list.useQuery();
  const seed = trpc.glossary.seed.useMutation({ onSuccess: () => { utils.glossary.list.invalidate(); } });

  const categories = ["all", ...Array.from(new Set((terms as any[]).map((t: any) => t.category ?? "General").filter(Boolean)))].sort();
  const filtered = (terms as any[]).filter((t: any) => {
    const matchSearch = !search || t.term?.toLowerCase().includes(search.toLowerCase()) || t.definition?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || (t.category ?? "General") === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <AppLayout>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" />Glossary</h1>
          <p className="text-muted-foreground text-sm mt-1">AEC industry terms, contract definitions, and firm-specific terminology.</p>
        </div>
        {(terms as any[]).length === 0 && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Seed AEC Terms
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search terms…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} className="h-9 text-xs capitalize"
              onClick={() => setCategoryFilter(cat)}>
              {cat === "all" ? "All" : cat}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No terms found. Try adjusting your search or add terms in Settings → Glossary.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((term: any) => (
            <Card key={term.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span>{term.term}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{term.category ?? "General"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground">{term.definition ?? "No definition provided."}</p>
                {term.source && <p className="text-xs text-muted-foreground mt-1 italic">Source: {term.source}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
