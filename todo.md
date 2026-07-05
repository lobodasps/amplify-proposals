# Amplify-Proposals — Active TODO

Last updated: 2026-07-05
Current version: v4.21 (post AI Skills Configuration Overhaul)

---

## 🔴 In Progress / Immediate

- [ ] Reassign 7 `manus_builtin` skills to real provider keys in Settings → AI Skills (executive_summary_writer, firm_qualifications_writer, key_personnel_writer, project_experience_writer, requirements_matrix_builder, technical_approach_writer, win_theme_generator)

---

## 🟡 Next Up

### Pipeline Upgrade — Phase 1: Schema and Normalization Foundation — COMPLETE
- [x] Add `document_chunks` table to `drizzle/schema.ts` (id, damDocumentId, chunkType, content, pageRef, sectionRef, confidence, extractionMethod, metadata, serviceLineTags, createdAt)
- [x] Add `normalized_tags` table to `drizzle/schema.ts` (id, canonical, displayName, aliases)
- [x] Add `normalizedTags` (text[]), `chunkCount` (int), `chunkStatus` (enum) columns to `damDocuments`
- [x] Add `evidenceBundles` (jsonb), `scorerEvidenceInput` (jsonb) columns to `rfpSessions`
- [x] Add `ChunkType`, `ExtractionMethod`, `ChunkStatus`, `PdfScanClassification` types to `shared/types.ts`
- [x] Add `EvidenceItem`, `EvidenceBundle`, `EvidenceBundleMap`, `CriterionEvidenceCoverage` interfaces to `shared/workflowTypes.ts`
- [x] Improve scanned PDF detection in `server/rfpExtractor.ts`: per-page analysis, `mixed` classification, combined pdf_parse+vision_llm path
- [x] Run `pnpm db:push` — migration 0017 applied successfully
- [x] TypeScript: zero errors
- [x] 24/25 tests pass (1 pre-existing OpenAI 429 rate limit failure, unrelated)
- [x] Checkpoint saved — stopped for review before Phase 2

### Pipeline Upgrade — Phase 2: Chunk Creation in triggerExtract + Backfill — COMPLETE
- [x] Write `server/chunkBuilder.ts` — pure function `buildChunksFromDocument(doc, extractedMeta)` implementing locked docType→ChunkType mapping
- [x] Wire chunk creation into `triggerExtract` Path 0 (image), Path A (xml_shredder), Path B (llm_single_pass): delete-then-insert, set chunkStatus/chunkCount, fail-safe (chunk error must not break extraction success)
- [x] Add `backfillChunks` admin procedure to `dam.ts`: batch process all documents with `chunkStatus = 'pending'`, per-document error isolation, progress logging
- [x] Write `server/chunkBuilder.test.ts` unit tests: 30 tests covering all docTypes, idempotency, 80-char threshold, blank-skip, exempt short chunks
- [x] TypeScript: zero errors; 54/55 tests pass (1 pre-existing OpenAI 429 rate limit failure)
- [x] Checkpoint saved — stopped for review before Phase 3

### Pipeline Upgrade — Phase 3: Hybrid Retrieval Backend + Asset Matching UI — COMPLETE
- [x] Fix `ChunkType` enum in `shared/types.ts` to match `chunkBuilder.ts` actual outputs
- [x] Add GIN expression index on `to_tsvector('english', content)` to `document_chunks` in schema
- [x] Run `pnpm db:push` — migration applied, 2 indexes on document_chunks
- [x] Update `PIPELINE_UPGRADE_PLAN.md` with locked spec decisions (Fix 1/2/3 + Rec 4/5)
- [x] Write `server/hybridRetrieval.ts` — CHUNK_TYPE_WEIGHTS, computeCompositeScore, classifyMatchQuality, fetchFtsScores, CORPUS_SIZE_THRESHOLD
- [x] Replace `matchProjectSheets` with hybrid three-pass version (legacyTagScore + ftScore + metaScore)
- [x] Replace `matchResumes` with hybrid three-pass version
- [x] Replace `matchPastProposals` with hybrid three-pass version
- [x] Update `searchForAssetMatching` to return compatible shape (compositeScore, topChunks, matchQuality)
- [x] Rewrite `AssetMatchingPanel.tsx`: compositeScore badge, matchQuality banner (hybrid/tag-only/fallback), topChunks expandable preview, corpusSize suppression (<8 docs), isFallback removed
- [x] Write 31 Vitest tests in `server/hybridRetrieval.test.ts` covering all 6 required groups
- [x] TypeScript: zero errors; 85/86 tests pass (1 pre-existing OpenAI 429 rate limit failure)
- [x] Checkpoint saved — stopped for review before Phase 4

- [ ] Step 4 Phase B — Citation-backed proposal generation (inject specific project sheet excerpts, resume passages, and past proposal language as cited evidence into each section)
- [ ] Section Scorecard — full scorer output display (criteria coverage %, gap list, improvement suggestions, win theme coverage)
- [ ] RequirementsMatrixViewer renderer — table with requirementId, requirement text, proposalSection, status badge (for requirements_matrix_builder skill)
- [ ] ConflictDetectorViewer renderer — conflict cards with severity badges, affected sections, resolution recommendations (for conflict_detector skill)

---

## 🟠 Known Issues

- [ ] Some proposal sections may still render as raw JSON if the DB ai_skills outputType record was seeded incorrectly — use the "Re-render as Prose" button as a workaround; run seedDefaultSkills to re-seed if needed
- [ ] Firm name and other firm variables showing as {{placeholder}} in generated content when firm_settings has not been filled in for the active entity
- [ ] Asset matching Step 3 — verify scroll behavior with 10+ cards after CSS layout fix (v4.12)

---

## 🔵 Backlog (see backlog.md for full list)

- [ ] Live public agency portal scraping (NJDOT, NYC Procurement, NJ State, NYC DDC, Port Authority)
- [ ] Adobe UXP InDesign plugin for proposal layout export
- [ ] SF 330 form auto-fill
- [ ] PDF page rendering + photo extraction from documents (Stage 1: thumbnails; Stage 2: vision model photo extraction)
- [ ] pgvector semantic search across Knowledge Hub
- [ ] Navigation restructure (4 zones)
- [ ] App-to-app toggle link (Amplify ↔ v0 timekeeping)
- [ ] Bulk image import — PDF rendering stage 2 (vision model pass on rendered pages)
- [ ] Word/PowerPoint export of completed proposal
- [ ] Mobile responsive pass
- [ ] SSO/SAML
- [ ] Stripe billing
- [ ] Token usage logging per skill invocation + usage dashboard

---

## ✅ Recently Completed

### AI Skills Configuration Overhaul (v4.20–v4.21)
- [x] Add `provider_api_keys` table — unlimited named providers (name, provider, sdkType, baseUrl, apiKey, defaultModel, isDefault)
- [x] Add `sdkType` column (`openai_compatible` | `google_gemini` | `anthropic`) — routing decoupled from provider name string
- [x] Remove all Manus built-in (manus_builtin/forge) references from `invokeLLMWithSkill` and Settings UI
- [x] On any API error, fall back to default provider key; set `_usedDefaultModel` flag on result
- [x] Surface amber "Default model used" banner in SkillOutputRenderer when `_usedDefaultModel` is set
- [x] Rebuild Provider API Keys UI: add/edit/delete any number of providers, mark one as default, SDK type selector
- [x] Per-skill provider dropdown now reads from `provider_api_keys` table (not hardcoded list)
- [x] Provider name field is free-text with datalist suggestions (not locked enum)
- [x] Base URL field auto-appears for non-well-known providers
- [x] Test Connection button in Add/Edit modal — real inference call, validates model name
- [x] sdkType badge shown in key list row
- [x] Zero TypeScript errors throughout

### Contract Management (v4.17)
- [x] Entity filter (JPCL/Strans selector) filters contract list by performingCompanyId
- [x] Contract analyzer results viewable — fixed rawAnalysis field name

### Pipeline Upgrade — Phase 4: Evidence Bundles in Generation — COMPLETE
- [x] Write `server/evidenceBundleBuilder.ts` — `buildEvidenceBundle(docIds, skillName, rfpServiceLines)` returning skill-specific ranked/capped EvidenceBundle
- [x] Implement skill-specific chunk type caps and source type ranking per the Phase 4 spec
- [x] Update `buildSkillVariables` in `rfpSessions.ts`: inject `evidenceContext` string alongside ALL legacy summary variables (additive, no removals)
- [x] Store assembled `EvidenceBundleMap` in `rfpSessions.evidenceBundles` after each relevant skill run
- [x] Write `server/evidenceBundleBuilder.test.ts`: 29 tests covering bundle assembly per skill, empty-bundle fallback, confidence filtering, source-type caps, provenance fields, service line boost, evidenceContext format
- [x] TypeScript: zero errors; 116/117 tests pass (1 pre-existing OpenAI 429 rate limit failure)
- [x] Checkpoint saved — stopped for review before Phase 5
