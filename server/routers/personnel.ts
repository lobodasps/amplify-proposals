import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { personnel, projects, contracts } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const personnelRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(personnel).orderBy(personnel.name).limit(200);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(personnel).where(eq(personnel.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      title: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      yearsExperience: z.number().optional(),
      serviceLines: z.array(z.string()).optional(),
      summary: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(personnel).values({
        name: input.name,
        title: input.title,
        email: input.email,
        phone: input.phone,
        yearsExperience: input.yearsExperience,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        summary: input.summary,
        isActive: true,
      });
      return { success: true };
    }),
});

export const projectsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(projects).orderBy(desc(projects.createdAt)).limit(200);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      clientName: z.string().optional(),
      description: z.string().optional(),
      serviceLine: z.string().optional(),
      contractValue: z.number().optional(),
      state: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(projects).values({
        name: input.name,
        clientName: input.clientName,
        description: input.description,
        serviceLine: (input.serviceLine as any) ?? "other",
        contractValue: input.contractValue,
        state: (input.state as any) ?? "NY",
        status: "active",
        createdBy: ctx.user.id,
      });
      return { success: true };
    }),
});

export const contractsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(contracts).orderBy(desc(contracts.createdAt)).limit(200);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(contracts).where(eq(contracts.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      contractNumber: z.string(),
      title: z.string(),
      clientId: z.number().optional(),
      contractValue: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      serviceLine: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(contracts).values({
        contractNumber: input.contractNumber,
        title: input.title,
        clientId: input.clientId,
        value: input.contractValue,
        startDate: input.startDate,
        endDate: input.endDate,
        serviceLines: input.serviceLine ? JSON.stringify([input.serviceLine]) : null,
        status: "draft",
        contractManagerId: ctx.user.id,
      });
      return { success: true };
    }),
});
