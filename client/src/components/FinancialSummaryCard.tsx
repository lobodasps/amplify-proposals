import { Card, CardContent } from "@/components/ui/card";

export interface ContractFinancials {
  selfContractValue: number;   // in dollars (Amplify stores dollars, not cents)
  authorizedValue: number;
  allocatedToChildren: number;
  billedToDate: number;
  remaining: number;
  descendantCount: number;
}

interface Props {
  financials: ContractFinancials;
  className?: string;
}

const fmt = (val: number) =>
  `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FinancialSummaryCard({ financials, className }: Props) {
  const {
    selfContractValue,
    authorizedValue,
    allocatedToChildren,
    billedToDate,
    remaining,
    descendantCount,
  } = financials;

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
          {/* Contract Value */}
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Contract Value</p>
            <p className="text-xl font-bold tracking-tight font-mono mt-1">{fmt(selfContractValue)}</p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">original</p>
          </div>

          {/* Authorized Value */}
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Authorized Value</p>
            <p className="text-xl font-bold tracking-tight font-mono mt-1">{fmt(authorizedValue)}</p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {adj === 0 ? "no adjustments" : `${adj > 0 ? "+" : "-"}${fmt(Math.abs(adj))} vs. original`}
            </p>
            {hasDrawingChildren && (
              <p className="text-xs text-primary-foreground/70 mt-1">
                Allocated to children: <span className="font-mono">{fmt(allocatedToChildren)}</span>
                {" — "}
                <span className="font-mono">{fmt(unallocated)}</span> unallocated
              </p>
            )}
          </div>

          {/* Billed to Date */}
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Billed to Date</p>
            <p className={`text-xl font-bold tracking-tight font-mono mt-1 ${isOverBilled ? "text-red-300" : "text-green-200"}`}>
              {fmt(billedToDate)}
            </p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {authorizedValue > 0 ? `${drawdownPct}% of authorized` : "—"}
            </p>
          </div>

          {/* Remaining */}
          <div>
            <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wide">Remaining</p>
            <p className={`text-xl font-bold tracking-tight font-mono mt-1 ${isOverBilled ? "text-red-300" : ""}`}>
              {fmt(remaining)}
            </p>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {isOverBilled ? "over-billed" : "unbilled"}
            </p>
          </div>

          {/* Authorized Draw-Down */}
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
