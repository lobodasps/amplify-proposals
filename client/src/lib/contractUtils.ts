// ─── Company Badge Colors (matching Replit Accordly exactly) ─────────────────

export const COMPANY_BADGE_COLORS: Record<string, {
  badge: string;
  text: string;
  bg: string;
  border: string;
}> = {
  blue: {
    badge: "border-blue-500 text-blue-700 bg-blue-50",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-500",
  },
  emerald: {
    badge: "border-emerald-500 text-emerald-700 bg-emerald-50",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-500",
  },
  violet: {
    badge: "border-violet-500 text-violet-700 bg-violet-50",
    text: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-500",
  },
  amber: {
    badge: "border-amber-500 text-amber-700 bg-amber-50",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-500",
  },
  rose: {
    badge: "border-rose-500 text-rose-700 bg-rose-50",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-500",
  },
  slate: {
    badge: "border-slate-500 text-slate-700 bg-slate-50",
    text: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-500",
  },
};

export function getCompanyBadgeClass(companyName: string | null | undefined): string {
  if (!companyName) return COMPANY_BADGE_COLORS.slate.badge;
  const lower = companyName.toLowerCase();
  if (lower.includes("jpcl") || lower.includes("j.p.c")) return COMPANY_BADGE_COLORS.blue.badge;
  if (lower.includes("strans") || lower.includes("str-")) return COMPANY_BADGE_COLORS.emerald.badge;
  return COMPANY_BADGE_COLORS.slate.badge;
}

// ─── Contract Status Display ──────────────────────────────────────────────────

export const CONTRACT_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  dot: string;
}> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
  negotiation: { label: "Negotiation", color: "bg-blue-100 text-blue-700 border-blue-300", dot: "bg-blue-500" },
  executed: { label: "Executed", color: "bg-indigo-100 text-indigo-700 border-indigo-300", dot: "bg-indigo-500" },
  active: { label: "Active", color: "bg-green-100 text-green-700 border-green-300", dot: "bg-green-500" },
  on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500" },
  completed: { label: "Completed", color: "bg-teal-100 text-teal-700 border-teal-300", dot: "bg-teal-500" },
  terminated: { label: "Terminated", color: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-500" },
  expired: { label: "Expired", color: "bg-orange-100 text-orange-700 border-orange-300", dot: "bg-orange-500" },
};

export function getStatusConfig(status: string) {
  return CONTRACT_STATUS_CONFIG[status] ?? CONTRACT_STATUS_CONFIG.draft;
}

// ─── Currency Formatting ──────────────────────────────────────────────────────

export function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return "$0.00";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCurrencyCompact(val: number | null | undefined): string {
  if (val == null) return "$0";
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

// ─── Contract Number Hierarchy ────────────────────────────────────────────────

export function getContractLevel(contractNumber: string | null | undefined): "primary" | "child" | "subproject" {
  if (!contractNumber) return "primary";
  // Remove STR- prefix for counting
  const clean = contractNumber.replace(/^STR-/, "");
  const parts = clean.split("-").filter(p => !/^[AC]\d+$/.test(p)); // exclude amendment/CO suffixes
  if (parts.length >= 3) return "subproject";
  if (parts.length === 2) return "child";
  return "primary";
}

export function isAmendmentNumber(contractNumber: string | null | undefined): boolean {
  if (!contractNumber) return false;
  return /-A\d+$/.test(contractNumber);
}

export function isChangeOrderNumber(contractNumber: string | null | undefined): boolean {
  if (!contractNumber) return false;
  return /-C\d+$/.test(contractNumber);
}
