/**
 * RFP Conflict Detector
 *
 * Scans the structured index of an RFP package for contradictions:
 * - Date discrepancies (due dates, pre-bid meeting times)
 * - Value contradictions (contract value, fee schedule totals)
 * - Scope conflicts (requirements that contradict each other)
 * - Submission format conflicts (page limits, format requirements)
 * - Evaluation weight conflicts (weights that don't sum to 100%)
 * - Addendum supersession issues (conflicting addenda)
 * - Broken references (references to exhibits/sections that don't exist)
 * - Eligibility conflicts (contradictory qualification requirements)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  rfpConflicts,
  rfpStructuredIndex,
  documentShreds,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConflictingFact {
  value: string;
  source: string;
  xmlPath: string;
  fileRole?: string;
}

export interface DetectedConflict {
  conflictType: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  conflictingFacts: ConflictingFact[];
  recommendation: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const rfpConflictsRouter = router({

  /** List all conflicts for a shred */
  list: protectedProcedure
    .input(z.object({
      shredId: z.number().optional(),
      pursuitId: z.number().optional(),
      status: z.enum(["open", "resolved", "acknowledged", "all"]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(rfpConflicts)
        .where(
          input.shredId
            ? eq(rfpConflicts.shredId, input.shredId)
            : input.pursuitId
            ? eq(rfpConflicts.pursuitId, input.pursuitId)
            : undefined
        )
        .orderBy(desc(rfpConflicts.detectedAt));

      return rows.map(r => ({
        ...r,
        conflictingFacts: safeJson<ConflictingFact[]>(r.conflictingFacts),
      })).filter(r => input.status === "all" || r.status === input.status);
    }),

  /** Get conflict summary counts for a shred */
  summary: protectedProcedure
    .input(z.object({ shredId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { critical: 0, warning: 0, info: 0, total: 0 };
      const rows = await db
        .select()
        .from(rfpConflicts)
        .where(and(eq(rfpConflicts.shredId, input.shredId), eq(rfpConflicts.status, "open")));

      return {
        critical: rows.filter(r => r.severity === "critical").length,
        warning: rows.filter(r => r.severity === "warning").length,
        info: rows.filter(r => r.severity === "info").length,
        total: rows.length,
      };
    }),

  /**
   * Run conflict detection on a shred.
   *
   * Two-pass approach:
   * 1. Structural pass: compare structured index facts programmatically
   *    (e.g. find all submission deadlines and check if they differ)
   * 2. AI pass: send the raw XML to the LLM with a conflict-detection prompt
   *    to catch semantic contradictions the structural pass misses
   */
  detect: protectedProcedure
    .input(z.object({
      shredId: z.number(),
      pursuitId: z.number().optional(),
      /** Replace existing conflicts for this shred */
      replace: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Load shred
      const shredRows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.id, input.shredId))
        .limit(1);
      const shred = shredRows[0];
      if (!shred?.xmlContent) throw new Error("Shred not found or has no XML content");

      // Load structured index
      const indexRows = await db
        .select()
        .from(rfpStructuredIndex)
        .where(eq(rfpStructuredIndex.shredId, input.shredId))
        .limit(1);
      const index = indexRows[0];

      // ── Pass 1: Structural conflict detection ──────────────────────────────
      const structuralConflicts: DetectedConflict[] = [];

      if (index) {
        const deadlines = safeJson<Array<{value: string; source: string; xmlPath: string; fileRole?: string}>>(index.submissionDeadlines);
        const pageLimits = safeJson<Array<{value: string; source: string; xmlPath: string}>>(index.pageLimits);
        const contractValues = safeJson<Array<{value: string; source: string; xmlPath: string}>>(index.contractValues);
        const evalCriteria = safeJson<Array<{criterion: string; weight?: string; source: string; xmlPath: string}>>(index.evaluationCriteria);

        // Check for multiple different submission deadlines
        const uniqueDeadlines = new Set(deadlines.map(d => normalizeDate(d.value)));
        if (uniqueDeadlines.size > 1) {
          structuralConflicts.push({
            conflictType: "date_contradiction",
            severity: "critical",
            title: "Conflicting Submission Deadlines",
            description: `The RFP package contains ${deadlines.length} different submission deadline references with ${uniqueDeadlines.size} distinct values. This is a critical issue that could result in disqualification if the wrong date is used.`,
            conflictingFacts: deadlines,
            recommendation: `Contact the issuing agency immediately to request a written clarification. Use the most restrictive (earliest) deadline until clarified. Check if any addendum supersedes the original deadline.`,
          });
        }

        // Check for multiple different page limits
        const pageLimitGroups = groupBy(pageLimits, p => p.value);
        if (Object.keys(pageLimitGroups).length > 1) {
          structuralConflicts.push({
            conflictType: "submission_format_conflict",
            severity: "warning",
            title: "Conflicting Page Limits",
            description: `Multiple page limit requirements found: ${Object.keys(pageLimitGroups).join(", ")}. Sections may have different limits that contradict each other.`,
            conflictingFacts: pageLimits,
            recommendation: `Review each page limit in context. The most restrictive limit typically applies. Submit a clarification request if ambiguous.`,
          });
        }

        // Check for multiple different contract values
        const uniqueValues = new Set(contractValues.map(v => normalizeValue(v.value)));
        if (uniqueValues.size > 1) {
          structuralConflicts.push({
            conflictType: "value_contradiction",
            severity: "warning",
            title: "Conflicting Contract Values",
            description: `Multiple contract value references found: ${Array.from(uniqueValues).join(", ")}. These may represent different line items or a genuine contradiction.`,
            conflictingFacts: contractValues,
            recommendation: `Verify whether the values represent different contract components (base + options) or a genuine contradiction. Request clarification if the total is ambiguous.`,
          });
        }

        // Check evaluation criteria weights sum to ~100%
        const weightsWithNumbers = evalCriteria
          .map(c => ({ ...c, numWeight: parseFloat((c.weight ?? "0").replace(/[^0-9.]/g, "")) }))
          .filter(c => c.numWeight > 0);
        if (weightsWithNumbers.length > 0) {
          const totalWeight = weightsWithNumbers.reduce((sum, c) => sum + c.numWeight, 0);
          if (Math.abs(totalWeight - 100) > 2) {
            structuralConflicts.push({
              conflictType: "evaluation_weight_conflict",
              severity: "warning",
              title: `Evaluation Weights Sum to ${totalWeight.toFixed(1)}% (not 100%)`,
              description: `The extracted evaluation criteria weights sum to ${totalWeight.toFixed(1)}%, not 100%. This may indicate missing criteria, a typo, or an addendum that changed weights without updating all references.`,
              conflictingFacts: weightsWithNumbers.map(c => ({ value: `${c.criterion}: ${c.weight}`, source: c.source, xmlPath: c.xmlPath })),
              recommendation: `Review all evaluation criteria sections and addenda. Request a clarification if the weights are genuinely inconsistent.`,
            });
          }
        }
      }

      // ── Pass 2: AI semantic conflict detection ─────────────────────────────
      const aiResult = await invokeLLMWithSkill({
        skillType: "wiki_compiler",
        variables: {
          fileName: shred.fileName,
          xmlContent: shred.xmlContent.slice(0, 80000),
          firmContext: "Detect all contradictions, conflicts, and inconsistencies in this RFP package.",
        },
        systemOverride: `You are an expert RFP analyst specializing in conflict detection. Analyze the provided RFP XML document for contradictions, inconsistencies, and conflicts.

Look for ALL of the following:
1. DATE CONTRADICTIONS: Any dates that appear in multiple places with different values (due dates, pre-bid meetings, Q&A deadlines, award dates)
2. VALUE CONTRADICTIONS: Contract values, fee amounts, or budget figures that conflict
3. SCOPE CONTRADICTIONS: Requirements that contradict each other (e.g., "must have PE license" in one section, "PE not required" in another)
4. SUBMISSION FORMAT CONFLICTS: Page limits, font sizes, margin requirements, or format specs that differ between sections
5. EVALUATION WEIGHT CONFLICTS: Scoring criteria weights that don't add up or differ between sections
6. ADDENDUM SUPERSESSION: Addenda that conflict with each other or with the original RFP
7. BROKEN REFERENCES: References to exhibits, sections, or attachments that don't exist in the package
8. ELIGIBILITY CONFLICTS: Contradictory qualification requirements

For each conflict found, return a JSON object. Return an empty array if no conflicts are found.

Return ONLY a JSON array with this structure:
[
  {
    "conflictType": "date_contradiction|value_contradiction|scope_contradiction|submission_format_conflict|evaluation_weight_conflict|addendum_supersession|reference_conflict|eligibility_conflict",
    "severity": "critical|warning|info",
    "title": "Short title of the conflict",
    "description": "Detailed description of the conflict",
    "conflictingFacts": [
      {"value": "exact text from source 1", "source": "filename, section, page", "xmlPath": "xml path", "fileRole": "primary|addendum|exhibit"},
      {"value": "exact text from source 2", "source": "filename, section, page", "xmlPath": "xml path", "fileRole": "primary|addendum|exhibit"}
    ],
    "recommendation": "Specific recommended action"
  }
]`,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "rfp_conflicts",
            strict: false,
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  conflictType: { type: "string" },
                  severity: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  conflictingFacts: { type: "array", items: { type: "object" } },
                  recommendation: { type: "string" },
                },
                required: ["conflictType", "severity", "title", "description", "conflictingFacts", "recommendation"],
              },
            },
          },
        },
      });

      const raw = (aiResult.choices[0]?.message?.content as string) ?? "[]";
      let aiConflicts: DetectedConflict[] = [];
      try { aiConflicts = JSON.parse(raw); } catch { aiConflicts = []; }
      if (!Array.isArray(aiConflicts)) aiConflicts = [];

      // Merge structural + AI conflicts (deduplicate by title)
      const allConflicts = [...structuralConflicts];
      for (const ac of aiConflicts) {
        const isDuplicate = structuralConflicts.some(sc =>
          sc.conflictType === ac.conflictType &&
          sc.title.toLowerCase().includes(ac.title.toLowerCase().slice(0, 20))
        );
        if (!isDuplicate) allConflicts.push(ac);
      }

      // Replace existing conflicts for this shred if requested
      if (input.replace) {
        await db.delete(rfpConflicts).where(eq(rfpConflicts.shredId, input.shredId));
      }

      // Insert all detected conflicts
      if (allConflicts.length > 0) {
        await db.insert(rfpConflicts).values(
          allConflicts.map(c => ({
            shredId: input.shredId,
            pursuitId: input.pursuitId,
            conflictType: c.conflictType,
            severity: c.severity,
            title: c.title,
            description: c.description,
            conflictingFacts: JSON.stringify(c.conflictingFacts),
            recommendation: c.recommendation,
            status: "open",
            provider: aiResult._provider,
            model: aiResult._model,
            createdBy: ctx.user.id,
          }))
        );
      }

      return {
        success: true,
        conflictsFound: allConflicts.length,
        structuralConflicts: structuralConflicts.length,
        aiConflicts: aiConflicts.length,
        conflicts: allConflicts,
        _provider: aiResult._provider,
        _model: aiResult._model,
      };
    }),

  /** Resolve or acknowledge a conflict */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "resolved", "acknowledged"]),
      resolvedNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(rfpConflicts).set({
        status: input.status,
        resolvedNote: input.resolvedNote,
        resolvedAt: input.status === "resolved" ? new Date() : undefined,
        resolvedBy: ctx.user.id,
      }).where(eq(rfpConflicts.id, input.id));
      return { success: true };
    }),

  /** Delete a conflict */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(rfpConflicts).where(eq(rfpConflicts.id, input.id));
      return { success: true };
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJson<T>(raw: string | null | undefined): T {
  if (!raw) return [] as unknown as T;
  try { return JSON.parse(raw) as T; } catch { return [] as unknown as T; }
}

function normalizeDate(s: string): string {
  // Strip time zones and normalize common date formats for comparison
  return s.toLowerCase().replace(/\s+/g, " ").replace(/,/g, "").trim();
}

function normalizeValue(s: string): string {
  // Strip $ and commas for numeric comparison
  return s.replace(/[$,\s]/g, "").trim();
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
