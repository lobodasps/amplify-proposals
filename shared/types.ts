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
