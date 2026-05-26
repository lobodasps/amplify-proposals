/**
 * Contract and Project Number Generation
 *
 * JPCL:   YY-NNN  (primary)  →  YY-NNN-NNN  (child)  →  YY-NNN-NNN-NNN  (sub-project)
 * Strans: STR-YY-NNN         →  STR-YY-NNN-NNN        →  STR-YY-NNN-NNN-NNN
 *
 * Amendments:    [parent]-A001, -A002, ...
 * Change Orders: [parent]-C001, -C002, ...
 *
 * Old/legacy numbers (e.g. PRJ-2024-001) remain valid — new format only applies to
 * newly created contracts going forward.
 */

export type CompanyAbbrev = "JPCL" | "Strans" | string;

/**
 * Returns the 2-digit year string for the current year (or a given year).
 */
export function twoDigitYear(date: Date = new Date()): string {
  return date.getFullYear().toString().slice(-2);
}

/**
 * Pads a sequential number to 3 digits: 1 → "001"
 */
export function padSeq(n: number): string {
  return String(n).padStart(3, "0");
}

/**
 * Determines whether a company is Strans based on abbreviation or name.
 */
export function isStrans(company: string): boolean {
  return company?.toLowerCase().includes("strans");
}

/**
 * Generates a primary contract/project number.
 *   JPCL:   26-001
 *   Strans: STR-26-001
 */
export function generatePrimaryNumber(seq: number, company: CompanyAbbrev, year?: string): string {
  const yy = year ?? twoDigitYear();
  const base = `${yy}-${padSeq(seq)}`;
  return isStrans(company) ? `STR-${base}` : base;
}

/**
 * Generates a child (task order) number from a parent number.
 *   26-001       + seq 1  →  26-001-001
 *   STR-26-001   + seq 1  →  STR-26-001-001
 */
export function generateChildNumber(parentNumber: string, childSeq: number): string {
  return `${parentNumber}-${padSeq(childSeq)}`;
}

/**
 * Generates an amendment number from a contract number.
 *   26-001        + seq 1  →  26-001-A001
 *   26-001-002    + seq 2  →  26-001-002-A002
 */
export function generateAmendmentNumber(contractNumber: string, seq: number): string {
  return `${contractNumber}-A${padSeq(seq)}`;
}

/**
 * Generates a change order number from a contract number.
 *   26-001        + seq 1  →  26-001-C001
 *   STR-26-001-002 + seq 1 →  STR-26-001-002-C001
 */
export function generateChangeOrderNumber(contractNumber: string, seq: number): string {
  return `${contractNumber}-C${padSeq(seq)}`;
}

/**
 * Badge color classes matching the Replit timekeeping app exactly.
 * Source: lib/utils/company-colors.ts in the Vercel app.
 * Values stored in Supabase companies.badge_color column.
 */
export const COMPANY_BADGE_COLORS: Record<string, string> = {
  blue:    "border-blue-500 text-blue-700 bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-950/40",
  emerald: "border-emerald-500 text-emerald-700 bg-emerald-50 dark:border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40",
  amber:   "border-amber-500 text-amber-700 bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:bg-amber-950/40",
  rose:    "border-rose-500 text-rose-700 bg-rose-50 dark:border-rose-400 dark:text-rose-300 dark:bg-rose-950/40",
  purple:  "border-purple-500 text-purple-700 bg-purple-50 dark:border-purple-400 dark:text-purple-300 dark:bg-purple-950/40",
  cyan:    "border-cyan-500 text-cyan-700 bg-cyan-50 dark:border-cyan-400 dark:text-cyan-300 dark:bg-cyan-950/40",
  orange:  "border-orange-500 text-orange-700 bg-orange-50 dark:border-orange-400 dark:text-orange-300 dark:bg-orange-950/40",
  slate:   "border-slate-500 text-slate-700 bg-slate-50 dark:border-slate-400 dark:text-slate-300 dark:bg-slate-950/40",
};

/**
 * Known company badge colors (from live Supabase data).
 * JPCL = blue, Strans = emerald
 */
export const KNOWN_COMPANIES: Array<{
  id: string;
  name: string;
  abbreviation: string;
  badgeColor: string;
}> = [
  { id: "fddf0d5c-6199-4986-8e91-cb38d96d16bb", name: "JPCL", abbreviation: "JPCL", badgeColor: "blue" },
  { id: "e45a26d6-2e04-4358-9129-959ba4c55c45", name: "Strans", abbreviation: "Strans", badgeColor: "emerald" },
];

/**
 * Returns the Tailwind badge class string for a given badge color key.
 * Falls back to blue if unknown.
 */
export function getCompanyBadgeClass(badgeColor?: string | null): string {
  return COMPANY_BADGE_COLORS[badgeColor ?? "blue"] ?? COMPANY_BADGE_COLORS.blue;
}

/**
 * Returns the badge color for a company by its Supabase UUID.
 */
export function getBadgeColorById(companyId?: string | null): string {
  const found = KNOWN_COMPANIES.find(c => c.id === companyId);
  return found?.badgeColor ?? "blue";
}
