import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pursuits, tasks, proposals, rfpSessions, proposalSections, tailoredResumes } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const pursuitsRouter = router({
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pursuits).orderBy(desc(pursuits.createdAt)).limit(100);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(pursuits).where(eq(pursuits.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      clientId: z.string().uuid().optional(),
      clientName: z.string().optional(),
      rfpNumber: z.string().optional(),
      dueDate: z.date().optional(),
      estimatedValue: z.number().optional(),
      serviceLines: z.array(z.string()).optional(),
      leadId: z.string().uuid().optional(),
      rfpSessionId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db.insert(pursuits).values({
        title: input.title,
        clientId: input.clientId,
        clientName: input.clientName,
        rfpNumber: input.rfpNumber,
        dueDate: input.dueDate,
        estimatedValue: input.estimatedValue?.toString(),
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        leadId: input.leadId,
        rfpSessionId: input.rfpSessionId,
        status: "identify",
      }).returning({ id: pursuits.id });
      return { success: true, pursuitId: rows[0]?.id ?? null };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Delete linked proposals and their children
      const linkedProposals = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.pursuitId, input.id));
      for (const p of linkedProposals) {
        await db.delete(rfpSessions).where(eq(rfpSessions.proposalId, p.id));
        await db.delete(proposalSections).where(eq(proposalSections.proposalId, p.id));
        await db.delete(tailoredResumes).where(eq(tailoredResumes.proposalId, p.id));
      }
      await db.delete(proposals).where(eq(proposals.pursuitId, input.id));
      // Delete linked rfpSessions by pursuitId
      await db.delete(rfpSessions).where(eq(rfpSessions.pursuitId, input.id));
      // Delete tasks
      await db.delete(tasks).where(eq(tasks.pursuitId, input.id));
      // Delete the pursuit itself
      await db.delete(pursuits).where(eq(pursuits.id, input.id));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(pursuits).set({ status: input.status as any }).where(eq(pursuits.id, input.id));
      return { success: true };
    }),

  getTasks: protectedProcedure
    .input(z.object({ pursuitId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tasks).where(eq(tasks.pursuitId, input.pursuitId)).orderBy(tasks.dueDate);
    }),

  createTask: protectedProcedure
    .input(z.object({
      pursuitId: z.string().uuid(),
      title: z.string(),
      assignedTo: z.string().uuid().optional(),
      dueDate: z.date().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(tasks).values({
        pursuitId: input.pursuitId,
        title: input.title,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        priority: input.priority ?? "medium",
        status: "open",
      });
      return { success: true };
    }),

  // ── Asset Matching — Save Selections to Pursuit ──────────────────────────────
  saveAssetSelections: protectedProcedure
    .input(
      z.object({
        pursuitId: z.string().uuid(),
        selectedProjectIds: z.array(z.string().uuid()).default([]),
        selectedPastProposalIds: z.array(z.string().uuid()).default([]),
        selectedPersonnel: z.array(
          z.object({
            damDocumentId: z.string().uuid(),
            staffName: z.string(),
            role: z.string(),
          })
        ).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(pursuits)
        .set({
          selectedProjectIds: input.selectedProjectIds,
          selectedPastProposalIds: input.selectedPastProposalIds,
          selectedPersonnel: input.selectedPersonnel,
          updatedAt: new Date(),
        })
        .where(eq(pursuits.id, input.pursuitId));
      return { success: true };
    }),
});
