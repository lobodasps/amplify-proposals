/**
 * rfpExtractor.ts
 *
 * Multi-format RFP file extractor. Handles:
 *   - PDF (text-based)  → pdf-parse
 *   - PDF (image/scan)  → vision LLM describes each page
 *   - DOCX / DOC        → mammoth → markdown
 *   - XLSX / CSV        → xlsx → markdown tables
 *   - TXT               → raw text
 *   - XML               → preserved as-is (already structured)
 *   - Images (PNG/JPG/WEBP/GIF) → vision LLM describes content
 *
 * Returns a structured XML fragment for each file that the xmlShredder
 * router compiles into a single <rfp-package> document.
 */

import * as fs from "fs";
import * as path from "path";
import { invokeLLMWithSkill } from "./_core/llmSkill";
import { getDb } from "./db";
import type { PdfScanClassification } from "../shared/types";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type FileType =
  | "pdf_text"
  | "pdf_image"
  | "docx"
  | "xlsx"
  | "csv"
  | "txt"
  | "xml"
  | "image";

export interface ExtractedFile {
  fileName: string;
  fileType: FileType;
  fileRole: "primary" | "addendum" | "exhibit" | "form" | "attachment";
  textContent: string;
  pageCount?: number;
  sheetCount?: number;
  wordCount: number;
  hasImages: boolean;
  extractionMethod: string;
}

// ─── MIME / Extension Detection ───────────────────────────────────────────────

export function detectFileType(fileName: string, mimeType?: string): FileType {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "pdf_text"; // will be re-checked after extraction
  if (ext === ".docx" || ext === ".doc") return "docx";
  if (ext === ".xlsx" || ext === ".xls") return "xlsx";
  if (ext === ".csv") return "csv";
  if (ext === ".txt") return "txt";
  if (ext === ".xml") return "xml";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff"].includes(ext)) return "image";
  // Fallback to MIME
  if (mimeType?.includes("pdf")) return "pdf_text";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "docx";
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return "xlsx";
  if (mimeType?.includes("csv")) return "csv";
  if (mimeType?.includes("text/plain")) return "txt";
  if (mimeType?.includes("xml")) return "xml";
  if (mimeType?.startsWith("image/")) return "image";
  return "txt";
}

// ─── PDF Extraction ───────────────────────────────────────────────────────────

/**
 * Classify a PDF as text, scanned, or mixed using per-page analysis.
 *
 * Strategy:
 *   1. pdf-parse returns the full text and numpages.
 *   2. We split the text into per-page buckets using the \f (form-feed) separator
 *      that pdf-parse inserts between pages.
 *   3. A page is "image-only" if it has fewer than 50 characters after trimming.
 *   4. Classification:
 *      - scanned : ≥ 60% of pages are image-only
 *      - mixed   : 20–59% of pages are image-only
 *      - text    : < 20% of pages are image-only
 *
 * Returns the full extracted text alongside the classification so the caller
 * can decide whether to run vision LLM on all pages, some pages, or none.
 */
async function extractPdf(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
  scanClassification: PdfScanClassification;
  imagePageCount: number;
}> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? "";
    const pageCount = result.numpages ?? 0;

    // Per-page analysis: pdf-parse uses \f (form-feed, char code 12) as page separator
    const pages = text.split("\f");
    const imagePageCount = pages.filter((p: string) => p.trim().length < 50).length;
    const imageFraction = pageCount > 0 ? imagePageCount / pageCount : 1;

    let scanClassification: PdfScanClassification;
    if (imageFraction >= 0.6) {
      scanClassification = "scanned";
    } else if (imageFraction >= 0.2) {
      scanClassification = "mixed";
    } else {
      scanClassification = "text";
    }

    return { text, pageCount, scanClassification, imagePageCount };
  } catch {
    return { text: "", pageCount: 0, scanClassification: "scanned", imagePageCount: 0 };
  }
}

// ─── Vision LLM for Image/Scanned PDFs ───────────────────────────────────────

async function describeWithVision(
  fileUrl: string,
  fileName: string,
  context: string
): Promise<string> {
  try {
    const response = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: fileUrl },
            },
            {
              type: "text",
              text: `You are analyzing a page from an RFP document file named "${fileName}". ${context}

Describe all visible content in detail:
- Any text visible (transcribe it exactly)
- Tables: reproduce as markdown tables
- Diagrams, maps, site plans: describe what they show
- Forms: list all fields and any pre-filled values
- Charts/graphs: describe data shown
- Photos: describe what is depicted

Be thorough — this description will be used to compile an RFP requirements wiki.`,
            },
          ],
        },
      ],
    });
    return response.choices?.[0]?.message?.content ?? "";
  } catch {
    return `[Vision extraction failed for ${fileName}]`;
  }
}

// ─── DOCX Extraction ──────────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() ?? "";
  } catch {
    return "[DOCX extraction failed]";
  }
}

// ─── XLSX / CSV Extraction ────────────────────────────────────────────────────

async function extractXlsx(buffer: Buffer, isCSV = false): Promise<{ markdown: string; sheetCount: number }> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
      if (rows.length === 0) continue;

      const mdRows = rows.map((row) =>
        "| " + row.map((cell) => String(cell ?? "").replace(/\|/g, "\\|")).join(" | ") + " |"
      );
      const separator = "| " + rows[0].map(() => "---").join(" | ") + " |";
      const table = [mdRows[0], separator, ...mdRows.slice(1)].join("\n");
      sheets.push(`### Sheet: ${sheetName}\n\n${table}`);
    }

    return {
      markdown: sheets.join("\n\n"),
      sheetCount: workbook.SheetNames.length,
    };
  } catch {
    return { markdown: "[Spreadsheet extraction failed]", sheetCount: 0 };
  }
}

// ─── Main Extractor ───────────────────────────────────────────────────────────

export async function extractFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  fileRole?: ExtractedFile["fileRole"];
  fileUrl?: string; // needed for vision LLM on image PDFs
}): Promise<ExtractedFile> {
  const { buffer, fileName, mimeType, fileRole = "attachment", fileUrl } = params;
  let detectedType = detectFileType(fileName, mimeType);
  let textContent = "";
  let pageCount: number | undefined;
  let sheetCount: number | undefined;
  let hasImages = false;
  let extractionMethod = "text";

  if (detectedType === "pdf_text") {
    const pdfResult = await extractPdf(buffer);
    pageCount = pdfResult.pageCount;

    if (pdfResult.scanClassification === "scanned" && fileUrl) {
      // All/most pages are image-only — use vision LLM for the whole document
      detectedType = "pdf_image";
      hasImages = true;
      extractionMethod = "vision_llm";
      textContent = await describeWithVision(
        fileUrl,
        fileName,
        `This appears to be a fully scanned/image-based PDF (${pdfResult.imagePageCount} of ${pdfResult.pageCount} pages had no extractable text).`
      );
    } else if (pdfResult.scanClassification === "mixed" && fileUrl) {
      // Some pages are text, some are images — combine both extraction paths
      detectedType = "pdf_image";
      hasImages = true;
      extractionMethod = "pdf_parse+vision_llm";
      const visionText = await describeWithVision(
        fileUrl,
        fileName,
        `This is a mixed PDF: ${pdfResult.imagePageCount} of ${pdfResult.pageCount} pages are image-only. Describe all image pages in detail, including any text visible in images, tables, diagrams, and forms.`
      );
      // Combine: text-extracted content first, then vision supplement for image pages
      textContent = [
        pdfResult.text,
        "\n\n<!-- Vision LLM supplement for image-only pages -->\n",
        visionText,
      ]
        .filter(Boolean)
        .join("");
    } else {
      // Fully text-extractable PDF
      textContent = pdfResult.text;
      extractionMethod = "pdf_parse";
      // Check if PDF mentions images/figures
      hasImages = /figure|exhibit|photo|image|diagram|drawing/i.test(textContent);
    }
  } else if (detectedType === "docx") {
    textContent = await extractDocx(buffer);
    extractionMethod = "mammoth";
  } else if (detectedType === "xlsx") {
    const xlsxResult = await extractXlsx(buffer);
    textContent = xlsxResult.markdown;
    sheetCount = xlsxResult.sheetCount;
    extractionMethod = "xlsx_to_markdown";
  } else if (detectedType === "csv") {
    const csvResult = await extractXlsx(buffer, true);
    textContent = csvResult.markdown;
    extractionMethod = "csv_to_markdown";
  } else if (detectedType === "txt") {
    textContent = buffer.toString("utf-8").trim();
    extractionMethod = "raw_text";
  } else if (detectedType === "xml") {
    // Already structured — preserve as-is but strip any BOM
    textContent = buffer.toString("utf-8").replace(/^\uFEFF/, "").trim();
    extractionMethod = "preserved_xml";
  } else if (detectedType === "image") {
    hasImages = true;
    extractionMethod = "vision_llm";
    if (fileUrl) {
      textContent = await describeWithVision(fileUrl, fileName, "This is a standalone image file.");
    } else {
      textContent = `[Image file: ${fileName} — upload to storage first for vision extraction]`;
    }
  }

  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  return {
    fileName,
    fileType: detectedType,
    fileRole,
    textContent,
    pageCount,
    sheetCount,
    wordCount,
    hasImages,
    extractionMethod,
  };
}

// ─── XML Fragment Builder ─────────────────────────────────────────────────────

export function buildFileXmlFragment(extracted: ExtractedFile, index: number): string {
  const attrs = [
    `name="${escapeXml(extracted.fileName)}"`,
    `type="${extracted.fileRole}"`,
    `format="${extracted.fileType}"`,
    `extraction="${extracted.extractionMethod}"`,
    extracted.pageCount !== undefined ? `pages="${extracted.pageCount}"` : "",
    extracted.sheetCount !== undefined ? `sheets="${extracted.sheetCount}"` : "",
    `words="${extracted.wordCount}"`,
    extracted.hasImages ? `has-images="true"` : "",
    `index="${index}"`,
  ]
    .filter(Boolean)
    .join(" ");

  // For pre-existing XML, embed it directly inside a wrapper
  if (extracted.fileType === "xml") {
    return `  <file ${attrs}>\n    <embedded-xml><![CDATA[${extracted.textContent}]]></embedded-xml>\n  </file>`;
  }

  return `  <file ${attrs}>\n    <content><![CDATA[${extracted.textContent}]]></content>\n  </file>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Supported MIME types for upload validation ───────────────────────────────

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "text/xml",
  "application/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
];

export const SUPPORTED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv",
  ".txt", ".xml", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff",
];

export const FILE_TYPE_LABELS: Record<string, string> = {
  pdf_text: "PDF (Text)",
  pdf_image: "PDF (Scanned)",
  docx: "Word Document",
  xlsx: "Spreadsheet",
  csv: "CSV",
  txt: "Plain Text",
  xml: "XML",
  image: "Image",
};
