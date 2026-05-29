import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  entities, orderTypes, departments, serviceTypes, form254Codes,
  organizations, people, glossaryTerms, appSettings,
} from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

// ─── Entities Router ──────────────────────────────────────────────────────────

export const entitiesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(entities).orderBy(asc(entities.name));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      shortName: z.string().optional(),
      badgeColor: z.string().default("blue"),
      supabaseCompanyId: z.string().optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(entities).values(input).returning({ id: entities.id });
      const rows = await db.select().from(entities).where(eq(entities.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      shortName: z.string().optional(),
      badgeColor: z.string().optional(),
      supabaseCompanyId: z.string().optional(),
      isDefault: z.boolean().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(entities).set(data).where(eq(entities.id, id));
      const rows = await db.select().from(entities).where(eq(entities.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(entities).set({ active: false }).where(eq(entities.id, input.id));
      return { success: true };
    }),
});

// ─── Order Types Router ───────────────────────────────────────────────────────

export const orderTypesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(orderTypes).where(eq(orderTypes.active, true)).orderBy(asc(orderTypes.name));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(orderTypes).values(input).returning({ id: orderTypes.id });
      const rows = await db.select().from(orderTypes).where(eq(orderTypes.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(orderTypes).set(data).where(eq(orderTypes.id, id));
      const rows = await db.select().from(orderTypes).where(eq(orderTypes.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(orderTypes).set({ active: false }).where(eq(orderTypes.id, input.id));
      return { success: true };
    }),
});

// ─── Departments Router ───────────────────────────────────────────────────────

export const departmentsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(departments).where(eq(departments.active, true)).orderBy(asc(departments.name));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(departments).values(input).returning({ id: departments.id });
      const rows = await db.select().from(departments).where(eq(departments.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), description: z.string().optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(departments).set(data).where(eq(departments.id, id));
      const rows = await db.select().from(departments).where(eq(departments.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(departments).set({ active: false }).where(eq(departments.id, input.id));
      return { success: true };
    }),
});

// ─── Service Types Router ─────────────────────────────────────────────────────

export const serviceTypesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name));
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), code: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(serviceTypes).values(input).returning({ id: serviceTypes.id });
      const rows = await db.select().from(serviceTypes).where(eq(serviceTypes.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().optional(), code: z.string().optional(), description: z.string().optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(serviceTypes).set(data).where(eq(serviceTypes.id, id));
      const rows = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(serviceTypes).set({ active: false }).where(eq(serviceTypes.id, input.id));
      return { success: true };
    }),
});

// ─── Form 254 Codes Router ────────────────────────────────────────────────────

export const form254CodesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(form254Codes).where(eq(form254Codes.active, true)).orderBy(asc(form254Codes.code));
  }),

  create: protectedProcedure
    .input(z.object({ code: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(form254Codes).values(input).returning({ id: form254Codes.id });
      const rows = await db.select().from(form254Codes).where(eq(form254Codes.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), code: z.string().optional(), description: z.string().optional(), active: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(form254Codes).set(data).where(eq(form254Codes.id, id));
      const rows = await db.select().from(form254Codes).where(eq(form254Codes.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(form254Codes).set({ active: false }).where(eq(form254Codes.id, input.id));
      return { success: true };
    }),
});

// ─── Organizations Router ─────────────────────────────────────────────────────

export const organizationsRouter = router({
  list: protectedProcedure
    .input(z.object({ orgType: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(organizations).where(eq(organizations.active, true)).orderBy(asc(organizations.name));
      if (input?.orgType) return rows.filter((r) => r.orgType === input.orgType);
      if (input?.search) return rows.filter((r) => r.name.toLowerCase().includes(input.search!.toLowerCase()));
      return rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(organizations).where(eq(organizations.id, input.id));
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      orgType: z.string().default("CLIENT"),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(organizations).values(input).returning({ id: organizations.id });
      const rows = await db.select().from(organizations).where(eq(organizations.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      orgType: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(organizations).set(data).where(eq(organizations.id, id));
      const rows = await db.select().from(organizations).where(eq(organizations.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(organizations).set({ active: false }).where(eq(organizations.id, input.id));
      return { success: true };
    }),
});

// ─── People Router ────────────────────────────────────────────────────────────

export const peopleRouter = router({
  list: protectedProcedure
    .input(z.object({ role: z.string().optional(), organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(people).where(eq(people.active, true)).orderBy(asc(people.lastName));
      if (input?.role) return rows.filter((r) => r.role === input.role);
      if (input?.organizationId) return rows.filter((r) => r.organizationId === input.organizationId);
      return rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(people).where(eq(people.id, input.id));
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      role: z.string().default("PM"),
      organizationId: z.string().uuid().optional(),
      organizationName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(people).values(input).returning({ id: people.id });
      const rows = await db.select().from(people).where(eq(people.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      role: z.string().optional(),
      organizationId: z.string().uuid().optional(),
      organizationName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(people).set(data as any).where(eq(people.id, id));
      const rows = await db.select().from(people).where(eq(people.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(people).set({ active: false }).where(eq(people.id, input.id));
      return { success: true };
    }),
});

// ─── Glossary Router ──────────────────────────────────────────────────────────

const DEFAULT_GLOSSARY_TERMS = [
  { term: "IDIQ", definition: "Indefinite Delivery / Indefinite Quantity — a contract that provides for an indefinite quantity of services during a fixed period.", characteristics: ["No guaranteed quantity", "Task orders issued against master contract", "Ceiling value established upfront"], typicalUse: ["On-call engineering services", "Inspection contracts", "Design-build programs"], oneLiner: "Open-ended contract with task orders", category: "contract", sortOrder: 1 },
  { term: "NTE", definition: "Not-To-Exceed — the maximum amount that can be billed under a contract or task order without a formal amendment.", characteristics: ["Hard ceiling on billing", "Requires amendment to increase", "Tracked against actual billed amount"], typicalUse: ["Task orders under IDIQ", "Time & Materials contracts", "Cost-plus contracts"], oneLiner: "Maximum billing ceiling", category: "billing", sortOrder: 2 },
  { term: "T&M", definition: "Time & Materials — a billing method where the client pays for actual labor hours at agreed rates plus actual material costs.", characteristics: ["Hourly billing rates", "Material cost reimbursement", "Requires detailed time records"], typicalUse: ["Inspection services", "Construction management", "Emergency response"], oneLiner: "Pay per hour + materials", category: "pricing", sortOrder: 3 },
  { term: "Lump Sum", definition: "A fixed-price contract where the contractor agrees to complete the scope of work for a single, fixed price.", characteristics: ["Fixed total price", "Contractor bears cost risk", "No billing for overruns"], typicalUse: ["Design services", "Studies and reports", "Well-defined scopes"], oneLiner: "Fixed total price", category: "pricing", sortOrder: 4 },
  { term: "Cost Plus", definition: "A contract where the client reimburses the contractor for actual costs incurred plus an agreed fee or percentage.", characteristics: ["Reimbursable costs", "Fee on top of costs", "Requires detailed cost tracking"], typicalUse: ["Complex projects with uncertain scope", "Research and development", "Emergency work"], oneLiner: "Actual costs + fee", category: "pricing", sortOrder: 5 },
  { term: "MSA", definition: "Master Services Agreement — a contract that establishes the terms and conditions governing future task orders or work orders.", characteristics: ["Framework agreement", "Task orders issued under it", "Terms negotiated once"], typicalUse: ["Ongoing client relationships", "On-call services", "Multi-year programs"], oneLiner: "Master framework for task orders", category: "contract", sortOrder: 6 },
  { term: "Task Order", definition: "A specific work authorization issued under an IDIQ or MSA contract that defines a particular scope, schedule, and budget.", characteristics: ["Specific scope and budget", "Issued under master contract", "Has own NTE ceiling"], typicalUse: ["IDIQ contracts", "On-call programs", "MSA work authorizations"], oneLiner: "Specific work order under master contract", category: "contract", sortOrder: 7 },
  { term: "Retainage", definition: "A percentage of earned contract value withheld by the client until project completion to ensure contractor performance.", characteristics: ["Typically 5-10% of billings", "Released at substantial completion", "Incentive for completion"], typicalUse: ["Construction contracts", "Design-build", "Long-term projects"], oneLiner: "Withheld payment until completion", category: "billing", sortOrder: 8 },
  { term: "COI", definition: "Certificate of Insurance — a document proving that a contractor carries the required insurance coverage for a project.", characteristics: ["Names client as additional insured", "Specifies coverage amounts", "Has expiration date"], typicalUse: ["Required before contract execution", "Renewed annually", "Required for each project"], oneLiner: "Proof of insurance coverage", category: "contract", sortOrder: 9 },
  { term: "Draw-Down", definition: "The percentage of authorized contract value that has been billed to date.", characteristics: ["Calculated as billed ÷ authorized", "Triggers review when high", "Indicates contract utilization"], typicalUse: ["Contract monitoring", "Financial reporting", "Billing forecasting"], oneLiner: "% of contract value billed", category: "billing", sortOrder: 10 },
  { term: "Unit Price", definition: "A billing method where the contractor is paid a fixed price per unit of work completed.", characteristics: ["Fixed price per unit", "Quantity can vary", "Easy to audit"], typicalUse: ["Special inspections", "Material testing", "Survey work"], oneLiner: "Fixed price per unit of work", category: "pricing", sortOrder: 11 },
  { term: "Change Order", definition: "A formal modification to an executed contract that changes the scope, schedule, or price.", characteristics: ["Requires written approval", "Modifies original contract", "Has its own number and date"], typicalUse: ["Scope additions", "Schedule extensions", "Price adjustments"], oneLiner: "Formal contract modification", category: "contract", sortOrder: 12 },
];

export const glossaryRouter = router({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(glossaryTerms)
        .where(eq(glossaryTerms.active, true))
        .orderBy(asc(glossaryTerms.sortOrder), asc(glossaryTerms.term));
      if (input?.category) return rows.filter((r) => r.category === input.category);
      if (input?.search) return rows.filter((r) =>
        r.term.toLowerCase().includes(input.search!.toLowerCase()) ||
        r.definition.toLowerCase().includes(input.search!.toLowerCase())
      );
      return rows;
    }),

  create: protectedProcedure
    .input(z.object({
      term: z.string().min(1),
      definition: z.string().min(1),
      characteristics: z.array(z.string()).optional(),
      typicalUse: z.array(z.string()).optional(),
      oneLiner: z.string().optional(),
      category: z.string().default("general"),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(glossaryTerms).values(input).returning({ id: glossaryTerms.id });
      const rows = await db.select().from(glossaryTerms).where(eq(glossaryTerms.id, created.id));
      return rows[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      term: z.string().optional(),
      definition: z.string().optional(),
      characteristics: z.array(z.string()).optional(),
      typicalUse: z.array(z.string()).optional(),
      oneLiner: z.string().optional(),
      category: z.string().optional(),
      sortOrder: z.number().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      await db.update(glossaryTerms).set(data).where(eq(glossaryTerms.id, id));
      const rows = await db.select().from(glossaryTerms).where(eq(glossaryTerms.id, id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(glossaryTerms).set({ active: false }).where(eq(glossaryTerms.id, input.id));
      return { success: true };
    }),

  seed: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(glossaryTerms);
    const existingTerms = new Set(existing.map((t) => t.term.toLowerCase()));
    const toInsert = DEFAULT_GLOSSARY_TERMS.filter((d) => !existingTerms.has(d.term.toLowerCase()));
    if (toInsert.length > 0) {
      await db.insert(glossaryTerms).values(toInsert);
    }
    return { inserted: toInsert.length, skipped: DEFAULT_GLOSSARY_TERMS.length - toInsert.length };
  }),
});

// ─── App Settings Router ──────────────────────────────────────────────────────

export const appSettingsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(appSettings).orderBy(asc(appSettings.key));
  }),

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, input.key));
      return rows[0] ?? null;
    }),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db.select().from(appSettings).where(eq(appSettings.key, input.key));
      if (existing.length > 0) {
        await db.update(appSettings).set({ value: input.value, updatedBy: ctx.user?.id }).where(eq(appSettings.key, input.key));
      } else {
        await db.insert(appSettings).values({ key: input.key, value: input.value, description: input.description, updatedBy: ctx.user?.id });
      }
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, input.key));
      return rows[0];
    }),
});

// ─── Seed Entities Router ─────────────────────────────────────────────────────

export const seedEntitiesRouter = router({
  seedEntities: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(entities);
    if (existing.length > 0) return { inserted: 0, message: "Entities already seeded" };
    await db.insert(entities).values([
      { name: "JPCL", shortName: "JPCL", badgeColor: "blue", supabaseCompanyId: "fddf0d5c-1234-4321-abcd-000000000001", isDefault: true, active: true },
      { name: "Strans Engineering", shortName: "Strans", badgeColor: "emerald", supabaseCompanyId: "e45a26d6-1234-4321-abcd-000000000002", isDefault: false, active: true },
    ]);
    return { inserted: 2, message: "JPCL and Strans seeded" };
  }),

  seedOrderTypes: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(orderTypes);
    if (existing.length > 0) return { inserted: 0, message: "Order types already seeded" };
    await db.insert(orderTypes).values([
      { name: "Task Order", description: "Standard task order under IDIQ or MSA", active: true },
      { name: "Purchase Order", description: "Purchase order for goods or services", active: true },
      { name: "Work Order", description: "Work authorization for specific scope", active: true },
      { name: "Statement of Work", description: "Detailed scope document", active: true },
      { name: "Job Order", description: "Job-based work authorization", active: true },
    ]);
    return { inserted: 5, message: "Order types seeded" };
  }),

  seedDepartments: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(departments);
    if (existing.length > 0) return { inserted: 0, message: "Departments already seeded" };
    await db.insert(departments).values([
      { name: "Engineering", description: "Civil and structural engineering services", active: true },
      { name: "Construction Management", description: "CM and inspection services", active: true },
      { name: "Traffic Engineering", description: "Traffic studies and signal design", active: true },
      { name: "Environmental", description: "Environmental assessment and compliance", active: true },
      { name: "Landscape / Streetscape", description: "Landscape architecture and urban design", active: true },
      { name: "Special Inspections", description: "Materials testing and special inspections", active: true },
      { name: "Business Development", description: "BD and proposal management", active: true },
      { name: "Administration", description: "Administrative and finance", active: true },
    ]);
    return { inserted: 8, message: "Departments seeded" };
  }),

  seedServiceTypes: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select().from(serviceTypes);
    if (existing.length > 0) return { inserted: 0, message: "Service types already seeded" };
    await db.insert(serviceTypes).values([
      { name: "Construction Inspection", code: "CI", description: "On-site construction inspection services", active: true },
      { name: "Construction Management", code: "CM", description: "Full construction management services", active: true },
      { name: "Traffic Engineering", code: "TE", description: "Traffic studies, signal timing, design", active: true },
      { name: "Structural Engineering", code: "SE", description: "Structural analysis and design", active: true },
      { name: "Environmental Assessment", code: "EA", description: "Environmental studies and permitting", active: true },
      { name: "Special Inspections", code: "SI", description: "IBC special inspections and testing", active: true },
      { name: "Landscape Architecture", code: "LA", description: "Landscape and streetscape design", active: true },
      { name: "Program Management", code: "PM", description: "Program-level management services", active: true },
    ]);
    return { inserted: 8, message: "Service types seeded" };
  }),
});
