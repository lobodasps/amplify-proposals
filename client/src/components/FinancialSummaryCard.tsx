import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export interface ContractFinancialsResult {
  initialAmount: number;
  effectiveCeiling: number | null;
  computedContractValue: number;
  authorizedValue: number;
  ceilingCommittedByChildren: number;
  ceilingAvailable: number;
  billedToDate: number;
  retainageAmount: number;
  remaining: number;
  isBillingOverCeiling: boolean;
  hasOverBilledChildren: boolean;
  billingPercentage: number;
  avgMonthlyBurn: number | null;
  projectedExhaustionDate: Date | null;
  daysRemaining: number | null;
  childCount: number;
  billingBasis: string;
  hasNteCeiling: boolean;
  // Optional: injected by ContractDetail for burn-rate display
  contract?: { startDate?: string | Date | null; endDate?: string | Date | null };
}

// Legacy interface for backwards-compat (non-NTE contracts computed inline)
export interface ContractFinancials {
  selfContractValue: number;
  authorizedValue: number;
  allocatedToChildren: number;
  billedToDate: number;
  remaining: number;
  descendantCount: number;
}

interface Props {
  financials: ContractFinancialsResult | ContractFinancials;
  contract?: {
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    hasNteCeiling?: boolean;
    billingBasis?: string;
  };
  className?: string;
}

const fmt = (val: number) =>
  `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (val: number) => {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return fmt(val);
};

function isFullResult(f: ContractFinancialsResult | ContractFinancials): f is ContractFinancialsResult {
  return "hasNteCeiling" in f;
}

function formatProjectedDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function FinancialSummaryCard({ financials, className }: Props) {
  if (isFullResult(financials)) {
    return <FullFinancialCard financials={financials} className={className} />;
  }
  // Legacy fallback for non-NTE inline-computed financials
  return <LegacyFinancialCard financials={financials} className={className} />;
}

// ─── Full NTE-aware card ──────────────────────────────────────────────────────

function FullFinancialCard({ financials: f, className }: { financials: ContractFinancialsResult; className?: string }) {
  const isNTE = f.hasNteCeiling;
  const isAuthorized = f.billingBasis === "authorized";
  const isOnCall = f.billingBasis === "nte_ceiling";
  const ceiling = f.effectiveCeiling ?? f.computedContractValue;
  const burnPct = ceiling > 0 ? Math.min(100, Math.round((f.billedToDate / ceiling) * 100)) : 0;
  const committedPct = ceiling > 0 ? Math.min(100, Math.round((f.ceilingCommittedByChildren / ceiling) * 100)) : 0;
  // Over-committed: sum of task order values exceeds the NTE ceiling
  const isOverCommitted = isNTE && isAuthorized && f.ceilingCommittedByChildren > ceiling;
  const overCommittedBy = isOverCommitted ? f.ceilingCommittedByChildren - ceiling : 0;

  // Progress bar: green up to 75%, amber 75-90%, red 90%+
  const barColor = burnPct >= 90 ? "bg-red-400" : burnPct >= 75 ? "bg-amber-300" : "bg-emerald-400";

  return (
    <Card className={`bg-primary text-primary-foreground border-primary ${className ?? ""}`}>
      <CardContent className="p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Financial Summary</span>
            {f.isBillingOverCeiling && (
              <Badge variant="outline" className="bg-red-500/20 text-red-200 border-red-400 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> Over Ceiling
              </Badge>
            )}
            {isOverCommitted && (
              <Badge variant="outline" className="bg-red-500/20 text-red-200 border-red-400 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> Over-Committed by {fmtCompact(overCommittedBy)}
              </Badge>
            )}
            {f.hasOverBilledChildren && !f.isBillingOverCeiling && !isOverCommitted && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-400 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> Child Over-Billed
              </Badge>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isNTE && (
              <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 text-xs">
                NTE Ceiling Contract
              </Badge>
            )}
            {isOnCall && (
              <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 text-xs">
                On-Call / Direct Bill
              </Badge>
            )}
            {isAuthorized && isNTE && (
              <Badge variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 text-xs">
                Task Order Model
              </Badge>
            )}
          </div>
        </div>

        {/* Main KPI grid */}
        {isNTE ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* NTE Ceiling */}
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">NTE Ceiling</p>
              <p className="text-xl font-bold font-mono mt-1">{fmt(ceiling)}</p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">maximum spend cap</p>
            </div>

            {/* Committed / Authorized Value */}
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">
                {isAuthorized ? "Committed" : "Authorized Value"}
              </p>
              <p className={`text-xl font-bold font-mono mt-1 ${isOverCommitted ? "text-red-300" : ""}`}>
                {isAuthorized ? fmt(f.ceilingCommittedByChildren) : fmt(f.authorizedValue)}
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {isAuthorized
                  ? ceiling > 0
                    ? `${Math.round((f.ceilingCommittedByChildren / ceiling) * 100)}% of ceiling${isOverCommitted ? " ⚠ over" : ""}`
                    : "—"
                  : ceiling > 0 ? `${Math.round((f.authorizedValue / ceiling) * 100)}% of ceiling` : "—"}
              </p>
              {isAuthorized && isOverCommitted && (
                <p className="text-xs text-red-300 mt-0.5 font-medium">+{fmt(overCommittedBy)} over ceiling</p>
              )}
            </div>

            {/* Available */}
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Available</p>
              <p className={`text-xl font-bold font-mono mt-1 ${f.ceilingAvailable < 0 ? "text-red-300" : "text-emerald-200"}`}>
                {fmt(f.ceilingAvailable)}
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {isOnCall ? "ceiling − billed" : "ceiling − committed"}
              </p>
              {f.ceilingAvailable < 0 && (
                <p className="text-xs text-red-300 mt-0.5 font-medium">OVER-COMMITTED</p>
              )}
            </div>

            {/* Billed to Date */}
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Billed to Date</p>
              <p className={`text-xl font-bold font-mono mt-1 ${f.isBillingOverCeiling ? "text-red-300" : "text-emerald-200"}`}>
                {fmt(f.billedToDate)}
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {burnPct}% of ceiling
              </p>
            </div>

            {/* Ceiling Draw-Down */}
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Ceiling Draw-Down</p>
              <p className={`text-xl font-bold font-mono mt-1 ${
                f.isBillingOverCeiling ? "text-red-300" : burnPct >= 90 ? "text-amber-200" : ""
              }`}>
                {burnPct}%
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {fmtCompact(f.billedToDate)} / {fmtCompact(ceiling)}
                <br />of ceiling used
              </p>
            </div>
          </div>
        ) : (
          // Non-NTE: simpler 4-column layout
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Contract Value</p>
              <p className="text-xl font-bold font-mono mt-1">{fmt(f.initialAmount)}</p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">original</p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Authorized Value</p>
              <p className="text-xl font-bold font-mono mt-1">{fmt(f.computedContractValue)}</p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {(() => {
                  const adj = f.computedContractValue - f.initialAmount;
                  return adj === 0 ? "no adjustments" : `${adj > 0 ? "+" : ""}${fmt(adj)} vs. original`;
                })()}
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Billed to Date</p>
              <p className={`text-xl font-bold font-mono mt-1 ${f.isBillingOverCeiling ? "text-red-300" : "text-emerald-200"}`}>
                {fmt(f.billedToDate)}
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {f.computedContractValue > 0 ? `${f.billingPercentage}% of authorized` : "—"}
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">Remaining</p>
              <p className={`text-xl font-bold font-mono mt-1 ${f.isBillingOverCeiling ? "text-red-300" : ""}`}>
                {fmt(f.remaining)}
              </p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">
                {f.isBillingOverCeiling ? "over-billed" : "unbilled"}
              </p>
            </div>
          </div>
        )}

        {/* NTE burn-down bar */}
        {isNTE && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-primary-foreground/60">
              <span className="uppercase tracking-wide font-medium">
                {isOnCall ? "On-Call Ceiling Burn-Down" : "NTE Ceiling Burn-Down"}
              </span>
              <span>{burnPct}% of NTE used</span>
            </div>
            <div className="relative h-3 rounded-full bg-primary-foreground/10 overflow-hidden">
              {/* Committed bar (task order model only) */}
              {isAuthorized && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${isOverCommitted ? "bg-red-500/40" : "bg-primary-foreground/20"}`}
                  style={{ width: `${Math.min(100, committedPct)}%` }}
                />
              )}
              {/* Billed bar */}
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
                style={{ width: `${burnPct}%` }}
              />
            </div>
            {/* Tick marks at 50%, 75%, 90%, 100% */}
            <div className="relative h-2">
              {[50, 75, 90, 100].map(pct => (
                <div
                  key={pct}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                >
                  <div className="w-px h-1.5 bg-primary-foreground/20" />
                  <span className="text-[10px] text-primary-foreground/40 mt-0.5">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Burn-rate analytics row */}
        {isNTE && (f.avgMonthlyBurn != null || f.projectedExhaustionDate != null || f.daysRemaining != null) && (
          <div className="grid grid-cols-3 gap-4 pt-1 border-t border-primary-foreground/10">
            <div>
              <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">Avg Monthly Burn</p>
              <p className="text-lg font-bold font-mono mt-1">
                {f.avgMonthlyBurn != null ? fmtCompact(f.avgMonthlyBurn) : "—"}
              </p>
              {f.contract?.startDate && (
                <p className="text-xs text-primary-foreground/40 mt-0.5">
                  since {new Date(f.contract.startDate as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">Projected Exhaustion</p>
              <p className={`text-lg font-bold font-mono mt-1 ${
                f.projectedExhaustionDate && f.daysRemaining != null &&
                new Date(f.projectedExhaustionDate) < new Date(Date.now() + f.daysRemaining * 86400000)
                  ? "text-amber-200" : ""
              }`}>
                {formatProjectedDate(f.projectedExhaustionDate)}
              </p>
              {f.projectedExhaustionDate && f.daysRemaining != null && (
                <p className="text-xs text-primary-foreground/40 mt-0.5">
                  {new Date(f.projectedExhaustionDate) > new Date(Date.now() + f.daysRemaining * 86400000)
                    ? "after contract end ✓"
                    : "before contract end ⚠️"}
                </p>
              )}
            </div>
            <div>
              <p className="text-primary-foreground/60 text-xs font-medium uppercase tracking-wide">Contract End</p>
              <p className="text-lg font-bold font-mono mt-1">
                {f.contract?.endDate
                  ? new Date(f.contract.endDate as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </p>
              {f.daysRemaining != null && (
                <p className="text-xs text-primary-foreground/40 mt-0.5">{f.daysRemaining} days remaining</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Legacy card (non-NTE inline-computed) ────────────────────────────────────

function LegacyFinancialCard({ financials, className }: { financials: ContractFinancials; className?: string }) {
  const { selfContractValue, authorizedValue, allocatedToChildren, billedToDate, remaining, descendantCount } = financials;
  const hasDrawingChildren = allocatedToChildren > 0;
  const unallocated = authorizedValue - allocatedToChildren;
  const isOverBilled = remaining < 0;
  const drawdownPct = authorizedValue > 0 ? Math.round((billedToDate / authorizedValue) * 100) : 0;
  const adj = authorizedValue - selfContractValue;

  return (
    <Card className={`bg-primary text-primary-foreground border-primary ${className ?? ""}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Financial Summary</h3>
          {descendantCount > 0 && (
            <span className="text-xs font-medium text-primary-foreground/70">
              Rolled up across {descendantCount} descendant{descendantCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Contract Value</p>
            <p className="text-xl font-bold tracking-tight font-mono mt-1">{fmt(selfContractValue)}</p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">original</p>
          </div>
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Authorized Value</p>
            <p className="text-xl font-bold tracking-tight font-mono mt-1">{fmt(authorizedValue)}</p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {adj === 0 ? "no adjustments" : `${adj > 0 ? "+" : "-"}${fmt(Math.abs(adj))} vs. original`}
            </p>
            {hasDrawingChildren && (
              <p className="text-xs text-primary-foreground/70 mt-1">
                Allocated: <span className="font-mono">{fmt(allocatedToChildren)}</span>
                {" — "}<span className="font-mono">{fmt(unallocated)}</span> unallocated
              </p>
            )}
          </div>
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Billed to Date</p>
            <p className={`text-xl font-bold tracking-tight font-mono mt-1 ${isOverBilled ? "text-red-300" : "text-green-200"}`}>
              {fmt(billedToDate)}
            </p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {authorizedValue > 0 ? `${drawdownPct}% of authorized` : "—"}
            </p>
          </div>
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Remaining</p>
            <p className={`text-xl font-bold tracking-tight font-mono mt-1 ${isOverBilled ? "text-red-300" : ""}`}>
              {fmt(remaining)}
            </p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">{isOverBilled ? "over-billed" : "unbilled"}</p>
          </div>
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Authorized Draw-Down</p>
            <p className={`text-xl font-bold tracking-tight font-mono mt-1 ${
              isOverBilled ? "text-red-300" : drawdownPct >= 90 ? "text-amber-200" : ""
            }`}>
              {authorizedValue > 0 ? `${drawdownPct}%` : "—"}
            </p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {authorizedValue > 0 ? `${fmt(billedToDate)} / ${fmt(authorizedValue)}` : "nothing authorized yet"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
