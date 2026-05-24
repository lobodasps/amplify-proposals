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
  version: int("version").default(1),
  parentAssetId: int("parentAssetId"),
  uploadedBy: int("uploadedBy"),
  isPublic: boolean("isPublic").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

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
  proposalId: int("proposalId"),
  pursuitId: int("pursuitId"),
  projectId: int("projectId"),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 256 }),
  title: varchar("title", { length: 512 }).notNull(),
  contractNumber: varchar("contractNumber", { length: 128 }),
  status: mysqlEnum("contract_status", [
    "draft", "negotiation", "executed", "active", "completed", "terminated",
  ]).default("draft"),
  value: float("value"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  executionDate: timestamp("executionDate"),
  serviceLines: json("serviceLines"),
  contractManagerId: int("contractManagerId"),
  documentUrl: text("documentUrl"),
  documentKey: text("documentKey"),
  milestones: json("milestones"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

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
