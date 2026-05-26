/**
 * XML Document Shredder — Karpathy Pattern 1
 *
 * Compiles uploaded documents (RFPs, contracts, specs) into a structured XML
 * document with semantic tags. This gives the LLM a navigable, hierarchical
 * context instead of a flat text dump.
 *
 * Pipeline:
 *   Upload file → /api/upload → shred(fileUrl, fileKey) → xmlContent stored in DB
 *   → feed xmlContent to shredRfp / wiki.compile instead of raw text
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { documentShreds } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch the raw text content from a file URL.
 * For PDFs we rely on the LLM's file_url content type.
 * For plain text / markdown we fetch directly.
 */
async function fetchFileText(fileUrl: string, mimeType?: string): Promise<string | null> {
  try {
    if (mimeType?.includes("text") || fileUrl.endsWith(".txt") || fileUrl.endsWith(".md")) {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      return res.text();
    }
    // For PDFs and Word docs, return null — we'll pass the URL directly to the LLM
    return null;
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const xmlShredderRouter = router({
  /** List all document shreds, optionally filtered by proposalId or pursuitId */
  list: protectedProcedure
    .input(z.object({
      proposalId: z.number().optional(),
      pursuitId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(documentShreds)
        .orderBy(desc(documentShreds.createdAt))
        .limit(100);
      if (input?.proposalId) return rows.filter(r => r.proposalId === input.proposalId);
      if (input?.pursuitId) return rows.filter(r => r.pursuitId === input.pursuitId);
      return rows;
    }),

  /** Get a single shred by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  /**
   * Shred a document into structured XML.
   *
   * The LLM reads the document (via file_url for PDFs or raw text for .txt)
   * and produces a structured XML with semantic tags:
   *   <document>, <section>, <requirement>, <evaluation_criterion>,
   *   <key_date>, <key_personnel>, <scope_item>, <attachment>
   */
  shred: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileUrl: z.string(),
      fileKey: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      proposalId: z.number().optional(),
      pursuitId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Create a pending record first so the UI can show progress
      const [inserted] = await db.insert(documentShreds).values({
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        proposalId: input.proposalId,
        pursuitId: input.pursuitId,
        status: "processing",
        createdBy: ctx.user.id,
      });

      // Get the inserted ID
      const rows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.fileKey, input.fileKey))
        .orderBy(desc(documentShreds.createdAt))
        .limit(1);
      const shredId = rows[0]?.id;
      if (!shredId) throw new Error("Failed to create shred record");

      try {
        // Determine how to pass the document to the LLM
        const isPdf = input.mimeType?.includes("pdf") || input.fileName.toLowerCase().endsWith(".pdf");
        const isWord = input.fileName.toLowerCase().endsWith(".docx") || input.fileName.toLowerCase().endsWith(".doc");
        const rawText = await fetchFileText(input.fileUrl, input.mimeType);

        let result: Awaited<ReturnType<typeof invokeLLMWithSkill>>;

        if (isPdf || isWord) {
          // Pass the file URL directly — LLM reads the PDF natively
          result = await invokeLLMWithSkill({
            skillType: "xml_shredder",
            variables: {
              fileName: input.fileName,
              fileUrl: input.fileUrl,
              documentType: isPdf ? "PDF" : "Word document",
            },
            extraUserContent: [
              {
                type: "file_url",
                file_url: {
                  url: input.fileUrl,
                  mime_type: (input.mimeType as any) ?? "application/pdf",
                },
              },
            ],
          });
        } else {
          // Plain text — interpolate into the prompt
          result = await invokeLLMWithSkill({
            skillType: "xml_shredder",
            variables: {
              fileName: input.fileName,
              fileUrl: input.fileUrl,
              documentType: "text document",
              rawText: rawText?.slice(0, 50000) ?? "(could not read file)",
            },
          });
        }

        const xmlContent = (result.choices[0]?.message?.content as string) ?? "";

        // Extract metadata from the XML for quick access
        const sectionCount = (xmlContent.match(/<section/g) ?? []).length;
        const requirementCount = (xmlContent.match(/<requirement/g) ?? []).length;
        const criteriaCount = (xmlContent.match(/<evaluation_criterion/g) ?? []).length;
        const metadata = JSON.stringify({
          sectionCount,
          requirementCount,
          criteriaCount,
          provider: result._provider,
          model: result._model,
          processedAt: new Date().toISOString(),
        });

        await db
          .update(documentShreds)
          .set({ xmlContent, metadata, status: "complete" })
          .where(eq(documentShreds.id, shredId));

        return {
          id: shredId,
          xmlContent,
          metadata,
          sectionCount,
          requirementCount,
          criteriaCount,
          _provider: result._provider,
          _model: result._model,
        };
      } catch (err: any) {
        await db
          .update(documentShreds)
          .set({ status: "error", metadata: JSON.stringify({ error: err.message }) })
          .where(eq(documentShreds.id, shredId));
        throw err;
      }
    }),

  /** Delete a shred record */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(documentShreds).where(eq(documentShreds.id, input.id));
      return { success: true };
    }),
});
