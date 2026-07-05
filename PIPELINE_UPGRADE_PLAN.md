# Amplify Proposals — Pipeline Upgrade Plan
## Deterministic Ingestion, Evidence-First Generation, and Hybrid Retrieval

**Version:** 1.0  
**Date:** July 5, 2026  
**Status:** DRAFT — Awaiting approval before any code changes  
**Scope:** Proposal ingestion, retrieval, generation, and scoring pipeline  

---

## Executive Recommendation

The current pipeline is functional but relies too heavily on comma-separated tags and free-form text blobs at every stage. The root cause is a missing **canonical normalized chunk layer** between raw document storage and LLM generation. Retrieval is shallow (tag overlap only), evidence is collapsed into narrative summaries before reaching the model, and the scorer cannot distinguish supported claims from hallucinated ones.

The recommended design is **Alternative A — Canonical Normalized Chunk Pipeline**, extended with evidence bundles for generation and evidence-aware scoring. This is an additive upgrade: existing tables and columns are preserved, new tables are added alongside them, and the workflow continues to run through the same tRPC procedures and sequential skill chain. The upgrade delivers measurable improvements in retrieval precision, generation groundedness, and scoring reliability without replacing the architecture.

---

## Section 1 — Current-State Assessment

### 1.1 Ingestion

Documents enter the system through two paths. The **Knowledge Hub** path handles firm assets (resumes, project sheets, past proposals, certifications). On upload, `autoExtract` fires a single-pass LLM call that returns a JSON object used to pre-fill the upload form. After the user confirms, `triggerExtract` runs a deeper per-docType extraction and stores the result in `extractedMeta` (JSONB) and `extractedText` (plain text). Tags are stored as a comma-separated string in the `tags` column.

The **RFP path** handles incoming solicitation packages. Files are classified by label (Main RFP, Scope of Work, Addendum, etc.), extracted by `rfpExtractor.ts` using `pdf-parse`, `mammoth`, `xlsx`, or a vision LLM fallback, and compiled into a single `<rfp-package>` XML document stored in `document_shreds.xmlContent`. The RFP Wiki then extracts a structured index of requirements, dates, and criteria from this XML.

### 1.2 Retrieval (Asset Matching)

Asset matching in `dam.ts` (`matchProjectSheets`, `matchResumes`, `matchPastProposals`) works as follows: for each asset type, the system runs a SQL `LIKE` query against the `tags` column using the RFP's service lines as search terms. If no results are found, it falls back to returning all indexed documents of that type ordered by `createdAt DESC`. There is no scoring, no ranking by relevance, no full-text search against `extractedText`, and no semantic similarity. The UI explicitly warns users when the fallback has triggered.

### 1.3 Generation

`buildSkillVariables()` in `rfpSessions.ts` assembles the prompt context for each skill. Selected assets are hydrated from the database and collapsed into narrative summary strings (`personnelSummary`, `projectsSummary`, `pastProposalsSummary`). These strings are injected as template variables into the skill prompts. The model receives a single large text blob per asset type with no structure, no ranking, no source attribution, and no indication of which facts came from which document.

### 1.4 Scoring

`proposal_scorer` receives the full text outputs of four prior skills (`technicalApproach`, `keyPersonnel`, `pastPerformance`, `winThemes`) and the RFP evaluation criteria. It returns a structured JSON scorecard with criterion scores, gaps, and improvements. However, it has no way to distinguish a claim that is grounded in a specific project sheet from one that was hallucinated, because no provenance information reaches it.

### 1.5 Identified Weak Points

| Area | Weak Point | Impact |
|------|-----------|--------|
| Ingestion | Tags stored as comma-separated strings; no normalization | Tag drift, inconsistent matching, LIKE search is brittle |
| Ingestion | `extractedMeta` is unstructured JSONB; no canonical chunk representation | Cannot retrieve specific facts or passages; no provenance |
| Ingestion | Scanned PDF detection uses a 50-char/page heuristic | Misclassifies mixed PDFs; some text PDFs fall through to vision LLM unnecessarily |
| Retrieval | Tag-overlap-only matching with hard fallback to all docs | Low precision; wrong assets surface; user must manually correct |
| Retrieval | No full-text search against `extractedText` | Relevant documents missed when tags don't match |
| Retrieval | No ranking or relevance scoring | Top results are by `createdAt`, not relevance |
| Generation | Assets collapsed to narrative strings before model | Provenance lost; model cannot cite sources; hallucinations undetectable |
| Generation | No evidence bundles; model receives undifferentiated context | Model cannot prioritize or attribute claims |
| Scoring | Scorer has no provenance information | Cannot penalize unsupported claims; score is style-based, not evidence-based |
| Scoring | `overallScore` is a single number with no breakdown by evidence quality | No actionable signal about which sections need more grounding |

---

## Section 2 — Problem List

Problems are listed in priority order. Each entry includes user impact, technical cause, and risk if left unchanged.

**Problem 1 — Asset matching returns wrong or irrelevant assets (High)**  
*User impact:* Users see unrelated project sheets or resumes in the Launchpad Step 3 panel. They must manually search and substitute, adding friction and introducing selection errors. The UI fallback warning ("showing all documents") appears frequently.  
*Technical cause:* Matching is a single SQL `LIKE` on a comma-separated tag string. A project sheet tagged `"traffic engineering, NJ"` will not match an RFP service line of `"Traffic Engineering"` if case differs or if the tag uses an abbreviation. There is no scoring; the first 10 results by date are returned.  
*Risk if unchanged:* Wrong assets propagate into generation. The model writes about irrelevant projects and personnel, producing a proposal that does not reflect the firm's actual relevant experience.

**Problem 2 — Generated sections are not grounded in source documents (High)**  
*User impact:* Proposal sections may contain plausible-sounding but factually incorrect claims (wrong contract values, wrong client names, invented project details). Users cannot verify claims without manually cross-referencing source documents.  
*Technical cause:* `buildSkillVariables()` collapses all selected assets into narrative summary strings. The model receives these strings without any indication of which document each fact came from. There is no mechanism to require the model to cite sources.  
*Risk if unchanged:* Proposals submitted with hallucinated facts damage firm credibility and may constitute misrepresentation on government solicitations.

**Problem 3 — Scoring cannot distinguish grounded from hallucinated claims (High)**  
*User impact:* The proposal scorer gives high scores to well-written but unsupported sections. Users trust the score as a quality signal but it does not reflect evidence quality.  
*Technical cause:* The scorer receives only the generated text and the RFP criteria. It has no access to the source documents used for generation, so it cannot check whether a claim is supported.  
*Risk if unchanged:* The scoring feature provides false confidence. Users may submit proposals with high scores that contain fabricated project details.

**Problem 4 — No full-text search across document content (Medium)**  
*User impact:* Users cannot find a document by searching for a keyword that appears in the document body but not in the title or tags. Relevant assets are missed.  
*Technical cause:* `searchForAssetMatching` searches only `title`, `tags`, and `staffName` columns. `extractedText` is not indexed for search.  
*Risk if unchanged:* As the Knowledge Hub grows, retrieval precision degrades. Users increasingly rely on manual browsing.

**Problem 5 — Tag quality is inconsistent and not normalized (Medium)**  
*User impact:* Two project sheets covering the same discipline may have different tags (`"traffic"` vs. `"traffic engineering"` vs. `"Traffic Eng"`), causing one to match and one to miss.  
*Technical cause:* Tags are generated by the LLM in `autoExtract` as a free-form comma-separated string. There is no normalization, deduplication, or controlled vocabulary enforcement.  
*Risk if unchanged:* Tag-based matching becomes less reliable as the corpus grows. The fallback-to-all-docs behavior becomes the norm rather than the exception.

**Problem 6 — Scanned PDF detection heuristic is fragile (Low)**  
*User impact:* Mixed PDFs (partially scanned, partially text) may be misclassified. Some text PDFs with sparse content (forms, checklists) are sent to the vision LLM unnecessarily, increasing cost and latency.  
*Technical cause:* The 50-char/page threshold is a single global constant with no per-page analysis.  
*Risk if unchanged:* Unnecessary vision LLM calls increase cost; some content is missed in mixed PDFs.

**Problem 7 — RFP Wiki is not connected to generation (Medium)**  
*User impact:* The RFP Wiki builds a structured requirements index with source citations (`xmlPath`, `source`), but this structured data is not used by the generation skills. Skills receive only the raw wiki text blob or the raw RFP context.  
*Technical cause:* `buildSkillVariables()` injects `rfpWikiContent` as a raw string. The structured index arrays (`evaluationCriteria`, `scopeItems`, `submissionDeadlines`) are not used as typed inputs to the generation skills.  
*Risk if unchanged:* The RFP Wiki's structured provenance is wasted. Generation skills cannot reliably map their output to specific RFP requirements.

---

## Section 3 — Design Alternatives

Three alternatives were evaluated. Each is assessed on seven dimensions.

### Alternative A — Canonical Normalized Chunk Pipeline

**Architecture summary:** Add a `document_chunks` table that stores normalized, typed, provenance-bearing representations of all ingested documents. Each chunk is a discrete unit of content (a paragraph, a table row, a project highlight, a resume section) with fields for `sourceDocId`, `chunkType`, `content`, `pageRef`, `confidence`, and `extractionMethod`. Asset matching queries this table using full-text search plus metadata filters. Generation skills receive ranked evidence packets drawn from this table rather than collapsed narrative strings.

**Affected tables/files:** `drizzle/schema.ts` (new `document_chunks` table), `server/routers/dam.ts` (chunk creation on `triggerExtract`, updated matching queries), `server/routers/rfpSessions.ts` (`buildSkillVariables` updated to build evidence bundles from chunks), `shared/workflowTypes.ts` (new evidence bundle types), `server/rfpExtractor.ts` (minor: chunk output format).

**Determinism:** High. Chunk creation is a deterministic transformation of the LLM's structured JSON output. Retrieval uses SQL full-text search and metadata filters, not free-form LLM inference. Evidence bundles are assembled by deterministic ranking rules.

**Implementation effort:** Medium. The schema addition is straightforward. The main work is updating `triggerExtract` to emit chunks and updating `buildSkillVariables` to consume them. Existing columns are preserved.

**Migration risk:** Low. Existing `extractedMeta` and `extractedText` columns are preserved. New chunks are created for newly indexed documents; existing documents can be backfilled in a background job. The workflow continues to function without chunks (falls back to current behavior).

**Effect on retrieval quality:** High improvement. Full-text search against chunk content, combined with metadata filters (docType, serviceLines, clientName), produces significantly more precise results than tag-overlap alone.

**Effect on generation quality:** High improvement. Skills receive typed, ranked evidence packets with source attribution. The model can cite specific projects, personnel, and past proposals by name and document.

**Effect on scoring quality:** High improvement. The scorer receives evidence bundles alongside generated text, enabling it to check whether claims are grounded.

---

### Alternative B — Entity/Wiki + Evidence Graph Pipeline

**Architecture summary:** Build a knowledge graph of entities (firms, projects, personnel, clients, agencies) extracted from all documents. Each entity has typed attributes and relationships. Retrieval traverses the graph to find relevant entities. Generation uses entity-structured context.

**Affected tables/files:** New `entities`, `entity_attributes`, `entity_relationships` tables; major changes to all extraction and retrieval paths; new graph traversal logic.

**Determinism:** Medium. Entity extraction is LLM-driven and subject to extraction errors. Graph traversal is deterministic once the graph is built, but graph quality depends on extraction quality.

**Implementation effort:** Very high. Requires a complete redesign of the extraction layer, new graph storage and traversal logic, and new generation patterns. Estimated 6–10 weeks of backend work.

**Migration risk:** High. Existing extraction outputs are incompatible with the graph model. A full re-extraction of all existing documents is required.

**Effect on retrieval quality:** Very high in theory, but depends on graph completeness. Gaps in entity extraction produce retrieval failures that are harder to debug than missing tags.

**Effect on generation quality:** Very high in theory. Entity-structured context is the most precise input for generation. But the complexity of building and maintaining the graph introduces new failure modes.

**Effect on scoring quality:** High. Entity-grounded scoring is very precise, but requires the graph to be complete and accurate.

**Verdict:** Too complex for this codebase at this stage. The entity graph approach is the right long-term direction but requires a stable chunk layer as a prerequisite. It is a future evolution of Alternative A, not a replacement.

---

### Alternative C — Minimal Patch Approach

**Architecture summary:** Keep the existing architecture unchanged. Improve tag normalization (add a controlled vocabulary list), add a full-text search index on `extractedText`, and add a basic relevance score to asset matching. Add a citation instruction to the generation skill prompts.

**Affected tables/files:** `drizzle/schema.ts` (add `tsvector` index on `extractedText`), `server/routers/dam.ts` (updated matching queries), AI skill prompts (add citation instructions).

**Determinism:** Low improvement. Tag normalization helps but does not solve the underlying structural problem. Prompt-based citation instructions are unreliable.

**Implementation effort:** Low. One to two days of work.

**Migration risk:** Very low. No schema changes beyond an index.

**Effect on retrieval quality:** Moderate improvement. Full-text search on `extractedText` catches documents missed by tag matching. But ranking is still weak and there is no chunk-level precision.

**Effect on generation quality:** Low improvement. Prompt-based citation instructions produce inconsistent results. The model may comply sometimes and not others. No structural guarantee of provenance.

**Effect on scoring quality:** No improvement. The scorer still has no access to source documents.

**Verdict:** Insufficient. This approach treats symptoms rather than causes. The tag normalization and full-text search improvements are worth doing, but as part of Alternative A, not as a standalone fix.

---

### Comparison Table

| Dimension | Alt A (Chunks) | Alt B (Graph) | Alt C (Patch) |
|-----------|---------------|--------------|--------------|
| Determinism | High | Medium | Low |
| Retrieval quality | High | Very High | Moderate |
| Generation quality | High | Very High | Low |
| Scoring quality | High | High | None |
| Implementation effort | Medium | Very High | Low |
| Migration risk | Low | High | Very Low |
| Backward compatibility | Full | Partial | Full |
| Fits current architecture | Yes | No (major redesign) | Yes |
| Recommended | **Yes** | Future phase | No (insufficient) |

---

## Section 4 — Chosen Design

**Recommendation: Alternative A — Canonical Normalized Chunk Pipeline**, with three extensions: (1) hybrid retrieval combining metadata filters, PostgreSQL full-text search, and tag normalization; (2) evidence bundles for generation skills; and (3) evidence-aware scoring inputs.

This design is the best fit for this codebase for the following reasons:

It is **additive**. The `document_chunks` table is a new table alongside existing ones. `extractedMeta` and `extractedText` remain in place. The workflow's sequential skill chain, tRPC procedures, and `invokeLLMWithSkill` pattern are unchanged. The upgrade can be rolled out incrementally without breaking any existing flow.

It **directly addresses all seven problems** identified in Section 2. Tag normalization solves Problem 5. Full-text chunk search solves Problem 4. Ranked evidence bundles solve Problems 1 and 2. Evidence-aware scoring solves Problem 3. Structured RFP requirement injection solves Problem 7. The scanned PDF heuristic improvement (Problem 6) is a minor fix included in Phase 1.

It is **inspectable**. Every retrieved chunk carries `sourceDocId`, `pageRef`, `confidence`, and `extractionMethod`. Every evidence bundle passed to a generation skill is a typed, ranked list of chunks. The scorer receives the same bundles and can check claims against them. This makes the pipeline debuggable at every step.

It **preserves the Settings-driven provider/model architecture**. No provider or model is hardcoded. All LLM calls continue to route through `invokeLLMWithSkill` with skills configured in the `ai_skills` table.

Alternative B is the right long-term evolution but requires Alternative A as a prerequisite. Alternative C is insufficient because it does not solve the provenance and evidence problems.

---

## Section 5 — Data Model Plan

### 5.1 New Table: `document_chunks`

This is the central addition. It stores normalized, typed, provenance-bearing content units extracted from all `dam_documents` records.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Chunk identifier |
| `damDocumentId` | UUID FK → `dam_documents.id` | Parent document |
| `chunkType` | enum | `paragraph`, `table_row`, `list_item`, `highlight`, `personnel_entry`, `project_summary`, `certification`, `evaluation_criterion`, `scope_item`, `key_date`, `page_limit`, `win_theme` |
| `content` | text | The normalized text content of the chunk |
| `contentTsv` | tsvector | PostgreSQL full-text search vector (generated column) |
| `pageRef` | text nullable | Page number, sheet name, or section reference |
| `sectionRef` | text nullable | Section heading or document section name |
| `confidence` | float | 0.0–1.0 extraction confidence (1.0 for deterministic, <1.0 for LLM-extracted) |
| `extractionMethod` | enum | `deterministic`, `llm_structured`, `llm_vision`, `rule_based` |
| `metadata` | jsonb | Type-specific structured data (e.g., for `personnel_entry`: `{name, title, yearsExp, certifications[]}`) |
| `serviceLineTags` | text[] | Normalized service line tags from a controlled vocabulary |
| `createdAt` | timestamp | Creation time |

**Why this design:** The `chunkType` enum allows type-specific retrieval (e.g., "find all `highlight` chunks from project sheets tagged `traffic engineering`"). The `metadata` JSONB column stores structured facts without requiring separate tables for each chunk type. The `contentTsv` generated column enables PostgreSQL full-text search without a separate indexing step. The `confidence` and `extractionMethod` fields make the provenance of each chunk inspectable.

### 5.2 New Table: `normalized_tags`

A controlled vocabulary table for service line tags, replacing free-form comma-separated strings.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | Tag identifier |
| `canonical` | text unique | Canonical form (e.g., `traffic_engineering`) |
| `displayName` | text | Human-readable label (e.g., `Traffic Engineering`) |
| `aliases` | text[] | Alternate forms that normalize to this tag (e.g., `["traffic eng", "traffic", "Traffic Eng."]`) |

**Why this design:** Tag normalization is a prerequisite for reliable retrieval. By storing aliases, the system can normalize LLM-generated tags to canonical forms without requiring the LLM to use exact vocabulary.

### 5.3 Additive Changes to Existing Tables

| Table | Column | Change |
|-------|--------|--------|
| `dam_documents` | `normalizedTags` | New `text[]` column — normalized canonical tags derived from `tags` string |
| `dam_documents` | `chunkCount` | New `int` column — number of chunks created for this document |
| `dam_documents` | `chunkStatus` | New enum — `pending`, `chunked`, `error` — tracks chunk creation status |
| `rfp_sessions` | `evidenceBundles` | New `jsonb` column — stores the evidence bundles assembled for each skill run, for provenance display |
| `rfp_sessions` | `scorerEvidenceInput` | New `jsonb` column — stores the evidence bundle passed to the scorer, enabling the UI to show which claims were checked |

### 5.4 Existing Columns — Status

| Column | Status | Rationale |
|--------|--------|-----------|
| `dam_documents.extractedMeta` | **Remains, becomes secondary** | Still populated by `triggerExtract`; chunks are derived from it. Preserved for backward compatibility and as a fallback. |
| `dam_documents.extractedText` | **Remains, becomes secondary** | Still populated; used as fallback when chunks are not yet available. Will gain a `tsvector` index. |
| `dam_documents.tags` | **Remains, becomes secondary** | Still populated by LLM; `normalizedTags` is the new retrieval backbone. |
| `document_shreds.xmlContent` | **Unchanged** | RFP XML compilation is unchanged. |
| `rfp_sessions.skillOutputs` | **Unchanged** | Sequential skill outputs are unchanged. |
| `rfp_sessions.extractedData` | **Unchanged** | `rfp_parser` structured output is unchanged. |

---

## Section 6 — Ingestion Plan by File Type

For each file type, the plan specifies the primary extraction method, fallback, structured output target, confidence/provenance capture, and deterministic rules applied before any LLM call.

### 6.1 DOCX / DOC

**Primary extraction:** `mammoth.extractRawText()` → plain text. This is deterministic and produces clean prose without formatting artifacts.  
**Fallback:** If `mammoth` throws or returns empty content, fall back to vision LLM with the file URL.  
**Structured output target:** For `resume` docType: `personnel_entry` chunks (one per role/position section) + `highlight` chunks (one per notable project). For `project_sheet` docType: `project_summary` chunk + `highlight` chunks. For `past_proposal` docType: `paragraph` chunks by section heading.  
**Confidence/provenance:** Deterministic extraction → `confidence: 1.0`, `extractionMethod: "deterministic"`. LLM-structured extraction → `confidence: 0.85`, `extractionMethod: "llm_structured"`.  
**Deterministic rules:** Section headers are identified by regex patterns (`/^[A-Z][A-Z\s]+:?$/m`, heading-level styles from mammoth's AST). Tables are extracted as `table_row` chunks with column headers as metadata. These rules run before any LLM call.

### 6.2 PDF — Text-Based

**Primary extraction:** `pdf-parse` → plain text. Deterministic.  
**Fallback:** If average chars/page < 50 after `pdf-parse`, reclassify as scanned (see 6.3).  
**Improvement over current:** Replace the global 50-char/page threshold with a **per-page analysis**: if more than 60% of pages are below 50 chars, classify as scanned; if 20–60% of pages are below 50 chars, classify as `mixed` and run both `pdf-parse` (for text pages) and vision LLM (for image pages), merging results.  
**Structured output target:** Same as DOCX by docType.  
**Confidence/provenance:** `confidence: 1.0`, `extractionMethod: "deterministic"` for text pages. `confidence: 0.80`, `extractionMethod: "llm_vision"` for image pages.  
**Deterministic rules:** Page boundaries are preserved as `pageRef`. Section headings identified by font-size heuristics from `pdf-parse` metadata where available.

### 6.3 PDF — Scanned / Image-Based

**Primary extraction:** Vision LLM via `invokeLLMWithSkill` with `skillType: "xml_shredder"` (configurable). The prompt instructs the model to transcribe all visible text, reproduce tables as markdown, and describe diagrams.  
**Fallback:** If vision LLM fails or returns empty content, store the raw file URL and set `processingStatus: "error"` with a descriptive message.  
**Structured output target:** `paragraph` chunks with `pageRef` set to the page number. Tables become `table_row` chunks.  
**Confidence/provenance:** `confidence: 0.75`, `extractionMethod: "llm_vision"`.  
**Deterministic rules:** None applicable before LLM (the document is an image). Post-LLM: apply the same section-heading regex to the transcribed text.

### 6.4 XLSX / XLS / CSV

**Primary extraction:** `xlsx` library → `sheet_to_json()` → typed row objects. Deterministic.  
**Fallback:** If `xlsx` throws, fall back to reading the file as raw text.  
**Structured output target:** Each data row becomes a `table_row` chunk. Column headers are stored in `metadata.headers`. Sheet name is stored in `sectionRef`.  
**Confidence/provenance:** `confidence: 1.0`, `extractionMethod: "deterministic"`.  
**Deterministic rules:** Numeric columns are type-checked and stored as numbers in `metadata`. Date columns are normalized to ISO 8601. Empty rows are skipped. Header rows are identified by position (first non-empty row).

### 6.5 TXT / XML

**Primary extraction:** Raw buffer → UTF-8 string. Deterministic.  
**Fallback:** None needed.  
**Structured output target:** For TXT: `paragraph` chunks split by double newline. For XML: preserved as a single `scope_item` chunk with the raw XML in `metadata.rawXml`.  
**Confidence/provenance:** `confidence: 1.0`, `extractionMethod: "deterministic"`.  
**Deterministic rules:** TXT paragraphs are split by double newline. XML is BOM-stripped and validated as well-formed before storage.

### 6.6 Images (PNG / JPG / WEBP / GIF / TIFF)

**Primary extraction:** Vision LLM via `invokeLLMWithSkill` with `skillType: "dam_image_caption"` (configurable).  
**Fallback:** If vision LLM fails, store the image URL and set `processingStatus: "error"`.  
**Structured output target:** A single `paragraph` chunk containing the image description. If the image contains a table, additional `table_row` chunks.  
**Confidence/provenance:** `confidence: 0.75`, `extractionMethod: "llm_vision"`.  
**Deterministic rules:** Image dimensions and format are recorded in `metadata` before LLM call. If the image is smaller than 50×50 pixels, skip LLM and store as `confidence: 0.0` with `extractionMethod: "skipped_too_small"`.

---

## Section 7 — Retrieval Plan

### 7.1 Hybrid Retrieval Strategy

The new asset matching replaces the single-pass tag-overlap query with a three-pass hybrid strategy. All three passes run in parallel (Promise.all); results are merged and ranked by a composite score.

**Pass 1 — Metadata filter (deterministic):** Filter `dam_documents` by `docType`, `processingStatus: "indexed"`, and `normalizedTags` overlap with the RFP's service lines. This pass uses the `normalizedTags` array column with a PostgreSQL `&&` (array overlap) operator, which is both deterministic and index-friendly. Returns documents with a base score of 1.0 per matching tag.

**Pass 2 — Full-text search (deterministic):** Run a PostgreSQL `to_tsquery` search against the `contentTsv` column of `document_chunks`, using the RFP's `scopeSummary` keywords and service line terms as the query. Returns chunks with a `ts_rank` score. Documents are scored by the sum of their top-3 chunk `ts_rank` scores.

**Pass 3 — Metadata enrichment scoring (deterministic):** For documents that pass Pass 1 or Pass 2, apply additional scoring rules:
- Client name match against RFP agency: +0.3
- Contract value within 50% of RFP estimated value: +0.2
- Award year within 5 years: +0.1
- `companyTag` matches the session's entity: +0.2

**Composite score:** `(tagOverlapScore × 0.4) + (fullTextScore × 0.4) + (metadataScore × 0.2)`. Documents are ranked by composite score descending. The top 10 are returned with their scores exposed to the UI.

**Fallback behavior:** If all three passes return zero results, fall back to the current behavior (all indexed documents of that type, ordered by `createdAt DESC`), but surface this as a `matchQuality: "fallback"` flag so the UI can warn the user.

### 7.2 Asset-Type-Specific Matching

**Project sheets:** Pass 1 uses `normalizedTags`. Pass 2 searches `project_summary` and `highlight` chunks. Pass 3 adds client name match and contract value proximity. The top 3 project sheets by composite score are pre-selected in the Launchpad UI.

**Resumes:** Pass 1 uses `normalizedTags`. Pass 2 searches `personnel_entry` chunks. Pass 3 adds certification match against RFP key personnel requirements (parsed from `extractedData.keyPersonnelRequirements`). The top 3 resumes by composite score are pre-selected.

**Past proposals:** Pass 1 uses `normalizedTags`. Pass 2 searches `paragraph` chunks from `past_proposal` docType. Pass 3 adds agency name match and award year recency. The top 2 past proposals by composite score are pre-selected.

### 7.3 Ranking Logic and Tie-Breaking

When composite scores are equal, tie-breaking order is: (1) most recent `awardYear`, (2) highest `contractValue`, (3) most recent `createdAt`. This ensures that more recent, higher-value experience is preferred when relevance is equal.

### 7.4 Search (Manual)

`searchForAssetMatching` is updated to search both `dam_documents` metadata columns (title, staffName, clientName) and `document_chunks.content` via full-text search. Results are ranked by `ts_rank` descending.

---

## Section 8 — Generation Plan

### 8.1 Evidence Bundles

Each generation skill receives a typed evidence bundle alongside its existing template variables. An evidence bundle is a structured object containing ranked chunks grouped by source type:

```typescript
interface EvidenceBundle {
  projectSheets: EvidenceItem[];     // From selected project sheet chunks
  resumes: EvidenceItem[];           // From selected resume chunks
  pastProposals: EvidenceItem[];     // From selected past proposal chunks
  rfpRequirements: EvidenceItem[];   // From RFP Wiki structured index
}

interface EvidenceItem {
  sourceDocId: string;
  sourceTitle: string;
  chunkType: string;
  content: string;
  pageRef: string | null;
  relevanceScore: number;
  confidence: number;
}
```

The bundle is assembled in `buildSkillVariables()` by querying `document_chunks` for the selected assets, ranking by composite score, and selecting the top N chunks per source type (configurable per skill, default 5).

### 8.2 Skill-Specific Evidence Consumption

**`win_themes`:** Receives `projectSheets` (top 5 highlights) and `pastProposals` (top 3 win theme chunks). The prompt instructs the model to ground each win theme in a specific named project or past proposal from the evidence bundle.

**`technical_writer`:** Receives `projectSheets` (top 5 project summaries + highlights) and `rfpRequirements` (evaluation criteria and scope items). The prompt instructs the model to address each evaluation criterion and cite at least one project from the evidence bundle per criterion.

**`key_personnel`:** Receives `resumes` (top 5 personnel entries, filtered by RFP key personnel requirements). The prompt instructs the model to match each RFP-required role to a specific named person from the evidence bundle, citing their certifications and relevant project experience.

**`past_performance`:** Receives `projectSheets` (top 5) and `pastProposals` (top 3 summaries). The prompt instructs the model to write each project entry using the specific facts from the evidence bundle (client name, contract value, scope description, measurable outcomes).

**`proposal_scorer`:** Receives the full evidence bundle used for generation, alongside the generated text. The prompt instructs the model to check each factual claim in the generated text against the evidence bundle and flag unsupported claims.

### 8.3 Provenance in Generated Output

The evidence bundle used for each skill run is stored in `rfp_sessions.evidenceBundles` (a JSONB column keyed by skill name). This enables the Proposal Workspace UI to display a "Sources" panel for each generated section, showing which documents contributed to the output. This is a UI enhancement that can be built in a later phase without changing the generation logic.

### 8.4 Reducing Unsupported Claims

Three mechanisms work together to reduce hallucination:

1. **Structured evidence bundles** replace narrative summaries. The model receives specific, attributed facts rather than a collapsed paragraph. This reduces the need for the model to "fill in" missing details.
2. **Prompt instructions** explicitly require citation. Each generation skill prompt includes an instruction such as: "Every project reference must use the exact project name, client name, and contract value from the provided evidence. Do not invent project details."
3. **Scorer evidence checking** (Section 9) flags unsupported claims post-generation, creating a feedback loop.

---

## Section 9 — Scoring Plan

### 9.1 Current Scorer Limitations

The current `proposal_scorer` receives four generated text blobs and the RFP evaluation criteria. It returns a scorecard with criterion scores, gaps, and improvements. It cannot distinguish a claim grounded in a specific project sheet from one that was invented, because it has no access to the source documents.

### 9.2 Redesigned Scorer Inputs

The scorer receives three inputs:

1. **Generated sections** — the full text of `technical_writer`, `key_personnel`, `past_performance`, and `win_themes` outputs (unchanged from current).
2. **RFP evaluation criteria** — from `extractedData.evaluationCriteria` (unchanged from current).
3. **Evidence bundle** — the same `EvidenceBundle` object used for generation, stored in `rfp_sessions.evidenceBundles`. This is the new addition.

### 9.3 Redesigned Scorer Outputs

The scorer's JSON schema is extended with two new fields:

| Field | Type | Description |
|-------|------|-------------|
| `evidenceCoverage` | object | Per-criterion: how many claims are supported by evidence vs. unsupported |
| `unsupportedClaims` | object[] | Each: `{ section, claim, reason }` — claims in the generated text that do not appear in the evidence bundle |

The existing fields (`overallScore`, `sectionScores`, `criteriaScores`, `topGaps`, `topImprovements`, `summary`) are preserved unchanged.

### 9.4 Scoring Logic

The scorer prompt instructs the model to:

1. For each evaluation criterion, assess whether the generated text addresses it (existing behavior).
2. For each factual claim in the generated text (project names, client names, contract values, personnel names, certifications), check whether the claim appears in the evidence bundle.
3. If a claim does not appear in the evidence bundle, add it to `unsupportedClaims` with the section name and a brief explanation.
4. Compute `evidenceCoverage` as the ratio of supported claims to total claims per criterion.
5. Apply a penalty to `criteriaScores` for criteria where `evidenceCoverage < 0.7` (configurable threshold).

### 9.5 Score Penalty Formula

`adjustedScore = rawScore × (0.7 + 0.3 × evidenceCoverage)`. This means a criterion with 100% evidence coverage receives the full raw score. A criterion with 0% evidence coverage receives 70% of the raw score. The 70/30 split is a starting point; it should be tuned based on observed scoring behavior.

### 9.6 UI Display

The `unsupportedClaims` array is surfaced in the Proposal Workspace section scorecard as an amber warning list: "The following claims could not be verified against your selected source documents." This gives the user actionable feedback to either correct the generated text or add supporting documents to the Knowledge Hub.

---

## Section 10 — Rollout Plan

The rollout is divided into five phases. Each phase is independently deployable and backward-compatible with the previous phase.

### Phase 1 — Schema and Normalization Foundation (Schema + Backend, ~3 days)

**What:** Add `document_chunks` table and `normalized_tags` table to `drizzle/schema.ts`. Add `normalizedTags`, `chunkCount`, and `chunkStatus` columns to `dam_documents`. Add `evidenceBundles` and `scorerEvidenceInput` columns to `rfp_sessions`. Run `pnpm db:push`. Add tag normalization utility function. Improve scanned PDF detection to per-page analysis.

**What does NOT change:** No existing queries, procedures, or UI are modified. The new tables are empty; existing documents continue to function as before.

**Acceptance criteria:** `pnpm db:push` succeeds with zero errors. TypeScript: zero errors. All existing tests pass.

### Phase 2 — Chunk Creation on triggerExtract (Backend, ~4 days)

**What:** Update `dam.triggerExtract` in `server/routers/dam.ts` to emit `document_chunks` rows after the LLM extraction completes. Chunks are derived from the `extractedMeta` JSON output (deterministic transformation). Add a `backfillChunks` admin procedure that re-processes all existing `indexed` documents to create chunks. Update `chunkStatus` on `dam_documents`.

**What does NOT change:** The `triggerExtract` LLM call itself is unchanged. `extractedMeta` and `extractedText` are still populated. No retrieval or generation changes yet.

**Acceptance criteria:** After `triggerExtract` runs on a test document, `document_chunks` contains rows with correct `chunkType`, `content`, `pageRef`, `confidence`, and `extractionMethod`. `chunkStatus` is set to `"chunked"`. TypeScript: zero errors.

### Phase 3 — Hybrid Retrieval (Backend, ~3 days)

> **Spec locked: July 5, 2026** — See PHASE3_READINESS_REVIEW.md for full analysis.
>
> **Fix 1 (approved):** Pass 1 uses `damDocuments.tags` (legacy comma-separated) until `normalizedTags`
> population and backfill are complete. Referred to as `legacyTagScore` in code comments.
>
> **Fix 2 (approved):** `contentTsv` approach replaced by GIN expression index on
> `to_tsvector('english', content)` directly on `document_chunks`. Migration 0018 applied.
> FTS queries use inline `to_tsvector` / `ts_rank` — no separate column needed.
>
> **Fix 3 (approved):** `ChunkType` enum in `shared/types.ts` aligned to `chunkBuilder.ts` outputs:
> `project_description`, `project_highlight`, `section_content`, `image_caption`,
> `personnel_bio`, `project_experience`, `win_theme`, `certification_detail`.
>
> **Rec 4 (locked):** `matchQuality` thresholds:
> - `hybrid` when `ftScore > 0.1`
> - `tag-only` when `legacyTagScore > 0` and `ftScore ≤ 0.1`
> - `fallback` when both are 0
>
> **Rec 5 (locked):** Response includes `corpusSize`; UI suppresses `compositeScore` badges
> when `corpusSize < 8` (small corpus rankings are not meaningful).

**What:** Update `matchProjectSheets`, `matchResumes`, `matchPastProposals`, and `searchForAssetMatching` in `server/routers/dam.ts` to use the three-pass hybrid strategy described in Section 7. Add composite score to results. Update `AssetMatchingPanel.tsx` to display relevance scores and remove the fallback warning (replace with `matchQuality` badge).

**What does NOT change:** Generation and scoring are unchanged. The workflow continues to use the same asset selection mechanism.

**Acceptance criteria:** Asset matching returns results ranked by composite score. `matchQuality` field is present on all results. Fallback behavior still works when no chunks exist. TypeScript: zero errors. Existing tests pass.

### Phase 4 — Evidence Bundles for Generation (Backend + Prompts, ~4 days)

**What:** Update `buildSkillVariables()` in `server/routers/rfpSessions.ts` to assemble `EvidenceBundle` objects from `document_chunks` for the selected assets. Update the variable maps for `win_themes`, `technical_writer`, `key_personnel`, and `past_performance` to include evidence bundle items as structured template variables. Store the assembled bundle in `rfp_sessions.evidenceBundles`. Update skill prompts (via `ai_skills` table, not hardcoded) to instruct citation.

**What does NOT change:** The sequential workflow, skill chain, and output storage are unchanged. The scorer is unchanged in this phase.

**Acceptance criteria:** `buildSkillVariables` returns evidence bundle items as named variables. Skill outputs reference specific project names and personnel from the evidence bundle. `rfp_sessions.evidenceBundles` is populated after each skill run. TypeScript: zero errors.

### Phase 5 — Evidence-Aware Scoring (Backend + Prompts + UI, ~3 days)

**What:** Update `proposal_scorer` inputs in `buildSkillVariables()` to include the evidence bundle. Extend the scorer's JSON schema in `shared/workflowTypes.ts` to include `evidenceCoverage` and `unsupportedClaims`. Update the `SkillOutputRenderer` for `proposal_scorer` to display unsupported claims as an amber warning list. Update `rfp_sessions.scorerEvidenceInput`.

**What does NOT change:** The `overallScore` and existing scorecard fields are preserved. The `liveScore` column continues to reflect `overallScore`.

**Acceptance criteria:** Scorer output includes `evidenceCoverage` and `unsupportedClaims`. UI displays unsupported claims list. `liveScore` is unchanged. TypeScript: zero errors. All tests pass.

---

## Section 11 — Validation Plan

### 11.1 Automated Tests

| Test | Type | Acceptance Criterion |
|------|------|---------------------|
| `document_chunks` row creation after `triggerExtract` | Vitest unit | At least 3 chunks created per indexed document; `chunkStatus: "chunked"` |
| Tag normalization utility | Vitest unit | 15 known aliases map to correct canonical tags |
| Hybrid retrieval composite score calculation | Vitest unit | Score formula produces expected values for known inputs |
| Evidence bundle assembly | Vitest unit | Bundle contains correct chunk types for each skill |
| Scorer extended schema parsing | Vitest unit | `evidenceCoverage` and `unsupportedClaims` parse correctly |
| Backward compatibility — existing workflow without chunks | Vitest integration | Workflow completes successfully when `document_chunks` is empty (falls back to current behavior) |

### 11.2 Manual Checks

**Retrieval precision check:** Upload 10 project sheets with known service lines. Run asset matching for an RFP with matching service lines. Verify that the top 3 results are the most relevant documents, not the most recent ones.

**Evidence grounding check:** Run a full proposal generation with 3 project sheets selected. Verify that the generated `technical_writer` output references specific project names and client names from the selected project sheets, not invented ones.

**Scorer evidence check:** Manually introduce a hallucinated project name into the `technical_writer` output. Verify that the scorer flags it in `unsupportedClaims`.

**Backward compatibility check:** Run the full workflow on a session where no chunks exist for the selected assets. Verify that the workflow completes without errors and falls back to the current narrative summary behavior.

### 11.3 Regression Checks

- All 25+ existing Vitest tests must pass after each phase.
- TypeScript must report zero errors after each phase.
- The Proposal Launchpad upload → Go/No-Go → Asset Matching → Workspace flow must complete end-to-end after each phase.
- The `liveScore` value must be present and non-zero after `proposal_scorer` runs.

### 11.4 Acceptance Criteria Summary

The upgrade is considered successful when:
1. Asset matching returns results ranked by composite score (not by date) for at least 80% of test RFPs.
2. Generated `technical_writer` sections reference specific named projects from the evidence bundle in at least 90% of test runs.
3. The scorer identifies at least one unsupported claim in a deliberately hallucinated test section.
4. All existing tests pass.
5. TypeScript: zero errors.
6. The full proposal workflow completes in under 3 minutes (no regression in latency).

---

## Section 12 — File-by-File Implementation Map

This section names every file that will change and explains the intended modification before any editing begins.

| File | Phase | Intended Modification |
|------|-------|-----------------------|
| `drizzle/schema.ts` | 1 | Add `documentChunks` table (10 columns as specified in Section 5.1). Add `normalizedTags` table. Add `normalizedTags`, `chunkCount`, `chunkStatus` columns to `damDocuments`. Add `evidenceBundles`, `scorerEvidenceInput` columns to `rfpSessions`. |
| `server/routers/dam.ts` | 1, 2, 3 | Phase 1: add `normalizeTagString()` utility. Phase 2: add chunk creation logic after `triggerExtract` LLM call; add `backfillChunks` admin procedure. Phase 3: replace `matchProjectSheets`, `matchResumes`, `matchPastProposals`, `searchForAssetMatching` with hybrid three-pass queries. |
| `server/rfpExtractor.ts` | 1 | Replace global 50-char/page scanned PDF threshold with per-page analysis. Add `mixed` classification for partially scanned PDFs. |
| `server/routers/rfpSessions.ts` | 4, 5 | Phase 4: update `buildSkillVariables()` to assemble `EvidenceBundle` from `document_chunks`; update variable maps for `win_themes`, `technical_writer`, `key_personnel`, `past_performance`; store bundle in `evidenceBundles`. Phase 5: update `proposal_scorer` variables to include evidence bundle; store scorer input in `scorerEvidenceInput`. |
| `shared/workflowTypes.ts` | 4, 5 | Phase 4: add `EvidenceBundle` and `EvidenceItem` types. Phase 5: extend `ProposalScorerOutput` with `evidenceCoverage` and `unsupportedClaims` fields. |
| `shared/types.ts` | 1 | Add `NormalizedTag` type and `ChunkType` enum. |
| `client/src/components/AssetMatchingPanel.tsx` | 3 | Display composite relevance score badge next to each asset. Replace fallback warning with `matchQuality` badge. |
| `client/src/components/SkillOutputRenderer.tsx` | 5 | Add `unsupportedClaims` amber warning list to `proposal_scorer` renderer. |
| `server/routers/dam.ts` (test file) | 2, 3 | Add Vitest tests for chunk creation and hybrid retrieval. |
| `server/routers/rfpSessions.ts` (test file) | 4, 5 | Add Vitest tests for evidence bundle assembly and scorer extended schema. |

**Files that will NOT change:**

| File | Reason |
|------|--------|
| `server/_core/llmSkill.ts` | LLM invocation layer is unchanged; evidence bundles are assembled before the call, not inside it |
| `server/routers/xmlShredder.ts` | RFP XML compilation is unchanged |
| `server/routers/rfpWiki.ts` | RFP Wiki extraction is unchanged; its structured index is consumed via `rfpWikiContent` as before |
| `server/routers/rfpConflicts.ts` | Conflict detection is unchanged |
| `server/routers/pursuits.ts` | Asset selection persistence is unchanged |
| `client/src/pages/ProposalLaunchpad.tsx` | Upload and processing flow is unchanged; only the asset matching panel changes |
| `client/src/pages/ProposalWorkspace.tsx` | Workflow orchestration is unchanged; only the scorer renderer changes |
| `drizzle/relations.ts` | New table relations will be added, but existing relations are unchanged |

---

## Pre-Implementation Reasoning Check

Before any code is written, the following questions are explicitly answered:

**What becomes more deterministic?**  
Tag normalization replaces free-form LLM-generated strings with a controlled vocabulary. Chunk creation is a deterministic transformation of the LLM's structured JSON output. Retrieval uses SQL operators (array overlap, `ts_rank`) rather than LLM inference. Evidence bundle assembly uses deterministic ranking rules.

**What becomes more explainable?**  
Every retrieved asset carries a composite score with component breakdown. Every evidence item in a bundle carries `sourceDocId`, `pageRef`, and `confidence`. The scorer's `unsupportedClaims` output names specific claims and their source. The `evidenceBundles` column stores the full provenance chain for each skill run.

**What becomes easier to test?**  
Chunk creation is a pure function of `extractedMeta` JSON — unit-testable. Tag normalization is a pure function — unit-testable. Composite score calculation is a pure function — unit-testable. Evidence bundle assembly is a pure function of chunk query results — unit-testable.

**What existing behavior could break?**  
The main risk is the `buildSkillVariables()` refactor in Phase 4. If evidence bundles are empty (because no chunks exist for selected assets), the generation skills must fall back to the current narrative summary behavior. This fallback must be explicitly implemented and tested. The scorer schema extension in Phase 5 must be backward-compatible — the existing `overallScore` and `liveScore` must be unaffected.

**How is rollback handled?**  
Each phase is independently deployable. Phase 1 (schema) adds new tables and columns; rollback means dropping them (safe, no data loss). Phase 2 (chunk creation) adds new rows to a new table; rollback means stopping chunk creation and ignoring the table. Phase 3 (retrieval) replaces query logic; rollback means reverting the three matching procedures. Phases 4 and 5 update `buildSkillVariables` and the scorer; rollback means reverting those functions. No existing data is modified or deleted in any phase.

---

*This document is a planning artifact. No code changes have been made. Implementation begins only after this plan is reviewed and approved.*
