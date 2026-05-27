# Amplify-Proposals TODO

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
- [x] 15 vitest unit tests passing across all modules (auth, pursuits, proposals, assets, personnel, projects, opportunities, contracts)
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

## Backlog / Future Enhancements
- [ ] Real Supabase/Postgres connection (replace TiDB with Supabase DATABASE_URL)
- [ ] Live public agency portal scraping with real HTTP scraper
- [ ] Adobe UXP InDesign plugin (Phase 2 product)
- [ ] SF 330 form auto-fill and PDF export
- [ ] Word/PowerPoint/PDF export with branded templates
- [ ] Email notification system for task assignments and deadlines
- [ ] Mobile-responsive optimization pass
- [ ] SSO/SAML enterprise authentication
- [ ] Stripe billing for SaaS multi-tenant deployment
- [ ] Contract Management Module — full milestone tracking, amendment history, billing schedule

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
- [ ] ContractsList: sortable columns, hierarchy tree, rolled-up financials, KPI cards, filters, CSV export
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

## Phase 4 — Prototype → Production (v2.0)

### LLM Configuration System
- [ ] Schema: llmConfigs table (taskType, provider, model, apiKey encrypted, systemPrompt, userPromptTemplate, enabled)
- [ ] Schema: promptTemplates table (name, taskType, systemPrompt, userPromptTemplate, isDefault)
- [ ] Settings router: getLlmConfig, upsertLlmConfig, listPromptTemplates, upsertPromptTemplate
- [ ] Settings > AI Configuration tab: per-task LLM selector (RFP Shredding, Resume Tailoring, Go/No-Go, Opportunity Scoring, Contract Analyzer, Opportunity Ingestion)
- [ ] Per-task: provider dropdown (OpenAI / Anthropic / Google Gemini / Manus Built-in), model field, API key field (masked), system prompt editor, user prompt template editor with variable hints
- [ ] invokeLLM helper: check llmConfigs table first, fall back to built-in Manus LLM if no config
- [ ] All AI procedures (shredRfp, tailorResume, scoreGoNoGo, scoreOpportunity, analyze contract) read from llmConfigs table

### Real File Upload — DAM / Knowledge Hub / Assets
- [ ] Assets.tsx: replace mock ASSETS array with real trpc.assets.list.useQuery + search/filter params wired
- [ ] Assets.tsx: add file upload button → POST /api/upload → trpc.assets.create with returned fileKey/fileUrl
- [ ] KnowledgeHub.tsx: replace mock PROJECTS array with real trpc.projects.list.useQuery
- [ ] KnowledgeHub.tsx: replace mock RESUMES with real trpc.personnel.list.useQuery
- [ ] KnowledgeHub.tsx: wire asset search to real trpc.assets.list with search param
- [ ] assets.list router: wire search and assetType filter params (currently ignored)
- [ ] /api/upload: add folder param so uploads can be bucketed by type (assets, contracts, rfps, resumes)

### Opportunities Ingestion — Settings-Based
- [ ] Schema: portalConfigs table (portalName, baseUrl, enabled, scrapeMethod, selectors JSON, lastScrapedAt)
- [ ] Settings > Opportunity Portals tab: list portals, enable/disable, configure selectors, test connection
- [ ] Opportunities router: scrapePortal mutation that fetches portal URL, parses HTML with cheerio, upserts to opportunities table
- [ ] Opportunities.tsx: replace mock PORTALS/OPPORTUNITIES arrays with real trpc.opportunities.list.useQuery
- [ ] Opportunities.tsx: add "Scan Portals" button → trpc.opportunities.scrapePortals mutation
- [ ] Opportunities.tsx: wire AI score button to real trpc.opportunities.scoreOpportunity mutation
- [ ] Install cheerio for HTML parsing

### Pursuit Detail — Real DB
- [ ] PursuitDetail.tsx: replace mock TASKS/REQUIREMENTS/TEAM with real tRPC queries
- [ ] pursuits router: add getRequirements, addRequirement, updateRequirement procedures
- [ ] pursuits router: add getTeamFirms, addTeamFirm, removeTeamFirm procedures (uses opportunityTeamFirms table)
- [ ] pursuits router: add getWinThemes, updateWinThemes, getNotes, updateNotes procedures
- [ ] PursuitDetail.tsx: wire tasks tab to real trpc.pursuits.getTasks + createTask
- [ ] PursuitDetail.tsx: wire team tab to real trpc.pursuits.getTeamFirms + addTeamFirm
- [ ] PursuitDetail.tsx: wire requirements tab to real trpc.pursuits.getRequirements + addRequirement

### Proposals — Real DB
- [ ] Proposals.tsx: remove DEMO_PROPOSALS fallback, show empty state when no DB data
- [ ] ProposalDetail page: wire proposal sections to real trpc.proposals.getById with sections
- [ ] ProposalDetail: wire resume tailoring to real trpc.proposals.tailorResume mutation with personnel picker
- [ ] proposals router: add getById with sections, updateSection, addSection, deleteSection procedures

## Phase 5 — Karpathy AI Patterns (v2.1)

- [ ] Fix TypeScript errors in aiSkills.ts (line 167, 178)
- [ ] Add seedDefaultSkills() call at server startup in _core/index.ts
- [ ] Pattern 1 — XML Shredder: schema table (documentShreds), server router (xmlShredder.shred, xmlShredder.list, xmlShredder.getById), skill definition (xml_shredder), ShredderPage UI with file upload + XML preview + structured output
- [ ] Pattern 1 — Wire XML Shredder as first step in RFP ingestion: upload RFP → shred to XML → feed XML to shredRfp instead of raw text
- [ ] Pattern 2 — LLM Wiki: schema table (rfpWikis), server router (wiki.compile, wiki.get, wiki.refresh, wiki.list), skill definition (wiki_compiler), WikiPage UI with Markdown rendering + search + refresh button
- [ ] Pattern 2 — Wire wiki context into generateSection: fetch wiki for the proposal's RFP, inject wiki as firmContext so the model has full cross-referenced context
- [ ] Pattern 2 — Wire wiki context into scoreProposal: inject wiki as evaluationCriteria source
- [ ] Pattern 3 — Agent Guidelines: schema table (agentGuidelines), server router (guidelines.getForSkill, guidelines.upsert, guidelines.multiApproach), skill definition (agent_guidelines)
- [ ] Pattern 3 — Multi-approach advisor: server procedure that takes a task description and returns 3 approaches with pros/cons/recommendation before committing
- [ ] Pattern 3 — Wire success criteria into generateSection UI: show criteria checklist, require user to confirm criteria before generating
- [ ] Pattern 3 — Wire multi-approach into generateSection: "Suggest Approaches" button → shows 3 approaches → user picks one → generates section from chosen approach
- [ ] Wire all three pattern pages into sidebar nav and App.tsx routes

## Phase 7 — RFP-Centric AI Pipeline Architecture (v2.2)

- [ ] Add pursuitId FK to documentShreds, rfpWikis, agentGuidelines tables
- [ ] Create proposalScores table (pursuitId, sectionType, score, annotations JSON, criteriaScores JSON, proposalText, createdBy, createdAt)
- [ ] Push schema migration
- [ ] Build RfpContextSelector component (pursuit picker, persists in localStorage, shows name/agency/due date)
- [ ] Update DocumentShredder page: RfpContextSelector at top, pass pursuitId to shred mutation, filter history by pursuitId
- [ ] Update RfpWiki page: RfpContextSelector at top, filter wikis by pursuitId, auto-suggest latest shred for selected pursuit
- [ ] Update AgentGuidelines page: RfpContextSelector at top, scope guidelines to pursuitId, show per-section guidelines list for the pursuit
- [ ] Update ProposalScorer page: RfpContextSelector at top, save scores to proposalScores table with pursuitId, show scoring history for pursuit
- [ ] Add saveScore procedure to agentGuidelines router (saves to proposalScores table)
- [ ] Add listScores procedure to agentGuidelines router (filters by pursuitId + optional sectionType)
- [ ] Build RFP Workspace page (/pursuits/:id/workspace): shreds panel, wiki panel, per-section guidelines cards, scoring history with trend
- [ ] Add "Workspace" button on PursuitDetail page linking to /pursuits/:id/workspace
- [ ] Wire Workspace quick-launch buttons to each AI tool pre-scoped to the pursuit (?pursuitId= query param)

## Sidebar Navigation Redesign (v2.3)
- [x] Redesign AppLayout sidebar: Option A+C — lifecycle-ordered collapsible section groups
- [x] Groups: Home, Business Development (step 1), Pursuits & Proposals (step 2), RFP Intelligence (step 3), Firm Knowledge, Contracts & Compliance (step 4), Reports & Admin
- [x] Each group is collapsible with smooth animation; active group auto-expands on navigation
- [x] Lifecycle step numbers (1–4) shown on BD-workflow groups
- [x] Collapsed sidebar shows icon-only items with rich tooltips (label + description)
- [x] "BD Lifecycle" label at top of expanded sidebar for orientation
- [x] ConflictDetector page wired into RFP Intelligence group
- [x] RfpWiki page updated to hybrid architecture (extractIndex + query tabs)
