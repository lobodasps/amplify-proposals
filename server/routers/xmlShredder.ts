/**
 * XML Document Shredder — Karpathy Pattern 1
 *
 * Compiles one or more uploaded RFP files into a single structured XML
 * <rfp-package> document with semantic tags. Supports:
 *   - PDF (text-based)  → pdf-parse
 *   - PDF (scanned)     → vision LLM
 *   - DOCX / DOC        → mammoth
 *   - XLSX / XLS / CSV  → xlsx → markdown tables
 *   - TXT               → raw text
 *   - XML               → embedded as-is (already structured)
 *   - Images            → vision LLM
 *
 * The compiled XML is stored in documentShreds and fed to:
 *   - rfpWiki.compile  (Pattern 2 — living wiki)
 *   - proposals.shredRfp  (requirements extraction)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { documentShreds } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";
import {
  extractFile,
  buildFileXmlFragment,
  detectFileType,
  SUPPORTED_EXTENSIONS,
  FILE_TYPE_LABELS,
} from "../rfpExtractor";

// ─── Router ───────────────────────────────────────────────────────────────────

export const xmlShredderRouter = router({
  /** List all document shreds, optionally filtered by proposalId or pursuitId */
  list: protectedProcedure
    .input(
      z
        .object({
          proposalId: z.number().optional(),
          pursuitId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(documentShreds)
        .orderBy(desc(documentShreds.createdAt))
        .limit(100);
      if (input?.proposalId) return rows.filter((r) => r.proposalId === input.proposalId);
      if (input?.pursuitId) return rows.filter((r) => r.pursuitId === input.pursuitId);
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
   * Shred a single document into structured XML.
   * Legacy single-file endpoint — still supported.
   */
  shred: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        fileKey: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        proposalId: z.number().optional(),
        pursuitId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Delegate to the multi-file shredder with a single file
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

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

      const rows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.fileKey, input.fileKey))
        .orderBy(desc(documentShreds.createdAt))
        .limit(1);
      const shredId = rows[0]?.id;
      if (!shredId) throw new Error("Failed to create shred record");

      try {
        const xmlContent = await shredSingleFile({
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType,
          fileRole: "primary",
        });

        const meta = extractMetadata(xmlContent);

        await db
          .update(documentShreds)
          .set({ xmlContent, metadata: JSON.stringify(meta), status: "complete" })
          .where(eq(documentShreds.id, shredId));

        return { id: shredId, xmlContent, ...meta };
      } catch (err: any) {
        await db
          .update(documentShreds)
          .set({ status: "error", metadata: JSON.stringify({ error: err.message }) })
          .where(eq(documentShreds.id, shredId));
        throw err;
      }
    }),

  /**
   * Shred a multi-file RFP package into a single structured XML document.
   *
   * Each file is extracted according to its type:
   *   - Text PDFs → pdf-parse
   *   - Scanned PDFs / Images → vision LLM
   *   - DOCX → mammoth
   *   - XLSX / CSV → markdown tables
   *   - TXT → raw text
   *   - XML → embedded as-is
   *
   * All files are compiled into one <rfp-package> XML document.
   */
  shredPackage: protectedProcedure
    .input(
      z.object({
        packageName: z.string(),
        pursuitId: z.number().optional(),
        proposalId: z.number().optional(),
        files: z.array(
          z.object({
            fileName: z.string(),
            fileUrl: z.string(),
            fileKey: z.string(),
            mimeType: z.string().optional(),
            fileSize: z.number().optional(),
            fileRole: z
              .enum(["primary", "addendum", "exhibit", "form", "attachment"])
              .default("attachment"),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Use the package name as the file name for the combined shred record
      const packageKey = `package-${Date.now()}-${input.packageName.replace(/\s+/g, "-")}`;

      const [inserted] = await db.insert(documentShreds).values({
        fileName: input.packageName,
        fileUrl: input.files[0]?.fileUrl ?? "",
        fileKey: packageKey,
        mimeType: "application/rfp-package",
        fileSize: input.files.reduce((sum, f) => sum + (f.fileSize ?? 0), 0),
        proposalId: input.proposalId,
        pursuitId: input.pursuitId,
        status: "processing",
        createdBy: ctx.user.id,
      });

      const rows = await db
        .select()
        .from(documentShreds)
        .where(eq(documentShreds.fileKey, packageKey))
        .orderBy(desc(documentShreds.createdAt))
        .limit(1);
      const shredId = rows[0]?.id;
      if (!shredId) throw new Error("Failed to create shred record");

      try {
        // Extract each file and build XML fragments
        const fileFragments: string[] = [];
        const fileResults: Array<{
          fileName: string;
          fileType: string;
          wordCount: number;
          extractionMethod: string;
        }> = [];

        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const fragment = await shredSingleFile({
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            mimeType: file.mimeType,
            fileRole: file.fileRole,
            asFragment: true,
          });
          fileFragments.push(fragment);

          const detectedType = detectFileType(file.fileName, file.mimeType);
          fileResults.push({
            fileName: file.fileName,
            fileType: FILE_TYPE_LABELS[detectedType] ?? detectedType,
            wordCount: fragment.split(/\s+/).length,
            extractionMethod: detectedType,
          });
        }

        // Wrap all fragments in a single <rfp-package> root
        const xmlContent = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rfp-package name="${escapeXml(input.packageName)}" files="${input.files.length}" compiled="${new Date().toISOString()}">`,
          ...fileFragments,
          `</rfp-package>`,
        ].join("\n");

        const meta = {
          ...extractMetadata(xmlContent),
          fileCount: input.files.length,
          files: fileResults,
          processedAt: new Date().toISOString(),
        };

        await db
          .update(documentShreds)
          .set({ xmlContent, metadata: JSON.stringify(meta), status: "complete" })
          .where(eq(documentShreds.id, shredId));

        return { id: shredId, xmlContent, ...meta };
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

  /** Return the list of supported file types for the UI */
  supportedTypes: protectedProcedure.query(() => {
    return {
      extensions: SUPPORTED_EXTENSIONS,
      labels: FILE_TYPE_LABELS,
      maxFileSizeMb: 16,
      maxFilesPerPackage: 20,
    };
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shred a single file — either returns a full XML document (for the legacy
 * shred endpoint) or just the <file> fragment (for shredPackage).
 */
async function shredSingleFile(params: {
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  fileRole: "primary" | "addendum" | "exhibit" | "form" | "attachment";
  asFragment?: boolean;
}): Promise<string> {
  const { fileName, fileUrl, mimeType, fileRole, asFragment = false } = params;
  const detectedType = detectFileType(fileName, mimeType);

  // For pre-existing XML, embed directly without LLM processing
  if (detectedType === "xml") {
    try {
      const res = await fetch(fileUrl);
      const rawXml = await res.text();
      const fragment = `  <file name="${escapeXml(fileName)}" type="${fileRole}" format="xml" extraction="preserved">\n    <embedded-xml><![CDATA[${rawXml}]]></embedded-xml>\n  </file>`;
      if (asFragment) return fragment;
      return `<?xml version="1.0" encoding="UTF-8"?>\n<rfp-package name="${escapeXml(fileName)}" compiled="${new Date().toISOString()}">\n${fragment}\n</rfp-package>`;
    } catch {
      // fall through to LLM
    }
  }

  // For text files, fetch content directly
  if (detectedType === "txt") {
    try {
      const res = await fetch(fileUrl);
      const text = await res.text();
      const fragment = `  <file name="${escapeXml(fileName)}" type="${fileRole}" format="txt" extraction="raw_text" words="${text.split(/\s+/).length}">\n    <content><![CDATA[${text.slice(0, 100000)}]]></content>\n  </file>`;
      if (asFragment) return fragment;
      // For TXT, still run through LLM shredder to get semantic XML
    } catch {
      // fall through
    }
  }

  // All other types: pass to LLM shredder skill
  const isPdf = detectedType === "pdf_text" || detectedType === "pdf_image";
  const isWord = detectedType === "docx";
  const isImage = detectedType === "image";
  const isSpreadsheet = detectedType === "xlsx" || detectedType === "csv";

  let result: Awaited<ReturnType<typeof invokeLLMWithSkill>>;

  if (isPdf || isWord) {
    // Pass file URL directly — LLM reads natively
    result = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      variables: {
        fileName,
        fileUrl,
        fileRole,
        documentType: isPdf ? "PDF document" : "Word document",
      },
      extraUserContent: [
        {
          type: "file_url",
          file_url: {
            url: fileUrl,
            mime_type: (mimeType as any) ?? "application/pdf",
          },
        },
      ],
    });
  } else if (isImage) {
    // Vision model for images
    result = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      variables: {
        fileName,
        fileUrl,
        fileRole,
        documentType: "image file",
      },
      extraUserContent: [
        {
          type: "image_url",
          image_url: { url: fileUrl },
        },
      ],
    });
  } else {
    // Fetch text content for TXT / XML / CSV / XLSX fallback
    let rawText = "";
    try {
      const res = await fetch(fileUrl);
      rawText = await res.text();
    } catch {
      rawText = "(could not fetch file content)";
    }

    result = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      variables: {
        fileName,
        fileUrl,
        fileRole,
        documentType: isSpreadsheet ? "spreadsheet/table data" : "text document",
        rawText: rawText.slice(0, 80000),
      },
    });
  }

  const xmlContent = (result.choices[0]?.message?.content as string) ?? "";

  if (asFragment) {
    // Wrap in a <file> tag if the LLM returned a full document
    const inner = xmlContent
      .replace(/^<\?xml[^>]*\?>\s*/i, "")
      .replace(/^<document[^>]*>\s*/i, "")
      .replace(/\s*<\/document>\s*$/i, "");
    return `  <file name="${escapeXml(fileName)}" type="${fileRole}" format="${detectedType}" extraction="llm_structured">\n${inner}\n  </file>`;
  }

  return xmlContent;
}

function extractMetadata(xmlContent: string) {
  return {
    sectionCount: (xmlContent.match(/<section/g) ?? []).length,
    requirementCount: (xmlContent.match(/<requirement/g) ?? []).length,
    criteriaCount: (xmlContent.match(/<evaluation_criterion/g) ?? []).length,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
