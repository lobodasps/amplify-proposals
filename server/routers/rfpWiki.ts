/**
 * RFP Wiki — Hybrid Architecture (Lahoti-safe)
 *
 * Write time: LLM extracts STRUCTURED METADATA only — entities, facts, claims,
 * citations — all tagged with exact XML source paths. No prose is stored as truth.
 *
 * Query time: LLM synthesizes prose answers FROM THE RAW XML, guided by the
 * structured index as a navigation aid. Every answer cites the exact source.
 *
 * This preserves chain of custody indefinitely. The structured index is a
 * librarian's index card, not a book. The raw XML is always the source of truth.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  rfpWikis,
  rfpStructuredIndex,
  documentShreds,
} from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitedFact {
  value: string;
  source: string;   // e.g. "RFP-001-Main.pdf, Section 4.2, p.45"
  xmlPath: string;  // e.g. "/rfp-package/file[@name='RFP-001-Main.pdf']/section[@type='submission']"
  fileRole?: string; // primary | addendum | exhibit | form | attachment
}

export interface EvalCriterion extends CitedFact {
  weight?: string;
  criterion: string;
}

export interface KeyPersonnelEntry extends CitedFact {
  role: string;
  qualifications: string;
}

export interface SectionMapEntry {
  section: string;
  description: string;
  xmlPath: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const rfpWikiRouter = router({

  /** Get the structured index for a shred */
  getIndex: protectedProcedure
    .input(z.object({ shredId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(rfpStructuredIndex)
        .where(eq(rfpStructuredIndex.shredId, input.shredId))
        .orderBy(desc(rfpStructuredIndex.extractedAt))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      // Parse all JSON columns
      return {
        ...row,
        submissionDeadlines: safeJson<CitedFact[]>(row.submissionDeadlines),
        contractValues: safeJson<CitedFact[]>(row.contractValues),
        evaluationCriteria: safeJson<EvalCriterion[]>(row.evaluationCriteria),
        eligibilityRequirements: safeJson<CitedFact[]>(row.eligibilityRequirements),
        submissionRequirements: safeJson<CitedFact[]>(row.submissionRequirements),
        keyPersonnel: safeJson<KeyPersonnelEntry[]>(row.keyPersonnel),
        keyDates: safeJson<CitedFact[]>(row.keyDates),
        pageLimits: safeJson<CitedFact[]>(row.pageLimits),
        references: safeJson<CitedFact[]>(row.references),
        scopeItems: safeJson<CitedFact[]>(row.scopeItems),
        sectionMap: safeJson<SectionMapEntry[]>(row.sectionMap),
      };
    }),

  /** List all structured indexes */
  listIndexes: protectedProcedure
    .input(z.object({ pursuitId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select().from(rfpStructuredIndex).orderBy(desc(rfpStructuredIndex.extractedAt)).limit(50);
      return q;
    }),

  /** Get the legacy wiki content (kept for backward compat) */
  getByShredId: protectedProcedure
    .input(z.object({ shredId: z.string().uuid() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(rfpWikis)
        .where(eq(rfpWikis.shredId, input.shredId))
        .orderBy(desc(rfpWikis.compiledAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** List all wikis */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(rfpWikis).orderBy(desc(rfpWikis.compiledAt)).limit(50);
  }),

  /**
   * WRITE-TIME: Extract structured metadata from shredded XML.
   *
   * The LLM extracts facts with exact source citations — never prose summaries.
   * Each fact is tagged with the XML path it came from so it can always be
   * traced back to the original document.
   *
   * This replaces the old "compile wiki" approach with a safer index-card model.
   */
  extractIndex: protectedProcedure
    .input(z.object({
      shredId: z.string().uuid(),
      pursuitId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const shredRows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.id, input.shredId))
        .limit(1);
      const shred = shredRows[0];
      if (!shred) throw new Error(`Shred ${input.shredId} not found`);
      if (!shred.xmlContent) throw new Error("Shred has no XML content — run shred first");

      const result = await invokeLLMWithSkill({
        skillType: "wiki_compiler",
        variables: {
          fileName: shred.fileName,
          xmlContent: shred.xmlContent.slice(0, 80000),
          firmContext: "Extract structured facts only. Do not write prose summaries.",
        },
        systemOverride: `You are a precise document indexer. Your job is to extract structured facts from an RFP XML document.

CRITICAL RULES:
1. Extract FACTS with CITATIONS — never write prose summaries
2. Every fact must include: value (exact text from source), source (file name + section + page), xmlPath (XML path to the element)
3. If a fact appears in multiple places, list ALL occurrences — this enables conflict detection
4. For dates: extract the EXACT date string as written in the source, do not normalize
5. For values: extract the EXACT number/text as written, do not interpret
6. For requirements: quote the exact requirement text, do not paraphrase

Return a JSON object with these keys:
{
  "submissionDeadlines": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "contractValues": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "evaluationCriteria": [{"criterion": "...", "weight": "...", "value": "...", "source": "...", "xmlPath": "..."}],
  "eligibilityRequirements": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "submissionRequirements": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "keyPersonnel": [{"role": "...", "qualifications": "...", "value": "...", "source": "...", "xmlPath": "..."}],
  "keyDates": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "pageLimits": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "references": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "scopeItems": [{"value": "...", "source": "...", "xmlPath": "..."}],
  "sectionMap": [{"section": "...", "description": "...", "xmlPath": "..."}]
}`,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "rfp_structured_index",
            strict: false,
            schema: {
              type: "object",
              properties: {
                submissionDeadlines: { type: "array", items: { type: "object" } },
                contractValues: { type: "array", items: { type: "object" } },
                evaluationCriteria: { type: "array", items: { type: "object" } },
                eligibilityRequirements: { type: "array", items: { type: "object" } },
                submissionRequirements: { type: "array", items: { type: "object" } },
                keyPersonnel: { type: "array", items: { type: "object" } },
                keyDates: { type: "array", items: { type: "object" } },
                pageLimits: { type: "array", items: { type: "object" } },
                references: { type: "array", items: { type: "object" } },
                scopeItems: { type: "array", items: { type: "object" } },
                sectionMap: { type: "array", items: { type: "object" } },
              },
              additionalProperties: false,
            },
          },
        },
      });

      const raw = (result.choices[0]?.message?.content as string) ?? "{}";
      let parsed: Record<string, unknown[]> = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      // Upsert the structured index
      const existing = await db
        .select()
        .from(rfpStructuredIndex)
        .where(eq(rfpStructuredIndex.shredId, input.shredId))
        .limit(1);

      const indexData = {
        shredId: input.shredId,
        pursuitId: input.pursuitId,
        submissionDeadlines: JSON.stringify(parsed.submissionDeadlines ?? []),
        contractValues: JSON.stringify(parsed.contractValues ?? []),
        evaluationCriteria: JSON.stringify(parsed.evaluationCriteria ?? []),
        eligibilityRequirements: JSON.stringify(parsed.eligibilityRequirements ?? []),
        submissionRequirements: JSON.stringify(parsed.submissionRequirements ?? []),
        keyPersonnel: JSON.stringify(parsed.keyPersonnel ?? []),
        keyDates: JSON.stringify(parsed.keyDates ?? []),
        pageLimits: JSON.stringify(parsed.pageLimits ?? []),
        references: JSON.stringify(parsed.references ?? []),
        scopeItems: JSON.stringify(parsed.scopeItems ?? []),
        sectionMap: JSON.stringify(parsed.sectionMap ?? []),
        provider: result._provider,
        model: result._model,
        createdBy: ctx.user.id,
      };

      if (existing.length > 0) {
        await db.update(rfpStructuredIndex).set(indexData).where(eq(rfpStructuredIndex.shredId, input.shredId));
      } else {
        await db.insert(rfpStructuredIndex).values(indexData);
      }

      return {
        success: true,
        index: parsed,
        _provider: result._provider,
        _model: result._model,
      };
    }),

  /**
   * QUERY-TIME: Synthesize a prose answer from the raw XML.
   *
   * The structured index guides which parts of the XML are relevant.
   * The LLM reads the original XML and generates a fresh answer with citations.
   * Nothing is stored — every call synthesizes from the source.
   */
  query: protectedProcedure
    .input(z.object({
      shredId: z.string().uuid(),
      question: z.string().min(3).max(1000),
      /** Optional: focus the answer on specific fact types */
      focusAreas: z.array(z.enum([
        "submission_deadlines", "contract_values", "evaluation_criteria",
        "eligibility", "submission_requirements", "key_personnel",
        "key_dates", "page_limits", "scope", "section_guide",
      ])).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Load the raw XML (source of truth)
      const shredRows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.id, input.shredId))
        .limit(1);
      const shred = shredRows[0];
      if (!shred?.xmlContent) throw new Error("Shred not found or has no XML content");

      // Load the structured index as a navigation guide
      const indexRows = await db
        .select()
        .from(rfpStructuredIndex)
        .where(eq(rfpStructuredIndex.shredId, input.shredId))
        .limit(1);
      const index = indexRows[0];

      // Build navigation context from the index (not prose — just pointers)
      let navContext = "";
      if (index) {
        const keyDates = safeJson<CitedFact[]>(index.keyDates);
        const deadlines = safeJson<CitedFact[]>(index.submissionDeadlines);
        const criteria = safeJson<EvalCriterion[]>(index.evaluationCriteria);
        const sectionMap = safeJson<SectionMapEntry[]>(index.sectionMap);

        navContext = `
INDEX NAVIGATION (use these pointers to find relevant XML sections):
Key Dates: ${keyDates.map(d => `${d.value} (${d.source})`).join("; ")}
Deadlines: ${deadlines.map(d => `${d.value} (${d.source})`).join("; ")}
Evaluation Criteria: ${criteria.map(c => `${c.criterion} ${c.weight ?? ""} (${c.source})`).join("; ")}
Sections: ${sectionMap.map(s => `${s.section}: ${s.description}`).join("; ")}
`;
      }

      const result = await invokeLLMWithSkill({
        skillType: "wiki_compiler",
        variables: {
          fileName: shred.fileName,
          xmlContent: shred.xmlContent.slice(0, 80000),
          firmContext: navContext,
        },
        systemOverride: `You are an expert RFP analyst. Answer the user's question by reading the raw RFP XML document provided.

CRITICAL RULES:
1. Answer ONLY from the XML content — do not use prior knowledge or make assumptions
2. Every claim must be followed by a citation in the format [Source: filename, Section X, p.Y]
3. If the answer appears in multiple places with different values, report ALL of them — this may indicate a conflict
4. If the information is not in the document, say "Not found in the provided RFP package"
5. Quote exact text for dates, values, and requirements — do not paraphrase critical facts
6. If you detect a contradiction while answering, explicitly flag it: ⚠️ CONFLICT DETECTED: ...

${navContext}

Question: ${input.question}`,
      });

      const answer = (result.choices[0]?.message?.content as string) ?? "";

      return {
        answer,
        question: input.question,
        shredId: input.shredId,
        _provider: result._provider,
        _model: result._model,
      };
    }),

  /**
   * Legacy: compile a Markdown wiki (kept for backward compat).
   * Now marked as deprecated — use extractIndex + query instead.
   */
  compile: protectedProcedure
    .input(z.object({
      shredId: z.string().uuid(),
      proposalId: z.string().uuid().optional(),
      firmContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const shredRows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.id, input.shredId))
        .limit(1);
      const shred = shredRows[0];
      if (!shred) throw new Error(`Shred ${input.shredId} not found`);
      if (!shred.xmlContent) throw new Error("Shred has no XML content");

      const result = await invokeLLMWithSkill({
        skillType: "wiki_compiler",
        variables: {
          fileName: shred.fileName,
          xmlContent: shred.xmlContent.slice(0, 60000),
          firmContext: input.firmContext ?? "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY.",
        },
        systemOverride: `IMPORTANT: This wiki is a NAVIGATION GUIDE only, not a source of truth.
Every section must cite exact XML sources. Do not paraphrase dates, values, or requirements — quote them exactly.
Mark any detected contradictions with ⚠️ CONFLICT: prefix.`,
      });

      const wikiContent = (result.choices[0]?.message?.content as string) ?? "";
      const tokenEstimate = Math.round(wikiContent.length / 4);

      const existing = await db.select().from(rfpWikis).where(eq(rfpWikis.shredId, input.shredId)).limit(1);

      let wikiId: string;
      if (existing.length > 0) {
        await db.update(rfpWikis).set({ wikiContent, tokenEstimate, compiledAt: new Date(), proposalId: input.proposalId }).where(eq(rfpWikis.shredId, input.shredId));
        wikiId = existing[0].id;
      } else {
        await db.insert(rfpWikis).values({ shredId: input.shredId, proposalId: input.proposalId, wikiContent, tokenEstimate, createdBy: ctx.user.id });
        const newRows = await db.select().from(rfpWikis).where(eq(rfpWikis.shredId, input.shredId)).orderBy(desc(rfpWikis.compiledAt)).limit(1);
        wikiId = newRows[0]?.id ?? "";
      }

      return { id: wikiId, wikiContent, tokenEstimate, _provider: result._provider, _model: result._model };
    }),

  /** Delete a wiki */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(rfpWikis).where(eq(rfpWikis.id, input.id));
      return { success: true };
    }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJson<T>(raw: string | null | undefined): T {
  if (!raw) return [] as unknown as T;
  try { return JSON.parse(raw) as T; } catch { return [] as unknown as T; }
}
