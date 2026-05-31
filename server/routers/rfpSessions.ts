/**
 * server/routers/rfpSessions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC router for the Proposal Workspace sequential skill workflow.
 *
 * KEY DESIGN RULES (enforced here):
 * 1. executeSkill runs ONE skill per request — never loops through all skills.
 * 2. After the LLM returns, the DB is updated BEFORE the endpoint returns.
 * 3. skillOutputs and workflowState are appended (merged), never overwritten.
 * 4. The frontend is the orchestrator — it calls executeSkill sequentially.
 * 5. No existing contract/billing logic is touched.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { rfpSessions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";
import type {
  WorkflowSkillName,
  WorkflowState,
  SkillOutputs,
  SkillStateEntry,
  ParsedRfpData,
} from "../../shared/workflowTypes";
import {
  WORKFLOW_SKILL_NAMES,
  SKILL_META,
} from "../../shared/workflowTypes";
import { shredSingleFile, escapeXml } from "./xmlShredder";
import { LABEL_TIER_MAP, type ExtractionTier, type RfpFileLabel } from "../../shared/types";

// ─── Zod schema for WorkflowSkillName ────────────────────────────────────────

const workflowSkillNameSchema = z.enum([
  "rfp_parser",
  "win_themes",
  "technical_outline",
  "technical_writer",
  "key_personnel",
  "past_performance",
  "fee_estimator",
  "proposal_scorer",
] as const);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely merge a new key into an existing JSON column value */
function mergeJson<T extends Record<string, unknown>>(
  existing: unknown,
  patch: Partial<T>
): T {
  const base = (existing && typeof existing === "object" ? existing : {}) as T;
  return { ...base, ...patch } as T;
}

/** Build skill-specific LLM variables from session context */
function buildSkillVariables(
  skillName: WorkflowSkillName,
  session: typeof rfpSessions.$inferSelect
): Record<string, string> {
  const outputs = (session.skillOutputs ?? {}) as SkillOutputs;
  const extracted = (session.extractedData ?? {}) as Partial<ParsedRfpData>;

  const rfpContext = outputs.rfp_parser ?? extracted.scopeSummary ?? "RFP context not yet parsed.";
  const winThemes = outputs.win_themes ?? "Win themes not yet generated.";
  const technicalOutline = outputs.technical_outline ?? "Technical outline not yet generated.";
  const technicalApproach = outputs.technical_writer ?? "Technical approach not yet drafted.";
  const keyPersonnel = outputs.key_personnel ?? "Key personnel section not yet drafted.";
  const pastPerformance = outputs.past_performance ?? "Past performance section not yet drafted.";

  const agency = extracted.agency ?? "the client agency";
  const rfpTitle = extracted.projectTitle ?? "this proposal";
  const rfpNumber = extracted.rfpNumber ?? "";
  const evalCriteria = JSON.stringify(extracted.evaluationCriteria ?? []);
  const keyPersonnelReqs = JSON.stringify(extracted.keyPersonnelRequirements ?? []);
  const scopeSummary = extracted.scopeSummary ?? rfpContext;

  switch (skillName) {
    case "rfp_parser": {
      const uploadedFiles = (session.uploadedFiles ?? []) as Array<{ name: string; url: string; mimeType: string }>;
      const fileList = uploadedFiles.length > 0
        ? `RFP Package contains ${uploadedFiles.length} files:\n${uploadedFiles.map((f) => `- ${f.name}`).join("\n")}\n\nThe most relevant documents are attached as file content below. Extract all RFP details from the attached files.`
        : session.rfpFileUrl
          ? `[File attached below]`
          : "No RFP file uploaded.";
      return {
        rfpText: fileList,
        firmProfile:
          "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY/NYC public-agency markets.",
      };
    }

    case "win_themes":
      return {
        rfpContext,
        agency,
        rfpTitle,
        evalCriteria,
        firmCapabilities:
          "Special Inspections (NICET-certified), Construction Management, Traffic Engineering, Landscape/Streetscape, Environmental services. 20+ years NJ/NY/NYC public-agency experience. NJDOT, NYSDOT, PANYNJ, NJTA, NYC DOT, NYC DEP approved.",
      };

    case "technical_outline":
      return {
        rfpContext,
        winThemes,
        agency,
        rfpTitle,
        evalCriteria,
        scopeSummary,
      };

    case "technical_writer":
      return {
        rfpContext,
        winThemes,
        technicalOutline,
        agency,
        rfpTitle,
        firmExperience:
          "Our firm brings 20+ years of NJ/NY/NYC public-agency AEC experience. We have successfully delivered Special Inspections, CM, Traffic Engineering, and Environmental services for NJDOT, NYSDOT, PANYNJ, NJTA, NYC DOT, and NYC DEP.",
        wordLimit: "800-1200 words",
      };

    case "key_personnel":
      return {
        rfpContext,
        keyPersonnelReqs,
        agency,
        rfpTitle,
        availableStaff:
          "Staff data will be pulled from the Timekeeping skills matrix in a future integration. For now, reference firm's qualified personnel with relevant certifications.",
      };

    case "past_performance":
      return {
        rfpContext,
        agency,
        rfpTitle,
        evalCriteria,
        pastProjectsContext:
          "Project briefs will be pulled from the DAM in a future integration. For now, reference firm's relevant completed projects in NJ/NY/NYC public-agency markets.",
        projectCount: "5",
      };

    case "fee_estimator":
      return {
        rfpContext,
        technicalOutline,
        agency,
        rfpTitle,
        scopeSummary,
        laborCategories:
          "Principal-in-Charge, Project Manager, Senior Engineer/Inspector, Engineer/Inspector, Field Inspector, Administrative. Rates from Timekeeping system (future integration).",
      };

    case "proposal_scorer":
      return {
        rfpContext,
        evalCriteria,
        agency,
        rfpTitle,
        technicalApproach,
        keyPersonnel,
        pastPerformance,
        winThemes,
        scoreTarget: "full proposal draft",
      };

    default:
      return { rfpContext, agency, rfpTitle };
  }
}

/** Map WorkflowSkillName to the aiSkills.skillType used for LLM config lookup */
function mapToSkillType(skillName: WorkflowSkillName): string {
  const mapping: Record<WorkflowSkillName, string> = {
    rfp_parser: "rfp_shredder",
    win_themes: "go_no_go_advisor",
    technical_outline: "proposal_writer",
    technical_writer: "proposal_writer",
    key_personnel: "resume_tailor",
    past_performance: "proposal_writer",
    fee_estimator: "proposal_writer",
    proposal_scorer: "proposal_scorer",
  };
  return mapping[skillName] ?? "proposal_writer";
}

/** Get JSON schema for structured output skills */
function getResponseFormat(skillName: WorkflowSkillName) {
  if (skillName === "rfp_parser") {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: "parsed_rfp_data",
        strict: true,
        schema: {
          type: "object",
          properties: {
            projectTitle: { type: "string" },
            agency: { type: "string" },
            rfpNumber: { type: "string" },
            submissionDeadline: { type: "string" },
            estimatedValue: { type: "string" },
            serviceLines: { type: "array", items: { type: "string" } },
            evaluationCriteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  weight: { type: "string" },
                  description: { type: "string" },
                },
                required: ["id", "title", "weight", "description"],
                additionalProperties: false,
              },
            },
            keyPersonnelRequirements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  requiredCertifications: { type: "array", items: { type: "string" } },
                  minimumYearsExperience: { type: "number" },
                  description: { type: "string" },
                },
                required: ["role", "requiredCertifications", "minimumYearsExperience", "description"],
                additionalProperties: false,
              },
            },
            pageLimits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  section: { type: "string" },
                  limit: { type: "string" },
                },
                required: ["section", "limit"],
                additionalProperties: false,
              },
            },
            mandatoryItems: { type: "array", items: { type: "string" } },
            submissionFormat: { type: "string" },
            scopeSummary: { type: "string" },
            conflictsDetected: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["type", "description", "severity"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "projectTitle", "agency", "rfpNumber", "submissionDeadline",
            "estimatedValue", "serviceLines", "evaluationCriteria",
            "keyPersonnelRequirements", "pageLimits", "mandatoryItems",
            "submissionFormat", "scopeSummary", "conflictsDetected",
          ],
          additionalProperties: false,
        },
      },
    };
  }

  if (skillName === "proposal_scorer") {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: "scorer_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            overallScore: { type: "number" },
            sectionScores: {
              type: "object",
              additionalProperties: { type: "number" },
            },
            criteriaScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterionId: { type: "string" },
                  criterionTitle: { type: "string" },
                  score: { type: "number" },
                  addressedWell: { type: "string" },
                  gaps: { type: "array", items: { type: "string" } },
                  improvements: { type: "array", items: { type: "string" } },
                },
                required: ["criterionId", "criterionTitle", "score", "addressedWell", "gaps", "improvements"],
                additionalProperties: false,
              },
            },
            topGaps: { type: "array", items: { type: "string" } },
            topImprovements: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
          required: ["overallScore", "sectionScores", "criteriaScores", "topGaps", "topImprovements", "summary"],
          additionalProperties: false,
        },
      },
    };
  }

  return undefined;
}

/** Get system prompt override for workflow-specific skills */
function getSystemOverride(skillName: WorkflowSkillName): string | undefined {
  const overrides: Partial<Record<WorkflowSkillName, string>> = {
    win_themes: `You are an expert AEC proposal strategist specializing in NJ/NY/NYC public-agency markets.
Generate 3-5 differentiated win themes for this proposal. Each theme must:
1. Directly address a key evaluation criterion
2. Be specific to this firm's capabilities (not generic)
3. Include evidence from past performance
4. Be expressed as a compelling, memorable statement
Return as a numbered list with theme title, supporting evidence, and how it addresses the RFP.`,

    technical_outline: `You are an expert AEC proposal writer. Create a detailed section-by-section outline for the Technical Approach.
Each section must:
1. Map directly to an RFP evaluation criterion
2. List 3-5 key points to address
3. Reference the win themes where applicable
4. Note any specific RFP language to mirror
Return as a structured outline with section headers and bullet points.`,

    key_personnel: `You are an expert AEC proposal writer specializing in key personnel sections.
Draft the Key Personnel section based on RFP requirements.
For each required role:
1. State the qualifications required by the RFP
2. Describe the type of professional needed (certifications, experience)
3. Note how the firm's staff meets or exceeds requirements
4. Format for SF-330 Section E compatibility
Return as a professional proposal section.`,

    past_performance: `You are an expert AEC proposal writer specializing in past performance sections.
Draft the Past Performance section based on RFP requirements.
For each project:
1. Project name, client, location, contract value
2. Scope description (2-3 sentences)
3. Relevance to this RFP (specific connection to evaluation criteria)
4. Key outcomes and measurable results
Format for SF-330 Section F compatibility. Return as a professional proposal section.`,

    fee_estimator: `You are an expert AEC fee estimator with deep knowledge of NJ/NY/NYC public-agency contract structures.
Generate a preliminary fee estimate based on the project scope.
Structure the estimate by:
1. Major tasks/phases (from the technical outline)
2. Labor categories and estimated hours per task
3. Direct costs (travel, equipment, subconsultants)
4. Total fee by task and overall
Note: Actual billing rates will be confirmed with the Timekeeping system.
Return as a structured fee table with totals.`,
  };
  return overrides[skillName];
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const rfpSessionsRouter = router({
  // ── Create a new rfpSession ────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        pursuitId: z.string().uuid().optional(),
        proposalId: z.string().uuid().optional(),
        opportunityId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const initialWorkflowState: WorkflowState = {
        rfp_parser: { status: "pending" },
        win_themes: { status: "pending" },
        technical_outline: { status: "pending" },
        technical_writer: { status: "pending" },
        key_personnel: { status: "pending" },
        past_performance: { status: "pending" },
        fee_estimator: { status: "pending" },
        proposal_scorer: { status: "pending" },
      };

      const [result] = await db
        .insert(rfpSessions)
        .values({
          pursuitId: input.pursuitId,
          proposalId: input.proposalId,
          opportunityId: input.opportunityId,
          sessionStatus: "not_started",
          workflowState: initialWorkflowState,
          skillOutputs: {},
          createdBy: ctx.user.id,
        })
        .returning({ id: rfpSessions.id });

      return { sessionId: result.id };
    }),

  // ── Get a session by ID (used on page load for resume) ────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  // ── List sessions for a pursuit ───────────────────────────────────────────
  listByPursuit: protectedProcedure
    .input(z.object({ pursuitId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.pursuitId, input.pursuitId))
        .orderBy(rfpSessions.createdAt);
    }),


  // ── List sessions for a proposal (by proposalId) ─────────────────────
  listByProposal: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.proposalId, input.proposalId))
        .orderBy(rfpSessions.createdAt);
    }),
  // ── Link an existing session to a proposal/pursuit ─────────────────────────
  linkToProposal: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        proposalId: z.string().uuid(),
        pursuitId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(rfpSessions)
        .set({
          proposalId: input.proposalId,
          ...(input.pursuitId ? { pursuitId: input.pursuitId } : {}),
        })
        .where(eq(rfpSessions.id, input.sessionId));
      return { success: true };
    }),

  // ── Save RFP file metadata (after upload to storage) ─────────────────────
  saveRfpFile: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        rfpFileName: z.string(),
        rfpFileKey: z.string(),
        rfpFileUrl: z.string(),
        rfpMimeType: z.string().optional(),
        rfpFileSizeBytes: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(rfpSessions)
        .set({
          rfpFileName: input.rfpFileName,
          rfpFileKey: input.rfpFileKey,
          rfpFileUrl: input.rfpFileUrl,
          rfpMimeType: input.rfpMimeType,
          rfpFileSizeBytes: input.rfpFileSizeBytes,
          sessionStatus: "not_started",
        })
        .where(eq(rfpSessions.id, input.sessionId));
      return { success: true };
    }),

  /** Save all uploaded file metadata (name, url, mimeType) for multi-file RFP packages */
  saveUploadedFiles: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        files: z.array(z.object({
          name: z.string(),
          url: z.string(),
          mimeType: z.string(),
          /** User-chosen label from FILE_LABELS — used to determine extraction tier */
          label: z.string().optional(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(rfpSessions)
        .set({ uploadedFiles: input.files })
        .where(eq(rfpSessions.id, input.sessionId));
      return { success: true };
    }),

  // ── Manually update a skill output (for human edits) ─────────────────────
  updateSkillOutput: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        skillName: workflowSkillNameSchema,
        output: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const rows = await db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.id, input.sessionId))
        .limit(1);
      const session = rows[0];
      if (!session) throw new Error("Session not found");

      const updatedOutputs = mergeJson<SkillOutputs>(session.skillOutputs, {
        [input.skillName]: input.output,
      });

      await db
        .update(rfpSessions)
        .set({ skillOutputs: updatedOutputs })
        .where(eq(rfpSessions.id, input.sessionId));

      return { success: true };
    }),

  // ── Reset a skill to pending (to re-run it) ───────────────────────────────
  resetSkill: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        skillName: workflowSkillNameSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const rows = await db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.id, input.sessionId))
        .limit(1);
      const session = rows[0];
      if (!session) throw new Error("Session not found");

      const updatedState = mergeJson<WorkflowState>(session.workflowState, {
        [input.skillName]: { status: "pending" } satisfies SkillStateEntry,
      });

      // Also clear the output for this skill
      const updatedOutputs = mergeJson<SkillOutputs>(session.skillOutputs, {
        [input.skillName]: undefined as unknown as string,
      });
      // Remove the key entirely
      delete (updatedOutputs as Record<string, unknown>)[input.skillName];

      await db
        .update(rfpSessions)
        .set({
          workflowState: updatedState,
          skillOutputs: updatedOutputs,
        })
        .where(eq(rfpSessions.id, input.sessionId));

      return { success: true };
    }),

  // ── THE CORE ENDPOINT: Execute a single skill ─────────────────────────────
  //
  // This is the only endpoint the frontend calls to run AI skills.
  // It MUST:
  // 1. Validate the session exists and the skill is not already complete
  // 2. Mark the skill as "running" in workflowState (immediate DB write)
  // 3. Invoke the LLM for this specific skill only
  // 4. Write the output to skillOutputs (DB write before returning)
  // 5. Mark the skill as "complete" in workflowState (DB write)
  // 6. Return success — the frontend then fires the next skill
  //
  // If the LLM throws, the skill is marked "error" in workflowState.
  // The frontend can retry from the errored skill.
  executeSkill: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        skillName: workflowSkillNameSchema,
        /** Optional: force re-run even if already complete */
        force: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // ── 1. Load session ──────────────────────────────────────────────────
      const rows = await db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.id, input.sessionId))
        .limit(1);
      const session = rows[0];
      if (!session) throw new Error(`Session ${input.sessionId} not found`);

      const currentState = (session.workflowState ?? {}) as WorkflowState;
      const currentEntry = currentState[input.skillName];

      // ── 2. Guard: skip if already complete (unless forced) ───────────────
      if (currentEntry?.status === "complete" && !input.force) {
        return {
          success: true,
          skillName: input.skillName,
          output: ((session.skillOutputs ?? {}) as SkillOutputs)[input.skillName] ?? "",
          model: currentEntry.model ?? "cached",
          provider: currentEntry.provider ?? "cached",
          completedAt: currentEntry.completedAt ?? new Date().toISOString(),
          cached: true,
        };
      }

      // ── 3. Mark skill as "running" (immediate DB write) ──────────────────
      const startedAt = new Date().toISOString();
      const runningEntry: SkillStateEntry = { status: "running", startedAt };
      const runningState: WorkflowState = { ...currentState, [input.skillName as string]: runningEntry } as WorkflowState;

      await db
        .update(rfpSessions)
        .set({
          workflowState: runningState,
          sessionStatus: "in_progress",
        })
        .where(eq(rfpSessions.id, input.sessionId));

      // ── 4. Fire-and-forget: detach LLM work so the HTTP response returns
      //        immediately (avoids 180-300s gateway timeout on long skills).
      //        The frontend polls getById every 2s to detect completion.

      setImmediate(async () => {
        let llmOutput = "";
        let usedModel = "unknown";
        let usedProvider = "unknown";

        try {
        const variables = buildSkillVariables(input.skillName, session);
        const skillType = mapToSkillType(input.skillName) as Parameters<typeof invokeLLMWithSkill>[0]["skillType"];
        const responseFormat = getResponseFormat(input.skillName);
        const systemOverride = getSystemOverride(input.skillName);

        // For rfp_parser: run XML Shredder on all uploaded files first,
        // then pass the combined structured XML as text to the rfp_parser LLM.
        // This ensures ALL files are read (not just 3) and avoids upstream size limits.
        let extraUserContent: Array<{ type: "text"; text: string }> | undefined;
        if (input.skillName === "rfp_parser") {
          const allFiles = (session.uploadedFiles ?? []) as Array<{ name: string; url: string; mimeType: string }>;

          if (allFiles.length > 0) {
            // Classify each file by its likely role based on filename.
            // If the user set a label in the manifest, use it for tier lookup.
            const classifyFile = (
              name: string,
              index: number,
              userLabel?: string,
            ): { type: string; label: string; tier: ExtractionTier } => {
              const lower = name.toLowerCase();

              // Determine the display label (prefer user choice, fall back to filename heuristic)
              let displayLabel: string;
              if (userLabel) {
                displayLabel = userLabel;
              } else if (/rfp|solicitation|request.for.(proposal|qualification)/i.test(lower)) {
                displayLabel = "Main RFP";
              } else if (/scope|sow|scope.of.work/i.test(lower)) {
                displayLabel = "Scope of Work";
              } else if (/addendum|amendment/i.test(lower)) {
                displayLabel = "Addendum";
              } else if (/appendix/i.test(lower)) {
                displayLabel = "Appendix";
              } else if (/form|data.form/i.test(lower)) {
                displayLabel = "Forms";
              } else if (/insurance|certificate/i.test(lower)) {
                displayLabel = "Certificate";
              } else if (/fee|cost|price/i.test(lower) && /\.xlsx?$/i.test(lower)) {
                displayLabel = "Fee Schedule";
              } else if (/ref|standard|guide/i.test(lower)) {
                displayLabel = "Reference Doc";
              } else if (index === 0) {
                displayLabel = "Main RFP";
              } else {
                displayLabel = "Other";
              }

              // Map display label to internal docType
              const labelToType: Record<string, string> = {
                "Main RFP":      "main_rfp",
                "Scope of Work": "scope",
                "Addendum":      "addendum",
                "Appendix":      "appendix",
                "Forms":         "form",
                "Certificate":   "certificate",
                "Fee Schedule":  "fee_schedule",
                "Reference Doc": "reference",
                "Other":         "supplemental",
              };
              const type = labelToType[displayLabel] ?? "supplemental";

              // Look up extraction tier from shared map
              const tier: ExtractionTier =
                LABEL_TIER_MAP[displayLabel as RfpFileLabel] ?? "metadata_only";

              return { type, label: displayLabel, tier };
            }

            // Helper: write a sub-step message into workflowState so the UI can poll it
            const writeSubStep = async (msg: string) => {
              try {
                const freshDb = await getDb();
                if (!freshDb) return;
                const latestRows = await freshDb.select().from(rfpSessions).where(eq(rfpSessions.id, input.sessionId)).limit(1);
                const latestState = ((latestRows[0]?.workflowState ?? {}) as WorkflowState);
                const updatedEntry: SkillStateEntry = { ...latestState.rfp_parser, status: "running", subStepMessage: msg } as SkillStateEntry;
                await freshDb.update(rfpSessions).set({ workflowState: { ...latestState, rfp_parser: updatedEntry } as WorkflowState }).where(eq(rfpSessions.id, input.sessionId));
              } catch { /* non-fatal */ }
            };

            // Shred each file sequentially with a 1.5s delay to avoid rate limits
            const documentFragments: string[] = [];
            let fullExtractCount = 0;
            let metadataOnlyCount = 0;
            let sheetjsCount = 0;

            for (let i = 0; i < allFiles.length; i++) {
              if (i > 0) await new Promise((r) => setTimeout(r, 1500));
              const fileEntry = allFiles[i] as { name: string; url: string; mimeType: string; label?: string };
              const { type: docType, label, tier } = classifyFile(fileEntry.name, i, fileEntry.label);

              if (tier === "sheetjs") {
                // Fee Schedule XLSX: SheetJS parse only, no LLM
                sheetjsCount++;
                await writeSubStep(`Parsing fee schedule ${i + 1}/${allFiles.length}: ${fileEntry.name} (SheetJS)`);
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="sheetjs" processing="skipped-sheetjs-parse-only">\n    <metadata>\n      <title>${escapeXml(fileEntry.name.replace(/\.[^.]+$/, ""))}</title>\n      <note>Fee schedule XLSX - SheetJS parse only, not submitted to LLM. Review manually.</note>\n    </metadata>\n  </document>`
                );
              } else if (tier === "metadata_only") {
                // Appendix, Forms, Certs, Reference Docs: metadata only, skip LLM
                metadataOnlyCount++;
                await writeSubStep(`Cataloguing ${i + 1}/${allFiles.length}: ${fileEntry.name} (metadata only)`);
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="metadata_only" processing="skipped-metadata-only">\n    <metadata>\n      <title>${escapeXml(fileEntry.name.replace(/\.[^.]+$/, ""))}</title>\n      <url>${escapeXml(fileEntry.url)}</url>\n      <note>Catalogued without LLM extraction. File stored and available for reference.</note>\n    </metadata>\n  </document>`
                );
              } else {
                // Full extract: Main RFP, Scope of Work, Addendum
                fullExtractCount++;
                await writeSubStep(`Shredding file ${i + 1}/${allFiles.length}: ${fileEntry.name} (full extract)`);
                try {
                  const fragment = await shredSingleFile({
                    fileName: fileEntry.name,
                    fileUrl: fileEntry.url,
                    mimeType: fileEntry.mimeType,
                    fileRole: docType === "main_rfp" ? "primary" : "attachment",
                    asFragment: true,
                  });
                  documentFragments.push(
                    `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="full_extract">\n${fragment}\n  </document>`
                  );
                } catch (err: any) {
                  documentFragments.push(
                    `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="full_extract" status="error">\n    <error>${escapeXml(err.message ?? "Unknown error")}</error>\n  </document>`
                  );
                }
              }
            }

            console.log(`[rfp_parser] tier summary: ${fullExtractCount} full-extract, ${metadataOnlyCount} metadata-only, ${sheetjsCount} sheetjs (of ${allFiles.length} total)`);

            // Combine into a single <rfp_package> XML document
            const combinedXml = [
              `<?xml version="1.0" encoding="UTF-8"?>`,
              `<rfp_package files="${allFiles.length}" compiled="${new Date().toISOString()}">`,
              ...documentFragments,
              `</rfp_package>`,
            ].join("\n");

            await writeSubStep(`All ${allFiles.length} files shredded — running AI parser...`);

            // Pass the combined XML as text content to the rfp_parser
            extraUserContent = [{
              type: "text" as const,
              text: `\n\n--- FULL RFP PACKAGE (XML-STRUCTURED EXTRACTION) ---\n\n${combinedXml}`,
            }];

            // Also update the rfpText variable to reference the shredded content
            variables.rfpText = `The full RFP package has been shredded into structured XML and is provided below. Extract all details from the XML content.`;
          } else if (session.rfpFileUrl) {
            // Fallback: single file — attach as file_url
            extraUserContent = [{ type: "text" as const, text: "" }] as any;
            // Actually use file_url for single file
            (extraUserContent as any) = [{ type: "file_url", file_url: { url: session.rfpFileUrl, mime_type: (session.rfpMimeType ?? "application/pdf") as any } }];
          }
        }

        const result = await invokeLLMWithSkill({
          skillType,
          variables,
          ...(responseFormat ? { responseFormat } : {}),
          ...(systemOverride ? { systemOverride } : {}),
          ...(extraUserContent && extraUserContent.length > 0 ? { extraUserContent } : {}),
        });

        llmOutput = result.choices[0]?.message?.content ?? "";
        usedModel = result._model;
        usedProvider = result._provider;
      } catch (llmError) {
        // ── LLM failed inside setImmediate: write error state to DB (no throw —
        //    throwing here would cause an unhandled promise rejection).
        const errorMessage =
          llmError instanceof Error ? llmError.message : String(llmError);

        console.error(`[executeSkill] skill "${input.skillName}" failed:`, errorMessage);

        const errorEntry: SkillStateEntry = { status: "error", startedAt, errorMessage };
        const errorState: WorkflowState = { ...runningState, [input.skillName as string]: errorEntry } as WorkflowState;

        try {
          await db
            .update(rfpSessions)
            .set({
              workflowState: errorState,
              sessionStatus: "error",
            })
            .where(eq(rfpSessions.id, input.sessionId));
        } catch (dbErr) {
          console.error(`[executeSkill] failed to write error state to DB:`, dbErr);
        }
        return; // exit setImmediate callback cleanly
      }

      // ── 5. Save output + mark complete (single DB write) ─────────────────
      const completedAt = new Date().toISOString();

      // Re-read current session state to avoid overwriting concurrent changes
      const freshRows = await db
        .select()
        .from(rfpSessions)
        .where(eq(rfpSessions.id, input.sessionId))
        .limit(1);
      const freshSession = freshRows[0] ?? session;

      const updatedOutputs: SkillOutputs = {
        ...((freshSession.skillOutputs ?? {}) as SkillOutputs),
        [input.skillName as string]: llmOutput,
      } as SkillOutputs;

      const completedEntry: SkillStateEntry = { status: "complete", startedAt, completedAt, model: usedModel, provider: usedProvider };
      const completedState: WorkflowState = {
        ...((freshSession.workflowState ?? {}) as WorkflowState),
        [input.skillName as string]: completedEntry,
      } as WorkflowState;

      // Check if all skills are now complete
      const allComplete = ([
        "rfp_parser", "win_themes", "technical_outline", "technical_writer",
        "key_personnel", "past_performance", "fee_estimator", "proposal_scorer",
      ] as WorkflowSkillName[]).every(
        (name) => (completedState as WorkflowState)[name]?.status === "complete"
      );

      // For rfp_parser: also save extractedData for structured access
      const extractedDataPatch =
        input.skillName === "rfp_parser"
          ? (() => {
              try {
                return JSON.parse(llmOutput) as ParsedRfpData;
              } catch {
                return undefined;
              }
            })()
          : undefined;

      // For proposal_scorer: also save liveScore
      const scorerPatch =
        input.skillName === "proposal_scorer"
          ? (() => {
              try {
                const parsed = JSON.parse(llmOutput);
                return {
                  liveScore: typeof parsed.overallScore === "number" ? parsed.overallScore : null,
                  liveScoreDetails: parsed,
                };
              } catch {
                return undefined;
              }
            })()
          : undefined;

      await db
        .update(rfpSessions)
        .set({
          skillOutputs: updatedOutputs,
          workflowState: completedState,
          sessionStatus: allComplete ? "complete" : "in_progress",
          ...(extractedDataPatch ? { extractedData: extractedDataPatch } : {}),
          ...(scorerPatch ?? {}),
        })
        .where(eq(rfpSessions.id, input.sessionId));

        console.log(`[executeSkill] background job complete: ${input.skillName} session=${input.sessionId}`);
      }); // end setImmediate

      // ── 6. Return immediately — frontend polls getById for completion ──────
      return {
        success: true,
        skillName: input.skillName,
        output: "",
        model: "pending",
        provider: "pending",
        completedAt: new Date().toISOString(),
        cached: false,
        running: true,
      };
    }),
});
