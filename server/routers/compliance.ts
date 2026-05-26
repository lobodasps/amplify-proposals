import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  complianceExceptions, activityLogs, contracts, billingEntries,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Compliance Exceptions Router ────────────────────────────────────────────

export const complianceRouter = router({
  // List all open compliance exceptions, optionally filtered by contract
  listExceptions: protectedProcedure
    .input(z.object({
      contractId: z.number().optional(),
      status: z.string().optional(), // OPEN | RESOLVED
      severity: z.string().optional(), // INFO | WARN | BLOCKER
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(complianceExceptions).orderBy(
        desc(complianceExceptions.createdAt)
      );
      let filtered = rows;
      if (input?.contractId) filtered = filtered.filter(r => r.contractId === input.contractId);
      if (input?.status) filtered = filtered.filter(r => r.status === input.status);
      if (input?.severity) filtered = filtered.filter(r => r.severity === input.severity);
      return filtered;
    }),

  // Create a compliance exception
  createException: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      severity: z.string().default("WARN"),
      exceptionType: z.string(),
      description: z.string().optional(),
      assignedToId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [created] = await db.insert(complianceExceptions).values(input).$returningId();
      const rows = await db.select().from(complianceExceptions).where(eq(complianceExceptions.id, created.id));
      return rows[0];
    }),

  // Resolve a compliance exception
  resolveException: protectedProcedure
    .input(z.object({
      id: z.number(),
      resolutionNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(complianceExceptions).set({
        status: "RESOLVED",
        resolutionNote: input.resolutionNote,
        resolvedAt: new Date(),
      }).where(eq(complianceExceptions.id, input.id));
      const rows = await db.select().from(complianceExceptions).where(eq(complianceExceptions.id, input.id));
      return rows[0];
    }),

  // Update exception
  updateException: protectedProcedure
    .input(z.object({
      id: z.number(),
      severity: z.string().optional(),
      description: z.string().optional(),
      assignedToId: z.number().optional(),
      status: z.string().optional(),
      resolutionNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "RESOLVED") updateData.resolvedAt = new Date();
      await db.update(complianceExceptions).set(updateData).where(eq(complianceExceptions.id, id));
      const rows = await db.select().from(complianceExceptions).where(eq(complianceExceptions.id, id));
      return rows[0];
    }),

  // Auto-scan all active contracts and generate compliance exceptions
  scanContracts: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const allContracts = await db.select().from(contracts);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let created = 0;

    for (const contract of allContracts) {
      if (contract.status === "completed" || contract.status === "terminated") continue;

      // Check COI required but not received
      if (contract.coiRequired && !contract.coiReceived) {
        const existing = await db.select().from(complianceExceptions).where(
          and(
            eq(complianceExceptions.contractId, contract.id),
            eq(complianceExceptions.exceptionType, "COI_MISSING"),
            eq(complianceExceptions.status, "OPEN")
          )
        );
        if (existing.length === 0) {
          await db.insert(complianceExceptions).values({
            contractId: contract.id,
            severity: "BLOCKER",
            exceptionType: "COI_MISSING",
            description: `COI required but not received for contract ${contract.contractNumber || contract.title}`,
            status: "OPEN",
          });
          created++;
        }
      }

      // Check COI expiring within 30 days
      if (contract.coiExpirationDate && contract.coiExpirationDate <= thirtyDaysFromNow && contract.coiExpirationDate >= now) {
        const existing = await db.select().from(complianceExceptions).where(
          and(
            eq(complianceExceptions.contractId, contract.id),
            eq(complianceExceptions.exceptionType, "COI_EXPIRING"),
            eq(complianceExceptions.status, "OPEN")
          )
        );
        if (existing.length === 0) {
          await db.insert(complianceExceptions).values({
            contractId: contract.id,
            severity: "WARN",
            exceptionType: "COI_EXPIRING",
            description: `COI expires on ${contract.coiExpirationDate.toLocaleDateString()} for contract ${contract.contractNumber || contract.title}`,
            status: "OPEN",
          });
          created++;
        }
      }

      // Check executed contract missing
      if (contract.status === "active" && !contract.fullyExecutedContractReceived) {
        const existing = await db.select().from(complianceExceptions).where(
          and(
            eq(complianceExceptions.contractId, contract.id),
            eq(complianceExceptions.exceptionType, "EXECUTED_MISSING"),
            eq(complianceExceptions.status, "OPEN")
          )
        );
        if (existing.length === 0) {
          await db.insert(complianceExceptions).values({
            contractId: contract.id,
            severity: "WARN",
            exceptionType: "EXECUTED_MISSING",
            description: `Fully executed contract not received for ${contract.contractNumber || contract.title}`,
            status: "OPEN",
          });
          created++;
        }
      }

      // Check over-billed
      if (contract.isBillingOverCeiling) {
        const existing = await db.select().from(complianceExceptions).where(
          and(
            eq(complianceExceptions.contractId, contract.id),
            eq(complianceExceptions.exceptionType, "OVER_BILLED"),
            eq(complianceExceptions.status, "OPEN")
          )
        );
        if (existing.length === 0) {
          await db.insert(complianceExceptions).values({
            contractId: contract.id,
            severity: "BLOCKER",
            exceptionType: "OVER_BILLED",
            description: `Contract ${contract.contractNumber || contract.title} is over the billing ceiling`,
            status: "OPEN",
          });
          created++;
        }
      }

      // Check contract expiring within 30 days
      if (contract.endDate && contract.endDate <= thirtyDaysFromNow && contract.endDate >= now && contract.status === "active") {
        const existing = await db.select().from(complianceExceptions).where(
          and(
            eq(complianceExceptions.contractId, contract.id),
            eq(complianceExceptions.exceptionType, "CONTRACT_EXPIRING"),
            eq(complianceExceptions.status, "OPEN")
          )
        );
        if (existing.length === 0) {
          await db.insert(complianceExceptions).values({
            contractId: contract.id,
            severity: "WARN",
            exceptionType: "CONTRACT_EXPIRING",
            description: `Contract ${contract.contractNumber || contract.title} expires on ${contract.endDate.toLocaleDateString()}`,
            status: "OPEN",
          });
          created++;
        }
      }
    }

    return { scanned: allContracts.length, created };
  }),

  // Summary counts for dashboard
  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, open: 0, resolved: 0, blockers: 0, warnings: 0, info: 0 };
    const all = await db.select().from(complianceExceptions);
    const open = all.filter(e => e.status === "OPEN");
    return {
      total: all.length,
      open: open.length,
      resolved: all.filter(e => e.status === "RESOLVED").length,
      blockers: open.filter(e => e.severity === "BLOCKER").length,
      warnings: open.filter(e => e.severity === "WARN").length,
      info: open.filter(e => e.severity === "INFO").length,
    };
  }),
});

// ─── Activity Log Router ──────────────────────────────────────────────────────

export const activityLogRouter = router({
  list: protectedProcedure
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(input?.limit ?? 50);
      if (input?.entityType) return rows.filter(r => r.entityType === input.entityType);
      if (input?.entityId) return rows.filter(r => r.entityId === input.entityId);
      return rows;
    }),

  log: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
      action: z.string(),
      description: z.string().optional(),
      changedFields: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(activityLogs).values({
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        description: input.description,
        changedFields: input.changedFields ? JSON.stringify(input.changedFields) : undefined,
        userId: ctx.user?.id,
        userName: ctx.user?.name ?? undefined,
      });
      return { success: true };
    }),
});

// ─── Billing Entries Router ───────────────────────────────────────────────────

export const billingEntriesRouter = router({
  listByContract: protectedProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(billingEntries)
        .where(eq(billingEntries.contractId, input.contractId))
        .orderBy(desc(billingEntries.invoiceDate));
    }),

  create: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      invoiceNumber: z.string().optional(),
      invoiceDate: z.string().optional(),
      amount: z.number(),
      billedAmount: z.number().optional(),
      retainageAmount: z.number().optional(),
      description: z.string().optional(),
      source: z.string().default("manual"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { invoiceDate, ...rest } = input;
      const data = {
        ...rest,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
      };
      const [created] = await db.insert(billingEntries).values(data).$returningId();
      // Update contract totals
      const allEntries = await db.select().from(billingEntries).where(eq(billingEntries.contractId, input.contractId));
      const totalBilled = allEntries.reduce((sum, e) => sum + (e.billedAmount ?? e.amount), 0);
      const contractRows = await db.select().from(contracts).where(eq(contracts.id, input.contractId));
      const contract = contractRows[0];
      if (contract) {
        const authorized = contract.computedContractValue ?? contract.value ?? 0;
        const billingPct = authorized > 0 ? Math.round((totalBilled / authorized) * 100) : 0;
        await db.update(contracts).set({
          totalBilledAmount: totalBilled,
          billingPercentage: billingPct,
          isBillingOverCeiling: totalBilled > authorized,
          lastInvoicedDate: data.invoiceDate ?? new Date(),
        }).where(eq(contracts.id, input.contractId));
      }
      const rows = await db.select().from(billingEntries).where(eq(billingEntries.id, created.id));
      return rows[0];
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const entryRows = await db.select().from(billingEntries).where(eq(billingEntries.id, input.id));
      const entry = entryRows[0];
      await db.delete(billingEntries).where(eq(billingEntries.id, input.id));
      if (entry) {
        const allEntries = await db.select().from(billingEntries).where(eq(billingEntries.contractId, entry.contractId));
        const totalBilled = allEntries.reduce((sum, e) => sum + (e.billedAmount ?? e.amount), 0);
        const contractRows = await db.select().from(contracts).where(eq(contracts.id, entry.contractId));
        const contract = contractRows[0];
        if (contract) {
          const authorized = contract.computedContractValue ?? contract.value ?? 0;
          const billingPct = authorized > 0 ? Math.round((totalBilled / authorized) * 100) : 0;
          await db.update(contracts).set({
            totalBilledAmount: totalBilled,
            billingPercentage: billingPct,
            isBillingOverCeiling: totalBilled > authorized,
          }).where(eq(contracts.id, entry.contractId));
        }
      }
      return { success: true };
    }),
});
