/**
 * RfpContextSelector
 *
 * A shared sticky banner that appears at the top of all AI pipeline tool pages.
 * Lets the user pick an active pursuit (RFP) and persists the selection in
 * localStorage so every tool automatically knows which RFP it is operating on.
 *
 * Usage:
 *   const { pursuitId, pursuit } = useRfpContext();
 *   <RfpContextSelector />
 *
 * All AI tool mutations should pass `pursuitId` from this context.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Building2, Target, X, ChevronRight } from "lucide-react";
import { Link } from "wouter";

// ─── Context ──────────────────────────────────────────────────────────────────

interface RfpContextValue {
  pursuitId: string | null;
  setPursuitId: (id: string | null) => void;
  pursuit: {
    id: string;
    title: string;
    clientName: string | null;
    dueDate: Date | string | null;
    status: string | null;
    rfpNumber: string | null;
  } | null;
}

const RfpContext = createContext<RfpContextValue>({
  pursuitId: null,
  setPursuitId: () => {},
  pursuit: null,
});

const STORAGE_KEY = "amplify_active_rfp_id";

export function RfpContextProvider({ children }: { children: React.ReactNode }) {
  const [pursuitId, setPursuitIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  const { data: pursuits } = trpc.pursuits.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const pursuit = pursuits?.find((p) => p.id === pursuitId) ?? null;

  const setPursuitId = (id: string | null) => {
    setPursuitIdState(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
  };

  // If stored ID no longer exists in the list, clear it
  useEffect(() => {
    if (pursuits && pursuitId !== null) {
      const exists = pursuits.some((p) => p.id === pursuitId);
      if (!exists) setPursuitId(null);
    }
  }, [pursuits, pursuitId]);

  return (
    <RfpContext.Provider value={{ pursuitId, setPursuitId, pursuit }}>
      {children}
    </RfpContext.Provider>
  );
}

export function useRfpContext() {
  return useContext(RfpContext);
}

// ─── Status badge colors ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  identify: "bg-slate-100 text-slate-700",
  qualify: "bg-blue-100 text-blue-700",
  pursue: "bg-indigo-100 text-indigo-700",
  submit: "bg-amber-100 text-amber-700",
  award: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  no_go: "bg-gray-100 text-gray-500",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface RfpContextSelectorProps {
  /** If true, shows a compact inline version instead of the full banner */
  compact?: boolean;
  /** Optional label override */
  label?: string;
}

export function RfpContextSelector({ compact = false, label }: RfpContextSelectorProps) {
  const { pursuitId, setPursuitId, pursuit } = useRfpContext();
  const { data: pursuits, isLoading } = trpc.pursuits.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const activePursuits = pursuits?.filter(
    (p) => p.status !== "lost" && p.status !== "no_go"
  ) ?? [];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          {label ?? "RFP Context:"}
        </span>
        <Select
          value={pursuitId ? String(pursuitId) : ""}
          onValueChange={(v) => setPursuitId(v || null)}
        >
          <SelectTrigger className="h-7 text-xs w-[220px]">
            <SelectValue placeholder="Select a pursuit…" />
          </SelectTrigger>
          <SelectContent>
            {activePursuits.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pursuitId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPursuitId(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-4 py-3 mb-6 ${
      pursuit
        ? "bg-indigo-50/60 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800"
        : "bg-muted/40 border-border"
    }`}>
      <div className="flex items-center gap-3 flex-wrap">
        <Target className={`h-4 w-4 shrink-0 ${pursuit ? "text-indigo-600" : "text-muted-foreground"}`} />

        <span className="text-sm font-medium text-muted-foreground shrink-0">
          {label ?? "Active RFP:"}
        </span>

        {/* Pursuit picker */}
        <Select
          value={pursuitId ? String(pursuitId) : ""}
          onValueChange={(v) => setPursuitId(v || null)}
          disabled={isLoading}
        >
          <SelectTrigger className={`h-8 text-sm w-[280px] ${
            pursuit ? "border-indigo-300 bg-white dark:bg-indigo-950/50" : ""
          }`}>
            <SelectValue placeholder={isLoading ? "Loading pursuits…" : "Select a pursuit to scope this tool…"} />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Active Pursuits
            </div>
            {activePursuits.length === 0 && (
              <div className="px-2 py-2 text-sm text-muted-foreground">
                No active pursuits found
              </div>
            )}
            {activePursuits.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">{p.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                    {p.status}
                  </span>
                </div>
              </SelectItem>
            ))}
            {pursuits && pursuits.length > activePursuits.length && (
              <>
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide border-t mt-1 pt-2">
                  Closed
                </div>
                {pursuits
                  .filter((p) => p.status === "lost" || p.status === "no_go")
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="text-muted-foreground truncate max-w-[200px]">{p.title}</span>
                    </SelectItem>
                  ))}
              </>
            )}
          </SelectContent>
        </Select>

        {/* Pursuit metadata chips */}
        {pursuit && (
          <>
            {pursuit.clientName && (
              <div className="flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-300">
                <Building2 className="h-3 w-3" />
                <span>{pursuit.clientName}</span>
              </div>
            )}
            {pursuit.dueDate && (
              <div className="flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-300">
                <CalendarDays className="h-3 w-3" />
                <span>Due {new Date(pursuit.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            {pursuit.rfpNumber && (
              <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-700 dark:text-indigo-300">
                {pursuit.rfpNumber}
              </Badge>
            )}
            <Badge className={`text-xs ${STATUS_COLORS[pursuit.status ?? ""] ?? ""}`}>
              {pursuit.status}
            </Badge>

            {/* Quick links */}
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/pursuits/${pursuit.id}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100">
                  Pursuit Detail
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
              <Link href={`/pursuits/${pursuit.id}/workspace`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100">
                  Workspace
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setPursuitId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}

        {!pursuit && !isLoading && (
          <span className="text-xs text-muted-foreground ml-1">
            Select a pursuit to link all AI artifacts to a specific RFP.
          </span>
        )}
      </div>
    </div>
  );
}
