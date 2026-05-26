import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { personnel, projects, contracts, pursuits } from "../../drizzle/schema";
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
      contractNumber: z.string().optional(),
      title: z.string(),
      clientId: z.number().optional(),
      clientName: z.string().optional(),
      contractValue: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      serviceLines: z.array(z.string()).optional(),
      contractVehicle: z.string().optional(),
      companyRole: z.string().optional(),
      primaryLocation: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const result = await db.insert(contracts).values({
        contractNumber: input.contractNumber,
        title: input.title,
        clientId: input.clientId,
        clientName: input.clientName,
        value: input.contractValue ?? 0,
        computedContractValue: input.contractValue ?? 0,
        startDate: input.startDate,
        endDate: input.endDate,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        contractVehicle: input.contractVehicle ?? "standalone",
        companyRole: input.companyRole ?? "prime",
        primaryLocation: input.primaryLocation,
        notes: input.notes,
        status: "draft",
        contractManagerId: ctx.user.id,
      });
      return { success: true, id: (result as any).insertId };
    }),

  // Convert an awarded pursuit into a Draft contract
  convertFromPursuit: protectedProcedure
    .input(z.object({
      pursuitId: z.number(),
      // Optional overrides from the confirmation dialog
      contractVehicle: z.string().optional(),
      companyRole: z.string().optional(),
      projectNumber: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Load the pursuit
      const [pursuit] = await db.select().from(pursuits).where(eq(pursuits.id, input.pursuitId)).limit(1);
      if (!pursuit) throw new Error("Pursuit not found");
      if (pursuit.status !== "award") throw new Error("Pursuit must be in Awarded status to convert to contract");
      // Check if a contract already exists for this pursuit
      const existing = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.pursuitId, input.pursuitId)).limit(1);
      if (existing.length > 0) throw new Error("A contract already exists for this pursuit");
      // Create the draft contract pre-populated from the pursuit
      const result = await db.insert(contracts).values({
        pursuitId: pursuit.id,
        clientId: pursuit.clientId ?? undefined,
        clientName: pursuit.clientName ?? undefined,
        title: pursuit.title,
        projectNumber: input.projectNumber ?? undefined,
        status: "draft",
        contractVehicle: input.contractVehicle ?? "standalone",
        companyRole: input.companyRole ?? "prime",
        value: pursuit.awardedValue ?? pursuit.estimatedValue ?? 0,
        computedContractValue: pursuit.awardedValue ?? pursuit.estimatedValue ?? 0,
        serviceLines: pursuit.serviceLines,
        notes: input.notes ?? pursuit.notes ?? undefined,
        contractManagerId: ctx.user.id,
        level: 1,
        nodeType: "contract",
        budgetBehavior: "independent",
        isPublic: true,
      });
      const newContractId = (result as any).insertId;
      return { success: true, contractId: newContractId };
    }),

  // Update a contract
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      title: z.string().optional(),
      contractNumber: z.string().optional(),
      projectNumber: z.string().optional(),
      value: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      contractVehicle: z.string().optional(),
      companyRole: z.string().optional(),
      notes: z.string().optional(),
      coiRequired: z.boolean().optional(),
      coiReceived: z.boolean().optional(),
      fullyExecutedContractReceived: z.boolean().optional(),
      primeAgreementRequired: z.boolean().optional(),
      primeAgreementOnFile: z.boolean().optional(),
      clientBillingInfoOnFile: z.boolean().optional(),
      qbName: z.string().optional(),
      timeCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updates } = input;
      await db.update(contracts).set(updates as any).where(eq(contracts.id, id));
      return { success: true };
    }),
});
