/**
 * RFP Wiki Compiler — Karpathy Pattern 2
 *
 * Takes shredded XML and synthesizes a living, cross-referenced Markdown wiki.
 * This replaces naive RAG chunking: instead of retrieving arbitrary 500-char
 * fragments, the LLM does one synthesis pass and produces an interlinked wiki
 * that captures relationships between sections, criteria, requirements, and dates.
 *
 * The wiki is then used as the primary context source for:
 *   - generateSection (proposal writing)
 *   - scoreProposal (compliance scoring)
 *   - tailorResume (key personnel matching)
 *
 * Knowledge compounds over time: the wiki is updated as addenda arrive or
 * lessons learned are added from past proposals.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { rfpWikis, documentShreds } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

export const rfpWikiRouter = router({
  /** Get the wiki for a specific shred */
  getByShredId: protectedProcedure
    .input(z.object({ shredId: z.number() }))
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

  /** Get the wiki for a specific proposal */
  getByProposalId: protectedProcedure
    .input(z.object({ proposalId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(rfpWikis)
        .where(eq(rfpWikis.proposalId, input.proposalId))
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
   * Compile a wiki from a shredded XML document.
   *
   * The LLM reads the XML and produces a structured Markdown wiki with:
   * - ## Overview: agency, project type, estimated value, submission deadline
   * - ## Evaluation Criteria: weighted criteria table with cross-refs to sections
   * - ## Key Requirements: numbered list with section references
   * - ## Key Personnel: required roles, qualifications, and page limits
   * - ## Key Dates: timeline table
   * - ## Section-by-Section Guide: what each section must address
   * - ## Compliance Checklist: all mandatory items
   * - ## Strategic Notes: win themes, differentiators, red flags
   */
  compile: protectedProcedure
    .input(z.object({
      shredId: z.number(),
      proposalId: z.number().optional(),
      /** Optional firm context to include in strategic notes */
      firmContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Load the shred
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
          xmlContent: shred.xmlContent.slice(0, 60000), // stay within context window
          firmContext: input.firmContext ?? "AEC firm specializing in Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, and Environmental services in NJ/NY.",
        },
      });

      const wikiContent = (result.choices[0]?.message?.content as string) ?? "";

      // Extract structured data from the wiki for quick access
      // Parse evaluation criteria section
      const criteriaMatch = wikiContent.match(/## Evaluation Criteria[\s\S]*?(?=##|$)/);
      const criteriaText = criteriaMatch?.[0] ?? "";

      // Parse key dates section
      const datesMatch = wikiContent.match(/## Key Dates[\s\S]*?(?=##|$)/);
      const datesText = datesMatch?.[0] ?? "";

      // Parse key personnel section
      const personnelMatch = wikiContent.match(/## Key Personnel[\s\S]*?(?=##|$)/);
      const personnelText = personnelMatch?.[0] ?? "";

      // Parse key requirements section
      const requirementsMatch = wikiContent.match(/## Key Requirements[\s\S]*?(?=##|$)/);
      const requirementsText = requirementsMatch?.[0] ?? "";

      // Estimate token count (rough: 1 token ≈ 4 chars)
      const tokenEstimate = Math.round(wikiContent.length / 4);

      // Check if a wiki already exists for this shred
      const existingRows = await db
        .select()
        .from(rfpWikis)
        .where(eq(rfpWikis.shredId, input.shredId))
        .limit(1);

      let wikiId: number;
      if (existingRows.length > 0) {
        await db
          .update(rfpWikis)
          .set({
            wikiContent,
            evaluationCriteria: criteriaText,
            keyRequirements: requirementsText,
            keyDates: datesText,
            keyPersonnel: personnelText,
            tokenEstimate,
            compiledAt: new Date(),
            proposalId: input.proposalId,
          })
          .where(eq(rfpWikis.shredId, input.shredId));
        wikiId = existingRows[0].id;
      } else {
        await db.insert(rfpWikis).values({
          shredId: input.shredId,
          proposalId: input.proposalId,
          wikiContent,
          evaluationCriteria: criteriaText,
          keyRequirements: requirementsText,
          keyDates: datesText,
          keyPersonnel: personnelText,
          tokenEstimate,
          createdBy: ctx.user.id,
        });
        const newRows = await db
          .select()
          .from(rfpWikis)
          .where(eq(rfpWikis.shredId, input.shredId))
          .orderBy(desc(rfpWikis.compiledAt))
          .limit(1);
        wikiId = newRows[0]?.id ?? 0;
      }

      return {
        id: wikiId,
        wikiContent,
        evaluationCriteria: criteriaText,
        keyRequirements: requirementsText,
        keyDates: datesText,
        keyPersonnel: personnelText,
        tokenEstimate,
        _provider: result._provider,
        _model: result._model,
      };
    }),

  /**
   * Append an addendum or lesson-learned to an existing wiki.
   * The LLM reads the existing wiki + new content and produces an updated wiki.
   */
  update: protectedProcedure
    .input(z.object({
      wikiId: z.number(),
      addendumText: z.string(),
      updateType: z.enum(["addendum", "lesson_learned", "clarification"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const rows = await db
        .select()
        .from(rfpWikis)
        .where(eq(rfpWikis.id, input.wikiId))
        .limit(1);
      const wiki = rows[0];
      if (!wiki) throw new Error(`Wiki ${input.wikiId} not found`);

      const result = await invokeLLMWithSkill({
        skillType: "wiki_compiler",
        variables: {
          fileName: "existing wiki",
          xmlContent: `<existing_wiki>\n${wiki.wikiContent}\n</existing_wiki>\n\n<update type="${input.updateType}">\n${input.addendumText}\n</update>`,
          firmContext: "Update the existing wiki to incorporate the new information. Preserve all existing sections and add/modify only what is affected by the update.",
        },
      });

      const updatedContent = (result.choices[0]?.message?.content as string) ?? wiki.wikiContent ?? "";

      await db
        .update(rfpWikis)
        .set({
          wikiContent: updatedContent,
          compiledAt: new Date(),
        })
        .where(eq(rfpWikis.id, input.wikiId));

      return { success: true, wikiContent: updatedContent };
    }),

  /** Delete a wiki */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(rfpWikis).where(eq(rfpWikis.id, input.id));
      return { success: true };
    }),
});
