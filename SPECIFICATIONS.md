# Amplify Proposals — Product Specification

**Version:** 3.7 (May 31, 2026)
**Status:** Active Development — Production-Ready Core
**Audience:** Engineering, Product, Investors, Prospective Integrators

---

## 1. Product Vision

Amplify Proposals is an AI-powered proposal intelligence platform purpose-built for Architecture, Engineering, and Construction (AEC) firms operating in the NJ/NY/NYC public-sector market. It unifies the full pursuit lifecycle — from opportunity discovery through contract execution — in a single, deeply integrated system that replaces the fragmented combination of SharePoint folders, Excel trackers, Deltek, and manual InDesign workflows that most mid-size AEC firms rely on today.

The platform is designed to be the institutional memory of a BD and proposal team: every past project, every resume, every RFP, every contract, and every photo the firm has ever produced is indexed, searchable, and immediately available to the AI at proposal time.

---

## 2. Target Users

| Role | Primary Use Cases |
|------|------------------|
| **BD Director / Principal** | Go/No-Go decisions, pipeline visibility, win-rate analytics |
| **Proposal Manager** | RFP intake, section assembly, deadline tracking, team coordination |
| **Technical Staff** | Resume tailoring, project sheet updates, qualification uploads |
| **Contract Administrator** | Contract creation, amendment tracking, NTE/billing management |
| **Firm Principal / Owner** | Executive dashboard, compliance oversight, financial KPIs |

---

## 3. Core Modules

### 3.1 Proposal Launchpad (`/launch`)

The Launchpad is the primary entry point for new pursuits. It is a two-step wizard that converts a raw RFP package into a structured pursuit record in under five minutes.

**Step 1 — RFP Ingestion** accepts multi-file packages (PDF, DOCX, XLSX, ZIP). ZIP files are extracted client-side using `fflate` before upload; each inner file is queued individually. A per-file label selector (Main RFP, Scope of Work, Appendix, Addendum, Fee Schedule, Reference Doc, Other) auto-guesses from filename keywords. PDF and DOCX files are processed through the `rfp_parser` LLM skill; XLSX files are parsed client-side with SheetJS (up to 5 sheets × 30 rows). An alternative **Manual Entry** path allows BD staff to enter title, agency, RFP number, due date, estimated value, service lines, and scope summary without uploading any files.

**Step 2 — Go/No-Go Scoring** invokes `proposals.scoreGoNoGo` and returns a 0–100 score with color-coded recommendation (GO / NO-GO / CONDITIONAL GO), plus structured strengths, risks, and win themes. A GO decision creates a pursuit record and redirects to the Pursuit Detail page.

### 3.2 Pursuits & Pipeline (`/pursuits`, `/pipeline`)

The pursuit module tracks every active bid from identification through award. Each pursuit record carries: title, agency/client, RFP number, due date, estimated value, service lines, status (identified → active → submitted → awarded / no-award), and a linked rfpSession for AI workflow state.

The Pipeline view provides a Kanban-style board across pursuit stages with drag-to-advance functionality. The Bid Calendar (`/bid-calendar`) shows upcoming due dates in a monthly calendar view with color-coded urgency.

### 3.3 Proposal Workspace (`/proposals/:id/workspace`)

The Workspace is a sequential AI skill orchestrator that walks a proposal team through a defined workflow for each pursuit. Skills execute one at a time in strict order; the system resumes from the last completed skill on re-entry. Each skill's output is editable before the next skill runs.

The current skill sequence is: `rfp_parser` → `compliance_matrix` → `scope_analysis` → `win_themes` → `key_personnel` → `past_performance` → `fee_estimator` → `executive_summary` → `technical_approach` → `management_plan` → `quality_control` → `final_review`.

Individual skills can be re-run without resetting downstream outputs. A per-skill progress sidebar shows completion status, live score, and error state.

### 3.4 Knowledge Hub (`/knowledge-hub`)

The Knowledge Hub is the firm's unified digital asset management (DAM) system for all proposal-relevant content. It replaces both the legacy Resource Library and the separate Assets page.

**Supported document types:**

| Type | Description | AI Processing |
|------|-------------|---------------|
| `resume` | Staff qualifications | Section extraction, skills/certs tagging, multi-project split |
| `project_sheet` | Past project briefs | Owner/client/role extraction, project number, service lines |
| `past_proposal` | Prior submissions | RFP number, win/loss, section extraction |
| `certification` | DBE/MBE/WBE/SDVOB certs | Staff linkage, expiry date |
| `rfp` | Archived RFP packages | Conflict detection, wiki compilation |
| `contract` | Executed contracts | Contract number, parties, value |
| `boilerplate` | Firm narrative blocks | Category, service line, word count |
| `content_library` | Reusable content assets | Free-form tagging |
| `reference_doc` | Technical references | Free-form tagging |
| `image` | AEC project photography | Gemini Vision captioning, AEC metadata |

**Upload pipeline:** Files are uploaded via `POST /api/upload` to Supabase Storage (private `dam` bucket, 50 MB limit). `autoExtract` runs a fast LLM pass to pre-fill the upload form. After the user confirms metadata, `triggerExtract` runs a full structured extraction pass and writes `extractedText`, `extractedMeta`, and `tags` back to the record.

**Image-specific pipeline:** Image files (JPG, JPEG, PNG, TIFF, WEBP) bypass the document extraction path entirely. `triggerExtract` routes them to the `dam_image_caption` skill (Gemini Flash vision), which returns a structured 9-field JSON object. The caption is stored as `extractedText`; the full JSON is stored as `extractedMeta`; `imageQuality`, `hasPersonnel`, and `structureType` are written to dedicated columns.

**Duplicate detection:** File-level duplicate detection matches by filename; content-level detection uses per-docType logic (project number for project sheets, staff name + version for resumes, RFP number for RFPs). Users are presented with Replace / Keep Both / Cancel options.

**Bulk Extract:** Selection mode allows batch AI extraction of up to 10 unindexed documents at once, processed sequentially with a 1.5-second rate-limit delay.

**Filtering:** Documents can be filtered by docType, company entity (JPCL / Strans / Both), processing status, and free-text search. When the Images filter is active, a Quality filter (High / Medium / Low) appears.

### 3.5 Bulk Image Import (`/knowledge-hub` → modal)

A dedicated full-screen modal for ingesting large batches of AEC project photography (designed for 200+ images per session). The workflow has nine stages:

1. **Drop zone** — unlimited multi-file drag-and-drop with live thumbnail preview grid.
2. **Folder parsing** — `webkitRelativePath` is parsed to extract project name hints and construction phase / setting hints from folder names before upload begins.
3. **Upload stage** — parallel batches of 10 via `POST /api/upload`; per-file status icons (waiting → uploading → uploaded → error).
4. **Captioning queue** — sequential batches of 5 through `dam.triggerExtract` with 500 ms delay; Gemini Vision returns 9-field structured output per image.
5. **Smart grouping** — images are grouped by `structureType` with AEC-specific icons (bridges, roadways, under construction, environmental sites, athletic fields, buildings, waterfront, utilities, aerial, other).
6. **Group metadata sheet** — per-group slide-out panel for project association, company tag, usage rights, year range, additional tags, and phase override.
7. **Review panel** — flagged images (low quality or `structureType = 'other'`) shown with larger thumbnail, full Gemini output, manual caption field, and group reassignment.
8. **Confirm and create** — sticky footer with ready/needs-review counts, skip-unresolved checkbox, and Create button with progress bar.
9. **Completion** — summary card with "View in Knowledge Hub" button; Images filter activated automatically.

### 3.6 AI Tools Suite

The platform includes six standalone AI tools accessible from the sidebar:

| Tool | Route | Function |
|------|-------|----------|
| **Document Shredder** | `/document-shredder` | Parses RFP documents into structured XML sections for downstream processing |
| **RFP Wiki** | `/rfp-wiki` | Compiles a cross-referenced wiki document from shredded RFP sections |
| **Conflict Detector** | `/conflict-detector` | Identifies contradictions within an RFP (differing due dates, conflicting scope language) |
| **Contract Analyzer** | `/contract-analyzer` | Extracts key terms, obligations, and risk flags from contract documents |
| **Agent Guidelines** | `/agent-guidelines` | Defines per-section success criteria and multi-approach advisor for proposal generation |
| **Proposal Scorer** | `/proposal-scorer` | Scores draft proposal sections against RFP evaluation criteria |

### 3.7 Contract Management (`/contracts`)

The contract module provides a full three-tier contract hierarchy: Primary Contract → Child Order (Task Order / Purchase Order / Phase) → Sub-Project. Tier labels are configurable per contract via the `order_types` lookup table.

**Financial model:** The system implements a sophisticated NTE vs. Authorized billing basis model. Under `NTE_CEILING` mode, child orders utilize (draw down) the parent NTE without adding to the authorized value. Under `AUTHORIZED` mode, child orders add to the parent's authorized value. Key financial KPIs computed per contract: Effective Ceiling, Committed via Task Orders, Available NTE, Total Billed, Remaining, and Average Monthly Burn with projected exhaustion date.

**Amendments:** Each amendment carries an `amountBehavior` field (`adds_to_value` / `subtracts_from_value` / `utilizes_value`) and a signed `amountChange`. The system recomputes all KPIs on every amendment save.

**QuickBooks integration:** A CSV import flow parses QB export files, matches rows by project number or QB name, upserts billing entries, and triggers financial recalculation.

**Compliance tracking:** COI (certificate of insurance) received/expiry dates, fully executed contract receipt, prime agreement on file — all tracked per contract with boolean flags and date fields.

**Bulk import:** Organizations, People, Contracts, Amendments, Billing entries, Service Types, Glossary Terms, and Opportunities can all be imported via CSV/Excel with per-row error reporting and downloadable templates.

### 3.8 Opportunities (`/opportunities`)

The Opportunities module tracks public-sector bid opportunities from identification through Go/No-Go decision. Records can be created manually via a full dialog form (title, agency, RFP number, estimated value, due date, service lines, source, description) or ingested automatically from public portals (planned). Each opportunity links to a pursuit record upon Go decision.

### 3.9 Firm Records

**Staff** (`/staff`): Personnel records with linked Supabase Auth profiles. Each staff member has a file attachment panel for resumes, headshots, and certifications. Staff records are auto-created when a resume is uploaded to the Knowledge Hub.

**Projects** (`/projects`): Project records linked to the v0 timekeeping system. Each project has a file attachment panel for photos, drawings, and reports. Project records are auto-created when a project sheet is uploaded to the Knowledge Hub.

**Glossary** (`/glossary`): Firm-specific terminology and acronym definitions, importable via CSV.

**Resource Library** (`/resource-library`): Retired page — route now redirects to `/knowledge-hub`. Boilerplate text blocks and content library items are accessible via the Knowledge Hub docType filter.

### 3.10 Settings (`/settings`)

The Settings module has fourteen tabs:

| Tab | Contents |
|-----|----------|
| **Entities** | Company entity records (JPCL, Strans) |
| **Organizations** | External organizations/firms for contracts |
| **People** | Contact/personnel records for contracts |
| **Order Types** | Contract hierarchy tier labels (Task Order, Purchase Order, Phase, etc.) |
| **Departments** | Internal department lookup |
| **Service Types** | Service type lookup for contracts |
| **Form 254 Codes** | ACEC Form 254 service classification codes |
| **Glossary** | Firm-specific terminology and acronym definitions |
| **Users** | User list from `profiles` table; Invite User dialog (Supabase Auth admin invite) |
| **Reminders** | COI expiration and contract end date reminder configuration |
| **App Settings** | App name, logo, default entity, reminder lead times |
| **AI Skills** | Per-skill system prompt and user prompt editor; provider/model selector per task; global provider API keys; monthly token usage |
| **Firm Profile** | Per-entity firm profile for Quick Signal scoring: service lines, licensed states, typical value range, min days to respond, preferred/avoided agencies. Entity toggle (JPCL / Strans) in card header. |
| **Import** | CSV/Excel bulk import for 8 data types with downloadable templates |

---

## 4. Technical Specifications

### 4.1 Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + Tailwind CSS 4 | shadcn/ui component library |
| Routing | Wouter | Client-side SPA |
| API | tRPC 11 + superjson | End-to-end type safety |
| Server | Express 4 | Node.js, single process |
| ORM | Drizzle ORM | postgres-js driver |
| Database | Supabase Postgres | Session pooler, port 6543 |
| Auth | Supabase Auth | Email/password, JWT |
| Storage | Supabase Storage | Private `dam` bucket, 50 MB limit |
| LLM | Configurable | Defaults to models defined in Settings > AI Skills; OpenAI, Anthropic, Gemini, Manus built-in supported |
| Vision | Google Gemini Flash | AEC image captioning via `dam_image_caption` skill |
| ZIP | fflate 0.8.3 | Client-side extraction |
| Excel | SheetJS 0.18.5 | Client-side parsing |
| Testing | Vitest | 25 tests across 4 files |
| Language | TypeScript | Strict mode, zero errors enforced |

### 4.2 Database

The Supabase Postgres instance contains 44 Amplify-managed tables (defined in `drizzle/schema.ts`, all UUID primary keys) alongside 66 pre-existing v0/timekeeping tables. Cross-app references use soft FK columns (no hard Postgres constraints) to avoid migration coupling.

Key Amplify tables: `dam_documents`, `contracts`, `contract_amendments`, `billing_entries`, `personnel`, `amp_projects`, `pursuits`, `proposals`, `rfp_sessions`, `opportunities`, `ai_skill_configs`, `document_shreds`, `rfp_wikis`, `assets`, `asset_tags`, `order_types`, `organizations`, `people`, `glossary_terms`, `firm_settings`.

### 4.3 LLM Architecture

All LLM calls route through `invokeLLM()` in `server/_core/llm.ts`. The system defaults to models configured in Settings > AI Skills (`ai_skill_configs` table, which stores system prompt, user prompt template, provider, model, and API key per named skill). When no config is found for a skill, the helper falls back to the Manus built-in API. No existing procedure call signatures change when a user switches providers.

Named skills currently in production: `rfp_parser`, `compliance_matrix`, `scope_analysis`, `win_themes`, `key_personnel`, `past_performance`, `fee_estimator`, `executive_summary`, `technical_approach`, `management_plan`, `quality_control`, `final_review`, `go_no_go_scorer`, `dam_image_caption`, `xml_shredder`, `wiki_compiler`, `conflict_detector`, `contract_analyzer`.

### 4.4 File Upload

All file uploads go through `POST /api/upload` (multer, 50 MB limit). Allowed top-level folders: `contract-analyzer`, `staff`, `projects`, `assets`, `rfp`, `proposals`, `dam`. The server calls `storagePut()` which appends an 8-character random hash to the key before writing to Supabase Storage. The response returns `{ url, key, fileName, size }`. Callers must persist the `key` — the `url` is a short-lived signed URL.

### 4.5 Authentication

Supabase Auth with email/password. The frontend `AuthContext` manages session state. Every tRPC request includes the Supabase JWT as a `Bearer` token. The server context validates the JWT via `supabase.auth.getUser()` and resolves the user from the `profiles` table. All routes except `/login` require authentication. Role-based access control uses the `role` field on `profiles` (`admin` | `user`); admin-only procedures check `ctx.user.role`.

---

## 5. Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Supabase Auth | Live | Email/password, JWT |
| Supabase Storage | Live | Private `dam` bucket |
| Supabase Postgres | Live | Session pooler |
| Google Gemini Flash | Live | Image captioning via Manus built-in proxy |
| QuickBooks (CSV) | Live | CSV import, billing entry upsert |
| SheetJS | Live | Client-side XLSX parsing |
| fflate | Live | Client-side ZIP extraction |
| OpenAI API | Planned | Per-task LLM config system |
| Anthropic API | Planned | Per-task LLM config system |
| Adobe InDesign (UXP) | Planned | Proposal layout export |
| Public portal scraping | Planned | Opportunity ingestion |
| SF 330 PDF export | Planned | Federal qualification form |

---

## 6. Non-Functional Requirements

**Performance:** The server runs as a single Node.js process on Cloud Run (1 vCPU, 512 MiB RAM, 180s request timeout, min-instances=0). LLM skill calls are the primary latency source (5–30s per skill); the UI shows per-skill progress indicators and supports pause/resume.

**Security:** All file storage is private (no public Supabase bucket). Signed URLs expire after 1 hour. API keys are injected via environment variables and never exposed to the client. Admin-only procedures enforce role checks server-side.

**Data integrity:** All timestamps stored as UTC milliseconds. Numeric contract values stored as Postgres `numeric` (returned as strings by Drizzle; converted with `parseFloat()` for arithmetic). UUID primary keys throughout.

**Testing:** Vitest test suite with 16 tests across `server/auth.logout.test.ts`, `server/routers/contracts.test.ts`, and `server/routers/dam.test.ts`. TypeScript strict mode enforced; zero errors required before any checkpoint.

---

## 7. Deployment

The application deploys to Manus hosting (Cloud Run backend + CDN frontend) via the Manus Management UI Publish button. A GitHub repository (`lobodasps/amplify-proposals`) is kept in sync via `webdev_save_checkpoint`. The production domain is `amplifypro-nzkhudzp.manus.space`.

---

*Last updated: May 31, 2026*
