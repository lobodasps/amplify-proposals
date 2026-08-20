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
- [ ] Fix outputType seeding: update `seedDefaultSkills` to upsert `outputType` on existing rows (not just insert-if-missing)
- [ ] Fix firm placeholder guard: warn user in Workspace when `firm_settings` is empty instead of silently passing `[Not provided]`
- [ ] Fix asset matching scroll: verify and fix scroll behavior with 10+ cards in AssetMatchingPanel

### GitHub Project Link
- [ ] Diagnose and restore the project-level GitHub repository binding; the Management UI status check currently fails after account authorization

### Database Schema Verification
- [x] Compare the live Supabase PostgreSQL catalog against `drizzle/schema.ts`, including tables, columns, types, defaults, nullability, primary/foreign keys, and indexes; document any drift before applying migrations — verified 2026-08-20: all 48 Drizzle tables exist with 0 table/column/type/nullability/default/PK/unique/index drift; 66 additional public tables belong to the pre-existing v0/timekeeping app

### Projects Information Architecture
- [x] Assess apparent redundancy between Firm Records → Projects and Knowledge Hub project sheets; document the recommended canonical-record (`amp_projects`) to evidence-document (`dam_documents`) relationship in `PROJECTS_INFORMATION_ARCHITECTURE_RECOMMENDATION.md`
- [x] Rename the canonical Projects experience surface to Project Experience; preserve `amp_projects` as the record of truth
- [x] Add create-or-link Project Experience controls to Knowledge Hub project-sheet intake; persist `dam_documents.projectId` for newly associated documents without rewriting legacy free-text associations
- [x] Add Project Experience create-or-link controls to multi-project split intake and persist the selected `projectId` per created project-sheet document
- [x] Add linked Knowledge Hub evidence documents to the Project Experience detail panel
- [x] Fix legacy Knowledge Hub project sheets that are not represented in Project Experience, starting with Tompkinsville Station; preserve evidence and avoid unsafe bulk name matching — Tompkinsville Station now has canonical `amp_projects` record `8f72e0d5-05d8-4fe3-9234-683cedb5aa16` linked to its project sheet; Project Experience now surfaces remaining unlinked sheets for manual review

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
