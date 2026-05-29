/**
 * Bulk Import Router
 * Handles CSV/JSON bulk imports for: Organizations, People, Contracts,
 * Amendments, Billing Entries, Service Types, Glossary Terms, Opportunities.
 *
 * All procedures accept an array of row objects parsed on the client from CSV.
 * Each procedure returns { inserted, updated, skipped, errors[] }.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  organizations, people, contracts, contractAmendments,
  billingEntries, serviceTypes, glossaryTerms, opportunities,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

// ─── Organizations ────────────────────────────────────────────────────────────
const orgRowSchema = z.object({
  name: z.string().min(1),
  orgType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

// ─── People ───────────────────────────────────────────────────────────────────
const personRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  role: z.string().optional(),
  organizationName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
});

// ─── Contracts ────────────────────────────────────────────────────────────────
const contractRowSchema = z.object({
  title: z.string().min(1),
  contractNumber: z.string().optional(),
  projectNumber: z.string().optional(),
  clientName: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.string().optional(),
  value: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  performingCompanyName: z.string().optional(),
  parentContractNumber: z.string().optional(), // used to resolve parentContractId
  level: z.coerce.number().optional(),
});

// ─── Amendments ───────────────────────────────────────────────────────────────
const amendmentRowSchema = z.object({
  contractNumber: z.string().min(1), // used to resolve contractId
  amendmentNumber: z.string().optional(),
  amendmentType: z.string().optional(),
  amount: z.coerce.number().optional(),
  amountBehavior: z.string().optional(),
  description: z.string().optional(),
  amendmentDate: z.string().optional(),
  approvalStatus: z.string().optional(),
});

// ─── Billing Entries ──────────────────────────────────────────────────────────
const billingRowSchema = z.object({
  contractNumber: z.string().min(1), // used to resolve contractId
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  amount: z.coerce.number().optional(),
  billedAmount: z.coerce.number().optional(),
  retainageAmount: z.coerce.number().optional(),
  description: z.string().optional(),
});

// ─── Service Types ────────────────────────────────────────────────────────────
const serviceTypeRowSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
});

// ─── Glossary ─────────────────────────────────────────────────────────────────
const glossaryRowSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  oneLiner: z.string().optional(),
  category: z.string().optional(),
});

// ─── Opportunities ────────────────────────────────────────────────────────────
const opportunityRowSchema = z.object({
  title: z.string().min(1),
  rfpNumber: z.string().optional(),
  clientName: z.string().optional(),
  description: z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
});

// ─── Helper: parse date string ────────────────────────────────────────────────
function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export const bulkImportRouter = router({
  // ── Organizations ──────────────────────────────────────────────────────────
  importOrganizations: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = orgRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        // Check if org with same name already exists
        const existing = await db.select({ id: organizations.id }).from(organizations)
          .where(eq(organizations.name, data.name)).limit(1);
        if (existing.length > 0) {
          await db.update(organizations).set({
            orgType: data.orgType ?? undefined,
            address: data.address ?? undefined,
            city: data.city ?? undefined,
            state: data.state ?? undefined,
            zip: data.zip ?? undefined,
            phone: data.phone ?? undefined,
            email: data.email ?? undefined,
            website: data.website ?? undefined,
            notes: data.notes ?? undefined,
          }).where(eq(organizations.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(organizations).values({
            name: data.name,
            orgType: data.orgType ?? "CLIENT",
            address: data.address ?? undefined,
            city: data.city ?? undefined,
            state: data.state ?? undefined,
            zip: data.zip ?? undefined,
            phone: data.phone ?? undefined,
            email: data.email ?? undefined,
            website: data.website ?? undefined,
            notes: data.notes ?? undefined,
            active: true,
          });
          result.inserted++;
        }
      }
      return result;
    }),

  // ── People ─────────────────────────────────────────────────────────────────
  importPeople: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = personRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        // Check by email if provided, otherwise by first+last name
        let existing: { id: string }[] = [];
        if (data.email) {
          existing = await db.select({ id: people.id }).from(people)
            .where(eq(people.email, data.email)).limit(1);
        }
        if (!existing.length) {
          existing = await db.select({ id: people.id }).from(people)
            .where(and(eq(people.firstName, data.firstName), eq(people.lastName, data.lastName ?? ""))).limit(1);
        }
        if (existing.length > 0) {
          await db.update(people).set({
            role: data.role ?? undefined,
            organizationName: data.organizationName ?? undefined,
            email: data.email ?? undefined,
            phone: data.phone ?? undefined,
            title: data.title ?? undefined,
          }).where(eq(people.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(people).values({
            firstName: data.firstName,
            lastName: data.lastName ?? "",
            role: data.role ?? "PM",
            organizationName: data.organizationName ?? undefined,
            email: data.email ?? undefined,
            phone: data.phone ?? undefined,
            title: data.title ?? undefined,
            active: true,
          });
          result.inserted++;
        }
      }
      return result;
    }),

  // ── Contracts ──────────────────────────────────────────────────────────────
  importContracts: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      // Build a map of contractNumber → id for parent resolution
      const allContracts = await db.select({ id: contracts.id, contractNumber: contracts.contractNumber }).from(contracts);
      const contractNumMap = new Map<string, string>(allContracts.filter(c => c.contractNumber).map(c => [c.contractNumber!, c.id]));

      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = contractRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        // Resolve parent
        let parentContractId: string | undefined;
        if (data.parentContractNumber) {
          parentContractId = contractNumMap.get(data.parentContractNumber);
          if (!parentContractId) {
            result.errors.push({ row: i + 1, message: `Parent contract number "${data.parentContractNumber}" not found` });
            result.skipped++;
            continue;
          }
        }
        // Check if contract with same contractNumber already exists
        if (data.contractNumber && contractNumMap.has(data.contractNumber)) {
          const existingId = contractNumMap.get(data.contractNumber)!;
          await db.update(contracts).set({
            title: data.title,
            clientName: data.clientName ?? undefined,
            ownerName: data.ownerName ?? undefined,
            status: (data.status as any) ?? undefined,
            value: data.value as any ?? undefined,
            startDate: parseDate(data.startDate),
            endDate: parseDate(data.endDate),
            notes: data.notes ?? undefined,
            performingCompanyName: data.performingCompanyName ?? undefined,
            parentContractId: parentContractId ?? undefined,
            level: data.level ?? undefined,
          }).where(eq(contracts.id, existingId));
          result.updated++;
        } else {
          await db.insert(contracts).values({
            title: data.title,
            contractNumber: data.contractNumber ?? undefined,
            projectNumber: data.projectNumber ?? undefined,
            clientName: data.clientName ?? undefined,
            ownerName: data.ownerName ?? undefined,
            status: (data.status as any) ?? "draft",
            value: data.value ?? 0,
            computedContractValue: data.value ?? 0,
            startDate: parseDate(data.startDate),
            endDate: parseDate(data.endDate),
            notes: data.notes ?? undefined,
            performingCompanyName: data.performingCompanyName ?? undefined,
            parentContractId: parentContractId ?? undefined,
            level: data.level ?? 1,
          } as any);
          // Re-query to get the inserted id
          if (data.contractNumber) {
            const newRow = await db.select({ id: contracts.id }).from(contracts)
              .where(eq(contracts.contractNumber, data.contractNumber)).limit(1);
            if (newRow[0]) contractNumMap.set(data.contractNumber, newRow[0].id);
          }
          result.inserted++;
        }
      }
      return result;
    }),

  // ── Amendments ─────────────────────────────────────────────────────────────
  importAmendments: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      const allContracts = await db.select({ id: contracts.id, contractNumber: contracts.contractNumber }).from(contracts);
      const contractNumMap = new Map<string, string>(allContracts.filter(c => c.contractNumber).map(c => [c.contractNumber!, c.id]));

      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = amendmentRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        const contractId = contractNumMap.get(data.contractNumber);
        if (!contractId) {
          result.errors.push({ row: i + 1, message: `Contract number "${data.contractNumber}" not found` });
          result.skipped++;
          continue;
        }
        await db.insert(contractAmendments).values({
          contractId,
          amendmentNumber: data.amendmentNumber ?? undefined,
          amendmentType: (data.amendmentType as any) ?? "amendment",
          amount: data.amount as any ?? 0,
          amountBehavior: (data.amountBehavior as any) ?? "adds_to_value",
          description: data.description ?? undefined,
          amendmentDate: parseDate(data.amendmentDate),
          approvalStatus: (data.approvalStatus as any) ?? "pending",
        });
        result.inserted++;
      }
      return result;
    }),

  // ── Billing Entries ────────────────────────────────────────────────────────
  importBilling: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      const allContracts = await db.select({ id: contracts.id, contractNumber: contracts.contractNumber }).from(contracts);
      const contractNumMap = new Map<string, string>(allContracts.filter(c => c.contractNumber).map(c => [c.contractNumber!, c.id]));

      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = billingRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        const contractId = contractNumMap.get(data.contractNumber);
        if (!contractId) {
          result.errors.push({ row: i + 1, message: `Contract number "${data.contractNumber}" not found` });
          result.skipped++;
          continue;
        }
        // Skip duplicate invoice numbers for same contract
        if (data.invoiceNumber) {
          const dup = await db.select({ id: billingEntries.id }).from(billingEntries)
            .where(and(eq(billingEntries.contractId, contractId), eq(billingEntries.invoiceNumber, data.invoiceNumber))).limit(1);
          if (dup.length > 0) {
            result.skipped++;
            continue;
          }
        }
        await db.insert(billingEntries).values({
          contractId,
          invoiceNumber: data.invoiceNumber ?? undefined,
          invoiceDate: parseDate(data.invoiceDate),
          amount: data.amount as any ?? 0,
          billedAmount: (data.billedAmount ?? data.amount ?? 0) as any,
          retainageAmount: data.retainageAmount as any ?? 0,
          description: data.description ?? undefined,
          source: "import",
        });
        result.inserted++;
      }
      return result;
    }),

  // ── Service Types ──────────────────────────────────────────────────────────
  importServiceTypes: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = serviceTypeRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        const existing = await db.select({ id: serviceTypes.id }).from(serviceTypes)
          .where(eq(serviceTypes.name, data.name)).limit(1);
        if (existing.length > 0) {
          await db.update(serviceTypes).set({ code: data.code ?? undefined, description: data.description ?? undefined })
            .where(eq(serviceTypes.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(serviceTypes).values({ name: data.name, code: data.code ?? undefined, description: data.description ?? undefined, active: true });
          result.inserted++;
        }
      }
      return result;
    }),

  // ── Glossary ───────────────────────────────────────────────────────────────
  importGlossary: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = glossaryRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        const existing = await db.select({ id: glossaryTerms.id }).from(glossaryTerms)
          .where(eq(glossaryTerms.term, data.term)).limit(1);
        if (existing.length > 0) {
          await db.update(glossaryTerms).set({ definition: data.definition, oneLiner: data.oneLiner ?? undefined, category: data.category ?? undefined })
            .where(eq(glossaryTerms.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(glossaryTerms).values({ term: data.term, definition: data.definition, oneLiner: data.oneLiner ?? undefined, category: data.category ?? "general", active: true });
          result.inserted++;
        }
      }
      return result;
    }),

  // ── Opportunities ──────────────────────────────────────────────────────────
  importOpportunities: protectedProcedure
    .input(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
    .mutation(async ({ input }): Promise<ImportResult> => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result: ImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < input.rows.length; i++) {
        const raw = input.rows[i];
        const parsed = opportunityRowSchema.safeParse(raw);
        if (!parsed.success) {
          result.errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
          result.skipped++;
          continue;
        }
        const data = parsed.data;
        // Check by rfpNumber if provided
        let existing: { id: string }[] = [];
        if (data.rfpNumber) {
          existing = await db.select({ id: opportunities.id }).from(opportunities)
            .where(eq(opportunities.rfpNumber, data.rfpNumber)).limit(1);
        }
        if (existing.length > 0) {
          await db.update(opportunities).set({
            title: data.title,
            clientName: data.clientName ?? undefined,
            description: data.description ?? undefined,
            estimatedValue: data.estimatedValue as any ?? undefined,
            dueDate: parseDate(data.dueDate),
            status: (data.status as any) ?? undefined,
          }).where(eq(opportunities.id, existing[0].id));
          result.updated++;
        } else {
          await db.insert(opportunities).values({
            title: data.title,
            rfpNumber: data.rfpNumber ?? undefined,
            clientName: data.clientName ?? undefined,
            description: data.description ?? undefined,
            estimatedValue: data.estimatedValue as any ?? undefined,
            dueDate: parseDate(data.dueDate),
            status: (data.status as any) ?? "new",
          });
          result.inserted++;
        }
      }
      return result;
    }),
});
