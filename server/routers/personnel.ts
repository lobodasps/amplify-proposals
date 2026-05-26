import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { personnel, projects, contracts, pursuits } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { supabase } from "../supabase";

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

  // Activate a contract and create a matching project in Supabase
  activateContract: protectedProcedure
    .input(z.object({
      id: z.number(),
      // Supabase-side fields
      supabaseCompanyId: z.string().optional(), // UUID of JPCL or Strans in Supabase
      supabaseOwnerId: z.string().optional(),   // UUID of the agency/owner in Supabase
      defaultBillingMethod: z.enum(["hourly", "unit", "lump_sum", "cost_plus", "no_charge"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Load the contract
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, input.id)).limit(1);
      if (!contract) throw new Error("Contract not found");
      if (contract.status === "active") throw new Error("Contract is already active");

      // Generate contract number if not already set
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const contractNumber = contract.contractNumber ?? `JPCL-${year}-${String(input.id).padStart(3, "0")}`;
      const projectNumber = contract.projectNumber ?? `${year}-${String(input.id).padStart(3, "0")}`;

      // 1. Update Amplify contract to Active with generated numbers
      await db.update(contracts)
        .set({
          status: "active",
          contractNumber,
          projectNumber,
        } as any)
        .where(eq(contracts.id, input.id));

      // 2. Create project record in Supabase for the timekeeping app
      let supabaseProjectId: string | null = null;
      let supabaseError: string | null = null;

      try {
        const projectPayload: Record<string, any> = {
          project_number: projectNumber,
          name: contract.title,
          description: contract.notes ?? null,
          client_id: null, // Will be linked manually in Vercel app if needed
          company_id: input.supabaseCompanyId ?? null,
          owner_id: input.supabaseOwnerId ?? null,
          status: "active",
          start_date: contract.startDate ? new Date(contract.startDate).toISOString().split("T")[0] : null,
          end_date: contract.endDate ? new Date(contract.endDate).toISOString().split("T")[0] : null,
          budget: contract.computedContractValue ?? null,
          default_billing_method: input.defaultBillingMethod ?? "hourly",
        };

        const { data: sbProject, error: sbError } = await supabase
          .from("projects")
          .insert(projectPayload)
          .select("id, project_number")
          .single();

        if (sbError) {
          supabaseError = sbError.message;
          console.error("[Supabase] Failed to create project:", sbError.message);
        } else {
          supabaseProjectId = sbProject?.id ?? null;
          console.log(`[Supabase] Project created: ${sbProject?.project_number} (${supabaseProjectId})`);
        }
      } catch (err: any) {
        supabaseError = err.message;
        console.error("[Supabase] Exception creating project:", err.message);
      }

      return {
        success: true,
        contractNumber,
        projectNumber,
        supabaseProjectId,
        supabaseError,
      };
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
