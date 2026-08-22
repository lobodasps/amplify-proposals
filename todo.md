# Amplify-Proposals — Active TODO

Last updated: 2026-07-05
Current version: v4.29 (post Pipeline Upgrade Phases 4–8 + auth storage-key isolation)

---

## 🔴 Immediate Action Required

- [ ] Reassign 7 `manus_builtin` skills to real provider keys in Settings → AI Skills
- [ ] Apply updated GROUNDING RULES prompts: Settings → AI Skills → Reset to Default for each of the 4 generation skills

---

## 🟡 In Progress — Current Sprint

### Dashboard Mock Data (fixed)
- [x] `Dashboard.tsx` — remove all hardcoded fallback values from KPI cards (activePursuits||24, pipelineValue||14200000, winRate||38, etc.); show real DB counts or "—" when empty
- [x] `Dashboard.tsx` — remove hardcoded 5-row "Recent Pursuits" fallback; show empty state when no pursuits in DB
- [x] `Dashboard.tsx` — remove hardcoded 5-row "Pipeline Snapshot" fallback; derive from live pursuitsByStatus
- [x] `Dashboard.tsx` — remove entirely hardcoded "Recent Activity" array; replace with live rfpSessions + pursuit updates from DB
- [x] `analytics.ts` router — compute real pipelineValue (SUM estimatedValue), proposalsSubmittedYTD, upcomingDeadlines from DB instead of hardcoded numbers

### Known Issues (3 fixes)
- [x] Fix outputType seeding: update `seedDefaultSkills` to upsert `outputType` on existing rows (not just insert-if-missing)
- [x] Fix firm placeholder guard: warn user in Workspace when `firm_settings` is empty instead of silently passing `[Not provided]`
- [x] Fix asset matching scroll: verify and fix scroll behavior with 10+ cards in AssetMatchingPanel
- [x] Add a regression test or documented verification path for AssetMatchingPanel with 10+ matches, proving the parent Sheet owns scrolling and no nested inner scroll container remains — component test renders 10 project matches and verifies no inner vertical scroll style; list wrappers no longer set `overflowY` or `maxHeight`

### GitHub Project Link
- [ ] Diagnose and restore the project-level GitHub repository binding; the Management UI status check currently fails after account authorization
- [x] Commit the completed Project Experience, Knowledge Hub, Staff Phase 1, and schema-verification work and push the current branch to GitHub — pushed `main` to `lobodasps/amplify-proposals` on 2026-08-20

### Launch Generation Reliability
- [x] Rename the skill-assembled draft view and clarify its relationship to the complete editable Proposal Draft document with front matter
- [x] Add explicit Proposal Workspace guidance distinguishing Sources (evidence actually used) from Assets (editable pursuit inputs), render availability for all workflow skills, and support rebuilding legacy empty evidence bundles from current extracted document data
- [x] Clarify Sources versus Assets in Proposal Workspace and repair the empty per-skill Sources panel: new runs use safe document-level excerpts when selected assets lack chunks, while historical empty bundles now explain the selected-asset and excerpt availability state accurately
- [x] Allow Fee Estimator to retrieve relevant Knowledge Hub prior proposals with verified pricing, not only manually selected prior proposals; retain relevance screening, citations, and no-invention safeguards
- [x] Include pricing-bearing sections from selected past-proposal metadata in the Fee Estimator evidence payload so valid historical rate data is cited on rerun
- [x] Trace the current generated Fee Estimator schedule and correct its source gap; the displayed schedule was a legacy Claude run at 2026-08-22 15:18–15:19 before evidence provenance was recorded. The selected past proposal does contain pricing metadata, but that legacy Fee Estimator path did not retrieve or cite it. Historical completed fee outputs without provenance now require a forced evidence-validating retry before they can be trusted.
- [x] Change Fee Estimator to leave the fee section explicitly blank unless approved fee artifacts or prior-proposal pricing evidence are retrieved; report which permitted source types were searched and how to provide missing evidence
- [x] Investigate why the Fee Estimator returned no result; no usable fee schedule or rate evidence exists in Knowledge Hub, Fee Estimator had incomplete generic-template variables, and an empty LLM response was incorrectly saved as complete. It now receives complete prompt context, explicitly distinguishes no-rate evidence, blocks blank-output completion, and makes historical blank results retryable.
- [x] Fix `/launch` generation failure when an Anthropic provider key is configured with unavailable model `claude-sonnet-4-20250514`; use supported model routing and preserve provider fallback behavior — migrated 9 live skill rows to `claude-sonnet-5`, normalized legacy settings at runtime, and updated Settings suggestions
- [x] Fix proposal scoring when unresolved `{{evaluationCriteria}}` or `{{contentToScore}}` placeholders reach the model: assemble real extracted criteria and completed proposal text, and display invalid runs as Not Scored rather than 0/100
- [x] Restore `/proposals/:id` tRPC JSON responses after the partial saved-score update; resolve all TypeScript/server compile errors so API requests cannot fall back to HTML
- [x] Fix saved Full Draft Win Themes values that render as raw JSON instead of structured theme cards — fenced JSON saved in `proposal_sections` now parses into theme cards; malformed payloads use a readable recovery view
- [x] Replace misleading `Score 0/100` in saved Full Draft when no proposal score exists with normalized persisted scoring or an explicit unscored state — historical placeholder-driven scores show Not Scored with explanatory detail
- [x] Add regression coverage for fenced JSON Win Themes saved in proposal_sections and placeholder-driven historical zero score state
- [x] Fix all remaining section-level and full-draft `proposal_scorer` invocations to pass `evaluationCriteria` and `contentToScore`, not legacy `sectionContent` or `technicalApproach` variables
- [x] Add regression coverage across full-proposal and section-level scoring paths proving unresolved placeholders never reach the scorer prompt and invalid inputs persist as unscored
- [x] Fix Proposal Workspace Skill Pipeline clipping so skills 7–8 and the Full Draft action remain reachable below skill 6 at normal viewport heights — the full list now owns an explicit native scroll viewport with `min-h-0`; sidebar header and footer remain fixed
- [x] Fix Proposal Scorecard rendering when saved AI scoring fields such as `gaps` are strings, objects, or null rather than arrays; normalize at the boundary and guard all list displays — strings, JSON strings, objects, and null normalize safely for criteria gaps, top gaps, improvements, unsupported claims, and coverage fields
- [x] Fix Draft Mode full-proposal page overflow so users can scroll the workspace page beyond the viewport, not only the inner proposal panel — Full Draft now uses the AppLayout page scroll container; workflow views retain bounded inner scrolling
- [x] Render Win Themes structured output as readable proposal theme cards or prose, never raw JSON, while preserving structured fields for downstream use — valid saved JSON renders existing Win Theme cards; prose or malformed values retain safe narrative fallback
- [x] Prevent malformed or legacy Win Themes JSON from falling through to raw proposal text; render a readable recovery view with an actionable format warning instead
- [x] Add a Full Draft Win Themes rendering regression test covering valid card JSON and malformed legacy JSON without raw JSON exposure — isolated component test verifies valid theme cards and recovery messaging with no raw payload exposure
- [x] Reduce Draft Mode end-to-end wait time by removing avoidable queue handoff and polling delays between grounded skill calls, while preserving dependency order and evidence quality
- [x] Replace Draft Mode browser timer polling with a bounded server-side skill-completion wait so backgrounded preview tabs cannot introduce one-minute gaps between completed skills — calls completing within 25 seconds return directly to the sequential runner; longer calls retain background polling and resumability
- [x] Investigate and optimize Draft Mode Win Theme and Technical Approach execution latency without weakening grounded output, model retry safety, or evidence tracing — live calls were 16–18 seconds; the multi-minute perception came from browser-timer-clamped 60-second polling gaps, now removed for normal-duration skills
- [x] Add regression coverage proving a direct completed or cached skill response skips polling while long-running skill responses retain the resumable polling path — `draftSkillExecution.test.ts` covers direct completion, cached output, and background polling responses
- [x] Fix Draft Mode skills assigned to Google Gemini providers with retired Claude model identifiers, starting with Win Theme Generator; normalize model by provider and migrate incompatible persisted settings — migrated 7 legacy Manus-built-in skills to `google_gemini/gemini-2.5-flash-preview-05-20`; runtime now prevents any Gemini route from receiving a Claude model
- [x] Fix launch-session document-chunk full-text search when PostgreSQL UUID document IDs are bound as a multi-value `ANY(...::uuid[])` expression; restore evidence retrieval for saved sessions — valid UUIDs are bound as explicit typed ARRAY elements, invalid IDs are ignored, and FTS failure returns tag-only matches rather than crashing Launch
- [x] Add durable Launch session checkpoint state and persist reviewed RFP fields, completed stage status, per-stage errors, retry counts, and Go/No-Go output
- [x] Restore `/launch?session=<id>` directly to the furthest completed step without repeating upload, classification, or extraction — active extraction sessions poll persisted state; review/decision sessions restore from saved checkpoints without re-uploading
- [x] Add an isolated Retry Go/No-Go action that uses persisted review fields and does not rerun ingestion
- [x] Add a deterministic Go/No-Go input hash, successful-result reuse, and stale-result indication after review edits
- [x] Add explicit confirmed Re-extract package behavior; no extraction stage may rerun implicitly
- [x] Add stage-specific retry history, recovery telemetry, unit tests, and end-to-end session state validation — full workflow integration test verifies processing restore, persisted review, cached score reuse, isolated scoring failure, and explicit re-extraction without changing the uploaded manifest
- [x] Add router/integration tests for persisted Launch review, Go/No-Go reuse, scoring failure, and explicit re-extraction state transitions
- [x] Implement and test true mid-pipeline `/launch?session=<id>` recovery using the persisted upload manifest rather than synthetic files or re-uploading — manifest metadata is rendered directly; no synthetic browser `File` objects are created
- [x] Add Launchpad UI tests for review restore, cached Go/No-Go, stale-score notice, isolated scoring retry, and confirmed re-extraction — `LaunchRecoveryControls.test.tsx` tests the rendered component interactions and confirmation gate
- [x] Add a full workflow integration test for `/launch?session=` restore, persisted review recovery, cached Go/No-Go reuse, failed Go/No-Go retry, and confirmed re-extraction without re-uploading
- [x] Fix `/launch` Go/No-Go analysis when Anthropic returns 403 Request not allowed; fall back to a permitted configured provider and expose actionable configuration status — `go_no_go_advisor` now uses verified `google_gemini/gemini-2.5-flash`; Anthropic 403s also fall back to Google when no distinct default provider exists
- [x] Show a Launchpad status notice when Go/No-Go uses a fallback provider after an Anthropic 403, including the provider and model actually used
- [x] Add Settings guidance for an unusable Anthropic provider configuration and its Google Gemini fallback path
- [x] Fix `/launch` Go/No-Go rendering crash when `strengths` is returned as a non-array value; normalize all list-like AI fields before rendering — API normalizes array, JSON-string, bullet-string, object, and null forms for strengths, risks, and win themes; UI also safely guards list rendering
- [x] Fix Business Development Add to Pursuit so manually created opportunities produce visible, correctly linked records in the Pursuits list — live mutation creates one `pursuits` row linked by `opportunityId`, preserves metadata, marks the opportunity pursuing, prevents duplicates, invalidates lists, and opens the created pursuit
- [x] Fix `/launch` bid-document extraction so critical dates and opportunity metadata are captured reliably, with an explicit incomplete-extraction warning when source content cannot support a field — DOCX files are now converted to text with Mammoth before classification and XML shredding; user-confirmed Main RFP labels cannot be downgraded to metadata-only when classification is inconclusive
- [x] Add an explicit incomplete-extraction warning in `/launch` review when critical parsed fields (title, agency, submission deadline, or estimated value) remain blank after bid-document processing
- [x] Add automated DOCX launch extraction regression coverage for the text-extraction branch and missing-critical-field warning conditions — `launchExtraction.test.ts` verifies blank and placeholder critical-field warnings; `rfpSessions.classifyFile.test.ts` exercises the real protected endpoint with a DOCX fixture
- [x] Add server-side regression tests proving Launchpad DOCX classification extracts text before invoking Gemini rather than sending an unsupported Word MIME attachment — `rfpSessions.classifyFile.test.ts` verifies extracted DOCX text is sent without a Word `file_url`
- [x] Add server-side regression tests proving a user-designated Main RFP DOCX remains full-extract when automated classification is inconclusive — `launchDocumentProcessing.test.ts` covers the shared label-preservation decision used by the Launchpad

### Database Schema Verification
- [x] Compare the live Supabase PostgreSQL catalog against `drizzle/schema.ts`, including tables, columns, types, defaults, nullability, primary/foreign keys, and indexes; document any drift before applying migrations — verified 2026-08-20: all 48 Drizzle tables exist with 0 table/column/type/nullability/default/PK/unique/index drift; 66 additional public tables belong to the pre-existing v0/timekeeping app

### Projects Information Architecture
- [x] Investigate and correct the unexpected Ritesh Patel résumé launch from the Tompkinsville Project Experience record; preserve its valid extracted project sheet while routing résumé-derived sheets to the Knowledge Hub project-content view rather than launching the source résumé
- [x] Assess apparent redundancy between Firm Records → Projects and Knowledge Hub project sheets; document the recommended canonical-record (`amp_projects`) to evidence-document (`dam_documents`) relationship in `PROJECTS_INFORMATION_ARCHITECTURE_RECOMMENDATION.md`
- [x] Rename the canonical Projects experience surface to Project Experience; preserve `amp_projects` as the record of truth
- [x] Add create-or-link Project Experience controls to Knowledge Hub project-sheet intake; persist `dam_documents.projectId` for newly associated documents without rewriting legacy free-text associations
- [x] Add Project Experience create-or-link controls to multi-project split intake and persist the selected `projectId` per created project-sheet document
- [x] Add linked Knowledge Hub evidence documents to the Project Experience detail panel
- [x] Add a direct Open action for linked Knowledge Hub evidence in Project Experience, opening the selected document preview without a separate Hub search
- [x] Add a Create Project Sheet in Knowledge Hub action to Project Experience, opening explicit project-sheet intake with the canonical project ID and metadata prefilled
- [x] Fix the direct Knowledge Hub preview spinner when a linked Project Experience document is opened through the new Open action — the Open action now launches the signed attached file directly in a new tab; Knowledge Hub preview remains available through the Hub itself
- [x] Refresh signed storage URLs on-demand before opening or downloading Project Experience evidence, preventing expired-JWT attachment failures — `dam.getFreshFileUrl` and `projects.getAttachmentUrl` mint a URL immediately before launch; stale list URLs are no longer used
- [x] Fix legacy Knowledge Hub project sheets that are not represented in Project Experience, starting with Tompkinsville Station; preserve evidence and avoid unsafe bulk name matching — Tompkinsville Station now has canonical `amp_projects` record `8f72e0d5-05d8-4fe3-9234-683cedb5aa16` linked to its project sheet; Project Experience now surfaces remaining unlinked sheets for manual review
- [x] Fix Project Experience evidence display so linked Knowledge Hub sheets, including Tompkinsville Station, render in Files & Documents — fixed UUID query enablement (`Boolean(project.id)`)
- [x] Add a controlled reconciliation workflow for all legacy Knowledge Hub project sheets: identify, create or link canonical Project Experience records, preserve evidence, and require review for ambiguous mappings
- [x] Add a transactional one-time reconciliation action for the 21 unlinked legacy project sheets; create one canonical Project Experience per unique exact sheet title and skip ambiguous existing-project matches — reconciled 2026-08-20: 21 records created, 21 documents linked, 0 ambiguous mappings, 0 remaining unlinked sheets

### Staff Information Architecture
- [x] Audit duplication between Firm Records → Staff, Personnel records, and Knowledge Hub resumes/certifications; define a single canonical staff record and a safe consolidation path before changing UI or persisted relationships
- [x] Define v0 Timekeeping versus Amplify-Proposals staff-data ownership: retain shared profile/certification authority in v0, keep payroll/rates/timekeeping out of Amplify, and eliminate duplicated staff sources without unsafe automated migrations
- [x] Staff Phase 1: redirect `/personnel` to `/staff`; read v0 `profiles` and `user_certifications` as the primary Staff directory while preserving legacy `personnel` data and unlinked Knowledge Hub documents
- [x] Update Knowledge Hub resume/certification intake to select canonical `profiles.id`, and show legacy DAM documents with free-text `staffName` in a safe review path without automatic person matching

### Remove Mock Data — Wire to Live DB
- [x] `Proposals.tsx` — remove `DEMO_PROPOSALS` fallback; show empty state when DB returns 0 rows
- [x] `Opportunities.tsx` — remove `DEMO_OPPORTUNITIES` fallback; show empty state
- [x] `Personnel.tsx` — remove `DEMO_PERSONNEL` fallback; show empty state
- [x] `Projects.tsx` — remove `DEMO_PROJECTS` fallback; show empty state
- [x] `Staff.tsx` — remove `DEMO_STAFF` fallback; show empty state
- [x] `Assets.tsx` — remove `ASSETS` fallback; wire to `trpc.assets.list` with live DB data
- [x] `Pipeline.tsx` — remove hardcoded `PURSUITS` and `KPI_CARDS`; wire Kanban board to `pursuits.list` tRPC query with stage grouping; wire KPI cards to real counts
- [x] `PursuitDetail.tsx` — remove hardcoded `PURSUIT`, `TASKS`, `REQUIREMENTS`; wire to `pursuits.getById` using URL param; tasks wired to `pursuits.getTasks`

### Wire InDesignExport to Real Data
- [ ] `InDesignExport.tsx` — replace `EXPORT_SECTIONS` and `EXPORT_ASSETS` with real session skill outputs and DAM documents

### Token Usage Dashboard
- [x] Token usage dashboard already exists in Settings → AI Skills → Usage tab (wired to `trpc.aiSkills.usageStats`); no additional work needed

### pgvector Semantic Search
- [ ] Enable `pgvector` extension in Supabase (run `CREATE EXTENSION IF NOT EXISTS vector`)
- [ ] Add `embedding vector(1536)` column to `document_chunks` in `drizzle/schema.ts`; run `pnpm db:push`
- [ ] Add `embedChunk(content)` helper in `server/embeddings.ts` using OpenAI `text-embedding-3-small`
- [ ] Wire embedding generation into `chunkBuilder.ts`: after chunk insert, call `embedChunk` and update the row
- [ ] Add `semanticSearch` tRPC procedure in `server/routers/dam.ts`: embed query, cosine similarity search, return top-K chunks with doc metadata
- [ ] Add semantic search UI to Knowledge Hub: search bar with toggle (keyword / semantic), results list with chunk preview and source doc link

---

## 🟠 Known Issues (resolved in this sprint — move to ✅ when done)

---

## 🔵 Backlog (see backlog.md for full list)

- [ ] Live public agency portal scraping (NJDOT, NYC Procurement, NJ State, NYC DDC, Port Authority)
- [ ] Adobe UXP InDesign plugin for proposal layout export
- [ ] SF 330 form auto-fill
- [ ] PDF page rendering + photo extraction from documents (Stage 1: thumbnails; Stage 2: vision model photo extraction)
- [ ] Navigation restructure (4 zones)
- [ ] App-to-app toggle link (Amplify ↔ v0 timekeeping)
- [ ] Proposal export to Word/PowerPoint/PDF (on hold — pending design decision)
- [ ] Mobile responsive pass
- [ ] SSO/SAML
