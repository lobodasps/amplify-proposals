import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pursuits, tasks } from "../../drizzle/schema";
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
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(pursuits).where(eq(pursuits.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      clientId: z.number().optional(),
      clientName: z.string().optional(),
      rfpNumber: z.string().optional(),
      dueDate: z.date().optional(),
      estimatedValue: z.number().optional(),
      serviceLines: z.array(z.string()).optional(),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(pursuits).values({
        title: input.title,
        clientId: input.clientId,
        clientName: input.clientName,
        rfpNumber: input.rfpNumber,
        dueDate: input.dueDate,
        estimatedValue: input.estimatedValue,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        leadId: input.leadId,
        status: "identify",
      });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(pursuits).set({ status: input.status as any }).where(eq(pursuits.id, input.id));
      return { success: true };
    }),

  getTasks: protectedProcedure
    .input(z.object({ pursuitId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(tasks).where(eq(tasks.pursuitId, input.pursuitId)).orderBy(tasks.dueDate);
    }),

  createTask: protectedProcedure
    .input(z.object({
      pursuitId: z.number(),
      title: z.string(),
      assignedTo: z.number().optional(),
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
});
