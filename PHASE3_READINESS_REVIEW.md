# Phase 3 Readiness Review
**Amplify-Proposals Pipeline Upgrade — Hybrid Retrieval Backend + Asset Matching UI**
*Prepared: July 5, 2026 | Reviewer: Manus AI*

---

## 1. Phase Status Summary (Phases 1–2)

### Phase 1 — Schema and Normalization Foundation ✅ Complete

Phase 1 delivered all planned schema additions with zero regressions. The `document_chunks` table exists with 11 columns including `chunkType`, `content`, `pageRef`, `sectionRef`, `confidence`, `extractionMethod`, `metadata`, `serviceLineTags`, and `createdAt`. The `normalized_tags` table exists with canonical/displayName/aliases columns. The `damDocuments` table has the three new columns: `normalizedTags` (JSONB string[]), `chunkCount` (int, default 0), and `chunkStatus` (text, default `'pending'`). The `rfpSessions` table has `evidenceBundles` and `scorerEvidenceInput` (both JSONB). Shared types `ChunkType`, `ExtractionMethod`, `ChunkStatus`, and `PdfScanClassification` are defined in `shared/types.ts`. `EvidenceItem`, `EvidenceBundle`, `EvidenceBundleMap`, and `CriterionEvidenceCoverage` are defined in `shared/workflowTypes.ts`. The scanned PDF heuristic in `rfpExtractor.ts` now performs per-page analysis and returns a three-way `PdfScanClassification` (`text` | `scanned` | `mixed`).

**Open risks from Phase 1 that affect Phase 3:**

**Risk 1.1 — `normalizedTags` is never populated.** The `normalizedTags` column on `damDocuments` exists in the schema but no code path in `triggerExtract`, `chunkBuilder.ts`, or any other procedure writes to it. The Phase 3 composite scoring formula assigns 40% weight to `tagScore`, which the plan defines as overlap between `normalizedTags` and the RFP's service lines. If `normalizedTags` is universally empty, `tagScore` will always be 0 for every document, and the formula degrades to `(ftScore × 0.4) + (metaScore × 0.2)` with 40% of the score simply absent. The existing `tags` column (comma-separated legacy string) is what the current retrieval procedures actually use. Phase 3 must either populate `normalizedTags` during chunk creation or substitute `tags` for the tag-overlap pass.

**Risk 1.2 — No full-text search index exists.** There is no `tsvector` column on `document_chunks`, no GIN index, and no `to_tsvector` trigger. The plan assumes `ts_rank` and `plainto_tsquery` against a pre-indexed column. Without the index, every FTS query will be a full sequential scan of `document_chunks`, which is acceptable at small corpus sizes but will degrade noticeably at 500+ chunks. This is a schema gap that must be addressed in Phase 3 before the FTS pass can be used in production.

**Risk 1.3 — `chunkType` values in `document_chunks` do not match the values in `shared/types.ts`.** The `ChunkType` enum in `shared/types.ts` includes `paragraph`, `table_row`, `list_item`, `highlight`, `personnel_entry`, `project_summary`, `certification`, `evaluation_criterion`, `scope_item`, `key_date`, `page_limit`, and `win_theme`. The `chunkBuilder.ts` implementation produces `project_description`, `project_highlight`, `section_content`, `image_caption`, `personnel_bio`, `project_experience`, and `win_theme`. These two sets overlap only on `win_theme`. The chunk-type weight table in the locked Phase 3 spec references `project_description`, `personnel_bio`, `win_theme`, `section_content`, `project_highlight`, and `image_caption` — which matches `chunkBuilder.ts` but not `shared/types.ts`. The `shared/types.ts` enum is stale from the original plan and does not reflect what Phase 2 actually built. This is a doc–code mismatch that must be corrected before Phase 3 tests can assert on chunk types.

---

### Phase 2 — Chunk Creation on `triggerExtract` + Backfill ✅ Complete

Phase 2 delivered `server/chunkBuilder.ts` as a pure function implementing the locked `docType → ChunkType` mapping. Chunk creation is wired into all three `triggerExtract` paths (Path 0: image caption, Path A: xml_shredder, Path B: llm_single_pass) with fail-safe semantics — a chunk error sets `chunkStatus = 'error'` but does not throw or affect `processingStatus`. The `backfillChunks` admin procedure exists with role gating, per-document error isolation, and a structured return. Thirty unit tests cover all docTypes, idempotency, the 80-character threshold, blank-skip, and exempt short chunks.

**Open risks from Phase 2 that affect Phase 3:**

**Risk 2.1 — `serviceLineTags` on chunks is always `[]`.** In `chunkBuilder.ts`, every `makeChunk()` call passes `serviceLineTags: tags` where `tags` is derived from `doc.tags?.split(",").map(t => t.trim()).filter(Boolean) ?? []`. This uses the legacy comma-separated `tags` string, not the `normalizedTags` array. The values stored in `serviceLineTags` are therefore raw legacy tag strings (e.g., `"Traffic Engineering"`, `"Bridge Design"`) rather than canonical identifiers (e.g., `"traffic_engineering"`). The Phase 3 FTS pass that filters by `serviceLineTags` will be matching against these raw strings. This is internally consistent but means the `normalized_tags` table is entirely unused in both Phase 2 and Phase 3.

**Risk 2.2 — Existing documents have `chunkStatus = 'pending'` and zero chunks.** All documents uploaded before Phase 2 went live have `chunkStatus = 'pending'` and `chunkCount = 0`. The `backfillChunks` procedure exists but has not been run. Phase 3 retrieval will encounter a corpus where most documents have no chunks, and the FTS pass will return nothing for them. The fallback behavior in this scenario is critical to define precisely.

**Risk 2.3 — `chunkBuilder.ts` does not handle the `xml_shredder` output shape.** Path A (xml_shredder) calls `buildChunksFromDocument(doc, xmlMeta)` where `xmlMeta` is the parsed XML output from the `xml_shredder` skill. The `chunkBuilder.ts` function dispatches on `doc.docType`. For `rfp` and `contract` docTypes, it returns `[]` by design. However, the xml_shredder path in `triggerExtract` is used for RFP documents — meaning Path A always produces zero chunks. This is correct by design (RFPs are not chunked) but means Path A's chunk wiring is effectively a no-op. This is not a bug, but it means the only documents that actually produce chunks today are those processed via Path B (llm_single_pass: project_sheet, resume, past_proposal, boilerplate, certification, other) and Path 0 (image). This is important context for Phase 3 fallback behavior.

---

## 2. Phase 3 Design Review

### 2.1 Backend — Hybrid Retrieval in `dam.ts`

The three-pass strategy (normalized tag filter → full-text chunk search → metadata enrichment scoring) is architecturally sound for this codebase. The Drizzle + postgres-js stack supports raw SQL via the `sql` template tag, which is how the existing tag-overlap queries are already written. The composite scoring formula is deterministic and testable. The following analysis addresses each component in turn.

**Pass 1 — Tag overlap.** The current `matchProjectSheets`, `matchResumes`, and `matchPastProposals` procedures use `LOWER(tags) LIKE LOWER('%service_line%')` against the legacy `tags` column. The plan proposes replacing this with an overlap check against `normalizedTags`. As noted in Risk 1.1, `normalizedTags` is never populated. The pragmatic resolution is to keep Pass 1 operating against the legacy `tags` column for Phase 3, and defer `normalizedTags` population to a future normalization pass. This means `tagScore` in the composite formula should be renamed `legacyTagScore` in the implementation comments to avoid confusion, and the formula should document that it uses the legacy tags column until the normalization utility is built.

**Pass 2 — Full-text chunk search.** The plan calls for `ts_rank` against a `tsvector` column on `document_chunks`. As noted in Risk 1.2, no such column or index exists. Phase 3 must add a `contentTsv` tsvector column (generated, stored) and a GIN index as a schema migration before the FTS pass can be used. The alternative — using `ILIKE '%query%'` against the `content` column — avoids the schema migration but is a sequential scan and does not produce a rank score. For a corpus of under 1,000 chunks, `ILIKE` is acceptable as a Phase 3 interim implementation, with the tsvector migration deferred to a follow-up. The implementation must be explicit about which approach is used and must not silently degrade to `ILIKE` without documenting it.

**Pass 3 — Metadata enrichment scoring.** The `metaScore` component (0.2 weight) based on `contractValue`, `awardYear`, and `companyTag` is straightforward to implement as a JavaScript-side scoring step after the SQL query returns results. This does not require any SQL changes and is the lowest-risk component of Phase 3.

**Composite score formula.** The formula `(tagScore × 0.4) + (ftScore × 0.4) + (metaScore × 0.2)` is deterministic and testable. The weights are reasonable. The chunk-type weights applied to `ts_rank` before summing into `ftScore` are well-specified. One concern: the formula normalizes `ftScore` to [0, 1] by taking the top-3 chunks and dividing by the maximum possible `ts_rank` value. The maximum `ts_rank` value in PostgreSQL is not a fixed constant — it depends on the query and document frequency. The normalization should use the observed maximum across all documents in the result set, not a hardcoded constant.

**`matchQuality` thresholds.** The plan proposes three tiers: `hybrid` (green), `tag-only` (yellow), `fallback` (amber). The thresholds for these tiers are not specified in the plan. A concrete proposal: `hybrid` when `ftScore > 0` (at least one chunk matched), `tag-only` when `tagScore > 0` and `ftScore === 0` (tag matched but no chunks), `fallback` when both are 0 (showing all documents). These thresholds must be locked before implementation to ensure the tests assert on the correct values.

**Behavior when `document_chunks` is partially populated.** This is the most important behavioral question for Phase 3. The correct behavior is: if a document has `chunkStatus = 'pending'` or `chunkStatus = 'error'`, it participates in Pass 1 (tag overlap) and Pass 3 (metadata enrichment) but contributes `ftScore = 0` in Pass 2. It should not be excluded from results — it should be ranked lower than documents with chunks. The `matchQuality` for such a document should be `tag-only` if it matched on tags, or `fallback` if it appeared only because no other documents matched.

### 2.2 Frontend — `AssetMatchingPanel.tsx`

The current `AssetMatchingPanel.tsx` is 600 lines and already has a clear three-section layout (Project Sheets, Staff, Past Proposals) with a `FallbackBanner` component that renders an amber warning when `isFallback: true`. The Phase 3 UI changes must preserve this fallback signal while adding the new `compositeScore` badge and `topChunks` preview.

**The `isFallback` → `matchQuality` migration.** The current `FallbackBanner` is rendered conditionally on `projectsFallback`, `resumesFallback`, and `proposalsFallback`. Phase 3 replaces `isFallback: boolean` with `matchQuality: 'hybrid' | 'tag-only' | 'fallback'` in the server response. The frontend must map this correctly: `fallback` renders the amber banner (same as today), `tag-only` renders a yellow informational note ("Matched by service line tags — no content-level match found"), and `hybrid` renders a green indicator or no banner at all. The key constraint is that the `fallback` amber banner must not be removed or weakened — users currently rely on it to know when to be more selective.

**`compositeScore` badge placement.** The current asset card layout for project sheets shows: title, client/owner/value metadata row, tag list. Adding a `compositeScore` badge (e.g., "87% match") to the top-right of each card is straightforward and does not require layout restructuring. The badge should only appear when `compositeScore > 0` — documents in fallback mode with no tag or chunk match should show no score badge rather than "0% match," which would be confusing.

**`topChunks` expandable preview.** The plan calls for an expandable "Why this matched" section under each card showing up to 3 chunk previews. This is the highest-risk UI change because it adds significant vertical height to each card in the 280px-max-height scrollable list. If every card expands, the list becomes unusable. The implementation must default to collapsed and use a `ChevronDown` toggle. The toggle state should be per-card, not global.

**Auto-selection behavior.** The current `useEffect` pre-checks the first 3 project sheets and first 1 past proposal on data load. Phase 3 must preserve this behavior. If the results are now sorted by `compositeScore` descending, the auto-selection will pre-check the highest-scoring documents, which is the correct behavior.

---

## 3. Concrete Risks and Edge Cases

**Risk 3.1 — `normalizedTags` is empty for all documents, silently zeroing 40% of the composite score.** As detailed in Risk 1.1, the `normalizedTags` column is never written. If Phase 3 implements `tagScore` against `normalizedTags`, every document will score 0 on the tag component. The formula will produce misleadingly low scores and the `matchQuality` logic will never reach `hybrid` via the tag path. **Mitigation:** Use the legacy `tags` column for Pass 1 in Phase 3, document this clearly, and add a `normalizedTagsPopulated` flag to the response so the UI can show a "tags not yet normalized" notice.

**Risk 3.2 — No tsvector index means FTS is a sequential scan.** Without a GIN index on a `tsvector` column, `ts_rank` requires scanning every row in `document_chunks` for every query. At 100 documents × 10 chunks each = 1,000 rows, this is fast. At 500 documents × 15 chunks = 7,500 rows, it is still acceptable. At 2,000 documents × 15 chunks = 30,000 rows, it will be noticeably slow (500ms+). **Mitigation:** Either add the `contentTsv` generated column and GIN index as part of Phase 3 (requires a schema migration and `db:push`), or use `ILIKE` for Phase 3 with a clear comment that it must be replaced before the corpus exceeds 500 documents.

**Risk 3.3 — Small corpus produces identical scores, making ranking meaningless.** When a firm has only 5 project sheets, all 5 will likely match on tags, and the `ftScore` differences between them will be small. The composite score will cluster between 0.4 and 0.6, and the ranking will appear arbitrary to the user. **Mitigation:** When the corpus is small (fewer than 10 documents of a given type), suppress the `compositeScore` badge and show all documents without ranking. Add a `corpusSize` field to the response so the UI can make this decision.

**Risk 3.4 — `searchForAssetMatching` and `match*` procedures return different shapes, causing type errors in `AssetMatchingPanel.tsx`.** The current `AssetMatchingPanel.tsx` merges `matchProjectSheets` results with `searchForAssetMatching` results using a `useMemo` deduplication map. If `matchProjectSheets` now returns `{ compositeScore, topChunks, matchQuality, ... }` but `searchForAssetMatching` still returns the old shape, the merged list will have inconsistent types. The `compositeScore` badge will fail to render for search results. **Mitigation:** Update `searchForAssetMatching` to also return `compositeScore` and `topChunks` (can be 0 and [] respectively for metadata-only search results), or add a type guard in the merge logic.

**Risk 3.5 — `matchQuality` threshold ambiguity at the document level vs. the section level.** The current UI shows one `isFallback` banner per section (Project Sheets, Staff, Past Proposals). Phase 3 proposes per-document `matchQuality`. If some documents in a section are `hybrid` and others are `fallback`, what does the section-level banner show? The plan does not address this. **Mitigation:** Keep the section-level banner as the worst-case `matchQuality` across all documents in the section (if any document is `fallback`, show the amber banner). Add per-document badges only as supplementary information, not as a replacement for the section-level signal.

**Risk 3.6 — `topChunks` content preview exposes raw extracted text that may be poorly formatted.** The `section_content` chunks from `chunkBuilder.ts` are raw text from `extractedMeta.sections[].content`, which may contain markdown headers, bullet characters, or line breaks. Displaying 200 characters of this in a card preview may look broken. **Mitigation:** Strip markdown formatting and normalize whitespace in the `topChunks` preview before returning from the server. A simple regex `content.replace(/[#*_`\n\r]+/g, ' ').trim().slice(0, 200)` is sufficient.

---

## 4. Doc–Code Mismatches

| Document | Claim | Actual Code State |
|---|---|---|
| `PIPELINE_UPGRADE_PLAN.md` Phase 3 | "Tag score uses `normalizedTags` array" | `normalizedTags` is never written; legacy `tags` column is the only populated tag source |
| `PIPELINE_UPGRADE_PLAN.md` Phase 3 | "FTS uses `ts_rank` against `tsvector` column" | No `tsvector` column or GIN index exists on `document_chunks` |
| `shared/types.ts` `ChunkType` enum | Lists `paragraph`, `table_row`, `list_item`, `highlight`, `personnel_entry`, `project_summary`, `certification`, `evaluation_criterion`, `scope_item`, `key_date`, `page_limit`, `win_theme` | `chunkBuilder.ts` produces `project_description`, `project_highlight`, `section_content`, `image_caption`, `personnel_bio`, `project_experience`, `win_theme` — only `win_theme` overlaps |
| `PIPELINE_UPGRADE_PLAN.md` Phase 3 | "Three-pass: normalized tags → FTS → metadata" | Pass 1 must use legacy tags; Pass 2 requires schema addition; Pass 3 is JS-side and ready |
| `ARCHITECTURE.md` | "document_chunks has tsvector column" | No such column in the actual schema |

---

## 5. Test Coverage Gaps

The following tests do not yet exist and would make Phase 3 fragile without them:

**Test 5.1 — Composite score formula unit test.** A pure function test that asserts `compositeScore(tagScore=0.8, ftScore=0.6, metaScore=0.5) === (0.8×0.4) + (0.6×0.4) + (0.5×0.2) = 0.66`. This must exist before any UI renders the score.

**Test 5.2 — Chunk-type weight application test.** A test that asserts `image_caption` chunks receive weight 0.5 and `project_description` chunks receive weight 1.0 when computing `ftScore`.

**Test 5.3 — `matchQuality` threshold test.** Tests for all three tiers: `hybrid` when `ftScore > 0`, `tag-only` when `tagScore > 0` and `ftScore === 0`, `fallback` when both are 0.

**Test 5.4 — Fallback behavior when `document_chunks` is empty.** A test that asserts the procedure returns all indexed documents of the correct type when no chunks exist, with `matchQuality = 'fallback'` for all results.

**Test 5.5 — Mixed corpus test.** A test where some documents have chunks and others do not. Asserts that documents with chunks rank higher than documents without, and that documents without chunks still appear in results (not silently excluded).

**Test 5.6 — `searchForAssetMatching` shape compatibility test.** A test that asserts the search results can be merged with `matchProjectSheets` results without type errors (i.e., both have the same required fields, even if `compositeScore = 0` for search results).

---

## 6. Recommendation

**Phase 3 is not ready to implement as written.** The plan contains two structural gaps that would produce a broken or misleading implementation if not addressed first. The recommended minimum adjustments before approval are as follows.

**Adjustment 1 (Required) — Resolve the `normalizedTags` gap.** Either: (a) populate `normalizedTags` during chunk creation in `chunkBuilder.ts` by normalizing the legacy `tags` string, or (b) explicitly change the Phase 3 spec to use the legacy `tags` column for Pass 1 and rename `tagScore` to `legacyTagScore` in the implementation. Option (b) is lower risk and can be done in 30 minutes. Option (a) requires defining a normalization function and is better deferred to a dedicated normalization phase.

**Adjustment 2 (Required) — Decide on FTS implementation approach.** Either: (a) add a `contentTsv` generated tsvector column and GIN index as part of Phase 3 (one `db:push`, adds ~2 hours of work), or (b) use `ILIKE` for Phase 3 with a documented comment that it must be replaced before the corpus exceeds 500 documents. Option (b) is acceptable for Phase 3 given the current corpus size. The choice must be explicit in the spec before coding begins.

**Adjustment 3 (Required) — Fix `shared/types.ts` `ChunkType` enum.** Update the enum to match what `chunkBuilder.ts` actually produces. This is a 5-minute fix but must happen before Phase 3 tests can assert on chunk types without type errors.

**Adjustment 4 (Recommended) — Lock `matchQuality` thresholds.** Define the exact numeric thresholds for `hybrid`, `tag-only`, and `fallback` in the spec. Recommended: `hybrid` when `ftScore > 0.1`, `tag-only` when `tagScore > 0` and `ftScore ≤ 0.1`, `fallback` when `tagScore === 0` and `ftScore === 0`.

**Adjustment 5 (Recommended) — Add `corpusSize` to response.** Return the total count of indexed documents of each type so the UI can suppress `compositeScore` badges when the corpus is too small to produce meaningful rankings (suggested threshold: fewer than 8 documents).

With these five adjustments incorporated into the Phase 3 spec, the implementation is ready to proceed. Adjustments 1–3 are required; Adjustments 4–5 are strongly recommended to avoid UX regressions. The total additional specification work is approximately 2–3 hours before coding begins.
