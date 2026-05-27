import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { personnel, projects, contracts, pursuits, contractAmendments, assets } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { supabase } from "../supabase";
import { generatePrimaryNumber, isStrans, KNOWN_COMPANIES } from "../../shared/contractNumbers";

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

  // ── Attachments (stored in assets table with staffId) ──────────────────────
  listAttachments: protectedProcedure
    .input(z.object({ staffId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(assets)
        .where(eq(assets.staffId, input.staffId))
        .orderBy(desc(assets.createdAt));
    }),

  addAttachment: protectedProcedure
    .input(z.object({
      staffId: z.number(),
      name: z.string(),
      fileKey: z.string(),
      fileUrl: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      assetType: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(assets).values({
        name: input.name,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        assetType: (input.assetType as any) ?? "document",
        description: input.description,
        staffId: input.staffId,
        folder: "staff",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  deleteAttachment: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(assets).where(eq(assets.id, input.assetId));
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

  // ── Attachments (stored in assets table with projectId) ───────────────────
  listAttachments: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(assets)
        .where(eq(assets.projectId, input.projectId))
        .orderBy(desc(assets.createdAt));
    }),

  addAttachment: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string(),
      fileKey: z.string(),
      fileUrl: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      assetType: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(assets).values({
        name: input.name,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        assetType: (input.assetType as any) ?? "document",
        description: input.description,
        projectId: input.projectId,
        folder: "projects",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  deleteAttachment: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(assets).where(eq(assets.id, input.assetId));
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

      // Generate contract/project number if not already set
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);

      let contractNumber = contract.contractNumber;
      let projectNumber = contract.projectNumber;

      if (!contractNumber || !projectNumber) {
        // Determine company from the supabaseCompanyId provided
        const companyInfo = KNOWN_COMPANIES.find(c => c.id === input.supabaseCompanyId);
        const companyAbbrev = companyInfo?.abbreviation ?? "JPCL";

        // Count existing primary contracts this year to get next sequence
        const allContracts = await db.select({ contractNumber: contracts.contractNumber })
          .from(contracts)
          .where(eq(contracts.level as any, 1));

        // Count contracts whose number starts with YY- (JPCL) or STR-YY- (Strans)
        const prefix = isStrans(companyAbbrev) ? `STR-${yy}-` : `${yy}-`;
        const existingThisYear = allContracts.filter(c =>
          c.contractNumber?.startsWith(prefix) &&
          // Only count primary numbers (no further dashes after the seq segment)
          (c.contractNumber.replace(prefix, "").split("-").length === 1)
        ).length;

        const seq = existingThisYear + 1;
        const generatedNumber = generatePrimaryNumber(seq, companyAbbrev, yy);
        contractNumber = contractNumber ?? generatedNumber;
        projectNumber = projectNumber ?? generatedNumber;
      }

      // 1. Update Amplify contract to Active with generated numbers + store company
      const companyInfo2 = KNOWN_COMPANIES.find(c => c.id === input.supabaseCompanyId);
      await db.update(contracts)
        .set({
          status: "active",
          contractNumber,
          projectNumber,
          performingCompanyId: input.supabaseCompanyId ?? null,
          performingCompanyName: companyInfo2?.abbreviation ?? null,
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
      ownerName: z.string().optional(),
      primeName: z.string().optional(),
      projectManagerName: z.string().optional(),
      accountingContactName: z.string().optional(),
      coiRequired: z.boolean().optional(),
      coiReceived: z.boolean().optional(),
      fullyExecutedContractReceived: z.boolean().optional(),
      primeAgreementRequired: z.boolean().optional(),
      primeAgreementOnFile: z.boolean().optional(),
      clientBillingInfoOnFile: z.boolean().optional(),
      coiExpirationDate: z.date().optional(),
      qbName: z.string().optional(),
      timeCode: z.string().optional(),
      clientName: z.string().optional(),
      contractManagerName: z.string().optional(),
      primaryLocation: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...updates } = input;
      await db.update(contracts).set(updates as any).where(eq(contracts.id, id));
      return { success: true };
    }),

  // Get a contract with all its children (task orders + sub-projects) and amendments
  getWithChildren: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, input.id)).limit(1);
      if (!contract) return null;
      // Get all descendants (children and their children)
      const allContracts = await db.select().from(contracts).orderBy(contracts.contractNumber);
      const children = allContracts.filter(c => c.parentContractId === input.id);
      const childrenWithSubs = children.map(child => ({
        ...child,
        subProjects: allContracts.filter(c => c.parentContractId === child.id),
      }));
      // Get amendments and change orders
      const amendments = await db.select().from(contractAmendments)
        .where(eq(contractAmendments.contractId, input.id))
        .orderBy(contractAmendments.amendmentNumber);
      return { contract, children: childrenWithSubs, amendments };
    }),

  // Create a child contract (task order or sub-project)
  createChild: protectedProcedure
    .input(z.object({
      parentId: z.number(),
      title: z.string(),
      contractValue: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [parent] = await db.select().from(contracts).where(eq(contracts.id, input.parentId)).limit(1);
      if (!parent) throw new Error("Parent contract not found");

      const parentNumber = parent.contractNumber ?? "";
      const parentLevel = parent.level ?? 1;
      const childLevel = parentLevel + 1;
      const nodeType = childLevel === 2 ? "task_order" : "sub_project";

      // Count existing children of this parent to get next seq
      const { generateChildNumber } = await import("../../shared/contractNumbers");
      const siblings = await db.select({ contractNumber: contracts.contractNumber })
        .from(contracts)
        .where(eq(contracts.parentContractId, input.parentId));
      const childSeq = siblings.length + 1;
      const childNumber = parentNumber ? generateChildNumber(parentNumber, childSeq) : undefined;

      const result = await db.insert(contracts).values({
        parentContractId: input.parentId,
        title: input.title,
        contractNumber: childNumber,
        projectNumber: childNumber,
        clientId: parent.clientId ?? undefined,
        clientName: parent.clientName ?? undefined,
        status: parent.status === "active" ? "active" : "draft",
        contractVehicle: parent.contractVehicle ?? "standalone",
        companyRole: parent.companyRole ?? "prime",
        value: input.contractValue ?? 0,
        computedContractValue: input.contractValue ?? 0,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
        level: childLevel,
        nodeType,
        budgetBehavior: "draws_from_parent",
        contractManagerId: ctx.user.id,
      });
      return { success: true, id: (result as any).insertId, contractNumber: childNumber };
    }),

  // Add an amendment or change order to a contract
  addAmendment: protectedProcedure
    .input(z.object({
      contractId: z.number(),
      type: z.enum(["amendment", "change_order"]),
      amount: z.number(),
      description: z.string().optional(),
      date: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, input.contractId)).limit(1);
      if (!contract) throw new Error("Contract not found");

      // Count existing amendments/COs of this type for this contract
      const { generateAmendmentNumber, generateChangeOrderNumber } = await import("../../shared/contractNumbers");
      const existing = await db.select({ amendmentNumber: contractAmendments.amendmentNumber })
        .from(contractAmendments)
        .where(eq(contractAmendments.contractId, input.contractId));
      const typePrefix = input.type === "amendment" ? "-A" : "-C";
      const sameType = existing.filter(a => a.amendmentNumber?.includes(typePrefix));
      const seq = sameType.length + 1;

      const baseNumber = contract.contractNumber ?? String(input.contractId);
      const amendmentNumber = input.type === "amendment"
        ? generateAmendmentNumber(baseNumber, seq)
        : generateChangeOrderNumber(baseNumber, seq);

      await db.insert(contractAmendments).values({
        contractId: input.contractId,
        amendmentType: input.type === "amendment" ? "amendment" : "change_order",
        amendmentNumber,
        amount: input.amount,
        description: input.description,
        amendmentDate: input.date ?? new Date(),
        approvalStatus: "pending",
      });

      // Update computedContractValue on the contract
      const newValue = (contract.computedContractValue ?? contract.value ?? 0) + input.amount;
      await db.update(contracts)
        .set({ computedContractValue: newValue } as any)
        .where(eq(contracts.id, input.contractId));

      return { success: true, amendmentNumber };
    }),

  // List amendments for a contract
  listAmendments: protectedProcedure
    .input(z.object({ contractId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(contractAmendments)
        .where(eq(contractAmendments.contractId, input.contractId))
        .orderBy(contractAmendments.amendmentNumber);
    }),
});
