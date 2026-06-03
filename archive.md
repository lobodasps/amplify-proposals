# Amplify-Proposals — Completed Work Archive

> Append-only. All items marked `[x]` in todo.md are moved here.
> Last updated: 2026-06-03 | Current version: v4.16

---

## Phase 1: Design System, Theme & Database Schema
- [x] Global design system: color palette, typography, spacing tokens in index.css
- [x] Database schema: users with AEC roles, firms, projects, resumes, proposals, pursuits, assets, tasks, contracts, opportunities
- [x] Run db:push to apply migrations

## Phase 2: Auth, Roles, Dashboard Layout & Navigation
- [x] Role-based auth: Administrator, Executive, Business Development, Proposal Coordinator, Project Manager/Seller-Doer, Technical Reviewer, Designer, Contract Manager, Read-Only Contributor
- [x] DashboardLayout with sidebar navigation for all modules
- [x] Protected routes per role
- [x] User profile and settings page

## Phase 3: Knowledge Hub & Digital Asset Management
- [x] Knowledge Hub page: searchable repository for projects, resumes, boilerplate, case studies, qualifications, certifications
- [x] Service line tagging: Special Inspections, Construction Management, Traffic Engineering, Landscape/Streetscape, Environmental
- [x] DAM module: file upload, tagging, metadata, folder organization, version control
- [x] Full-text and semantic search across all assets
- [x] Asset inline insertion into proposals
- [x] Project profile pages with linked resumes, assets, and past proposals
- [x] Resume repository with role/service-line tagging

## Phase 4: AI RFP Ingestion, Proposal Assembly & Collaboration
- [x] RFP ingestion: upload RFP PDF/Word, AI shredding into requirements matrix
- [x] Compliance matrix: requirement-to-response mapping with scoring
- [x] AI first-draft generation using firm knowledge
- [x] Resume tailoring engine: reformat individual resumes to match RFP key personnel requirements
- [x] Proposal assembly workspace: drag-and-drop sections, template selection
- [x] InDesign export: JSON/XML/CSV data packages for Adobe Data Merge + UXP plugin roadmap
- [x] Collaboration workflow: task assignment, SME requests, comment threads
- [x] Review and approval workflows with deadline tracking
- [x] Notification system for proposal contributions

## Phase 5: Bid Pipeline, KPIs, Opportunity Ingestion & Contracts
- [x] Bid pipeline board: pursuit status tracking (Identify, Qualify, Pursue, Submit, Award, Lost) — Kanban + List view
- [x] Go/no-go scoring with weighted criteria
- [x] Win/loss recording and analysis
- [x] Client and agency history tracking (NJ/NY/NYC agencies)
- [x] Hit-rate reporting and backlog conversion tracking
- [x] KPI dashboards: win rate, proposal volume, revenue pipeline, team workload (Recharts)
- [x] Public opportunity ingestion: scrape NJ/NY/NYC agency portals (NJDOT, NYC Procurement, NJ State, NYC DDC, Port Authority)
- [x] Auto-score opportunities against firm capabilities and strategic criteria
- [x] Prioritized pursuit list with AI recommendations
- [x] Contract Management Module: record creation, status tracking, key dates, milestones
- [x] Contract document storage and linked proposal/project references

## Phase 6: Polish, Tests & Delivery
- [x] Loading states, empty states, error boundaries on all pages
- [x] 25 vitest unit tests passing across all modules (auth, pursuits, proposals, assets, personnel, projects, opportunities, contracts)
- [x] Zero TypeScript errors
- [x] Checkpoint save
- [x] Deliver live preview to user

## Phase 2 — Supabase Integration & Contract → Project Handoff (v1.4)
- [x] Install @supabase/supabase-js client
- [x] Store SUPABASE_URL and SUPABASE_SECRET_KEY as environment secrets
- [x] Create server/supabase.ts helper with testSupabaseConnection()
- [x] Vitest test for Supabase connection — passes (16 tests total)
- [x] Inspect live Supabase schema: clients, projects, profiles, companies, owners, phases, tasks, time_entries, billing_rules all confirmed
- [x] Confirmed JPCL (fddf0d5c) and Strans (e45a26d6) company IDs in Supabase
- [x] Add contractsRouter.activateContract mutation: generates contract/project numbers, updates Amplify contract to Active, creates project record in Supabase
- [x] Rewrite Contracts.tsx with real tRPC data, KPI cards, Activate button on Draft contracts, ActivateContractDialog with company selector and billing method
- [x] Post-activation: contract shows project number + "In Timekeeping" badge

## Phase 1 — Awarded → Draft Contract Conversion (v1.3)
- [x] Extend contracts schema with Accordly-compatible fields: contractVehicle, companyRole, billingMethods, NTE ceiling, QB fields, compliance flags, hierarchy, amendments table
- [x] Push schema migration to TiDB (contract_amendments table added, contracts table extended)
- [x] Add contractsRouter.convertFromPursuit mutation: validates award status, prevents duplicates, seeds Draft contract from pursuit data
- [x] Add contractsRouter.update mutation for contract field editing
- [x] Rewrite Pursuits.tsx with real tRPC data + "Convert to Contract" button on Awarded pursuits
- [x] ConvertToContractDialog: preview card, contract vehicle selector, company role selector, project number, notes, confirmation warning

## Bug Fixes Applied (v1.2)
- [x] analytics.ts: Replace raw SQL NOT IN with Drizzle notInArray/inArray to fix TiDB crash
- [x] analytics.ts: Wrap all DB queries in try/catch with fallback demo data
- [x] Dashboard.tsx: Safe JSON.parse for serviceLines field (handles array, string, null, malformed)
- [x] Personnel.tsx: Safe JSON.parse for serviceLines field (handles array, string, null, malformed)

## Phase 3 — Full Contract Management UI (v1.5)
- [x] Update contract number generator: JPCL YY-NNN, Strans STR-YY-NNN, child YY-NNN-NNN, sub-project YY-NNN-NNN-NNN, amendment -A001, change order -C001
- [x] Company badge colors matching Replit: JPCL=blue, Strans=emerald (from live Supabase badge_color field)
- [x] Old/test project numbers remain valid — new format only applies to newly created contracts
- [x] Contract detail page: header with status, numbers, client, value, dates, company badge
- [x] Contract hierarchy tree: primary → child task orders (0-m) → sub-projects (0-m)
- [x] Add child order / sub-project buttons with auto-numbering
- [x] Amendments panel: list + add amendment with -A001 numbering, applies to any hierarchy level
- [x] Change orders panel: list + add change order with -C001 numbering, applies to any hierarchy level
- [x] Compliance flags: COI required/received, executed contract, prime agreement on file, client billing info
- [x] Contract status workflow: Draft → Negotiation → Executed → Active → On Hold → Completed / Terminated
- [x] Contract Analyzer stub (AI document extraction placeholder — in detail page tabs)
- [x] Contracts list page: company badges (JPCL=blue, Strans=emerald), clickable rows to detail, chevron indicator

## Phase 3 — Full Accordly Contract Management Replication (v1.6+)
- [x] Fix TypeScript errors in settings.ts, compliance.ts, contractAnalyzer.ts (getDb() async pattern)
- [x] FinancialSummaryCard component: Contract Value / Authorized / Billed / Remaining / Draw-Down % with color thresholds
- [x] ComplianceBar component: COI, executed contract, prime agreement, billing info flags
- [x] EntitySwitcher component: JPCL (blue) / Strans (emerald) toggle with badge
- [x] ContractDetail: FinancialSummaryCard, ComplianceBar, amendments/change orders, compliance tab, analyzer tab
- [x] Settings page: 10 tabs (Entities, Organizations, People, Order Types, Departments, Service Types, Form 254, Glossary, Users, Reminders) with CRUD
- [x] Analytics page: 7 Recharts reports + CSV export (live tRPC data)
- [x] Compliance page: issues table with severity badges, resolve button, compliance scan
- [x] ContractAnalyzer page: AI PDF extraction with analysis history
- [x] Glossary page: searchable term cards with category filter
- [x] Help page: user guide with section navigation
- [x] BidCalendar page: upcoming deadlines list with urgency color coding, overdue section, summary cards
- [x] ResourceLibrary page: 6 tabs (Project Sheets, Staff Profiles, Rate Sheets, Proposal Templates, Digital Assets, Content Blocks)
- [x] Opportunities: EntitySwitcher added to Contracts page; OpportunityDetail page with competitor tracking, debrief, proposal builder
- [x] OpportunityDetail: competitor tracking, post-award debrief, proposal builder link, status management

## Contract Financial Model Implementation (Issue #34 + QB Import)
- [x] Schema: add amountBehavior (adds_to_value | subtracts_from_value | utilizes_value), amountChange (float), billedAmount (float) to contractAmendments table
- [x] Schema: push migration (pnpm db:push)
- [x] Server: build getContractFinancials() helper implementing R1-R15 from financial model reference
- [x] Server: update addAmendment — accept amountBehavior + amountChange; UTILIZES_VALUE must NOT change computedContractValue; recompute NTE fields
- [x] Server: add updateAmendmentBilling mutation (update billedAmount on a UTILIZES_VALUE amendment + trigger recalculate)
- [x] Server: add recalculateFinancials mutation (recompute all KPIs from scratch for a contract)
- [x] Server: add importQbCsv mutation (parse CSV rows, upsert billingEntries, trigger recalculate)
- [x] UI: FinancialSummaryCard — add NTE ceiling breakdown panel (Effective Ceiling, Committed via TOs, Available, Billed, Remaining) when hasNteCeiling=true + billingBasis=authorized
- [x] UI: FinancialSummaryCard — show hasOverBilledTaskOrders warning badge
- [x] UI: ContractDetail amendments tab — Task Order badge type, Authorized/Billed/Remaining/Over-Billed columns for UTILIZES_VALUE rows
- [x] UI: ContractDetail amendments tab — inline billedAmount edit on Task Order rows (auto-recalculates on save)
- [x] UI: ContractDetail — QB CSV import button + upload flow + Recalculate button
- [x] UI: Add Amendment dialog — amountBehavior selector, amountChange field, billedAmount field for Task Orders
- [x] UI: Edit Contract dialog — expose billingBasis toggle (AUTHORIZED vs NTE_CEILING) + hasNteCeiling + nteCeilingAmount fields
- [x] Tests: update vitest tests for getContractFinancials covering S1, S2, S6, S8, S14 scenarios

## Contract Financial Model (v2.3 — Issue #34)
- [x] Schema: add amountBehavior column to contractAmendments table
- [x] Schema: push migration (amountBehavior, amountChange columns)
- [x] Server: getContractFinancials() helper — NTE_CEILING vs AUTHORIZED billing basis logic
- [x] Server: persistContractFinancials() — writes computed KPIs back to contracts table
- [x] Server: addAmendment updated — amountBehavior + amountChange fields, signed amount derived from behavior
- [x] Server: recalculateFinancials mutation — manual trigger to recompute all KPIs
- [x] Server: importQbCsv mutation — parse rows, upsert billing entries, recalculate
- [x] Server: updateBillingEntry mutation — inline edit with auto-recalculate
- [x] Server: update mutation extended — hasNteCeiling, nteCeilingAmount, billingBasis fields
- [x] UI: FinancialSummaryCard rewritten — NTE ceiling breakdown (5 KPIs), burn-down progress bar with tick marks, avg monthly burn, projected exhaustion, contract end
- [x] UI: ContractDetail — Task Order Portfolio section (NTE + AUTHORIZED mode only) with Effect on Parent badge
- [x] UI: ContractDetail — getFinancials query wired, financialsWithDates injected for burn-rate display
- [x] UI: ContractDetail — Recalculate button + QB CSV Import button in amendments tab
- [x] UI: QbImportDialog — client-side CSV parse, preview first 5 rows, confirm to import all rows
- [x] UI: AddAmendmentDialog — amountBehavior selector (Add/Deduct), positive amountChange field
- [x] UI: EditContractDialog — NTE toggle, NTE Ceiling Amount field, Billing Basis selector with explanatory text
- [x] TypeScript: zero errors
- [x] All 25 vitest tests passing

## Supabase Storage Migration (DAM backend)
- [x] Create 'dam' bucket in Supabase Storage (private, 50 MB file limit)
- [x] Rewrite server/storage.ts — storagePut/storageGet/storageGetSignedUrl now use Supabase SDK
- [x] Rewrite server/_core/storageProxy.ts — /manus-storage/:key generates Supabase signed URL and 307-redirects
- [x] Upload endpoint limit raised from 16 MB to 50 MB to match bucket limit
- [x] TypeScript: zero errors; 16 tests passing

## DAM Tagging & Filtering System
- [x] Schema: add tags JSON column to assets table; add assetTags lookup table (id, name, color, createdAt)
- [x] Schema: push migration (asset_tags table)
- [x] Server: assets.listTags procedure (returns all tags with usage counts)
- [x] Server: assets.createTag procedure (name + color)
- [x] Server: assets.deleteTag procedure
- [x] Server: assets.list updated — filter by tagIds[], assetType, search, folder
- [x] Server: assets.updateTags procedure (set tags on an asset)
- [x] UI: TagBadge component (colored pill with optional remove button)
- [x] UI: TagFilterBar component (multi-select tag chips + asset type dropdown + search input)
- [x] UI: Resource Library page — wire real trpc.assets.list with tag/type/search filters
- [x] UI: Asset card — show tag badges, click to open tag editor popover
- [x] UI: Tag Manager panel in Settings (create/delete tags, see usage count)

## Contract Hierarchy & Import Gaps (Session 3)

### Schema Additions
- [x] Add tierLabelId (FK to orderTypes) to contracts table
- [x] Add amountBehavior to contracts table (adds_to_parent / subtracts_from_parent / independent / utilizes_parent)
- [x] Add compliance fields: coiRequired, coiReceived, coiReceivedDate, coiExpirationDate
- [x] Add compliance fields: fullyExecutedContractReceived, fullyExecutedContractDate
- [x] Add compliance fields: primeAgreementRequired, primeAgreementOnFile, primeAgreementDate
- [x] Add hasCOI, hasSignedContract boolean fields to contracts
- [x] Add billingMethods JSON array to contracts (LUMP_SUM, T_AND_M, COST_PLUS, UNIT_PRICE)
- [x] Add structureType to contracts (CONTRACT_IS_PROJECT / CONTRACT_HAS_SUBPROJECTS)
- [x] Add contractOwnerId (FK to people) to contracts
- [x] Add primeOrgId (FK to organizations) to contracts
- [x] Push migration with pnpm db:push

### Server / Financial Rollup
- [x] Fix getContractFinancials() to do recursive rollup: L1=L1+L2+L3, L2=L2+L3
- [x] Update createChild to accept tierLabelId and amountBehavior
- [x] Update contracts.create and contracts.update to accept all new fields

### UI Updates
- [x] ContractDetail: show tier label from orderTypes on child order rows
- [x] ContractDetail: amountBehavior badge on child contracts
- [x] EditContractDialog: tierLabelId selector, amountBehavior for L2/L3
- [x] EditContractDialog: compliance fields (COI, executed contract, prime agreement)
- [x] EditContractDialog: billingMethods multi-select, structureType, contractOwnerId, primeOrgId
- [x] Contracts page: remove All Entities filter, add PM and Accountant filter dropdowns

### Import Tab in Settings
- [x] Add Import tab to Settings page
- [x] Import: Organizations CSV/Excel with download template
- [x] Import: People CSV/Excel with download template
- [x] Import: Contracts CSV/Excel with download template (supports level + parentProjectNumber)
- [x] Import: Amendments CSV/Excel with download template
- [x] Import: Billing/QB update CSV with download template
- [x] Import: Service Types CSV with download template
- [x] Import: Glossary Terms CSV with download template
- [x] Import: Opportunities CSV with download template
- [x] Server: bulk import tRPC procedures (8 data types, client-side CSV parse)
- [x] Show per-row errors + imported count after each import

## Proposal Workspace — Sequential Skill Workflow (v2.5)
- [x] rfpSessions table: proposalId, pursuitId, opportunityId, skillOutputs JSONB, workflowState JSON, liveScore, rfpFile metadata columns
- [x] shared/workflowTypes.ts: WorkflowSkillName, WorkflowState, SkillOutputs, SkillStateEntry, ParsedRfpData, ORDERED_SKILLS, SKILL_META, computeResumeState()
- [x] server/routers/rfpSessions.ts: executeSkill (one skill per request, DB write before return), create, getById, listByPursuit, listByProposal, saveRfpFile, updateSkillOutput, resetSkill
- [x] rfpSessionsRouter registered in server/routers.ts
- [x] ProposalWorkspace.tsx: full sequential orchestrator (strict sequential, no Promise.all), progress sidebar, resume from last completed skill, per-skill output editor, re-run individual skills, pause/resume, error recovery with retry

## Knowledge Hub / DAM — Document Ingestion
- [x] dam_documents table added to schema and migrated
- [x] DAM tRPC router (dam.create, dam.list, dam.getById, dam.delete, dam.triggerExtract, dam.getStats)
- [x] damRouter registered in appRouter
- [x] 'dam' folder added to upload allowlist
- [x] KnowledgeHub.tsx — drag-and-drop upload with metadata form (type, company, client, staff, tags)
- [x] KnowledgeHub.tsx — filterable document grid (by type, company, status, search)
- [x] KnowledgeHub.tsx — stats bar with per-type counts
- [x] KnowledgeHub.tsx — document preview dialog with extracted text and structured data
- [x] Sidebar nav updated: "File Library (DAM)" → "Knowledge Hub" at /knowledge-hub

## Knowledge Hub — Cross-Record Linking (v2.3)
- [x] Add projectId FK column to dam_documents table and push migration
- [x] DAM create procedure: auto-match or create Staff record when resume/certification uploaded
- [x] DAM create procedure: auto-match or create Project record when project sheet/past proposal uploaded
- [x] Add listByStaff tRPC procedure (dam router)
- [x] Add listByProject tRPC procedure (dam router)
- [x] Staff page: show linked Knowledge Hub documents in attachment panel with "Open Hub" link
- [x] Projects page: show linked Knowledge Hub documents in attachment panel with "Open Hub" link

## Supabase Postgres Migration
- [x] Step 2: Convert server/db.ts to Supabase Postgres (drizzle-orm/postgres-js)
- [x] Step 3: Convert drizzle/schema.ts from mysqlTable to pgTable with all type changes
- [x] Step 4: Add cross-app FK columns (profiles, projects, companies)
- [x] Step 5: Push schema to Supabase via drizzle-kit push
- [x] Step 6: Insert 3 real personnel records (Gregg, Renuka, Karen) and link to profiles
- [x] Step 7: Replace Manus custom auth with Supabase Auth (server-side only)
- [x] Step 8: Verify vitest suite passes (16/16) and app loads

## Router Type Fix Pass (UUID Migration)
- [x] Fix dam.ts: z.number() → z.string().uuid(), eq() calls to string
- [x] Fix contracts.ts: z.number() → z.string().uuid(), eq() calls to string
- [x] Fix remaining routers: assets, pursuits, proposals, personnel, projects, opportunities, analytics, rfpSessions, etc.
- [x] Zero server-side TypeScript errors (140 client-side remain — client files not touched per instructions)
- [x] All 16 vitest tests pass

## Client-Side UUID Type Migration
- [x] Fix all 140 client-side TypeScript errors (ContractDetail, Contracts, ProposalWorkspace, OpportunityDetail, DocumentShredder, ConflictDetector, RfpWiki, KnowledgeHub, Settings, QbSync, ResourceLibrary, FileLibrary, EntityContext, TagFilterBar, RfpContextSelector)
- [x] All ID references updated from number to string throughout client code
- [x] Zero TypeScript errors across entire codebase (server + client)
- [x] All 16 vitest tests pass

## Client-Side Supabase Auth
- [x] Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY secrets
- [x] Create client/src/lib/supabase.ts Supabase client
- [x] Update tRPC client to pass Supabase JWT as Bearer token
- [x] Replace useAuth hook to use Supabase session (AuthContext + re-export)
- [x] Create login page with email/password
- [x] Protect all routes — redirect unauthenticated users to login
- [x] Add logout via supabase.auth.signOut()
- [x] Verify auth flow works end-to-end (0 TS errors, 16/16 tests pass, route protection confirmed)

## Enhanced triggerExtract (v2.6)
- [x] SYSTEM_PROMPTS constant: per-docType prompts (resume, project_sheet, past_proposal, certification, other) with sections[] and images[] extraction
- [x] buildTagString() helper: merges tags from LLM output, serviceLines, certifications, image-level tags; normalizes to lowercase-hyphenated comma-separated
- [x] buildExtractedText() helper: assembles searchable text from summary/description, section content, image descriptions, and list fields
- [x] triggerExtract procedure updated: uses SYSTEM_PROMPTS, calls buildTagString/buildExtractedText, writes tags field back to dam_documents
- [x] KnowledgeHub.tsx onSuccess callback updated for new return shape { success, imageCount }
- [x] Zero TypeScript errors, 16/16 vitest tests pass

## Proposal Launchpad (/launch) — 2-Step Wizard (v2.7)
- [x] New page ProposalLaunchpad.tsx at /launch — no existing files modified
- [x] Step 1: drag-and-drop PDF upload via existing /api/upload endpoint (rfp folder)
- [x] Step 1: auto-create rfpSession (rfpSessions.create), save file metadata (rfpSessions.saveRfpFile)
- [x] Step 1: run rfp_parser skill (rfpSessions.executeSkill) with animated progress bar
- [x] Step 1: display editable summary card (title, agency, RFP#, due date, est. value, service line chips, scope summary)
- [x] Step 2: invoke proposals.scoreGoNoGo with extracted data
- [x] Step 2: display score (0–100 with color-coded bar), recommendation (GO/NO-GO/CONDITIONAL GO), rationale, strengths, risks, win themes
- [x] Step 2: GO button → pursuits.create → redirect to /pursuits/:id (newest record via list invalidation)
- [x] Step 2: NO-GO button → archived state with "Launch Another RFP" reset option
- [x] Step indicator (3 steps) at top of wizard
- [x] "Proposal Launchpad" nav item (AI badge, Rocket icon) added to Pursuits & Proposals sidebar group
- [x] /launch protected route registered in App.tsx
- [x] Zero new backend code — only existing tRPC procedures and /api/upload used

## Proposal Launchpad — Multi-File Package Support (v2.8)
- [x] Accept multiple files: PDF, DOCX (.doc/.docx), XLSX (.xls/.xlsx), ZIP
- [x] ZIP files extracted client-side with fflate; inner files queued individually
- [x] Per-file label selector: Main RFP, Scope of Work, Appendix, Addendum, Fee Schedule, Reference Doc, Other
- [x] Auto-label guessing from filename keywords (scope/sow, append, addend, fee/cost/price, ref/standard)
- [x] File type detection with colored badges (PDF=red, DOCX=blue, XLSX=emerald, ZIP=amber)
- [x] All files uploaded sequentially to /api/upload (rfp folder); primary file saved via rfpSessions.saveRfpFile
- [x] PDF + DOCX → rfp_parser skill (LLM extraction); XLSX → client-side SheetJS parse (sheet_to_csv, first 30 rows x 5 sheets)
- [x] Per-file upload/extracting/done/error status icons in processing view
- [x] Review card shows full file manifest with type badge, label badge, and status icon
- [x] XLSX structured data note appended to scope summary
- [x] Step 2 (Go/No-Go) unchanged
- [x] fflate 0.8.3 added as dependency (xlsx already present)
- [x] Zero TypeScript errors, 16/16 vitest tests pass

## Opportunities — Manual Entry Form (v3.1)
- [x] New Opportunity button on Opportunities page header
- [x] Full manual entry dialog: Title, Agency/Client, RFP Number, Estimated Value, Due Date, Service Lines, Source dropdown, Description/Notes, Attachments
- [x] Live DB opportunities merged with demo data in the opportunities list (DB badge shown)
- [x] Calls opportunities.create tRPC mutation, invalidates list on success

## Proposal Launchpad — Manual Entry Path (v3.1)
- [x] Step 1 now shows an entry mode chooser: "Upload RFP Package" vs "Enter Manually"
- [x] Manual entry form: Title, Agency, RFP Number, Due Date, Estimated Value, Service Lines, Scope Summary
- [x] Manual path skips file upload and processing — goes directly to review → Go/No-Go
- [x] Step indicator adapts to show 2 steps (Enter Details → Go/No-Go) for manual mode
- [x] Back button returns to mode chooser from either path
- [x] Reset clears entryMode back to "choose"

## DAM Duplicate Detection & Versioning (v3.2)
- [x] Part 1: File-level duplicate detection (check fileName match before autoExtract, show Replace/Keep Both/Cancel)
- [x] Part 2: Content-level duplicate detection per docType
- [x] Part 3: Resume versioning — resumeVersion + pursuitContext columns, dropdown in upload form
- [x] Part 4: replaceFile procedure for updating existing record's file
- [x] Part 5: Knowledge Hub display — resume version badge, firmRole badge, owner field in library cards
- [x] Schema: added resumeVersion, pursuitContext columns to dam_documents
- [x] Server: checkFileDuplicate, checkContentDuplicate, replaceFile procedures
- [x] Client: duplicate banners (file-level amber, content-level orange), version/role fields in upload form

## DAM Multi-Project Resume UX Fix
- [x] When autoExtract returns multiProject=true, auto-set docType to "resume" on upload form
- [x] Keep Staff Name and Company Entity fields visible on upload form for multi-project resumes
- [x] Propagate staffName and companyTag from upload form to all split project records on Create X Records
- [x] Disable "Confirm & Save" button when multiProject=true, show redirect banner to split panel

## DAM Resume Upload Fix
- [x] When docType=resume, never trigger split panel — save one resume record with projects[] in extractedMeta
- [x] Split panel (multi-project) only triggers for project_sheet and past_proposal docTypes
- [x] Resume record shows staff name, entity, project count badge in library grid
- [x] autoExtract: when docType=resume, return multiProject=false regardless of project count

## Knowledge Hub — Bulk Extract & Batch Upload
- [x] Batch upload: enforce max 10 files at a time in the multi-file drop zone
- [x] Auto-extract checkbox on upload form: when checked, trigger extraction automatically after each file is saved
- [x] Bulk extract: selection mode in library grid (checkboxes appear on hover)
- [x] Bulk extract: "Extract Selected" button in toolbar when 1+ documents selected
- [x] Bulk extract: sequential processing with per-file status (queued → processing → done/error)
- [x] Bulk extract: progress panel showing overall count and current file being processed
- [x] Bulk extract: only selectable for non-indexed documents (already indexed are greyed out)

## Knowledge Hub — Page-Count-Aware Extraction Routing
- [x] Add extractionMethod column to dam_documents (values: llm_single_pass | xml_shredder)
- [x] Add pageCount column to dam_documents (integer, null for non-PDF)
- [x] triggerExtract: detect PDF page count via pdf-parse before choosing extraction method
- [x] triggerExtract: 1-8 pages → llm_single_pass (all docTypes)
- [x] triggerExtract: 9+ pages AND docType in (past_proposal, rfp, boilerplate) → xml_shredder
- [x] triggerExtract: project_sheet and resume always use llm_single_pass regardless of page count
- [x] Create damShredder.ts adapter: runs xml_shredder pipeline, converts XML → DAM JSON schema
- [x] Both paths write extractionMethod and pageCount to the DAM record
- [x] Zero new tRPC routers added

## Proposal Workspace — RFP Data Flow & Scroll Fix
- [x] Link Launchpad rfpSession to the new proposal so Workspace uses existing parsed RFP data
- [x] Fix Proposal Workspace scroll clipping — content still cut off at viewport bottom

## Pursuit ↔ Proposal ↔ rfpSession Wiring
- [x] Add rfpSessionId column to pursuits table and save it when GO creates the pursuit
- [x] Proposal inherits pursuit metadata: copy serviceLines, dueDate, estimatedValue from pursuit to proposal on create
- [x] Verify Generate Proposal reads rfpSession extractedData and skillOutputs

## Proposals & Pursuits — Delete Actions
- [x] Add delete mutation to proposals router (cascade-deletes linked rfpSessions, sections, tailored resumes)
- [x] Add delete button (trash icon) to proposal cards on hover
- [x] Add delete mutation to pursuits router (cascade-deletes linked proposals, sessions, tasks)
- [x] Add delete button to pursuit cards

## LLM Configuration System — Multi-Provider Routing (v3.3)
- [x] Refactor llmSkill.ts DEFAULT_SKILLS: add new skill types with correct provider/model defaults
- [x] Update DEFAULT_SKILLS model assignments: rfp_parser→Gemini 2.5 Flash, go_no_go_advisor→Claude Sonnet 4, proposal_writer→Claude Sonnet 4, proposal_scorer→Claude Sonnet 4, conflict_detector→Claude Sonnet 4, tailored_resume→Claude Sonnet 4
- [x] Update resolveApiKey: fall back to ENV keys for each provider
- [x] Fix callOpenAICompat: strip file_url content parts for non-Gemini providers
- [x] Fix callGemini: use Google Generative AI OpenAI-compat endpoint with file_url support
- [x] Fix shredSingleFile: detect provider from ai_skills config
- [x] Fix max_tokens hardcoding in llm.ts: respect caller-specified maxTokens param
- [x] Update Settings AI Skills UI: show provider API key fields with ENV fallback indicator
- [x] Run TypeScript check and fix all errors
- [x] Run tests and ensure all pass

## Token Usage Logging & Visibility (v3.3)
- [x] Schema: add llm_usage_logs table (id, skillType, provider, model, tokensIn, tokensOut, estimatedCost, durationMs, userId, createdAt)
- [x] Log every invokeLLMWithSkill call to llm_usage_logs with token counts from API response
- [x] Add aiSkills.usage query: monthly aggregation by skill type
- [x] Settings AI Skills UI: add Usage tab showing monthly token consumption table and estimated cost per skill

## Switch Gemini to Native Google Generative AI SDK (v3.4)
- [x] Install @google/generative-ai npm package
- [x] Rewrite callGemini in llmSkill.ts: use native SDK with proper file_url/inline_data support
- [x] Keep full preview model strings: gemini-2.5-flash-preview-05-20, gemini-2.5-pro-preview-05-06
- [x] Remove google_gemini case from resolveEndpoint
- [x] Update sanitizeMessagesForProvider: Gemini now uses native SDK

## AI Settings UX Restructure — Global Provider Keys (v3.5)
- [x] Remove per-skill API key fields from the UI
- [x] Add "Provider API Keys" section at top of AI Settings: one field each for OpenAI, Anthropic, Google Gemini
- [x] Per-skill config shows only: provider dropdown + model selector
- [x] Update resolveApiKey in llmSkill.ts: reads from app_settings first, then ENV, then errors
- [x] Remove apiKey column usage from ai_skills table (keep column for backward compat but ignore it)
- [x] Cache app_settings lookups (30s TTL) to avoid DB hit on every LLM call
- [x] Finish native Gemini SDK migration (zero TypeScript errors)

## Proposal Launcher — Granular Progress Indicators (v3.6)
- [x] Add subStepMessage field to SkillStateEntry type in shared/workflowTypes.ts
- [x] Write subStepMessage updates into workflowState during shredding loop in rfpSessions.ts
- [x] Write subStepMessage for rfp_parser LLM call ("Parsing RFP with Gemini...")
- [x] Poll getById every 2s during executeSkill call in ProposalLaunchpad.tsx
- [x] Update processingStatus with subStepMessage from workflowState.rfp_parser
- [x] Make status text more prominent (font-medium, full width, larger text)

## Knowledge Hub Consolidation & Image Upload (v3.7)
- [x] Audit ResourceLibrary.tsx: identify any unique doc types or backend procedures not in KnowledgeHub
- [x] Remove ResourceLibrary page from App.tsx routes
- [x] Remove Resource Library from sidebar navigation
- [x] Merge any unique Resource Library doc types into Knowledge Hub docType filter
- [x] Add image upload support to Knowledge Hub: accept JPG, JPEG, PNG, TIFF
- [x] Skip triggerExtract for image uploads; invoke dam_image_caption skill instead
- [x] Image upload form fields: Project association, Location, Year taken, Photographer, Usage rights
- [x] Store caption as extractedText, full vision output as extractedMeta in DAM document records
- [x] Show image thumbnail in Knowledge Hub grid instead of document icon for image assets
- [x] Add 'Images' as a docType filter option in the Knowledge Hub toolbar

## Image Upload Support — Phase 1 (v2.5)
- [x] dam.ts: Add "image" to DOC_TYPES and createInput/updateMetaInput schemas
- [x] dam.ts: Add IMAGE_MIME_TYPES set and isImageMime() helper
- [x] dam.ts: triggerExtract — image fast-path invokes dam_image_caption skill
- [x] dam.ts: autoExtract — image fast-path returns image docType defaults
- [x] schema.ts: Add imageQuality, hasPersonnel, structureType columns to dam_documents
- [x] db:push: Migration applied
- [x] llmSkill.ts: Update dam_image_caption system prompt to AEC image analyst
- [x] KnowledgeHub.tsx: Full image upload support with metadata fields and thumbnail display

## Bulk Image Import — Parts 1-9 (Phase 2)
- [x] BulkImageImport.tsx component created (Parts 1-9)
- [x] Part 1: Bulk Import Images button in KnowledgeHub toolbar
- [x] Part 2: Drop zone — multi-file drag-and-drop, thumbnail grid preview
- [x] Part 3: Folder name parsing — project name hint from last folder
- [x] Part 4: Upload stage — parallel batches of 10, per-file status icons
- [x] Part 5: Gemini Vision captioning queue — batches of 5 with 500ms delay
- [x] Part 6: Smart grouping UI — groups by structureType with icons
- [x] Part 7: Group-level metadata sheet — project, company, usage rights, year range
- [x] Part 8: Review panel for flagged images — larger thumbnail, Gemini output, manual caption
- [x] Part 9: Confirm and create — sticky footer, ready/needs-review counts, create progress bar
- [x] Part 10: Quality filter (All/High/Medium/Low) in KnowledgeHub toolbar
- [x] TypeScript: zero errors

## Extraction Tier Control — Proposal Launchpad (v3.8)
- [x] Add EXTRACTION_TIER type and DOC_TYPE_TIER map to shared/types.ts
- [x] Update classifyFile() in rfpSessions.ts to return tier alongside type/label
- [x] Apply metadata-only path in shredding loop (skip LLM, store title/pageCount/fileSize)
- [x] Apply SheetJS path for fee_schedule XLSX files (no LLM)
- [x] Add Full Extract / Metadata Only / SheetJS badge to manifest in ProposalLaunchpad.tsx
- [x] Zero TypeScript errors after changes

## Two-Pass File Pre-Classification — Proposal Launchpad (v3.9)
- [x] Extend QueuedFile type: add confidence, keyEvidence, pageCount, pass2Running fields
- [x] Pass 1: PDF page count reader (client-side, read PDF header bytes via FileReader)
- [x] Pass 1: Updated guessLabel — XLSX→fee_schedule (high), generic names→unclassified
- [x] Pass 1: Assign confidence (high/medium/unclassified) to each file on drop
- [x] Pass 2: Add classifyFile protected procedure to rfpSessions router
- [x] Pass 2: classifyWithGemini helper in ProposalLaunchpad — upload file, call classifyFile mutation
- [x] Pass 2: Run in parallel for all unclassified/medium-confidence files after drop (batches of 5)
- [x] Manifest UI: confidence badge, keyEvidence subtitle, page count, extraction depth badge
- [x] Manifest UI: auto-open label dropdown for low-confidence files
- [x] Pre-process warning dialog: "X files need review" with Review Now / Process Anyway options

## Quick Signal Pre-Score — Proposal Launchpad (v4.0)
- [x] Schema: add firm_settings table (id, firmName, serviceLines JSON, states JSON, typicalValueMin, typicalValueMax, minDaysToRespond, preferredAgencies JSON, createdAt, updatedAt)
- [x] Schema: push migration (pnpm db:push)
- [x] Server: add firmSettings router (get, upsert procedures)
- [x] Settings: add Firm Profile tab with service lines multi-select, states multi-select, value range inputs, min days to respond, preferred agencies list
- [x] Extend classifyFile procedure: for main_rfp files only, add quickSignals object to response
- [x] ProposalLaunchpad: after Pass 2 completes, read quickSignals from main_rfp classification result
- [x] ProposalLaunchpad: client-side Quick Signal scoring — score 6 factors against firm profile
- [x] ProposalLaunchpad: Quick Signal card UI — signal strength badge, 6-factor checklist, red flag chips
- [x] ProposalLaunchpad: "Process & Full Analysis" and "Archive This RFP" buttons
- [x] Archive path: create opportunity record with status=archived via trpc.opportunities.create
- [x] Zero TypeScript errors

## Per-Entity Firm Profile (v4.1)
- [x] Schema: add entityId (text, nullable FK to entities) to firm_settings table; unique constraint on entityId
- [x] Schema: push migration (pnpm db:push)
- [x] Server: update firmSettingsRouter.get to accept optional entityId param
- [x] Server: update firmSettingsRouter.upsert to accept entityId; upsert by entityId
- [x] Settings Firm Profile tab: add entity switcher (JPCL / Strans toggle) at top
- [x] ProposalLaunchpad: read active entity from EntitySwitcher context; pass correct entity's firm profile to Quick Signal scorer
- [x] Docs: update ARCHITECTURE.md, SPECIFICATIONS.md, CLAUDE.md, FEATURE_CATALOG.md, README.md with per-entity firm profile notes
- [x] Push all changes to GitHub
- [x] Zero TypeScript errors, 25/25 tests passing

## Proposal Workspace Fix (v4.2)
- [x] Audit: list all skillTypes called in Proposal Workspace code vs ai_skills DB records
- [x] Enforce seeding rule: removed hardcoded provider/model from seedDefaultSkills()
- [x] Seed missing ai_skills records (win_theme_generator, requirements_matrix_builder, executive_summary_writer, technical_approach_writer, firm_qualifications_writer, project_experience_writer, key_personnel_writer)
- [x] Update autoExtract, triggerExtract, dam_image_caption, conflict_detector prompts
- [x] Fix buildSkillVariables: async function now queries pursuit, rfpSession, firm_settings, wiki, personnel, projects from DB
- [x] Fix mapToSkillType: routes to dedicated skill types
- [x] Fix proposal draft generation orchestration: await async buildSkillVariables in executeSkill
- [x] Add substitution validator: check for unresolved {variable} patterns before LLM call
- [x] Each section saved to proposal record immediately on completion
- [x] Proposal Workspace UI: live progress indicator per section
- [x] Full draft display with inline-editable sections, autosave-on-blur, score badges
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub
- [x] Live generation chain verified: win_themes + technical_writer ran against real DB data

## AI Skills outputType Column (v4.3)
- [x] Schema: add outputType column to ai_skills table (text, default 'prose')
- [x] Schema: push migration (pnpm db:push)
- [x] seedDefaultSkills: include outputType for all 23 skill records per spec
- [x] SQL: update any existing ai_skills rows in DB with correct outputType values
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Proposal Workspace Output Renderers (v4.4)
- [x] Build SkillOutputRenderer component: routes by outputType (prose | json | json_with_prose | unknown)
- [x] Prose renderer: inline rich text editor
- [x] WinThemeCards renderer: styled cards with title, statement, rationale, proof fields
- [x] ComplianceChecklist renderer: table with requirementId, requirement, proposalSection, status badge
- [x] ConflictCards renderer: list of conflict cards with severity badge
- [x] ProposalScorecard renderer: criterion bars with scores, overall score ring, gaps list
- [x] Fallback renderer: monospace code block + warning banner for unknown outputType
- [x] Wire SkillOutputRenderer into Proposal Workspace section display
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Dynamic outputType + Renderer Backlog (v4.5)
- [x] Replace static SKILL_OUTPUT_TYPE map with dynamic lookup from ai_skills records fetched at runtime
- [x] Verify ProseEditor onSaved callback writes to DB (trpc.rfpSessions.updateSkillOutput)
- [x] Add WORKFLOW_SKILL_TO_SKILL_TYPE mapping to shared/workflowTypes.ts
- [x] Add outputType to aiSkills.list in-memory fallback and both seed paths
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Proposal Launchpad Step 3 — Asset Matching (v4.6)
- [x] Schema: add selectedProjectIds, selectedPastProposalIds, selectedPersonnel to pursuits table
- [x] Schema: push migration (pnpm db:push)
- [x] Server: dam.matchProjectSheets, dam.matchResumes, dam.matchPastProposals queries
- [x] Server: dam.searchForAssetMatching query
- [x] Server: pursuits.saveAssetSelections mutation
- [x] Client: AssetMatchingPanel component with 3 sections (project sheets, resumes, past proposals)
- [x] Client: wire AssetMatchingPanel into Launchpad flow after GO click
- [x] Client: Continue Anyway button when no assets selected
- [x] Server: update buildSkillVariables() to read selectedProjectIds, selectedPersonnel, selectedPastProposalIds
- [x] Client: 'Edit Asset Selections' button in Proposal Workspace toolbar
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Proposal Workspace Step 4 Phase A — Proposal Generation with Live Per-Section Scoring (v4.7)
- [x] Shared types: SECTION_TO_SKILL_MAP, ProposalSection interface, SectionStatus type, DEFAULT_SECTIONS
- [x] Server: add generateSection procedure (generates one section + scores it)
- [x] Server: add generateFullProposal procedure (sequential generation of all sections)
- [x] Server: update buildSkillVariables() with section context
- [x] Client: three-panel workspace layout (left navigator, center editor, right scorecard)
- [x] Client: Section Navigator — RFP-driven section list with status badges, score badges
- [x] Client: Section Editor — SkillOutputRenderer for content, Generate/Regenerate/Save buttons
- [x] Client: Section Scorecard — score ring, criteria coverage checklist, improvements list
- [x] Client: Generate Full Proposal button with confirmation dialog
- [x] Client: Compliance dashboard bar at top
- [x] Client: Regenerate with gap feedback injection
- [x] Client: editedContent tracking — preserve AI draft, show 'Edited' badge
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Proposal Launchpad — Main RFP Designation Fixes (v4.8)
- [x] Fix 1: guessClassification: RFP keyword path → 'Supplemental' (not 'Main RFP')
- [x] Fix 2: mainRfpFileId state added; Designate Main RFP blue panel with radio buttons
- [x] Fix 3: Confirmed — Launchpad manifest renders from queue (session-local React state) only
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Launchpad Processing Kill Switch (v4.9)
- [x] Add Cancel Processing button to the Processing RFP Package step in ProposalLaunchpad
- [x] abortRef pattern: checks abort flag between every upload, extract, and poll iteration
- [x] Zero TypeScript errors, push to GitHub + checkpoint

## Gemini Retry-with-Backoff + Launchpad Cancel Button (v4.9)
- [x] llmSkill.ts: retryWithBackoff() helper — max 3 retries, 5/15/30s delays, retry on 503/429/502 only
- [x] llmSkill.ts: callGeminiNative() wraps genModel.generateContent() with retryWithBackoff()
- [x] Launchpad: abortRef pattern — Cancel button sets abortRef.current=true
- [x] Zero TypeScript errors, 25/25 tests passing
- [x] Push to GitHub + checkpoint

## Launchpad UX Fixes (v4.10)
- [x] Main RFP radio auto-sync: selecting a file as Main RFP automatically sets its label dropdown to "Main RFP"
- [x] Real-time processing status log panel with timestamps and icons (✅/⏳/⚠️/❌/ℹ️)
- [x] Current step indicator above log with elapsed seconds
- [x] Elapsed time display per step with 2-minute amber warning banner
- [x] Cancel button context text: "Cancel — stops processing, files already uploaded are preserved"
- [x] Gemini retry notices surfaced via retryMessage field polled from DB
- [x] Zero TypeScript errors, 25/25 tests passing

## Step 3 Asset Matching — Fallback to All Indexed Docs (v4.11)
- [x] matchProjectSheets, matchResumes, matchPastProposals fall back to all indexed docs when no tag overlap found
- [x] Amber fallback banner: "No direct service line matches found — showing all available assets."
- [x] Zero TypeScript errors, 25/25 tests passing

## Asset Matching Panel CSS Layout Fix (v4.12)
- [x] Replaced Radix ScrollArea (overflow:hidden root + absolute viewport) with plain div overflow-y:auto
- [x] All three section Cards are position:static — no sticky/fixed/absolute on any section
- [x] Sticky "Confirm Selections" footer: position:sticky; bottom:0; z-index:10
- [x] Zero TypeScript errors, 25/25 tests passing

## Section Output Rendering Fix (v4.13)
- [x] Log resolved outputType for every section (console.log in resolveOutputType)
- [x] Fix WORKFLOW_SKILL_TO_SKILL_TYPE mapping gaps via FORCE_PROSE_SKILLS constant
- [x] Add hard fallback: if skillType ends with _writer and DB outputType != prose, override to prose
- [x] Add Re-render as Prose button for sections showing as JSON/Fallback
- [x] Zero TypeScript errors, 25/25 tests passing

## Firm Profile Settings — Expanded Fields (v4.14)
- [x] Schema: extend firm_settings with 20+ new fields (legalName, foundingYear, employeeCount, description, geographicFocus, dbeCertification, mbeCertification, wbeCertification, certificationDetails, naicsCodes, ueiNumber, dunsNumber, stateRegistrations, boilerplateFirmDescription, differentiators)
- [x] Schema: push migration (pnpm db:push)
- [x] Server: extend firmSettings.get and firmSettings.upsert with all new fields
- [x] Settings Firm Profile tab: rebuilt into 7 sections (Identity, Disciplines & Geography, Certifications, Registrations & Identifiers, Agency Relationships, Contract Sizing, Proposal Content)
- [x] buildSkillVariables(): reads all new firm_settings fields and populates firmName, firmDescription, firmSize, foundingYear, firmStrengths, certifications, geographicFocus, stateRegistrations, firmServiceLines
- [x] Zero TypeScript errors, 25/25 tests passing

## RFP Parser & Win Theme Proper Renderers (v4.15)
- [x] Added RfpParserSummary component (agency/RFP#/deadline/value header cards, scope summary, service line badges, evaluation criteria table, key personnel cards, mandatory items list, page limits, conflicts)
- [x] Fixed JsonRenderer routing: rfp_parser → RfpParserSummary, win_themes → WinThemeCards, proposal_scorer → ProposalScorecard
- [x] Removed incorrect technical_outline→ComplianceChecklist mapping
- [x] Zero TypeScript errors, 25/25 tests passing

## Entities Form UUID Field Removal (v4.16)
- [x] Removed Supabase Company ID (UUID) field from Entities add/edit dialog
- [x] Users now only see Name, Short Name, Badge Color, and Default toggle
- [x] Zero TypeScript errors

## Sidebar Navigation Redesign (v2.3)
- [x] Redesign AppLayout sidebar: Option A+C — lifecycle-ordered collapsible section groups
- [x] Groups: Home, Business Development, Pursuits & Proposals, RFP Intelligence, Firm Knowledge, Contracts & Compliance, Reports & Admin
- [x] Each group is collapsible with smooth animation; active group auto-expands on navigation
- [x] Lifecycle step numbers (1–4) shown on BD-workflow groups
- [x] Collapsed sidebar shows icon-only items with rich tooltips
- [x] ConflictDetector page wired into RFP Intelligence group
- [x] RfpWiki page updated to hybrid architecture (extractIndex + query tabs)

## Firm Records Restructuring (v2.3)
- [x] Extend DB schema: add staffId column to assets table (migration 0010)
- [x] Update upload.ts: add folder param support (staff, projects, assets, rfp, proposals)
- [x] Add listAttachments / addAttachment / deleteAttachment to personnelRouter
- [x] Add listAttachments / addAttachment / deleteAttachment to projectsRouter
- [x] Create Staff.tsx page: staff cards with file attachment side panel (Sheet)
- [x] Rewrite Projects.tsx: project cards with file attachment side panel (Sheet)
- [x] Update ResourceLibrary.tsx: add Boilerplate Text tab, update description
- [x] Update AppLayout sidebar: replace firm_knowledge group with firm_records group
- [x] Remove Knowledge Hub and Assets (DAM) from sidebar nav
- [x] Add /staff route to App.tsx
- [x] TypeScript check: 0 errors
- [x] All 25 vitest tests passing
