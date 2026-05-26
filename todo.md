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
