import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  float,
  json,
} from "drizzle-orm/mysql-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = mysqlEnum("role", [
  "administrator",
  "executive",
  "business_development",
  "proposal_coordinator",
  "project_manager",
  "technical_reviewer",
  "designer",
  "contract_manager",
  "read_only",
]);

export const pursuitStatusEnum = mysqlEnum("pursuit_status", [
  "identify",
  "qualify",
  "pursue",
  "submit",
  "award",
  "lost",
  "no_go",
]);

export const proposalStatusEnum = mysqlEnum("proposal_status", [
  "draft",
  "in_review",
  "approved",
  "submitted",
  "awarded",
  "lost",
  "archived",
]);

export const contractStatusEnum = mysqlEnum("contract_status", [
  "draft",
  "negotiation",
  "executed",
  "active",
  "completed",
  "terminated",
]);

export const taskStatusEnum = mysqlEnum("task_status", [
  "open",
  "in_progress",
  "review",
  "done",
  "overdue",
]);

export const assetTypeEnum = mysqlEnum("asset_type", [
  "image",
  "document",
  "presentation",
  "spreadsheet",
  "video",
  "other",
]);

export const serviceLine = mysqlEnum("service_line", [
  "special_inspections",
  "construction_management",
  "traffic_engineering",
  "landscape_streetscape",
  "environmental",
  "other",
]);

export const opportunitySourceEnum = mysqlEnum("opportunity_source", [
  "njdot",
  "nysdot",
  "nyc_dddc",
  "nyc_dot",
  "nyc_dep",
  "njta",
  "panynj",
  "manual",
  "other",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", [
    "administrator",
    "executive",
    "business_development",
    "proposal_coordinator",
    "project_manager",
    "technical_reviewer",
    "designer",
    "contract_manager",
    "read_only",
    "admin",
    "user",
  ]).default("read_only").notNull(),
  title: varchar("title", { length: 128 }),
  department: varchar("department", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients / Agencies ───────────────────────────────────────────────────────

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["public_agency", "private", "municipal", "state", "federal", "other"]).default("public_agency"),
  state: mysqlEnum("state", ["NJ", "NY", "CT", "PA", "other"]).default("NY"),
  city: varchar("city", { length: 128 }),
  contactName: varchar("contactName", { length: 256 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 32 }),
  notes: text("notes"),
  totalAwardedValue: float("totalAwardedValue").default(0),
  winCount: int("winCount").default(0),
  lossCount: int("lossCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  projectNumber: varchar("projectNumber", { length: 64 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  serviceLine: mysqlEnum("service_line", [
    "special_inspections",
    "construction_management",
    "traffic_engineering",
    "landscape_streetscape",
    "environmental",
    "other",
  ]),
  description: text("description"),
  location: varchar("location", { length: 256 }),
  state: mysqlEnum("state", ["NJ", "NY", "CT", "PA", "other"]).default("NY"),
  contractValue: float("contractValue"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["active", "completed", "on_hold", "cancelled"]).default("active"),
  highlights: text("highlights"),
  tags: json("tags"),
  imageUrl: text("imageUrl"),
  isPublic: boolean("isPublic").default(true),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Resumes / Personnel ──────────────────────────────────────────────────────

export const personnel = mysqlTable("personnel", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  name: varchar("name", { length: 256 }).notNull(),
  title: varchar("title", { length: 128 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  yearsExperience: int("yearsExperience"),
  education: text("education"),
  licenses: json("licenses"),
  certifications: json("certifications"),
  serviceLines: json("serviceLines"),
  summary: text("summary"),
  baseResumeUrl: text("baseResumeUrl"),
  baseResumeKey: text("baseResumeKey"),
  tags: json("tags"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Personnel = typeof personnel.$inferSelect;
export type InsertPersonnel = typeof personnel.$inferInsert;

// ─── Personnel ↔ Projects ─────────────────────────────────────────────────────

export const personnelProjects = mysqlTable("personnel_projects", {
  id: int("id").autoincrement().primaryKey(),
  personnelId: int("personnelId").notNull(),
  projectId: int("projectId").notNull(),
  role: varchar("role", { length: 128 }),
  description: text("description"),
});

// ─── Digital Assets (DAM) ─────────────────────────────────────────────────────

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  description: text("description"),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  assetType: mysqlEnum("asset_type", ["image", "document", "presentation", "spreadsheet", "video", "other"]).default("document"),
  folder: varchar("folder", { length: 256 }).default("root"),
  tags: json("tags"),
  serviceLines: json("serviceLines"),
  projectId: int("projectId"),
  staffId: int("staffId"),
  version: int("version").default(1),
  parentAssetId: int("parentAssetId"),
  uploadedBy: int("uploadedBy"),
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// ─── Asset Tags (DAM tag definitions) ────────────────────────────────────────

export const assetTags = mysqlTable("asset_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#6366f1"), // hex or tailwind color token
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AssetTag = typeof assetTags.$inferSelect;
export type InsertAssetTag = typeof assetTags.$inferInsert;

// ─── Boilerplate / Content Library ───────────────────────────────────────────

export const contentLibrary = mysqlTable("content_library", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  category: mysqlEnum("category", [
    "boilerplate",
    "qualifications",
    "approach",
    "methodology",
    "cover_letter",
    "executive_summary",
    "project_narrative",
    "certifications",
    "other",
  ]).default("boilerplate"),
  content: text("content").notNull(),
  serviceLines: json("serviceLines"),
  tags: json("tags"),
  isApproved: boolean("isApproved").default(false),
  approvedBy: int("approvedBy"),
  version: int("version").default(1),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentLibraryItem = typeof contentLibrary.$inferSelect;
export type InsertContentLibraryItem = typeof contentLibrary.$inferInsert;

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  rfpNumber: varchar("rfpNumber", { length: 128 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  source: mysqlEnum("opportunity_source", [
    "njdot", "nysdot", "nyc_dddc", "nyc_dot", "nyc_dep", "njta", "panynj", "manual", "other",
  ]).default("manual"),
  sourceUrl: text("sourceUrl"),
  description: text("description"),
  serviceLines: json("serviceLines"),
  estimatedValue: float("estimatedValue"),
  dueDate: timestamp("dueDate"),
  publishedDate: timestamp("publishedDate"),
  aiScore: float("aiScore"),
  aiScoreReason: text("aiScoreReason"),
  goNoGoScore: float("goNoGoScore"),
  goNoGoNotes: text("goNoGoNotes"),
  goNoGoDecision: mysqlEnum("go_no_go_decision", ["go", "no_go", "pending"]).default("pending"),
  status: mysqlEnum("opp_status", ["new", "reviewing", "pursuing", "submitted", "awarded", "lost", "archived"]).default("new"),
  assignedTo: int("assignedTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

// ─── Pursuits ─────────────────────────────────────────────────────────────────

export const pursuits = mysqlTable("pursuits", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId"),
  title: varchar("title", { length: 512 }).notNull(),
  rfpNumber: varchar("rfpNumber", { length: 128 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  serviceLines: json("serviceLines"),
  status: mysqlEnum("pursuit_status", [
    "identify", "qualify", "pursue", "submit", "award", "lost", "no_go",
  ]).default("identify"),
  estimatedValue: float("estimatedValue"),
  probability: float("probability"),
  dueDate: timestamp("dueDate"),
  leadId: int("leadId"),
  coordinatorId: int("coordinatorId"),
  goNoGoScore: float("goNoGoScore"),
  goNoGoNotes: text("goNoGoNotes"),
  winThemes: text("winThemes"),
  competitorNotes: text("competitorNotes"),
  notes: text("notes"),
  isWon: boolean("isWon"),
  awardedValue: float("awardedValue"),
  lostReason: text("lostReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Pursuit = typeof pursuits.$inferSelect;
export type InsertPursuit = typeof pursuits.$inferInsert;

// ─── Proposals ────────────────────────────────────────────────────────────────

export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  pursuitId: int("pursuitId"),
  title: varchar("title", { length: 512 }).notNull(),
  rfpNumber: varchar("rfpNumber", { length: 128 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  serviceLines: json("serviceLines"),
  status: mysqlEnum("proposal_status", [
    "draft", "in_review", "approved", "submitted", "awarded", "lost", "archived",
  ]).default("draft"),
  dueDate: timestamp("dueDate"),
  submittedDate: timestamp("submittedDate"),
  coordinatorId: int("coordinatorId"),
  rfpFileUrl: text("rfpFileUrl"),
  rfpFileKey: text("rfpFileKey"),
  requirementsMatrix: json("requirementsMatrix"),
  complianceScore: float("complianceScore"),
  sections: json("sections"),
  selectedPersonnelIds: json("selectedPersonnelIds"),
  selectedProjectIds: json("selectedProjectIds"),
  exportPackageUrl: text("exportPackageUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ─── Proposal Sections ────────────────────────────────────────────────────────

export const proposalSections = mysqlTable("proposal_sections", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content"),
  sectionOrder: int("sectionOrder").default(0),
  rfpRequirement: text("rfpRequirement"),
  complianceStatus: mysqlEnum("compliance_status", ["compliant", "partial", "missing", "na"]).default("missing"),
  aiGenerated: boolean("aiGenerated").default(false),
  assignedTo: int("assignedTo"),
  status: mysqlEnum("section_status", ["draft", "in_review", "approved"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProposalSection = typeof proposalSections.$inferSelect;
export type InsertProposalSection = typeof proposalSections.$inferInsert;

// ─── Tailored Resumes ─────────────────────────────────────────────────────────

export const tailoredResumes = mysqlTable("tailored_resumes", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  personnelId: int("personnelId").notNull(),
  rfpRole: varchar("rfpRole", { length: 256 }),
  tailoredContent: text("tailoredContent"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  aiGenerated: boolean("aiGenerated").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TailoredResume = typeof tailoredResumes.$inferSelect;
export type InsertTailoredResume = typeof tailoredResumes.$inferInsert;

// ─── Tasks / Collaboration ────────────────────────────────────────────────────

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId"),
  pursuitId: int("pursuitId"),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  assignedTo: int("assignedTo"),
  assignedBy: int("assignedBy"),
  status: mysqlEnum("task_status", ["open", "in_progress", "review", "done", "overdue"]).default("open"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId"),
  sectionId: int("sectionId"),
  taskId: int("taskId"),
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ─── Contracts ────────────────────────────────────────────────────────────────

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  // Links to proposal pipeline
  proposalId: int("proposalId"),
  pursuitId: int("pursuitId"),
  projectId: int("projectId"),
  sourceOpportunityId: int("sourceOpportunityId"), // FK to opportunities — set when converted
  // Core identification
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  title: varchar("title", { length: 512 }).notNull(),
  contractNumber: varchar("contractNumber", { length: 128 }),
  projectNumber: varchar("projectNumber", { length: 128 }), // e.g. 25-440
  // Status and contract vehicle
  status: mysqlEnum("contract_status", [
    "draft", "negotiation", "executed", "active", "on_hold", "completed", "terminated",
  ]).default("draft"),
  contractVehicle: varchar("contractVehicle", { length: 64 }).default("standalone"), // standalone | msa | idiq_on_call | blanket
  companyRole: varchar("companyRole", { length: 32 }).default("prime"), // prime | subconsultant
  billingMethods: json("billingMethods"), // array: lump_sum | time_and_materials | cost_plus | unit_price
  // Parties
  ownerName: varchar("ownerName", { length: 256 }), // ultimate recipient (e.g. NJDOT)
  primeName: varchar("primeName", { length: 256 }), // prime contractor if we are sub
  // Key people
  contractManagerId: int("contractManagerId"),
  contractManagerName: varchar("contractManagerName", { length: 256 }),
  projectManagerName: varchar("projectManagerName", { length: 256 }),
  accountingContactName: varchar("accountingContactName", { length: 256 }),
  // Classification
  serviceLines: json("serviceLines"),
  primaryLocation: varchar("primaryLocation", { length: 256 }),
  isPublic: boolean("isPublic").default(true),
  // Dates
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  executionDate: timestamp("executionDate"),
  // Financial — all values in dollars (float)
  value: float("value").default(0), // initial contract value
  hasNteCeiling: boolean("hasNteCeiling").default(false),
  nteCeilingAmount: float("nteCeilingAmount"),
  billingBasis: varchar("billingBasis", { length: 32 }).default("authorized"), // authorized | nte_ceiling
  // Billing data (from QuickBooks or manual entry)
  totalBilledAmount: float("totalBilledAmount").default(0),
  retainageAmount: float("retainageAmount").default(0),
  lastInvoicedDate: timestamp("lastInvoicedDate"),
  billingPercentage: float("billingPercentage").default(0),
  isBillingOverCeiling: boolean("isBillingOverCeiling").default(false),
  computedContractValue: float("computedContractValue").default(0), // initial + amendments
  qbName: varchar("qbName", { length: 256 }), // QuickBooks project name
  clientProjectRef: varchar("clientProjectRef", { length: 256 }), // Client's own project reference number
  timeCode: varchar("timeCode", { length: 128 }), // Timekeeping identifier
  performingCompanyId: varchar("performingCompanyId", { length: 64 }), // Supabase company UUID (JPCL or Strans)
  performingCompanyName: varchar("performingCompanyName", { length: 64 }), // e.g. 'JPCL' or 'Strans'
  // Classification FKs
  departmentId: int("departmentId"), // FK to departments
  serviceTypeIds: json("serviceTypeIds"), // array of FK IDs to service_types
  form254CodeId: int("form254CodeId"), // FK to form_254_codes
  // Key personnel FKs
  projectManagerId: int("projectManagerId"), // FK to personnel
  projectAccountantId: int("projectAccountantId"), // FK to personnel
  // Organization FKs (dropdown instead of free text)
  clientOrgId: int("clientOrgId"), // FK to organizations (client)
  ownerOrgId: int("ownerOrgId"), // FK to organizations (owner/agency)
  // Compliance flags
  coiRequired: boolean("coiRequired").default(false),
  coiReceived: boolean("coiReceived").default(false),
  coiExpirationDate: timestamp("coiExpirationDate"),
  fullyExecutedContractReceived: boolean("fullyExecutedContractReceived").default(false),
  primeAgreementRequired: boolean("primeAgreementRequired").default(false),
  primeAgreementOnFile: boolean("primeAgreementOnFile").default(false),
  clientBillingInfoOnFile: boolean("clientBillingInfoOnFile").default(false),
  // Compliance flags (extended)
  coiReceivedDate: timestamp("coiReceivedDate"),
  fullyExecutedContractDate: timestamp("fullyExecutedContractDate"),
  primeAgreementDate: timestamp("primeAgreementDate"),
  hasCOI: boolean("hasCOI").default(false),
  hasSignedContract: boolean("hasSignedContract").default(false),
  // Contract structure
  structureType: varchar("structureType", { length: 64 }).default("CONTRACT_IS_PROJECT"), // CONTRACT_IS_PROJECT | CONTRACT_HAS_SUBPROJECTS
  // Additional key personnel
  contractOwnerId: int("contractOwnerId"), // FK to people — contract administrator
  // Additional organization FKs
  primeOrgId: int("primeOrgId"), // FK to organizations — prime contractor when we are sub
  // Hierarchy (for task orders / sub-projects)
  parentContractId: int("parentContractId"), // self-referencing for child contracts
  level: int("level").default(1), // 1=root, 2=task order, 3=sub-project
  tierLabelId: int("tierLabelId"), // FK to order_types — user-defined label for this tier (Task Order, Phase, PO, etc.)
  nodeType: varchar("nodeType", { length: 32 }).default("contract"), // contract | project | sub_project | phase
  budgetBehavior: varchar("budgetBehavior", { length: 32 }).default("draws_from_parent"), // draws_from_parent | adds_to_parent | independent
  amountBehavior: varchar("amountBehavior", { length: 32 }).default("independent"), // independent | adds_to_parent | subtracts_from_parent | utilizes_parent — how this child affects parent financials
  // Documents and notes
  documentUrl: text("documentUrl"),
  documentKey: text("documentKey"),
  milestones: json("milestones"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Contract Amendments ──────────────────────────────────────────────────────

export const contractAmendments = mysqlTable("contract_amendments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  amendmentType: varchar("amendmentType", { length: 64 }).default("amendment"), // amendment | change_order | task_order
  amendmentNumber: varchar("amendmentNumber", { length: 64 }), // e.g. CO-001, TO-002
  amendmentDate: timestamp("amendmentDate"),
  amount: float("amount").notNull().default(0), // positive = add, negative = deduct (legacy; kept for compatibility)
  amountBehavior: varchar("amountBehavior", { length: 32 }).default("adds_to_value"), // adds_to_value | subtracts_from_value
  amountChange: float("amountChange"), // explicit magnitude (positive); if null, falls back to abs(amount)
  description: text("description"),
  approvalStatus: varchar("approvalStatus", { length: 32 }).default("pending"), // pending | approved | rejected
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type InsertContractAmendment = typeof contractAmendments.$inferInsert;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── Business Entities (JPCL, Strans, etc.) ─────────────────────────────────

export const entities = mysqlTable("entities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  shortName: varchar("shortName", { length: 64 }),
  badgeColor: varchar("badgeColor", { length: 32 }).default("blue"), // blue | emerald | purple | amber | rose
  supabaseCompanyId: varchar("supabaseCompanyId", { length: 64 }), // UUID from Supabase companies table
  isDefault: boolean("isDefault").default(false),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;

// ─── Order Types (Task Order, Purchase Order, Work Order, SOW, etc.) ──────────

export const orderTypes = mysqlTable("order_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderType = typeof orderTypes.$inferSelect;
export type InsertOrderType = typeof orderTypes.$inferInsert;

// ─── Departments ──────────────────────────────────────────────────────────────

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ─── Service Types (Engineering, Inspection, CM, etc.) ───────────────────────

export const serviceTypes = mysqlTable("service_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  code: varchar("code", { length: 32 }),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = typeof serviceTypes.$inferInsert;

// ─── Form 254 Codes ───────────────────────────────────────────────────────────

export const form254Codes = mysqlTable("form_254_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Form254Code = typeof form254Codes.$inferSelect;
export type InsertForm254Code = typeof form254Codes.$inferInsert;

// ─── Organizations (Clients, Owners, Primes, Subs) ────────────────────────────

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  orgType: varchar("orgType", { length: 32 }).default("CLIENT"), // OWNER | CLIENT | PRIME_CONTRACTOR | SUBCONSULTANT | VENDOR
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 32 }),
  zip: varchar("zip", { length: 16 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  website: text("website"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── People (PMs, Accountants, Contract Admins) ───────────────────────────────

export const people = mysqlTable("people", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  role: varchar("role", { length: 64 }).default("PM"), // PM | ACCOUNTANT | CONTRACT_ADMIN | OWNER | EXECUTIVE
  organizationId: int("organizationId"),
  organizationName: varchar("organizationName", { length: 256 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  title: varchar("title", { length: 128 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;

// ─── Glossary Terms ───────────────────────────────────────────────────────────

export const glossaryTerms = mysqlTable("glossary_terms", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 256 }).notNull(),
  definition: text("definition").notNull(),
  characteristics: json("characteristics"), // string[]
  typicalUse: json("typicalUse"), // string[]
  oneLiner: text("oneLiner"),
  category: varchar("category", { length: 32 }).default("general"), // pricing | contract | billing | general
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type InsertGlossaryTerm = typeof glossaryTerms.$inferInsert;

// ─── Compliance Exceptions ────────────────────────────────────────────────────

export const complianceExceptions = mysqlTable("compliance_exceptions", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  severity: varchar("severity", { length: 16 }).default("WARN").notNull(), // INFO | WARN | BLOCKER
  exceptionType: varchar("exceptionType", { length: 64 }).notNull(), // COI_MISSING | COI_EXPIRED | EXECUTED_MISSING | etc.
  description: text("description"),
  status: varchar("status", { length: 16 }).default("OPEN").notNull(), // OPEN | RESOLVED
  assignedToId: int("assignedToId"),
  resolutionNote: text("resolutionNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type ComplianceException = typeof complianceExceptions.$inferSelect;
export type InsertComplianceException = typeof complianceExceptions.$inferInsert;

// ─── Contract Analyses (AI Analyzer) ─────────────────────────────────────────

export const contractAnalyses = mysqlTable("contract_analyses", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId"), // optional link to a contract record
  fileName: varchar("fileName", { length: 512 }),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  status: varchar("status", { length: 32 }).default("pending"), // pending | processing | complete | error
  extractedParties: json("extractedParties"),
  extractedDates: json("extractedDates"),
  extractedValues: json("extractedValues"),
  extractedClauses: json("extractedClauses"),
  riskFlags: json("riskFlags"),
  complianceFlags: json("complianceFlags"),
  summary: text("summary"),
  rawAnalysis: text("rawAnalysis"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContractAnalysis = typeof contractAnalyses.$inferSelect;
export type InsertContractAnalysis = typeof contractAnalyses.$inferInsert;

// ─── Activity Logs ────────────────────────────────────────────────────────────

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 64 }).notNull(), // contract | amendment | organization | person | etc.
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 64 }).notNull(), // CREATE | UPDATE | DELETE | STATUS_CHANGE | etc.
  description: text("description"),
  changedFields: json("changedFields"),
  userId: int("userId"),
  userName: varchar("userName", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── App Settings (key-value store) ──────────────────────────────────────────

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Billing Entries (from QuickBooks or manual) ──────────────────────────────

export const billingEntries = mysqlTable("billing_entries", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 128 }),
  invoiceDate: timestamp("invoiceDate"),
  amount: float("amount").notNull().default(0), // in dollars
  billedAmount: float("billedAmount").default(0),
  retainageAmount: float("retainageAmount").default(0),
  description: text("description"),
  source: varchar("source", { length: 32 }).default("manual"), // manual | quickbooks | import
  qbInvoiceId: varchar("qbInvoiceId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingEntry = typeof billingEntries.$inferSelect;
export type InsertBillingEntry = typeof billingEntries.$inferInsert;

// ─── Opportunity Team Firms ───────────────────────────────────────────────────

export const opportunityTeamFirms = mysqlTable("opportunity_team_firms", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  firmName: varchar("firmName", { length: 256 }).notNull(),
  role: varchar("role", { length: 128 }), // Prime | Sub | JV Partner | Specialty
  scope: text("scope"),
  estimatedFee: float("estimatedFee"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OpportunityTeamFirm = typeof opportunityTeamFirms.$inferSelect;
export type InsertOpportunityTeamFirm = typeof opportunityTeamFirms.$inferInsert;

// ─── Opportunity Competitors ──────────────────────────────────────────────────

export const opportunityCompetitors = mysqlTable("opportunity_competitors", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  firmName: varchar("firmName", { length: 256 }).notNull(),
  role: varchar("role", { length: 64 }), // Prime | Sub
  isWinner: boolean("isWinner").default(false),
  winningFee: float("winningFee"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OpportunityCompetitor = typeof opportunityCompetitors.$inferSelect;
export type InsertOpportunityCompetitor = typeof opportunityCompetitors.$inferInsert;

// ─── Opportunity Debrief ──────────────────────────────────────────────────────

export const opportunityDebriefs = mysqlTable("opportunity_debriefs", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull().unique(),
  outcome: varchar("outcome", { length: 32 }), // won | lost | no_bid | withdrawn
  winningFirm: varchar("winningFirm", { length: 256 }),
  winningFee: float("winningFee"),
  ourFee: float("ourFee"),
  lowestBidder: varchar("lowestBidder", { length: 256 }),
  debriefNotes: text("debriefNotes"),
  lessonsLearned: text("lessonsLearned"),
  debriefDate: timestamp("debriefDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OpportunityDebrief = typeof opportunityDebriefs.$inferSelect;
export type InsertOpportunityDebrief = typeof opportunityDebriefs.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message"),
  type: mysqlEnum("notif_type", ["task", "proposal", "pursuit", "contract", "opportunity", "system"]).default("system"),
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 64 }),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── AI Skills ────────────────────────────────────────────────────────────────
// Each "skill" is a named AI task with its own provider, model, key, and prompts.
export const aiProviderEnum = mysqlEnum("ai_provider", [
  "manus_builtin",
  "openai",
  "anthropic",
  "google_gemini",
  "azure_openai",
]);

export const aiSkillTypeEnum = mysqlEnum("ai_skill_type", [
  "rfp_shredder",
  "resume_tailor",
  "go_no_go_advisor",
  "opportunity_scorer",
  "contract_analyzer",
  "asset_tagger",
  "proposal_writer",
  "opportunity_ingestion",
  "proposal_scorer",
  "xml_shredder",
  "wiki_compiler",
  "agent_guidelines",
]);

export const aiSkills = mysqlTable("ai_skills", {
  id: int("id").autoincrement().primaryKey(),
  skillType: varchar("skillType", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  description: text("description"),
  provider: varchar("provider", { length: 64 }).notNull().default("manus_builtin"),
  model: varchar("model", { length: 128 }),
  apiKey: text("apiKey"),
  baseUrl: varchar("baseUrl", { length: 512 }),
  systemPrompt: text("systemPrompt").notNull(),
  userPromptTemplate: text("userPromptTemplate").notNull(),
  templateVariables: text("templateVariables"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiSkill = typeof aiSkills.$inferSelect;
export type InsertAiSkill = typeof aiSkills.$inferInsert;

// ─── Pattern 1: XML Document Shreds ──────────────────────────────────────────
// Stores the structured XML output of the document shredder for each uploaded file.
export const documentShreds = mysqlTable("document_shreds", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  xmlContent: text("xmlContent"),
  metadata: text("metadata"),
  proposalId: int("proposalId"),
  pursuitId: int("pursuitId"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DocumentShred = typeof documentShreds.$inferSelect;
export type InsertDocumentShred = typeof documentShreds.$inferInsert;

// ─── Pattern 2: RFP Wikis ─────────────────────────────────────────────────────
// Living Markdown wiki synthesized from shredded XML — replaces naive RAG chunking.
export const rfpWikis = mysqlTable("rfp_wikis", {
  id: int("id").autoincrement().primaryKey(),
  shredId: int("shredId").notNull(),
  pursuitId: int("pursuitId"),
  proposalId: int("proposalId"),
  wikiContent: text("wikiContent"),
  evaluationCriteria: text("evaluationCriteria"),
  keyRequirements: text("keyRequirements"),
  keyDates: text("keyDates"),
  keyPersonnel: text("keyPersonnel"),
  tokenEstimate: int("tokenEstimate"),
  compiledAt: timestamp("compiledAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type RfpWiki = typeof rfpWikis.$inferSelect;
export type InsertRfpWiki = typeof rfpWikis.$inferInsert;

// ─── Pattern 3: Agent Guidelines ─────────────────────────────────────────────
// CLAUDE.md-style success criteria and multi-approach records per task.
export const agentGuidelines = mysqlTable("agent_guidelines", {
  id: int("id").autoincrement().primaryKey(),
  skillType: varchar("skillType", { length: 64 }).notNull(),
  proposalId: int("proposalId"),
  pursuitId: int("pursuitId"),
  sectionName: varchar("sectionName", { length: 256 }),
  successCriteria: text("successCriteria"),
  approaches: text("approaches"),
  chosenApproachIndex: int("chosenApproachIndex"),
  choiceRationale: text("choiceRationale"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AgentGuideline = typeof agentGuidelines.$inferSelect;
export type InsertAgentGuideline = typeof agentGuidelines.$inferInsert;

// ─── Proposal Scores ──────────────────────────────────────────────────────────
// Stores every scoring run from the Proposal Scorer, linked to a pursuit.
// Enables scoring history, trend tracking, and per-section improvement over time.
export const proposalScores = mysqlTable("proposal_scores", {
  id: int("id").autoincrement().primaryKey(),
  pursuitId: int("pursuitId"),
  proposalId: int("proposalId"),
  sectionType: varchar("sectionType", { length: 128 }),
  sectionName: varchar("sectionName", { length: 256 }),
  proposalText: text("proposalText"),
  overallScore: int("overallScore"),
  overallPassed: boolean("overallPassed").default(false),
  criteriaScores: text("criteriaScores"),   // JSON array
  annotations: text("annotations"),          // JSON array of inline highlights
  summary: text("summary"),
  topImprovements: text("topImprovements"), // JSON array of strings
  rfpContext: text("rfpContext"),
  successCriteria: text("successCriteria"), // JSON array of strings
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProposalScore = typeof proposalScores.$inferSelect;
export type InsertProposalScore = typeof proposalScores.$inferInsert;

// ─── Hybrid Wiki: Structured Index ───────────────────────────────────────────
// Stores structured metadata extracted from shredded XML at write time.
// The LLM extracts entities/facts/claims with exact source citations — never prose.
// Prose synthesis happens at query time from the raw XML, guided by this index.
export const rfpStructuredIndex = mysqlTable("rfp_structured_index", {
  id: int("id").autoincrement().primaryKey(),
  shredId: int("shredId").notNull(),
  pursuitId: int("pursuitId"),
  // Structured facts extracted with source citations — JSON arrays of {value, source, xmlPath}
  submissionDeadlines: text("submissionDeadlines"),
  contractValues: text("contractValues"),
  evaluationCriteria: text("evaluationCriteria"),
  eligibilityRequirements: text("eligibilityRequirements"),
  submissionRequirements: text("submissionRequirements"),
  keyPersonnel: text("keyPersonnel"),
  keyDates: text("keyDates"),
  pageLimits: text("pageLimits"),
  references: text("references"),
  scopeItems: text("scopeItems"),
  sectionMap: text("sectionMap"),
  extractedAt: timestamp("extractedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
});
export type RfpStructuredIndex = typeof rfpStructuredIndex.$inferSelect;
export type InsertRfpStructuredIndex = typeof rfpStructuredIndex.$inferInsert;

// ─── RFP Conflict Detection ───────────────────────────────────────────────────
// Stores detected contradictions, date discrepancies, and scope conflicts
// found by comparing structured index facts across all files in the RFP package.
export const rfpConflicts = mysqlTable("rfp_conflicts", {
  id: int("id").autoincrement().primaryKey(),
  shredId: int("shredId").notNull(),
  pursuitId: int("pursuitId"),
  conflictType: varchar("conflictType", { length: 64 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description").notNull(),
  conflictingFacts: text("conflictingFacts").notNull(), // JSON array
  recommendation: text("recommendation"),
  status: varchar("status", { length: 16 }).default("open"),
  resolvedNote: text("resolvedNote"),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: int("resolvedBy"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
});
export type RfpConflict = typeof rfpConflicts.$inferSelect;
export type InsertRfpConflict = typeof rfpConflicts.$inferInsert;

// ─── RFP Sessions (Proposal Workspace Sequential Skill Workflow) ──────────────
// One rfpSession per pursuit/proposal attempt. Stores the full workflow state
// so the frontend can resume from any completed skill without restarting.
//
// skillOutputs: JSONB map of skillName → generated text/JSON (saved after each skill)
// workflowState: JSONB map of skillName → SkillStatus (pending|running|complete|error)
//
// This table is the single source of truth for the sequential skill workflow.
// The frontend orchestrator reads workflowState on load to determine resume point.

export const rfpSessionStatusEnum = mysqlEnum("rfp_session_status", [
  "not_started",
  "in_progress",
  "complete",
  "error",
]);

export const rfpSessions = mysqlTable("rfp_sessions", {
  id: int("id").autoincrement().primaryKey(),
  // Links
  pursuitId: int("pursuitId"),
  proposalId: int("proposalId"),
  opportunityId: int("opportunityId"),
  // Uploaded RFP file
  rfpFileName: varchar("rfpFileName", { length: 512 }),
  rfpFileKey: text("rfpFileKey"),   // Supabase Storage key (future) or Manus storage key
  rfpFileUrl: text("rfpFileUrl"),   // Accessible URL for LLM file_url content
  rfpMimeType: varchar("rfpMimeType", { length: 128 }),
  rfpFileSizeBytes: int("rfpFileSizeBytes"),
  // Extracted RFP context (from Skill 1 — RFP Parser)
  extractedData: json("extractedData"), // ParsedRfpData shape
  // Sequential skill outputs — keyed by WorkflowSkillName
  skillOutputs: json("skillOutputs"),   // Record<WorkflowSkillName, string>
  // Workflow state — keyed by WorkflowSkillName
  workflowState: json("workflowState"), // Record<WorkflowSkillName, SkillStatus>
  // Overall session status
  sessionStatus: mysqlEnum("rfp_session_status", [
    "not_started",
    "in_progress",
    "complete",
    "error",
  ]).default("not_started").notNull(),
  // Live proposal score (updated by Skill 8 — Proposal Scorer)
  liveScore: int("liveScore"),
  liveScoreDetails: json("liveScoreDetails"), // ScorerOutput shape
  // Metadata
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RfpSession = typeof rfpSessions.$inferSelect;
export type InsertRfpSession = typeof rfpSessions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// DAM — Knowledge Hub Documents
//
// One row per uploaded document. Supports past proposals, project sheets,
// resumes, certifications, and any other firm knowledge asset.
//
// docType values:
//   past_proposal  — a previously submitted proposal (PDF/DOCX)
//   project_sheet  — project data sheet / experience form
//   resume         — staff resume / CV
//   certification  — cert card, license scan, etc.
//   rfp            — raw RFP package for analysis
//   contract       — executed contract document
//   boilerplate    — reusable text block / template
//   other          — anything else
//
// processingStatus values:
//   uploaded   — file stored, no extraction yet
//   processing — LLM extraction in progress
//   indexed    — text extracted and ready for search
//   error      — extraction failed
// ─────────────────────────────────────────────────────────────────────────────

export const damDocuments = mysqlTable("dam_documents", {
  id: int("id").autoincrement().primaryKey(),

  // ── Document type & identity ───────────────────────────────────────────────
  docType: mysqlEnum("dam_doc_type", [
    "past_proposal",
    "project_sheet",
    "resume",
    "certification",
    "rfp",
    "contract",
    "boilerplate",
    "other",
  ]).notNull().default("other"),

  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),

  // ── Company / entity tag ───────────────────────────────────────────────────
  companyTag: mysqlEnum("dam_company_tag", ["JPCL", "Strans", "Both"]),

  // ── Staff link (resumes & certifications) ─────────────────────────────────
  staffName: varchar("staffName", { length: 255 }),
  staffId: int("staffId"),

  // ── Project / pursuit link (project sheets & past proposals) ──────────────
  projectId: int("projectId"),
  projectName: varchar("projectName", { length: 512 }),
  projectNumber: varchar("projectNumber", { length: 128 }),
  pursuitId: int("pursuitId"),
  proposalId: int("proposalId"),

  // ── Client / agency ────────────────────────────────────────────────────────
  clientName: varchar("clientName", { length: 512 }),
  contractValue: varchar("contractValue", { length: 64 }),
  awardYear: int("awardYear"),

  // ── File storage ───────────────────────────────────────────────────────────
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSizeBytes: int("fileSizeBytes"),

  // ── Extracted content ──────────────────────────────────────────────────────
  extractedText: text("extractedText"),
  extractedMeta: json("extractedMeta"),

  // ── Processing state ───────────────────────────────────────────────────────
  processingStatus: mysqlEnum("dam_processing_status", [
    "uploaded",
    "processing",
    "indexed",
    "error",
  ]).notNull().default("uploaded"),
  processingError: text("processingError"),

  // ── Tags (comma-separated keywords) ───────────────────────────────────────
  tags: text("tags"),

  // ── Audit ──────────────────────────────────────────────────────────────────
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DamDocument = typeof damDocuments.$inferSelect;
export type InsertDamDocument = typeof damDocuments.$inferInsert;
