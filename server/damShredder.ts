/**
 * damShredder.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adapter that runs the XML Shredder pipeline on a single DAM document and
 * returns output in the same shape that triggerExtract's LLM single-pass
 * produces, so the DAM record is populated identically regardless of which
 * extraction path was used.
 *
 * The XML Shredder pipeline itself (xmlShredder.ts / rfpExtractor.ts) is NOT
 * modified — this file only bridges the two systems.
 *
 * Usage (inside triggerExtract):
 *   const result = await shredDocumentForDam({ fileUrl, fileName, mimeType, docType });
 *   // result.extractedMeta  — JSONB object (mirrors LLM single-pass output)
 *   // result.extractedText  — flat searchable text
 *   // result.tags           — comma-separated keyword string
 *   // result.pageCount      — integer | null
 */

import { invokeLLMWithSkill } from "./_core/llmSkill";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DamShredResult {
  extractedMeta: Record<string, any>;
  extractedText: string;
  tags: string;
  ownerName: string | null;
  firmRole: string | null;
  pageCount: number | null;
}

// ─── PDF page count (lightweight — no full extraction) ────────────────────────

/**
 * Fetch the PDF from storage and count pages using pdf-parse.
 * Returns null if the file is not a PDF or if parsing fails.
 */
export async function getPdfPageCount(fileUrl: string, mimeType?: string): Promise<number | null> {
  const isPdf =
    mimeType?.includes("pdf") ||
    fileUrl.toLowerCase().includes(".pdf");

  if (!isPdf) return null;

  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const result = await pdfParse(buffer);
    return result.numpages ?? null;
  } catch {
    return null;
  }
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Run the XML Shredder pipeline on a single file and return DAM-compatible
 * structured output.  The shredder produces rich XML; we then ask the LLM to
 * convert that XML into the same JSON schema that the single-pass prompts
 * produce, so downstream code (buildTagString, buildExtractedText, etc.) works
 * without modification.
 */
export async function shredDocumentForDam(params: {
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  docType: string;
  pageCount: number | null;
}): Promise<DamShredResult> {
  const { fileUrl, fileName, mimeType, docType, pageCount } = params;

  // ── Step 1: Run the XML Shredder to get structured XML ──────────────────────
  const isPdf = mimeType?.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const isWord =
    mimeType?.includes("word") ||
    mimeType?.includes("document") ||
    fileName.toLowerCase().endsWith(".docx") ||
    fileName.toLowerCase().endsWith(".doc");

  let xmlContent = "";

  if (isPdf || isWord) {
    const shredResult = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      variables: {
        fileName,
        fileUrl,
        fileRole: "primary",
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
    xmlContent = (shredResult.choices[0]?.message?.content as string) ?? "";
  } else {
    // Fallback: fetch raw text and shred
    let rawText = "";
    try {
      const res = await fetch(fileUrl);
      rawText = await res.text();
    } catch {
      rawText = "(could not fetch file content)";
    }
    const shredResult = await invokeLLMWithSkill({
      skillType: "xml_shredder",
      variables: {
        fileName,
        fileUrl,
        fileRole: "primary",
        documentType: "text document",
        rawText: rawText.slice(0, 80000),
      },
    });
    xmlContent = (shredResult.choices[0]?.message?.content as string) ?? "";
  }

  // ── Step 2: Convert XML → DAM JSON schema via a second LLM pass ─────────────
  // We ask the LLM to read the shredded XML and return the same JSON structure
  // that the single-pass prompts produce for this docType.
  const conversionPrompt = buildConversionPrompt(docType);

  const conversionResult = await invokeLLMWithSkill({
    skillType: "xml_shredder",
    messages: [
      {
        role: "system",
        content: conversionPrompt,
      },
      {
        role: "user",
        content: `Here is the shredded XML document:\n\n${xmlContent.slice(0, 120000)}\n\nReturn only the JSON object.`,
      },
    ],
  });

  const rawContent =
    (conversionResult.choices[0]?.message?.content as string) ?? "{}";
  let extracted: Record<string, any> = {};
  try {
    // Strip markdown code fences if present
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    extracted = JSON.parse(cleaned);
  } catch {
    // Fallback: store the raw XML as the extracted text
    extracted = {
      raw: rawContent,
      xmlContent: xmlContent.slice(0, 50000),
    };
  }

  // ── Step 3: Build DAM fields from the extracted JSON ─────────────────────────
  const extractedText = buildExtractedTextFromJson(extracted, xmlContent);
  const tags = buildTagsFromJson(extracted);

  const rawOwner = extracted.owner;
  const ownerName: string | null = Array.isArray(rawOwner)
    ? (rawOwner as string[]).join(", ") || null
    : typeof rawOwner === "string"
    ? rawOwner || null
    : null;

  const firmRole: string | null =
    typeof extracted.firmRole === "string" ? extracted.firmRole : null;

  return {
    extractedMeta: extracted,
    extractedText,
    tags,
    ownerName,
    firmRole,
    pageCount,
  };
}

// ─── Conversion prompts ───────────────────────────────────────────────────────

function buildConversionPrompt(docType: string): string {
  const base = `You are an expert AEC document analyst. You will receive a structured XML document that has been shredded from a ${docType.replace(/_/g, " ")} file. Convert it into a JSON object with the following fields. Return ONLY valid JSON, no markdown, no explanation.`;

  const sharedFields = `
Common fields (include all that are present):
- title: string
- description: string (2-4 sentence summary)
- owner: string or array of strings (public agency / asset owner)
- clientName: string (direct contracting party)
- firmRole: string (prime | sub | joint-venture)
- contractValue: string
- awardYear: number
- serviceLines: array of strings
- location: string
- tags: array of strings (keywords for search)
- sections: array of {title, content} objects
`;

  const docTypeFields: Record<string, string> = {
    past_proposal: `${sharedFields}
Additional fields:
- projectName: string
- projectNumber: string
- startDate: string
- endDate: string
- scope: string
- highlights: array of strings (key achievements/differentiators)
- teamMembers: array of strings
- subconsultants: array of strings
`,
    rfp: `${sharedFields}
Additional fields:
- rfpNumber: string
- dueDate: string
- submissionRequirements: array of strings
- evaluationCriteria: array of {criterion, weight}
- scopeOfWork: string
- estimatedBudget: string
- questions: array of strings (key questions from the RFP)
- requirements: array of strings
`,
    boilerplate: `${sharedFields}
Additional fields:
- category: string (qualifications | approach | methodology | cover_letter | executive_summary | other)
- applicableProjects: array of strings
- keyMessages: array of strings
`,
    other: sharedFields,
  };

  return `${base}\n\n${docTypeFields[docType] ?? docTypeFields.other}`;
}

// ─── Text / tag builders ──────────────────────────────────────────────────────

function buildExtractedTextFromJson(
  extracted: Record<string, any>,
  xmlFallback: string
): string {
  const parts: string[] = [];

  if (extracted.title) parts.push(extracted.title);
  if (extracted.description) parts.push(extracted.description);
  if (extracted.scope) parts.push(extracted.scope);
  if (extracted.scopeOfWork) parts.push(extracted.scopeOfWork);

  if (Array.isArray(extracted.sections)) {
    for (const s of extracted.sections) {
      if (s.title) parts.push(s.title);
      if (s.content) parts.push(s.content);
    }
  }

  if (Array.isArray(extracted.requirements)) {
    parts.push(extracted.requirements.join(" "));
  }

  if (Array.isArray(extracted.highlights)) {
    parts.push(extracted.highlights.join(" "));
  }

  if (Array.isArray(extracted.keyMessages)) {
    parts.push(extracted.keyMessages.join(" "));
  }

  if (extracted.owner) {
    parts.push(Array.isArray(extracted.owner) ? extracted.owner.join(", ") : extracted.owner);
  }

  if (extracted.clientName) parts.push(extracted.clientName);
  if (extracted.location) parts.push(extracted.location);

  // If we couldn't extract much, fall back to the raw XML (truncated)
  if (parts.join(" ").length < 200 && xmlFallback) {
    parts.push(xmlFallback.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10000));
  }

  return parts.join("\n\n").trim();
}

function buildTagsFromJson(extracted: Record<string, any>): string {
  const tags: string[] = [];

  if (Array.isArray(extracted.tags)) {
    tags.push(...extracted.tags.map(String));
  }

  if (Array.isArray(extracted.serviceLines)) {
    tags.push(...extracted.serviceLines.map(String));
  }

  if (extracted.location) tags.push(String(extracted.location));
  if (extracted.clientName) tags.push(String(extracted.clientName));
  if (extracted.firmRole) tags.push(String(extracted.firmRole));

  // Deduplicate and clean
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).join(", ");
}
