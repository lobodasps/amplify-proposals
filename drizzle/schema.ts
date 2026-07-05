import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  jsonb,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("amp_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  // Valid values: administrator, executive, business_development, proposal_coordinator, project_manager, technical_reviewer, designer, contract_manager, read_only, admin, user
  role: text("role").default("read_only").notNull(),
  title: text("title"),
  department: text("department"),
  phone: text("phone"),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients / Agencies ───────────────────────────────────────────────────────

export const clients = pgTable("amp_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Valid values: public_agency, private, municipal, state, federal, other
  type: text("type").default("public_agency"),
  // Valid values: NJ, NY, CT, PA, other
  state: text("state").default("NY"),
  city: text("city"),
  contactName: text("contactName"),
  contactEmail: text("contactEmail"),
  contactPhone: text("contactPhone"),
  notes: text("notes"),
  totalAwardedValue: numeric("totalAwardedValue").default("0"),
  winCount: integer("winCount").default(0),
  lossCount: integer("lossCount").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable("amp_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  projectNumber: text("projectNumber"),
  clientId: uuid("clientId"),
  clientName: text("clientName"),
  // Valid values: special_inspections, construction_management, traffic_engineering, landscape_streetscape, environmental, other
  serviceLine: text("serviceLine"),
  description: text("description"),
  location: text("location"),
  // Valid values: NJ, NY, CT, PA, other
  state: text("state").default("NY"),
  contractValue: numeric("contractValue"),
  startDate: timestamp("startDate", { withTimezone: true }),
  endDate: timestamp("endDate", { withTimezone: true }),
  // Valid values: active, completed, on_hold, cancelled
  status: text("status").default("active"),
  highlights: text("highlights"),
  tags: jsonb("tags"),
  imageUrl: text("imageUrl"),
  isPublic: boolean("isPublic").default(true),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Resumes / Personnel ──────────────────────────────────────────────────────

export const personnel = pgTable("personnel", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId"),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  yearsExperience: integer("yearsExperience"),
  education: text("education"),
  licenses: jsonb("licenses"),
  certifications: jsonb("certifications"),
  serviceLines: jsonb("serviceLines"),
  summary: text("summary"),
  baseResumeUrl: text("baseResumeUrl"),
  baseResumeKey: text("baseResumeKey"),
  tags: jsonb("tags"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Personnel = typeof personnel.$inferSelect;
export type InsertPersonnel = typeof personnel.$inferInsert;

// ─── Personnel ↔ Projects ─────────────────────────────────────────────────────

export const personnelProjects = pgTable("personnel_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  personnelId: uuid("personnelId").notNull(),
  projectId: uuid("projectId").notNull(),
  role: text("role"),
  description: text("description"),
});

// ─── Digital Assets (DAM) ─────────────────────────────────────────────────────

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: text("mimeType"),
  fileSize: integer("fileSize"),
  // Valid values: image, document, presentation, spreadsheet, video, other
  assetType: text("assetType").default("document"),
  folder: text("folder").default("root"),
  tags: jsonb("tags"),
  serviceLines: jsonb("serviceLines"),
  projectId: uuid("projectId"),
  staffId: uuid("staffId"),
  version: integer("version").default(1),
  parentAssetId: uuid("parentAssetId"),
  uploadedBy: uuid("uploadedBy"),
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// ─── Asset Tags (DAM tag definitions) ────────────────────────────────────────

export const assetTags = pgTable("asset_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type AssetTag = typeof assetTags.$inferSelect;
export type InsertAssetTag = typeof assetTags.$inferInsert;

// ─── Boilerplate / Content Library ───────────────────────────────────────────

export const contentLibrary = pgTable("content_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  // Valid values: boilerplate, qualifications, approach, methodology, cover_letter, executive_summary, project_narrative, certifications, other
  category: text("category").default("boilerplate"),
  content: text("content").notNull(),
  serviceLines: jsonb("serviceLines"),
  tags: jsonb("tags"),
  isApproved: boolean("isApproved").default(false),
  approvedBy: uuid("approvedBy"),
  version: integer("version").default(1),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ContentLibraryItem = typeof contentLibrary.$inferSelect;
export type InsertContentLibraryItem = typeof contentLibrary.$inferInsert;

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  rfpNumber: text("rfpNumber"),
  clientId: uuid("clientId"),
  clientName: text("clientName"),
  // Valid values: njdot, nysdot, nyc_dddc, nyc_dot, nyc_dep, njta, panynj, manual, other
  source: text("source").default("manual"),
  sourceUrl: text("sourceUrl"),
  description: text("description"),
  serviceLines: jsonb("serviceLines"),
  estimatedValue: numeric("estimatedValue"),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  publishedDate: timestamp("publishedDate", { withTimezone: true }),
  aiScore: numeric("aiScore"),
  aiScoreReason: text("aiScoreReason"),
  goNoGoScore: numeric("goNoGoScore"),
  goNoGoNotes: text("goNoGoNotes"),
  // Valid values: go, no_go, pending
  goNoGoDecision: text("goNoGoDecision").default("pending"),
  // Valid values: new, reviewing, pursuing, submitted, awarded, lost, archived
  status: text("status").default("new"),
  assignedTo: uuid("assignedTo"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

// ─── Pursuits ─────────────────────────────────────────────────────────────────

export const pursuits = pgTable("pursuits", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunityId"),
  title: text("title").notNull(),
  rfpNumber: text("rfpNumber"),
  clientId: uuid("clientId"),
  clientName: text("clientName"),
  serviceLines: jsonb("serviceLines"),
  // Valid values: identify, qualify, pursue, submit, award, lost, no_go
  status: text("status").default("identify"),
  estimatedValue: numeric("estimatedValue"),
  probability: numeric("probability"),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  leadId: uuid("leadId"),
  coordinatorId: uuid("coordinatorId"),
  rfpSessionId: uuid("rfpSessionId"),
  goNoGoScore: numeric("goNoGoScore"),
  goNoGoNotes: text("goNoGoNotes"),
  winThemes: text("winThemes"),
  competitorNotes: text("competitorNotes"),
  notes: text("notes"),
  isWon: boolean("isWon"),
  awardedValue: numeric("awardedValue"),
  lostReason: text("lostReason"),
  // Asset matching selections (Step 3 of Launchpad)
  selectedProjectIds: jsonb("selectedProjectIds").$type<string[]>(),
  selectedPastProposalIds: jsonb("selectedPastProposalIds").$type<string[]>(),
  selectedPersonnel: jsonb("selectedPersonnel").$type<Array<{ damDocumentId: string; staffName: string; role: string }>>(),

  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Pursuit = typeof pursuits.$inferSelect;
export type InsertPursuit = typeof pursuits.$inferInsert;

// ─── Proposals ────────────────────────────────────────────────────────────────

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  pursuitId: uuid("pursuitId"),
  title: text("title").notNull(),
  rfpNumber: text("rfpNumber"),
  clientId: uuid("clientId"),
  clientName: text("clientName"),
  serviceLines: jsonb("serviceLines"),
  // Valid values: draft, in_review, approved, submitted, awarded, lost, archived
  status: text("status").default("draft"),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  submittedDate: timestamp("submittedDate", { withTimezone: true }),
  coordinatorId: uuid("coordinatorId"),
  rfpFileUrl: text("rfpFileUrl"),
  rfpFileKey: text("rfpFileKey"),
  requirementsMatrix: jsonb("requirementsMatrix"),
  complianceScore: numeric("complianceScore"),
  sections: jsonb("sections"),
  selectedPersonnelIds: jsonb("selectedPersonnelIds"),
  selectedProjectIds: jsonb("selectedProjectIds"),
  exportPackageUrl: text("exportPackageUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ─── Proposal Sections ────────────────────────────────────────────────────────

export const proposalSections = pgTable("proposal_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposalId").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  sectionOrder: integer("sectionOrder").default(0),
  rfpRequirement: text("rfpRequirement"),
  // Valid values: compliant, partial, missing, na
  complianceStatus: text("complianceStatus").default("missing"),
  aiGenerated: boolean("aiGenerated").default(false),
  assignedTo: uuid("assignedTo"),
  // Valid values: draft, in_review, approved
  status: text("status").default("draft"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ProposalSection = typeof proposalSections.$inferSelect;
export type InsertProposalSection = typeof proposalSections.$inferInsert;

// ─── Tailored Resumes ─────────────────────────────────────────────────────────

export const tailoredResumes = pgTable("tailored_resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposalId").notNull(),
  personnelId: uuid("personnelId").notNull(),
  rfpRole: text("rfpRole"),
  tailoredContent: text("tailoredContent"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  aiGenerated: boolean("aiGenerated").default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type TailoredResume = typeof tailoredResumes.$inferSelect;
export type InsertTailoredResume = typeof tailoredResumes.$inferInsert;

// ─── Tasks / Collaboration ────────────────────────────────────────────────────

export const tasks = pgTable("amp_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposalId"),
  pursuitId: uuid("pursuitId"),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: uuid("assignedTo"),
  assignedBy: uuid("assignedBy"),
  // Valid values: open, in_progress, review, done, overdue
  status: text("status").default("open"),
  // Valid values: low, medium, high, urgent
  priority: text("priority").default("medium"),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposalId"),
  sectionId: uuid("sectionId"),
  taskId: uuid("taskId"),
  authorId: uuid("authorId").notNull(),
  content: text("content").notNull(),
  parentId: uuid("parentId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ─── Contracts ────────────────────────────────────────────────────────────────

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Links to proposal pipeline
  proposalId: uuid("proposalId"),
  pursuitId: uuid("pursuitId"),
  projectId: uuid("projectId"),
  sourceOpportunityId: uuid("sourceOpportunityId"),
  // Core identification
  clientId: uuid("clientId"),
  clientName: text("clientName"),
  title: text("title").notNull(),
  contractNumber: text("contractNumber"),
  projectNumber: text("projectNumber"),
  // Valid values: draft, negotiation, executed, active, on_hold, completed, terminated
  status: text("status").default("draft"),
  contractVehicle: text("contractVehicle").default("standalone"),
  companyRole: text("companyRole").default("prime"),
  billingMethods: jsonb("billingMethods"),
  // Parties
  ownerName: text("ownerName"),
  primeName: text("primeName"),
  // Key people
  contractManagerId: uuid("contractManagerId"),
  contractManagerName: text("contractManagerName"),
  projectManagerName: text("projectManagerName"),
  accountingContactName: text("accountingContactName"),
  // Classification
  serviceLines: jsonb("serviceLines"),
  primaryLocation: text("primaryLocation"),
  isPublic: boolean("isPublic").default(true),
  // Dates
  startDate: timestamp("startDate", { withTimezone: true }),
  endDate: timestamp("endDate", { withTimezone: true }),
  executionDate: timestamp("executionDate", { withTimezone: true }),
  // Financial
  value: numeric("value").default("0"),
  hasNteCeiling: boolean("hasNteCeiling").default(false),
  nteCeilingAmount: numeric("nteCeilingAmount"),
  billingBasis: text("billingBasis").default("authorized"),
  // Billing data
  totalBilledAmount: numeric("totalBilledAmount").default("0"),
  retainageAmount: numeric("retainageAmount").default("0"),
  lastInvoicedDate: timestamp("lastInvoicedDate", { withTimezone: true }),
  billingPercentage: numeric("billingPercentage").default("0"),
  isBillingOverCeiling: boolean("isBillingOverCeiling").default(false),
  computedContractValue: numeric("computedContractValue").default("0"),
  qbName: text("qbName"),
  clientProjectRef: text("clientProjectRef"),
  timeCode: text("timeCode"),
  // Cross-app FK: references companies.id in Supabase (JPCL=fddf0d5c, Strans=e45a26d6)
  performingCompanyId: uuid("performingCompanyId"),
  performingCompanyName: text("performingCompanyName"),
  // Classification FKs
  departmentId: uuid("departmentId"),
  serviceTypeIds: jsonb("serviceTypeIds"),
  form254CodeId: uuid("form254CodeId"),
  // Key personnel FKs
  projectManagerId: uuid("projectManagerId"),
  projectAccountantId: uuid("projectAccountantId"),
  // Organization FKs
  clientOrgId: uuid("clientOrgId"),
  ownerOrgId: uuid("ownerOrgId"),
  // Compliance flags
  coiRequired: boolean("coiRequired").default(false),
  coiReceived: boolean("coiReceived").default(false),
  coiExpirationDate: timestamp("coiExpirationDate", { withTimezone: true }),
  fullyExecutedContractReceived: boolean("fullyExecutedContractReceived").default(false),
  primeAgreementRequired: boolean("primeAgreementRequired").default(false),
  primeAgreementOnFile: boolean("primeAgreementOnFile").default(false),
  clientBillingInfoOnFile: boolean("clientBillingInfoOnFile").default(false),
  // Compliance flags (extended)
  coiReceivedDate: timestamp("coiReceivedDate", { withTimezone: true }),
  fullyExecutedContractDate: timestamp("fullyExecutedContractDate", { withTimezone: true }),
  primeAgreementDate: timestamp("primeAgreementDate", { withTimezone: true }),
  hasCOI: boolean("hasCOI").default(false),
  hasSignedContract: boolean("hasSignedContract").default(false),
  // Contract structure
  structureType: text("structureType").default("CONTRACT_IS_PROJECT"),
  // Additional key personnel
  contractOwnerId: uuid("contractOwnerId"),
  // Additional organization FKs
  primeOrgId: uuid("primeOrgId"),
  // Hierarchy
  parentContractId: uuid("parentContractId"),
  level: integer("level").default(1),
  tierLabelId: uuid("tierLabelId"),
  nodeType: text("nodeType").default("contract"),
  budgetBehavior: text("budgetBehavior").default("draws_from_parent"),
  amountBehavior: text("amountBehavior").default("independent"),
  // Documents and notes
  documentUrl: text("documentUrl"),
  documentKey: text("documentKey"),
  milestones: jsonb("milestones"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── Contract Amendments ──────────────────────────────────────────────────────

export const contractAmendments = pgTable("contract_amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contractId").notNull(),
  amendmentType: text("amendmentType").default("amendment"),
  amendmentNumber: text("amendmentNumber"),
  amendmentDate: timestamp("amendmentDate", { withTimezone: true }),
  amount: numeric("amount").notNull().default("0"),
  amountBehavior: text("amountBehavior").default("adds_to_value"),
  amountChange: numeric("amountChange"),
  description: text("description"),
  approvalStatus: text("approvalStatus").default("pending"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type InsertContractAmendment = typeof contractAmendments.$inferInsert;

// ─── Business Entities (JPCL, Strans, etc.) ─────────────────────────────────

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("shortName"),
  badgeColor: text("badgeColor").default("blue"),
  supabaseCompanyId: text("supabaseCompanyId"),
  isDefault: boolean("isDefault").default(false),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;

// ─── Order Types ──────────────────────────────────────────────────────────────

export const orderTypes = pgTable("order_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type OrderType = typeof orderTypes.$inferSelect;
export type InsertOrderType = typeof orderTypes.$inferInsert;

// ─── Departments ──────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ─── Service Types ────────────────────────────────────────────────────────────

export const serviceTypes = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceType = typeof serviceTypes.$inferSelect;
export type InsertServiceType = typeof serviceTypes.$inferInsert;

// ─── Form 254 Codes ───────────────────────────────────────────────────────────

export const form254Codes = pgTable("form_254_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Form254Code = typeof form254Codes.$inferSelect;
export type InsertForm254Code = typeof form254Codes.$inferInsert;

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgType: text("orgType").default("CLIENT"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── People (PMs, Accountants, Contract Admins) ───────────────────────────────

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  role: text("role").default("PM"),
  organizationId: uuid("organizationId"),
  organizationName: text("organizationName"),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;

// ─── Glossary Terms ───────────────────────────────────────────────────────────

export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  characteristics: jsonb("characteristics"),
  typicalUse: jsonb("typicalUse"),
  oneLiner: text("oneLiner"),
  category: text("category").default("general"),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type InsertGlossaryTerm = typeof glossaryTerms.$inferInsert;

// ─── Compliance Exceptions ────────────────────────────────────────────────────

export const complianceExceptions = pgTable("compliance_exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contractId").notNull(),
  severity: text("severity").default("WARN").notNull(),
  exceptionType: text("exceptionType").notNull(),
  description: text("description"),
  status: text("status").default("OPEN").notNull(),
  assignedToId: uuid("assignedToId"),
  resolutionNote: text("resolutionNote"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
});

export type ComplianceException = typeof complianceExceptions.$inferSelect;
export type InsertComplianceException = typeof complianceExceptions.$inferInsert;

// ─── Contract Analyses (AI Analyzer) ─────────────────────────────────────────

export const contractAnalyses = pgTable("contract_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contractId"),
  fileName: text("fileName"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  status: text("status").default("pending"),
  extractedParties: jsonb("extractedParties"),
  extractedDates: jsonb("extractedDates"),
  extractedValues: jsonb("extractedValues"),
  extractedClauses: jsonb("extractedClauses"),
  riskFlags: jsonb("riskFlags"),
  complianceFlags: jsonb("complianceFlags"),
  summary: text("summary"),
  rawAnalysis: text("rawAnalysis"),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ContractAnalysis = typeof contractAnalyses.$inferSelect;
export type InsertContractAnalysis = typeof contractAnalyses.$inferInsert;

// ─── Activity Logs ────────────────────────────────────────────────────────────

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  changedFields: jsonb("changedFields"),
  userId: uuid("userId"),
  userName: text("userName"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── App Settings (key-value store) ──────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedBy: uuid("updatedBy"),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Billing Entries ──────────────────────────────────────────────────────────

export const billingEntries = pgTable("billing_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contractId").notNull(),
  invoiceNumber: text("invoiceNumber"),
  invoiceDate: timestamp("invoiceDate", { withTimezone: true }),
  amount: numeric("amount").notNull().default("0"),
  billedAmount: numeric("billedAmount").default("0"),
  retainageAmount: numeric("retainageAmount").default("0"),
  description: text("description"),
  source: text("source").default("manual"),
  qbInvoiceId: text("qbInvoiceId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type BillingEntry = typeof billingEntries.$inferSelect;
export type InsertBillingEntry = typeof billingEntries.$inferInsert;

// ─── Opportunity Team Firms ───────────────────────────────────────────────────

export const opportunityTeamFirms = pgTable("opportunity_team_firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunityId").notNull(),
  firmName: text("firmName").notNull(),
  role: text("role"),
  scope: text("scope"),
  estimatedFee: numeric("estimatedFee"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type OpportunityTeamFirm = typeof opportunityTeamFirms.$inferSelect;
export type InsertOpportunityTeamFirm = typeof opportunityTeamFirms.$inferInsert;

// ─── Opportunity Competitors ──────────────────────────────────────────────────

export const opportunityCompetitors = pgTable("opportunity_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunityId").notNull(),
  firmName: text("firmName").notNull(),
  role: text("role"),
  isWinner: boolean("isWinner").default(false),
  winningFee: numeric("winningFee"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type OpportunityCompetitor = typeof opportunityCompetitors.$inferSelect;
export type InsertOpportunityCompetitor = typeof opportunityCompetitors.$inferInsert;

// ─── Opportunity Debrief ──────────────────────────────────────────────────────

export const opportunityDebriefs = pgTable("opportunity_debriefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunityId").notNull().unique(),
  outcome: text("outcome"),
  winningFirm: text("winningFirm"),
  winningFee: numeric("winningFee"),
  ourFee: numeric("ourFee"),
  lowestBidder: text("lowestBidder"),
  debriefNotes: text("debriefNotes"),
  lessonsLearned: text("lessonsLearned"),
  debriefDate: timestamp("debriefDate", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type OpportunityDebrief = typeof opportunityDebriefs.$inferSelect;
export type InsertOpportunityDebrief = typeof opportunityDebriefs.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  // Valid values: task, proposal, pursuit, contract, opportunity, system
  type: text("type").default("system"),
  referenceId: uuid("referenceId"),
  referenceType: text("referenceType"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── AI Skills ────────────────────────────────────────────────────────────────

export const aiSkills = pgTable("ai_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillType: text("skillType").notNull().unique(),
  displayName: text("displayName").notNull(),
  description: text("description"),
  // Valid values: openai, anthropic, google_gemini, azure_openai, custom
  // null means "use system default" (falls back to the default provider_api_keys row)
  provider: text("provider"),
  // FK to provider_api_keys.id — when set, this key overrides the global provider key
  providerApiKeyId: uuid("providerApiKeyId"),
  model: text("model"),
  apiKey: text("apiKey"),
  baseUrl: text("baseUrl"),
  systemPrompt: text("systemPrompt").notNull(),
  userPromptTemplate: text("userPromptTemplate").notNull(),
  templateVariables: text("templateVariables"),
  enabled: boolean("enabled").default(true).notNull(),
  // Valid values: json | prose | json_with_prose
  outputType: text("outputType").default("prose").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type AiSkill = typeof aiSkills.$inferSelect;
export type InsertAiSkill = typeof aiSkills.$inferInsert;

// ─── XML Document Shreds ──────────────────────────────────────────────────────

export const documentShreds = pgTable("document_shreds", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("fileName").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  mimeType: text("mimeType"),
  fileSize: integer("fileSize"),
  xmlContent: text("xmlContent"),
  metadata: text("metadata"),
  proposalId: uuid("proposalId"),
  pursuitId: uuid("pursuitId"),
  status: text("status").notNull().default("pending"),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type DocumentShred = typeof documentShreds.$inferSelect;
export type InsertDocumentShred = typeof documentShreds.$inferInsert;

// ─── RFP Wikis ─────────────────────────────────────────────────────────────────

export const rfpWikis = pgTable("rfp_wikis", {
  id: uuid("id").primaryKey().defaultRandom(),
  shredId: uuid("shredId").notNull(),
  pursuitId: uuid("pursuitId"),
  proposalId: uuid("proposalId"),
  wikiContent: text("wikiContent"),
  evaluationCriteria: text("evaluationCriteria"),
  keyRequirements: text("keyRequirements"),
  keyDates: text("keyDates"),
  keyPersonnel: text("keyPersonnel"),
  tokenEstimate: integer("tokenEstimate"),
  compiledAt: timestamp("compiledAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("createdBy"),
});

export type RfpWiki = typeof rfpWikis.$inferSelect;
export type InsertRfpWiki = typeof rfpWikis.$inferInsert;

// ─── Agent Guidelines ─────────────────────────────────────────────────────────

export const agentGuidelines = pgTable("agent_guidelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillType: text("skillType").notNull(),
  proposalId: uuid("proposalId"),
  pursuitId: uuid("pursuitId"),
  sectionName: text("sectionName"),
  successCriteria: text("successCriteria"),
  approaches: text("approaches"),
  chosenApproachIndex: integer("chosenApproachIndex"),
  choiceRationale: text("choiceRationale"),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type AgentGuideline = typeof agentGuidelines.$inferSelect;
export type InsertAgentGuideline = typeof agentGuidelines.$inferInsert;

// ─── Proposal Scores ──────────────────────────────────────────────────────────

export const proposalScores = pgTable("proposal_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  pursuitId: uuid("pursuitId"),
  proposalId: uuid("proposalId"),
  sectionType: text("sectionType"),
  sectionName: text("sectionName"),
  proposalText: text("proposalText"),
  overallScore: integer("overallScore"),
  overallPassed: boolean("overallPassed").default(false),
  criteriaScores: text("criteriaScores"),
  annotations: text("annotations"),
  summary: text("summary"),
  topImprovements: text("topImprovements"),
  rfpContext: text("rfpContext"),
  successCriteria: text("successCriteria"),
  provider: text("provider"),
  model: text("model"),
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ProposalScore = typeof proposalScores.$inferSelect;
export type InsertProposalScore = typeof proposalScores.$inferInsert;

// ─── Hybrid Wiki: Structured Index ───────────────────────────────────────────

export const rfpStructuredIndex = pgTable("rfp_structured_index", {
  id: uuid("id").primaryKey().defaultRandom(),
  shredId: uuid("shredId").notNull(),
  pursuitId: uuid("pursuitId"),
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
  extractedAt: timestamp("extractedAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("createdBy"),
  provider: text("provider"),
  model: text("model"),
});

export type RfpStructuredIndex = typeof rfpStructuredIndex.$inferSelect;
export type InsertRfpStructuredIndex = typeof rfpStructuredIndex.$inferInsert;

// ─── RFP Conflict Detection ───────────────────────────────────────────────────

export const rfpConflicts = pgTable("rfp_conflicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  shredId: uuid("shredId").notNull(),
  pursuitId: uuid("pursuitId"),
  conflictType: text("conflictType").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  conflictingFacts: text("conflictingFacts").notNull(),
  recommendation: text("recommendation"),
  status: text("status").default("open"),
  resolvedNote: text("resolvedNote"),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  resolvedBy: uuid("resolvedBy"),
  detectedAt: timestamp("detectedAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("createdBy"),
  provider: text("provider"),
  model: text("model"),
});

export type RfpConflict = typeof rfpConflicts.$inferSelect;
export type InsertRfpConflict = typeof rfpConflicts.$inferInsert;

// ─── RFP Sessions ─────────────────────────────────────────────────────────────

export const rfpSessions = pgTable("rfp_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Links
  pursuitId: uuid("pursuitId"),
  proposalId: uuid("proposalId"),
  opportunityId: uuid("opportunityId"),
  // Uploaded RFP file
  rfpFileName: text("rfpFileName"),
  rfpFileKey: text("rfpFileKey"),
  rfpFileUrl: text("rfpFileUrl"),
  rfpMimeType: text("rfpMimeType"),
  rfpFileSizeBytes: integer("rfpFileSizeBytes"),
  // All uploaded file URLs (array of {name, url, mimeType})
  uploadedFiles: jsonb("uploadedFiles"),
  // Extracted RFP context
  extractedData: jsonb("extractedData"),
  // Sequential skill outputs
  skillOutputs: jsonb("skillOutputs"),
  // Workflow state
  workflowState: jsonb("workflowState"),
  // Valid values: not_started, in_progress, complete, error
  sessionStatus: text("sessionStatus").default("not_started").notNull(),
  // Live proposal score
  liveScore: integer("liveScore"),
  liveScoreDetails: jsonb("liveScoreDetails"),
  // Phase 1 — Pipeline Upgrade: evidence provenance storage
  // Stores evidence bundles assembled for each skill run, keyed by skill name
  evidenceBundles: jsonb("evidenceBundles"),
  // Stores the evidence bundle passed to the proposal_scorer for provenance display
  scorerEvidenceInput: jsonb("scorerEvidenceInput"),
  // Metadata
  createdBy: uuid("createdBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type RfpSession = typeof rfpSessions.$inferSelect;
export type InsertRfpSession = typeof rfpSessions.$inferInsert;

// ─── DAM — Knowledge Hub Documents ───────────────────────────────────────────

export const damDocuments = pgTable("dam_documents", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Document type
  // Valid values: past_proposal, project_sheet, resume, certification, rfp, contract, boilerplate, image, other
  docType: text("docType").notNull().default("other"),

  // Image-specific metadata (docType = 'image')
  photographer: text("photographer"),   // Optional photographer credit
  yearTaken: integer("yearTaken"),       // Year photo was taken
  // Valid values: internal_only, proposal_use, marketing, unrestricted
  usageRights: text("usageRights"),      // Usage rights classification
  // Valid values: high, medium, low
  imageQuality: text("imageQuality"),    // Gemini vision quality rating
  hasPersonnel: boolean("hasPersonnel"), // Whether people are visible in the image
  // Valid values: bridge, dam, roadway, retaining-wall, building, park, athletic-field, environmental-site, utility, tunnel, other
  structureType: text("structureType"),  // Primary AEC structure type from vision analysis

  title: text("title").notNull(),
  description: text("description"),

  // Company tag — Valid values: JPCL, Strans, Both
  companyTag: text("companyTag"),

  // Staff link (resumes & certifications)
  staffName: text("staffName"),
  // Cross-app FK: references profiles.id (uuid) in Supabase
  staffId: uuid("staffId"),

  // Project / pursuit link
  // Cross-app FK: references projects.id (uuid) in Supabase
  projectId: uuid("projectId"),
  projectName: text("projectName"),
  projectNumber: text("projectNumber"),
  pursuitId: uuid("pursuitId"),
  proposalId: uuid("proposalId"),

  // Client / agency / owner
  clientName: text("clientName"),       // Direct contracting party (prime if owner contract, prime contractor if sub)
  ownerName: text("ownerName"),          // Public agency / asset owner (e.g. NYSDOT, NYC Parks). Comma-separated if multiple.
  firmRole: text("firmRole"),            // Our role: prime | sub | joint-venture
  resumeVersion: text("resumeVersion"),  // base | tailored | submitted (resume docType only)
  pursuitContext: text("pursuitContext"),// Free-form pursuit description when no pursuitId linked
  contractValue: text("contractValue"),
  awardYear: integer("awardYear"),

  // File storage
  fileName: text("fileName").notNull(),
  fileKey: text("fileKey").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: text("mimeType"),
  fileSizeBytes: integer("fileSizeBytes"),

  // Extracted content
  extractedText: text("extractedText"),
  extractedMeta: jsonb("extractedMeta"),

  // Processing state — Valid values: uploaded, processing, indexed, error
  processingStatus: text("processingStatus").notNull().default("uploaded"),
  processingError: text("processingError"),

  // Extraction method used — Valid values: llm_single_pass | xml_shredder
  extractionMethod: text("extractionMethod"),

  // Page count detected before extraction (null for non-PDF or if detection failed)
  pageCount: integer("pageCount"),

  // Tags (comma-separated keywords — legacy; normalizedTags is the new retrieval backbone)
  tags: text("tags"),

  // Phase 1 — Pipeline Upgrade: normalized tags and chunk tracking
  // Array of canonical tag identifiers from normalized_tags table (e.g. ["traffic_engineering", "special_inspections"])
  normalizedTags: jsonb("normalizedTags").$type<string[]>().default([]),
  // Number of document_chunks rows created for this document (0 = not yet chunked)
  chunkCount: integer("chunkCount").default(0).notNull(),
  // Valid values: pending (not yet chunked), chunked (chunks created), error (chunking failed)
  chunkStatus: text("chunkStatus").default("pending").notNull(),

  // Thumbnail URL for image docTypes (stored in S3, auto-generated on upload)
  thumbnailUrl: text("thumbnailUrl"),

  // Audit
  uploadedBy: uuid("uploadedBy"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type DamDocument = typeof damDocuments.$inferSelect;
export type InsertDamDocument = typeof damDocuments.$inferInsert;

// ─── LLM Usage Logs ─────────────────────────────────────────────────────────

export const llmUsageLogs = pgTable("llm_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillType: text("skillType").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  tokensIn: integer("tokensIn").notNull().default(0),
  tokensOut: integer("tokensOut").notNull().default(0),
  estimatedCost: numeric("estimatedCost", { precision: 10, scale: 6 }),
  durationMs: integer("durationMs"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("errorMessage"),
  userId: uuid("userId"),
  /** Phase 6: optional structured metadata for scorer analytics (evidenceCoverage, unsupportedClaimsCount, etc.) */
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type LlmUsageLog = typeof llmUsageLogs.$inferSelect;
export type InsertLlmUsageLog = typeof llmUsageLogs.$inferInsert;

// ─── Firm Profile Settings ────────────────────────────────────────────────────

export const firmSettings = pgTable("firm_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // FK to entities table — one profile per entity (e.g. JPCL, Strans). Null = legacy single-entity row.
  entityId: uuid("entityId"),

  // Identity
  firmName: text("firmName"),
  legalName: text("legalName"),
  foundingYear: integer("foundingYear"),
  employeeCount: text("employeeCount"),          // e.g. '15-25 professionals'
  description: text("description"),              // 2-3 sentence firm description

  // Disciplines & geography
  // JSON array of service line strings e.g. ["Special Inspections","Traffic Engineering"]
  serviceLines: jsonb("serviceLines").$type<string[]>().default([]),
  geographicFocus: text("geographicFocus"),      // e.g. 'New York, New Jersey, Connecticut'

  // Certifications
  dbeCertification: boolean("dbeCertification").default(false),
  mbeCertification: boolean("mbeCertification").default(false),
  wbeCertification: boolean("wbeCertification").default(false),
  certificationDetails: text("certificationDetails"),

  // Registrations & identifiers
  naicsCodes: jsonb("naicsCodes").$type<string[]>().default([]),
  ueiNumber: text("ueiNumber"),
  dunsNumber: text("dunsNumber"),
  stateRegistrations: jsonb("stateRegistrations").$type<string[]>().default([]),

  // Agency relationships
  preferredAgencies: jsonb("preferredAgencies").$type<string[]>().default([]),
  avoidedAgencies: jsonb("avoidedAgencies").$type<string[]>().default([]),

  // Contract sizing & response capacity
  typicalValueMin: numeric("typicalValueMin"),
  typicalValueMax: numeric("typicalValueMax"),
  minDaysToRespond: integer("minDaysToRespond").default(14),

  // Proposal content
  boilerplateFirmDescription: text("boilerplateFirmDescription"),  // Approved marketing paragraph
  differentiators: jsonb("differentiators").$type<string[]>().default([]),  // Key firm differentiators

  // Legacy field (kept for backwards compat)
  states: jsonb("states").$type<string[]>().default([]),

  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type FirmSettings = typeof firmSettings.$inferSelect;
export type InsertFirmSettings = typeof firmSettings.$inferInsert;

// ─── Provider API Keys ────────────────────────────────────────────────────────
// Stores user-configured API keys for each LLM provider.
// Replaces the old hardcoded 3-provider approach with an unlimited list.

export const providerApiKeys = pgTable("provider_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),           // Display name, e.g. "Gemini Flash Experimental"
  // Free-form human label, e.g. "google_gemini", "gemini-flash", "mistral", "groq" — NOT used for routing
  provider: text("provider").notNull(),
  /**
   * SDK routing type — determines WHICH client library / HTTP format is used.
   * Valid values:
   *   "openai_compatible" — OpenAI Chat Completions API (default for all unknown providers)
   *   "google_gemini"     — Google Generative AI SDK (@google/generative-ai)
   *   "anthropic"         — Anthropic Messages API (raw fetch, anthropic-version header)
   * Decoupled from `provider` so you can name a key anything and still pick the right SDK.
   */
  sdkType: text("sdkType").notNull().default("openai_compatible"),
  apiKey: text("apiKey").notNull(),        // Stored as-is (server-side only)
  baseUrl: text("baseUrl"),               // Required for azure_openai and any custom endpoint
  isDefault: boolean("isDefault").default(false).notNull(),
  // Default model to use when this provider is selected as fallback
  defaultModel: text("defaultModel"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ProviderApiKey = typeof providerApiKeys.$inferSelect;
export type InsertProviderApiKey = typeof providerApiKeys.$inferInsert;

// ─── Normalized Tags ─────────────────────────────────────────────────────────
// Controlled vocabulary for service line tags.
// Replaces free-form comma-separated tag strings with canonical identifiers.

export const normalizedTags = pgTable("normalized_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Canonical identifier used in damDocuments.normalizedTags array, e.g. "traffic_engineering"
  canonical: text("canonical").notNull().unique(),
  // Human-readable label shown in the UI, e.g. "Traffic Engineering"
  displayName: text("displayName").notNull(),
  // Alternative forms that normalize to this tag, e.g. ["traffic eng", "traffic", "Traffic Eng."]
  aliases: jsonb("aliases").$type<string[]>().default([]),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type NormalizedTag = typeof normalizedTags.$inferSelect;
export type InsertNormalizedTag = typeof normalizedTags.$inferInsert;

// ─── Document Chunks ─────────────────────────────────────────────────────────
// Canonical normalized content units extracted from dam_documents.
// Each chunk is a discrete, typed, provenance-bearing piece of content.
// This is the central addition of Pipeline Upgrade Phase 1.

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Parent document
  damDocumentId: uuid("damDocumentId").notNull(),
  /**
   * Content type of this chunk. Valid values (matches ChunkType in shared/types.ts):
   *   project_description, project_highlight, section_content, image_caption,
   *   personnel_bio, project_experience, win_theme, certification_detail
   */
  chunkType: text("chunkType").notNull(),
  // Normalized text content of this chunk
  content: text("content").notNull(),
  // Page number, sheet name, or section reference in the source document
  pageRef: text("pageRef"),
  // Section heading or document section name
  sectionRef: text("sectionRef"),
  // Extraction confidence: 1.0 = deterministic, <1.0 = LLM-extracted or vision
  confidence: real("confidence").default(1.0).notNull(),
  /**
   * How this chunk was extracted. Valid values:
   *   deterministic — rule-based extraction from structured text
   *   llm_structured — LLM returned structured JSON; chunk derived from it
   *   llm_vision     — vision LLM transcribed an image or scanned page
   *   rule_based     — regex/heuristic extraction
   *   skipped_too_small — image too small to process
   */
  extractionMethod: text("extractionMethod").notNull().default("deterministic"),
  // Type-specific structured data (e.g. for personnel_entry: {name, title, yearsExp, certifications[]})
  metadata: jsonb("metadata"),
  // Canonical service line tags from normalized_tags.canonical (e.g. ["traffic_engineering"])
  serviceLineTags: jsonb("serviceLineTags").$type<string[]>().default([]),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // GIN index on to_tsvector expression for full-text search (Phase 3 hybrid retrieval)
  // Supports ts_rank() and plainto_tsquery() in matchProjectSheets/matchResumes/matchPastProposals
  contentFtsIdx: index("document_chunks_content_fts_idx")
    .using("gin", sql`to_tsvector('english', ${table.content})`),
  // B-tree index on damDocumentId for fast per-document chunk lookups
  damDocumentIdIdx: index("document_chunks_dam_document_id_idx").on(table.damDocumentId),
}));

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;
