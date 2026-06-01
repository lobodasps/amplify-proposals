// ─── AEC Platform Shared Types ────────────────────────────────────────────────

export type UserRole =
  | "administrator"
  | "executive"
  | "business_development"
  | "proposal_coordinator"
  | "project_manager"
  | "technical_reviewer"
  | "designer"
  | "contract_manager"
  | "read_only"
  | "admin"
  | "user";

export type ServiceLine =
  | "special_inspections"
  | "construction_management"
  | "traffic_engineering"
  | "landscape_streetscape"
  | "environmental"
  | "other";

export type PursuitStatus =
  | "identify"
  | "qualify"
  | "pursue"
  | "submit"
  | "award"
  | "lost"
  | "no_go";

export type ProposalStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "submitted"
  | "awarded"
  | "lost"
  | "archived";

export type ContractStatus =
  | "draft"
  | "negotiation"
  | "executed"
  | "active"
  | "completed"
  | "terminated";

export type TaskStatus = "open" | "in_progress" | "review" | "done" | "overdue";
export type Priority = "low" | "medium" | "high" | "urgent";
export type AssetType = "image" | "document" | "presentation" | "spreadsheet" | "video" | "other";

export const SERVICE_LINE_LABELS: Record<ServiceLine, string> = {
  special_inspections: "Special Inspections",
  construction_management: "Construction Management",
  traffic_engineering: "Traffic Engineering",
  landscape_streetscape: "Landscape / Streetscape",
  environmental: "Environmental",
  other: "Other",
};

export const SERVICE_LINE_COLORS: Record<ServiceLine, string> = {
  special_inspections: "badge-special-inspections",
  construction_management: "badge-construction-management",
  traffic_engineering: "badge-traffic-engineering",
  landscape_streetscape: "badge-landscape-streetscape",
  environmental: "badge-environmental",
  other: "bg-gray-100 text-gray-700",
};

export const PURSUIT_STATUS_LABELS: Record<PursuitStatus, string> = {
  identify: "Identify",
  qualify: "Qualify",
  pursue: "Pursue",
  submit: "Submitted",
  award: "Awarded",
  lost: "Lost",
  no_go: "No-Go",
};

export const PURSUIT_STATUS_COLORS: Record<PursuitStatus, string> = {
  identify: "status-identify",
  qualify: "status-qualify",
  pursue: "status-pursue",
  submit: "status-submit",
  award: "status-award",
  lost: "status-lost",
  no_go: "status-no-go",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  executive: "Executive",
  business_development: "Business Development",
  proposal_coordinator: "Proposal Coordinator",
  project_manager: "Project Manager / Seller-Doer",
  technical_reviewer: "Technical Reviewer",
  designer: "Designer",
  contract_manager: "Contract Manager",
  read_only: "Read-Only Contributor",
  admin: "Administrator",
  user: "User",
};

export const NJ_NY_AGENCIES = [
  "NJDOT",
  "NJTA (NJ Turnpike Authority)",
  "NJ Transit",
  "NJDEP",
  "NYSDOT",
  "NYC DOT",
  "NYC DDC",
  "NYC DEP",
  "NYC Parks",
  "NYC Transit / MTA",
  "Port Authority of NY & NJ",
  "NJ BPU",
  "NJEDA",
  "NYC SCA",
  "NYCEDC",
  "Other",
];

export const ALL_SERVICE_LINES: ServiceLine[] = [
  "special_inspections",
  "construction_management",
  "traffic_engineering",
  "landscape_streetscape",
  "environmental",
];

// ─── RFP File Extraction Tiers ────────────────────────────────────────────────
// Controls how deeply each labeled file is processed during rfp_parser execution.
//
//   full_extract   → full XML shred + LLM extraction (critical documents)
//   metadata_only  → extract title, page count, file size; store file; skip LLM
//   sheetjs        → SheetJS parse only (XLSX fee schedules); no LLM

export type ExtractionTier = "full_extract" | "metadata_only" | "sheetjs";

export type RfpFileLabel =
  | "Main RFP"
  | "Scope of Work"
  | "Addendum"
  | "Appendix"
  | "Cover Letter"
  | "Forms"
  | "Certificate"
  | "Reference Doc"
  | "Fee Schedule"
  | "Supplemental"
  | "Other";

/** Maps each user-visible file label to its extraction tier. */
export const LABEL_TIER_MAP: Record<RfpFileLabel, ExtractionTier> = {
  "Main RFP":       "full_extract",
  "Scope of Work":  "full_extract",
  "Addendum":       "full_extract",
  "Appendix":       "metadata_only",
  "Cover Letter":   "metadata_only",
  "Forms":          "metadata_only",
  "Certificate":    "metadata_only",
  "Reference Doc":  "metadata_only",
  "Fee Schedule":   "sheetjs",
  "Supplemental":   "metadata_only",
  "Other":          "metadata_only",
};

export const TIER_BADGE: Record<ExtractionTier, { label: string; className: string }> = {
  full_extract:  { label: "Full Extract",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  metadata_only: { label: "Metadata Only",  className: "bg-gray-100 text-gray-600 border-gray-200" },
  sheetjs:       { label: "SheetJS Parse",  className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

// ─── Two-Pass Pre-Classification ─────────────────────────────────────────────
// Pass 1: instant client-side heuristics (keyword + size + page count)
// Pass 2: Gemini Flash first-2-page skim for unclassified / medium-confidence files

export type ClassificationConfidence = "high" | "medium" | "low" | "unclassified";

export interface ClassificationResult {
  label: RfpFileLabel;
  confidence: ClassificationConfidence;
  /** Short human-readable reason (max 15 words) */
  keyEvidence: string;
  extractionDepth: ExtractionTier;
}

export const CONFIDENCE_BADGE: Record<ClassificationConfidence, { icon: string; label: string; className: string }> = {
  high:         { icon: "✅", label: "High",         className: "text-emerald-600" },
  medium:       { icon: "〰️", label: "Medium",       className: "text-amber-500" },
  low:          { icon: "⚠️", label: "Review",       className: "text-red-500" },
  unclassified: { icon: "⚠️", label: "Review needed", className: "text-red-500" },
};

// ─── Quick Signal Pre-Score ───────────────────────────────────────────────────
// Extracted from the main_rfp file during Pass 2 classification.

export interface QuickSignals {
  agency: string | null;
  projectType: string | null;
  estimatedValue: string | null;
  dueDate: string | null; // ISO date string or null
  location: string | null;
  prequalRequired: boolean;
  prequalType: string | null;
  immediateRedFlags: string[];
}

export type SignalRating = "favorable" | "neutral" | "unfavorable";

export interface SignalFactor {
  label: string;
  rating: SignalRating;
  detail: string;
}

export type QuickSignalStrength = "strong" | "mixed" | "weak";

export interface QuickSignalScore {
  strength: QuickSignalStrength;
  favorableCount: number;
  factors: SignalFactor[];
}

/** Firm profile used for Quick Signal scoring (mirrors firm_settings table). */
export interface FirmProfile {
  serviceLines: string[];
  states: string[];
  typicalValueMin: number | null;
  typicalValueMax: number | null;
  minDaysToRespond: number;
  preferredAgencies: string[];
  avoidedAgencies: string[];
}
