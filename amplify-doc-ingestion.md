# Amplify Proposals — Document Ingestion & Tagging Architecture

**Version:** 1.0  
**Date:** May 28, 2026  
**Scope:** All document ingestion pipelines, LLM extraction patterns, and metadata tagging strategies across the Amplify Proposals platform.

---

## Overview

Amplify Proposals ingests documents through three distinct pipelines, each serving a different purpose in the AEC proposal lifecycle. Every pipeline shares a common principle: **no manual tagging**. The LLM reads each document and auto-fills all available metadata before the user ever sees a form. The three pipelines are:

| Pipeline | Entry Point | Purpose | LLM Mode |
|---|---|---|---|
| **Knowledge Hub — autoExtract** | Upload drop zone | Pre-fill the upload confirmation form | `json_object` response |
| **Knowledge Hub — triggerExtract** | Post-save deep extraction | Structured per-docType indexing | `json_object` response |
| **XML Document Shredder** | RFP Intelligence page | Compile RFP files into semantic XML | Skill-based structured output |
| **Proposal Workspace Skills** | Proposal Workspace page | Sequential AI proposal generation | `json_schema` (structured) + free text |
| **RFP Wiki** | RFP Intelligence page | Build a living requirements index | `json_schema` response |
| **RFP Conflict Detector** | RFP Intelligence page | Detect contradictions in RFP packages | `json_schema` response |

---

## 1. Knowledge Hub — autoExtract (Pre-Upload Form Fill)

### Purpose

When a user drops a file onto the Knowledge Hub upload zone, the file is immediately uploaded to S3 storage and the `autoExtract` tRPC mutation is called **before** the confirmation dialog is shown. The LLM reads the document and returns a JSON object that pre-populates every field in the upload form. The user reviews and confirms (or corrects) the AI-suggested values before the DAM record is created.

### Trigger and Timing

The `autoExtract` mutation fires on the `onDrop` event in `KnowledgeHub.tsx`. The upload form displays a "Reading document..." spinner while the LLM call is in flight. On success, an "Auto-filled" badge appears next to each pre-populated field. If the LLM call fails for any reason, the form falls back to filename-derived defaults (the filename without extension, with hyphens and underscores replaced by spaces, and `docType` defaulting to `"other"`).

### LLM Call Structure

The procedure in `server/routers/dam.ts` (the `autoExtract` procedure) constructs a two-part user message:

1. A `file_url` content block pointing to a freshly signed S3 URL for the uploaded file. The MIME type is passed through; if the MIME type is not one of the LLM's natively supported types (`application/pdf`, `audio/mpeg`, `audio/wav`, `audio/mp4`, `video/mp4`), it defaults to `application/pdf` so the model treats it as a document.
2. A `text` content block instructing the model to analyze the document and extract metadata.

The system prompt instructs the model to act as an AEC document analyst and return a strict JSON object. The `response_format` is set to `{ type: "json_object" }` to guarantee parseable output.

### Extracted Fields

The system prompt specifies the following JSON schema (all fields nullable except `docType`):

| Field | Type | Description |
|---|---|---|
| `docType` | enum string | One of: `past_proposal`, `project_sheet`, `resume`, `certification`, `rfp`, `contract`, `boilerplate`, `other` |
| `companyTag` | string \| null | One of: `JPCL`, `Strans`, `Both`, or null — inferred from letterhead, logos, or company name mentions |
| `title` | string | Best descriptive title for the document |
| `clientName` | string \| null | Client or agency name |
| `projectName` | string \| null | Project name if identifiable |
| `projectNumber` | string \| null | Project or contract number |
| `contractValue` | string \| null | Formatted dollar amount (e.g., `$1,250,000`) |
| `awardYear` | number \| null | Four-digit award year |
| `staffName` | string \| null | Full name of the person (for resumes and certifications) |
| `tags` | string \| null | Comma-separated keywords: disciplines, location, agency type, etc. |
| `description` | string \| null | Two-to-three sentence summary of the document |

### Tag Storage Format

Tags are stored as a **comma-separated string** in the `dam_documents.tags` column (a `TEXT` column in MySQL/TiDB). On the frontend, tags are parsed for display using `doc.tags.split(",")`. This format was chosen for simplicity and full-text search compatibility — the DAM list query uses a SQL `LIKE` search that scans the `tags` column as a plain string.

---

## 2. Knowledge Hub — triggerExtract (Deep Post-Save Extraction)

### Purpose

After the DAM record is created (i.e., after the user confirms the upload form), a deeper per-docType extraction can be triggered via the `triggerExtract` tRPC mutation. This is a separate, optional step that performs **structured deep extraction** tailored to the specific document type. The results are stored in the `extractedMeta` JSONB column and the `extractedText` text column, and the `processingStatus` is updated from `"uploaded"` to `"indexed"` on success (or `"error"` on failure).

### LLM Call Structure

The `triggerExtract` procedure fetches a fresh signed URL for the document, then constructs a multi-part user message containing both a `file_url` content block (the document itself) and a `text` content block with a specific extraction instruction. The `response_format` is set to `{ type: "json_object" }`. The system prompt is selected from a per-docType map.

### Per-DocType System Prompts and Output Schemas

Each document type receives a specialized system prompt that defines the expected JSON structure:

**`past_proposal`** — Extracts proposal intelligence:

> "You are an expert AEC proposal analyst. Extract structured information from this past proposal. Return JSON with: title, client, rfpNumber, submitDate, awardDate, contractValue, serviceLines (string array of disciplines), keyPersonnel (string array of names), projectDescription, winThemes (string array), summary (3–5 paragraph plain-text summary)."

**`project_sheet`** — Extracts project experience data:

> "You are an expert AEC project data analyst. Extract: projectName, projectNumber, client, location, contractValue, startDate, endDate, serviceLines, keyPersonnel, description (2–3 paragraphs), highlights (string array), summary."

**`resume`** — Extracts staff profile data:

> "You are an expert AEC HR analyst. Extract: name, title, yearsExperience, education (string array), certifications (string array with credential numbers), serviceLines, skills (string array), projectExperience (string array), summary (2–3 paragraphs)."

**`certification`** — Extracts credential details:

> "You are an AEC certification document analyst. Extract: holderName, certificationName, certificationNumber, issuingAuthority, issueDate, expirationDate, level, summary."

**`other`** — Generic extraction:

> "You are a document analyst. Extract: title, documentType, date, keyEntities (string array), summary."

The `rfp`, `contract`, and `boilerplate` types fall through to the `other` prompt in the current implementation. The extracted `summary` or `description` field from the JSON output is also stored in the `extractedText` column for plain-text search and preview display.

### Processing Status Lifecycle

```
uploaded → (triggerExtract called) → processing → indexed
                                                 → error
```

The `processingStatus` column uses a MySQL enum with four values. The `"processing"` state is set at the start of the LLM call; `"indexed"` on success; `"error"` on any exception, with the error message stored in `processingError`.

---

## 3. Auto-Link Logic (Cross-Record Linking)

### Purpose

When a DAM document is created via the `dam.create` tRPC procedure, the system automatically attempts to link the document to an existing `personnel` (Staff) or `projects` record — or creates a new one if no match is found. This is what causes resumes and certifications to appear on the Staff page, and project sheets and past proposals to appear on the Projects page.

### Staff Auto-Link (Resumes and Certifications)

If the `docType` is `"resume"` or `"certification"` and a `staffName` was provided (either by the user or by `autoExtract`), the procedure performs a case-insensitive `LIKE` search against the `personnel.name` column. If a match is found, the `staffId` foreign key is set on the DAM record. If no match is found, a new `personnel` row is inserted with `isActive: true` and the resolved ID is used.

### Project Auto-Link (Project Sheets and Past Proposals)

If the `docType` is `"project_sheet"` or `"past_proposal"` and a `projectName` was provided, the procedure first attempts an exact match on `projects.projectNumber` (if a project number was also provided), then falls back to a `LIKE` search on `projects.name`. If neither matches, a new `projects` row is inserted with `status: "completed"`, using the `clientName`, `projectName`, `projectNumber`, and a numeric parse of `contractValue`.

### Matching Priority

| Match Attempt | Column Searched | Condition |
|---|---|---|
| Staff exact | `personnel.name` | `LIKE '%staffName%'` |
| Project by number | `projects.projectNumber` | `= projectNumber` |
| Project by name | `projects.name` | `LIKE '%projectName%'` |

---

## 4. XML Document Shredder

### Purpose

The XML Document Shredder (implemented in `server/routers/xmlShredder.ts` and `server/rfpExtractor.ts`) compiles one or more uploaded RFP files into a single structured `<rfp-package>` XML document. This compiled XML is the input for the RFP Wiki and RFP Conflict Detector features. The shredder is designed around "Karpathy Pattern 1" — converting unstructured documents into a canonical, machine-readable format before any higher-level analysis.

### Multi-Format Extraction Pipeline

The `extractFile()` function in `rfpExtractor.ts` handles all format detection and text extraction. Format detection uses file extension first, falling back to MIME type:

| Format | Detection | Extraction Method | Library / Approach |
|---|---|---|---|
| PDF (text-based) | `.pdf` extension | `pdf-parse` library | Extracts embedded text layer |
| PDF (scanned/image) | `.pdf` + `avgCharsPerPage < 50` threshold | Vision LLM | `invokeLLMWithSkill` with `image_url` content block |
| DOCX / DOC | `.docx`, `.doc` | `mammoth` library | `extractRawText()` → plain text |
| XLSX / XLS | `.xlsx`, `.xls` | `xlsx` library | `sheet_to_json()` → markdown tables (one table per sheet) |
| CSV | `.csv` | `xlsx` library | Same as XLSX, single sheet |
| TXT | `.txt` | Raw buffer | `buffer.toString("utf-8")` |
| XML | `.xml` | Preserved as-is | BOM stripped, embedded in `<embedded-xml><![CDATA[...]]>` |
| Images (PNG/JPG/WEBP/GIF/TIFF) | Image extensions | Vision LLM | `invokeLLMWithSkill` with `image_url` content block |

### Scanned PDF Detection

The scanned PDF detection heuristic is: after `pdf-parse` extracts text, if the average character count per page is **less than 50**, the PDF is classified as `pdf_image` and re-processed using the vision LLM. This threshold catches PDFs that are entirely composed of scanned images (where `pdf-parse` returns only whitespace or form field labels) while correctly classifying text-heavy PDFs.

### Vision LLM Prompt for Scanned PDFs and Images

When the vision LLM is invoked for scanned PDFs or standalone images, the prompt instructs the model to:

> "Describe all visible content in detail: any text visible (transcribe it exactly), tables (reproduce as markdown tables), diagrams/maps/site plans (describe what they show), forms (list all fields and any pre-filled values), charts/graphs (describe data shown), photos (describe what is depicted). Be thorough — this description will be used to compile an RFP requirements wiki."

The `skillType` used is `"xml_shredder"`, which looks up the corresponding system prompt from the `aiSkillConfigs` table via `invokeLLMWithSkill`.

### XML Fragment Structure

Each extracted file is wrapped in a `<file>` XML element with metadata attributes:

```xml
<file name="RFP_Section_B.pdf" type="primary" format="pdf_text"
      extraction="pdf_parse" pages="42" words="18500">
  <content><![CDATA[...extracted text...]]></content>
</file>
```

For pre-existing XML files, the content is embedded inside `<embedded-xml><![CDATA[...]]></embedded-xml>` to preserve the original structure. The `extraction` attribute records which method was used (`pdf_parse`, `vision_llm`, `mammoth`, `xlsx_to_markdown`, `csv_to_markdown`, `raw_text`, `preserved_xml`, or `llm_structured`).

### Multi-File Package Compilation

The `shredPackage` mutation accepts up to 20 files and compiles them into a single `<rfp-package>` document:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rfp-package name="FY2026-RFP-001" compiled="2026-05-28T..." fileCount="3">
  <file name="RFP_Main.pdf" type="primary" ...>...</file>
  <file name="Addendum_1.pdf" type="addendum" ...>...</file>
  <file name="Exhibit_A.xlsx" type="exhibit" ...>...</file>
</rfp-package>
```

The compiled XML is stored in the `documentShreds.xmlContent` column and the `status` is updated from `"processing"` to `"ready"`. For PDFs and Word documents, the shredder passes the file URL directly to the LLM via a `file_url` content block (the LLM reads the document natively). For images, it uses an `image_url` content block. For text-based formats (TXT, CSV, XLSX fallback), the raw text is fetched and injected into the prompt variables as `rawText`.

---

## 5. Proposal Workspace — Sequential Skill Workflow

### Purpose

The Proposal Workspace executes a chain of eight AI skills in strict sequence, with each skill building on the outputs of all prior skills. Each skill runs as a single HTTP request (one tRPC mutation per skill), and the result is written to the database before the next skill fires. This "intermediate saves" pattern prevents timeout issues on serverless platforms and enables resume capability.

### The Eight Skills

| Order | Skill Name | Output Type | LLM Mode |
|---|---|---|---|
| 1 | `rfp_parser` | Structured JSON | `json_schema` (strict) |
| 2 | `win_themes` | Free text (numbered list) | System prompt override |
| 3 | `technical_outline` | Free text (structured outline) | System prompt override |
| 4 | `technical_writer` | Free text (proposal prose) | System prompt override |
| 5 | `key_personnel` | Free text (proposal section) | System prompt override |
| 6 | `past_performance` | Free text (proposal section) | System prompt override |
| 7 | `fee_estimator` | Free text (fee table) | System prompt override |
| 8 | `proposal_scorer` | Structured JSON | `json_schema` (strict) |

### Skill Context Chaining

The `buildSkillVariables()` function constructs the LLM prompt variables for each skill by reading the `skillOutputs` JSONB column from the session record. Each skill receives the outputs of all prior skills as named variables:

- Skills 2–8 receive `rfpContext` (the `rfp_parser` output or the raw RFP text).
- Skills 3–8 receive `winThemes` (the `win_themes` output).
- Skills 4–8 receive `technicalOutline`.
- Skill 8 (`proposal_scorer`) receives `technicalApproach`, `keyPersonnel`, `pastPerformance`, and `winThemes` as separate inputs for criterion-by-criterion scoring.

The `agency`, `rfpTitle`, `rfpNumber`, `evaluationCriteria`, `keyPersonnelRequirements`, and `scopeSummary` fields are extracted from the `extractedData` JSONB column (populated by `rfp_parser`) and injected as variables into all downstream skills.

### rfp_parser — Strict JSON Schema

The `rfp_parser` skill uses `response_format: { type: "json_schema", strict: true }` to guarantee a fully typed output. The schema enforces the following structure:

| Field | Type | Description |
|---|---|---|
| `projectTitle` | string | Full project title from the RFP |
| `agency` | string | Issuing agency name |
| `rfpNumber` | string | RFP or solicitation number |
| `submissionDeadline` | string | Deadline date/time |
| `estimatedValue` | string | Estimated contract value |
| `serviceLines` | string[] | Disciplines required |
| `evaluationCriteria` | object[] | Each criterion: `id`, `title`, `weight`, `description` |
| `keyPersonnelRequirements` | object[] | Each role: `role`, `requiredCertifications`, `minimumYearsExperience`, `description` |
| `pageLimits` | object[] | Each limit: `section`, `limit` |
| `mandatoryItems` | string[] | Required submission items |
| `submissionFormat` | string | Electronic/physical/portal |
| `scopeSummary` | string | Plain-text scope summary |
| `conflictsDetected` | object[] | Each conflict: `type`, `description`, `severity` (low/medium/high) |

The `rfp_parser` output is also saved to the `extractedData` column as a parsed JavaScript object for direct field access by downstream skills.

### proposal_scorer — Strict JSON Schema

The `proposal_scorer` skill also uses strict `json_schema` mode. Its output schema:

| Field | Type | Description |
|---|---|---|
| `overallScore` | number | 0–100 composite score |
| `sectionScores` | object | Key-value map of section name → score |
| `criteriaScores` | object[] | Per-criterion: `criterionId`, `criterionTitle`, `score`, `addressedWell`, `gaps[]`, `improvements[]` |
| `topGaps` | string[] | Top weaknesses across the full proposal |
| `topImprovements` | string[] | Top recommended improvements |
| `summary` | string | Plain-text evaluation summary |

The `overallScore` is extracted from this output and stored in the `rfpSessions.liveScore` column for display in the Proposal Workspace header badge.

### Skills 2–7 — System Prompt Overrides

The middle six skills use free-text generation with system prompt overrides registered in the `getSystemOverride()` function. These overrides are passed to `invokeLLMWithSkill` as the `systemOverride` parameter, which replaces the default system prompt stored in the `aiSkillConfigs` table. Each override is tailored to AEC proposal writing conventions:

- **`win_themes`**: Instructs the model to generate 3–5 differentiated win themes, each directly addressing an evaluation criterion, backed by past performance evidence, and expressed as a compelling statement.
- **`technical_outline`**: Instructs the model to create a section-by-section outline mapping each section to an RFP evaluation criterion, with 3–5 key points per section and references to win themes.
- **`technical_writer`**: Instructs the model to draft the Technical Approach prose (800–1,200 words) using the outline and win themes as inputs.
- **`key_personnel`**: Instructs the model to draft the Key Personnel section in SF-330 Section E format, stating RFP-required qualifications and how the firm's staff meets them.
- **`past_performance`**: Instructs the model to draft the Past Performance section in SF-330 Section F format, with project name, client, scope, relevance to the RFP, and measurable outcomes.
- **`fee_estimator`**: Instructs the model to generate a preliminary fee estimate structured by major tasks, labor categories, estimated hours, direct costs, and totals.

### Skill-to-SkillType Mapping

Each `WorkflowSkillName` maps to a `skillType` string used to look up the LLM configuration in the `aiSkillConfigs` table:

| Workflow Skill | aiSkillConfigs skillType |
|---|---|
| `rfp_parser` | `rfp_shredder` |
| `win_themes` | `go_no_go_advisor` |
| `technical_outline` | `proposal_writer` |
| `technical_writer` | `proposal_writer` |
| `key_personnel` | `proposal_writer` |
| `past_performance` | `proposal_writer` |
| `fee_estimator` | `fee_estimator` |
| `proposal_scorer` | `proposal_scorer` |

---

## 6. RFP Wiki

### Purpose

The RFP Wiki (`server/routers/rfpWiki.ts`) takes a compiled `<rfp-package>` XML document (produced by the XML Shredder) and builds a structured, searchable requirements index — a "living wiki" of all requirements, dates, values, and evaluation criteria extracted from the RFP package.

### LLM Call Pattern

The RFP Wiki uses `invokeLLMWithSkill` with `skillType: "wiki_compiler"` and `response_format: { type: "json_schema" }`. The JSON schema defines a `rfp_structured_index` object with arrays of typed requirement objects, each carrying a `value`, `source` (filename, section, page), and `xmlPath` (the XPath-like location in the compiled XML):

| Array | Contents |
|---|---|
| `submissionDeadlines` | All deadline dates found across all files |
| `contractValues` | All dollar amounts and budget figures |
| `evaluationCriteria` | All scoring criteria with weights |
| `eligibilityRequirements` | All qualification requirements |
| `keyDates` | Pre-bid meetings, Q&A deadlines, award dates |
| `pageLimits` | Page/word/section limits |
| `references` | References to exhibits, attachments, forms |
| `scopeItems` | Scope of work items |
| `sectionMap` | Section-by-section description of the RFP structure |

The `xmlPath` field on each item enables the Conflict Detector to cross-reference the same fact appearing in multiple locations.

---

## 7. RFP Conflict Detector

### Purpose

The Conflict Detector (`server/routers/rfpConflicts.ts`) performs a two-pass analysis of the compiled `<rfp-package>` XML to identify contradictions, inconsistencies, and conflicts that could create compliance risk or require clarification requests.

### Pass 1 — Deterministic Rule Checks

Before invoking the LLM, the Conflict Detector runs deterministic checks on the structured wiki data:

- **Evaluation weight sum**: If the sum of all evaluation criteria weights (parsed as numbers) differs from 100% by more than 1%, a `"evaluation_weight_conflict"` conflict is generated with `severity: "warning"`.
- Additional rule-based checks can be added without LLM cost.

### Pass 2 — AI Semantic Conflict Detection

The second pass sends the full XML content (truncated to 80,000 characters) to `invokeLLMWithSkill` with `skillType: "wiki_compiler"` and a detailed system prompt override. The LLM is instructed to look for eight categories of conflicts:

1. **Date contradictions** — the same date appearing with different values in different sections
2. **Value contradictions** — conflicting contract values or budget figures
3. **Scope contradictions** — requirements that directly contradict each other
4. **Submission format conflicts** — conflicting page limits, font sizes, or margin requirements
5. **Evaluation weight conflicts** — scoring weights that differ between sections
6. **Addendum supersession** — addenda that conflict with each other or with the original RFP
7. **Broken references** — references to exhibits or sections that do not exist in the package
8. **Eligibility conflicts** — contradictory qualification requirements

The `response_format` uses `json_schema` with `strict: false` (to accommodate variable-length `conflictingFacts` arrays). Each returned conflict object contains: `conflictType`, `severity` (critical/warning/info), `title`, `description`, `conflictingFacts[]` (each with `value`, `source`, `xmlPath`, `fileRole`), and `recommendation`.

---

## 8. Data Flow Summary

The diagram below illustrates how a document moves through the system from upload to indexed record and how it feeds into proposal generation:

```
User drops file
      │
      ▼
/api/upload (multer, 50 MB limit)
      │
      ▼
storagePut() → S3 key + signed URL
      │
      ├──► dam.autoExtract (LLM reads file → JSON metadata)
      │         │
      │         ▼
      │    Upload confirmation form (pre-filled)
      │         │
      │         ▼
      │    dam.create → dam_documents row
      │         │
      │         ├──► Auto-link: staffId (resume/cert) or projectId (project_sheet/past_proposal)
      │         │
      │         └──► dam.triggerExtract (per-docType deep LLM extraction)
      │                   │
      │                   ▼
      │              extractedMeta (JSONB) + extractedText + processingStatus: "indexed"
      │
      └──► xmlShredder.shredPackage (RFP files only)
                │
                ▼
           rfpExtractor.extractFile() per file
           (pdf-parse | vision LLM | mammoth | xlsx→md | raw text)
                │
                ▼
           <rfp-package> XML → documentShreds.xmlContent
                │
                ├──► rfpWiki.compile → structured requirements index
                │
                └──► rfpConflicts.detect → conflict list
                          │
                          ▼
                     rfpSessions.create → 8-skill workflow
                          │
                          ▼
                     executeSkill (one per HTTP request)
                     rfp_parser → win_themes → technical_outline →
                     technical_writer → key_personnel → past_performance →
                     fee_estimator → proposal_scorer
                          │
                          ▼
                     skillOutputs (JSONB) + liveScore
```

---

## 9. Database Schema — Key Columns

### `dam_documents` Table

| Column | Type | Description |
|---|---|---|
| `docType` | enum | `past_proposal`, `project_sheet`, `resume`, `certification`, `rfp`, `contract`, `boilerplate`, `other` |
| `companyTag` | enum | `JPCL`, `Strans`, `Both` |
| `staffId` | int FK | Links to `personnel.id` (auto-resolved on create) |
| `projectId` | int FK | Links to `projects.id` (auto-resolved on create) |
| `extractedText` | text | Plain-text summary from `triggerExtract` |
| `extractedMeta` | json | Full structured JSON from `triggerExtract` |
| `processingStatus` | enum | `uploaded`, `processing`, `indexed`, `error` |
| `tags` | text | Comma-separated keyword string |

### `rfpSessions` Table

| Column | Type | Description |
|---|---|---|
| `skillOutputs` | json | Map of `WorkflowSkillName → string output` |
| `workflowState` | json | Map of `WorkflowSkillName → { status, startedAt, completedAt, error }` |
| `extractedData` | json | Parsed `rfp_parser` JSON output for downstream skill variable injection |
| `liveScore` | int | Numeric score from `proposal_scorer.overallScore` |
| `rfpFileUrl` | text | Signed URL of the uploaded RFP file |

### `documentShreds` Table

| Column | Type | Description |
|---|---|---|
| `xmlContent` | text | The compiled `<rfp-package>` XML document |
| `status` | enum | `processing`, `ready`, `error` |
| `metadata` | json | File count, extraction methods, error details |

---

## 10. LLM Helper Functions

All LLM calls in the platform use one of two helper functions defined in `server/_core/`:

**`invokeLLM()`** — Direct LLM call. Takes a `messages` array and optional `response_format`. Used by `dam.ts` for both `autoExtract` and `triggerExtract`. Credentials are injected from the platform environment; no API key management is required in application code.

**`invokeLLMWithSkill()`** — Skill-aware LLM call. Looks up a skill configuration record from the `aiSkillConfigs` table by `skillType`, applies the stored system prompt and model settings, then merges any `systemOverride` and `variables` provided by the caller. Used by `rfpSessions.ts`, `xmlShredder.ts`, `rfpWiki.ts`, and `rfpConflicts.ts`. This pattern allows skill prompts to be updated in the database without code deployments.

The `response_format` parameter is passed through to the underlying LLM API. Two modes are used:

- `{ type: "json_object" }` — Guarantees JSON output but does not enforce a specific schema. Used for DAM extraction where the schema is described in the system prompt.
- `{ type: "json_schema", json_schema: { name, strict, schema } }` — Enforces a specific JSON Schema. Used for `rfp_parser` and `proposal_scorer` where strict typing is required for downstream skill chaining.

---

## 11. Known Limitations and Future Work

Several capabilities are documented in `todo.md` as planned but not yet implemented:

**Image extraction (Stage 1 — Page Thumbnails):** The `rfpExtractor.ts` sets `hasImages: true` on PDFs that contain figure/exhibit/photo references, but does not yet extract individual page images. The planned implementation uses `pdfjs-dist` to render each page as a PNG thumbnail stored in S3.

**Image extraction (Stage 2 — Vision Photo Extraction):** After page thumbnails are generated, a vision LLM pass would identify and describe photographs, site plans, and diagrams embedded in proposal documents for inclusion in the Knowledge Hub.

**Timekeeping Integration:** The `key_personnel` and `fee_estimator` skills currently use placeholder text for staff qualifications and billing rates. A planned read-only integration with the timekeeping system will inject actual staff certifications (from the skills matrix) and current billing rates into these skill prompts.

**DAM Full-Text Search:** The current `tags` column is searched via SQL `LIKE` on a comma-separated string. A future migration to Supabase PostgreSQL will replace this with `pgvector` embeddings for semantic similarity search across `extractedText` content.

**Bulk Tagging Corrections:** The `fix-staff-tags.ts` and `backfill-dam-links.ts` scripts in the `scripts/` directory demonstrate the pattern for correcting bulk metadata issues (e.g., stringified arrays, orphaned records). These should be run after any bulk import operation.
