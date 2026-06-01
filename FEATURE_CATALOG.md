# Amplify Proposals — Feature Catalog

**Version:** 4.0 (Jun 1, 2026)
**Status:** Features marked **[LIVE]** are fully implemented and deployed. Features marked **[PLANNED]** are designed but not yet built.

---

## Category 1: Proposal Intelligence & RFP Processing

This category covers everything from the moment an RFP lands to the moment a proposal is submitted. It is the core differentiator of the platform.

### 1.1 Proposal Launchpad **[LIVE]**

The Launchpad is a two-step wizard that converts a raw RFP package into a structured pursuit record and Go/No-Go recommendation in under five minutes.

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-file RFP package upload (PDF, DOCX, XLSX, ZIP) | LIVE | Up to unlimited files per package |
| Client-side ZIP extraction (fflate) | LIVE | Inner files queued individually |
| Per-file label selector with keyword auto-guess | LIVE | 12 labels: Main RFP, Scope of Work, Appendix, Addendum, Fee Schedule, Reference Doc, Cover Letter, Forms, Certificate, Supplemental, Other |
| XLSX client-side parsing (SheetJS, 5 sheets × 30 rows) | LIVE | Structured data injected into rfp_parser context |
| Multi-file manifest stored in rfp_sessions.extractedData | LIVE | Full file list with labels, keys, and URLs |
| Manual entry path (no file upload required) | LIVE | Title, agency, RFP#, due date, value, service lines, scope |
| AI Go/No-Go scoring (0–100 with recommendation) | LIVE | GO / NO-GO / CONDITIONAL GO |
| Structured strengths, risks, and win themes output | LIVE | Editable before pursuit creation |
| Automatic pursuit record creation on GO | LIVE | Redirects to Pursuit Detail |
| Granular per-file processing progress indicators | LIVE | Per-file status icons + animated progress bar |
| Two-pass pre-classification (Pass 1 heuristics + Pass 2 Gemini Flash) | LIVE | Confidence badges, key evidence, amber warnings for low-confidence files |
| Extraction tier control (Full Extract / Metadata Only / SheetJS) | LIVE | Reduces LLM calls from 15 to 3–4 on typical packages |
| Quick Signal pre-score card | LIVE | Client-side only; scores 6 factors against firm profile; 🟢/🟡/🔴 strength badge |
| Archive This RFP shortcut | LIVE | Creates archived opportunity record, skips extraction |

### 1.2 Document Shredder **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| RFP document upload and XML section extraction | LIVE | Structured output with section titles and content |
| Pursuit-scoped shred history | LIVE | Filter by pursuitId |
| Contradiction / conflict detection across sections | LIVE | Identifies differing due dates, conflicting scope language |

### 1.3 RFP Wiki **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Cross-referenced wiki compiled from shredded sections | LIVE | Markdown output with section links |
| Pursuit-scoped wiki storage | LIVE | One wiki per pursuit |
| Refresh from latest shred | LIVE | Re-runs compilation on demand |

### 1.4 Conflict Detector **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Intra-document contradiction detection | LIVE | Flags conflicting statements within a single RFP |
| Structured conflict output (location, severity, description) | LIVE | |

### 1.5 Proposal Workspace **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| 12-skill sequential AI workflow orchestrator | LIVE | rfp_parser → compliance_matrix → … → final_review |
| Strict sequential execution (no parallel skill runs) | LIVE | Prevents context contamination |
| Resume from last completed skill | LIVE | Persistent state in rfp_sessions table |
| Per-skill output editor | LIVE | Edit any skill output before proceeding |
| Re-run individual skills without resetting downstream | LIVE | |
| Pause and resume workflow | LIVE | |
| Error recovery with retry | LIVE | Per-skill error state |
| Live proposal score in progress sidebar | LIVE | 0–100 running score |
| RFP data flow from Launchpad to Workspace | LIVE | rfpSession carries parsed RFP data |
| Key personnel skill reads real staff data | PLANNED | Currently uses extracted RFP context |
| Past performance skill reads real project briefs | PLANNED | Currently uses extracted RFP context |
| Fee estimator reads real billing rates | PLANNED | Currently uses estimated values |
| Proposal export to PDF | PLANNED | |
| Adobe InDesign handoff | PLANNED | UXP plugin |

### 1.6 Proposal Scorer **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Section-level scoring against RFP evaluation criteria | LIVE | |
| Score history per pursuit | LIVE | Stored in proposalScores table |

### 1.7 Agent Guidelines **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Per-section success criteria definition | LIVE | |
| Multi-approach advisor (3 approaches with pros/cons) | LIVE | |
| Pursuit-scoped guidelines | LIVE | |

---

## Category 2: Knowledge Hub & Digital Asset Management

This category covers the firm's institutional memory — every document, resume, project sheet, and photo ever produced.

### 2.1 Document Ingestion **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Upload: PDF, DOCX, DOC | LIVE | |
| Upload: JPG, JPEG, PNG, TIFF, WEBP (images) | LIVE | |
| Drag-and-drop upload with queue | LIVE | Up to 10 files per batch |
| Auto-extract (fast LLM pass to pre-fill form) | LIVE | Runs before user confirms metadata |
| Full triggerExtract (structured LLM extraction) | LIVE | Writes extractedText, extractedMeta, tags |
| Per-docType extraction prompts | LIVE | resume, project_sheet, past_proposal, certification, other |
| Image captioning via Gemini Vision (dam_image_caption) | LIVE | 9-field AEC-specialist output |
| Auto-tagging from LLM output | LIVE | Merged from serviceLines, certifications, image tags |
| Duplicate detection (file-level and content-level) | LIVE | Replace / Keep Both / Cancel |
| Resume versioning (Short / Long / Project-Specific) | LIVE | |
| Multi-project resume split panel | LIVE | One upload → multiple project records |
| Owner / Client / Firm Role distinction | LIVE | ownerName, clientName, firmRole columns |
| Cross-record linking (staff, project) | LIVE | Auto-creates Staff/Project records on upload |
| Bulk Extract (batch AI extraction, up to 10 docs) | LIVE | Sequential with 1.5s rate-limit delay |

### 2.2 Knowledge Hub Grid & Filtering **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Filterable document grid (docType, company, status, search) | LIVE | |
| Image thumbnail display for image docType | LIVE | |
| Quality filter (High / Medium / Low) for images | LIVE | Shown only when Images filter active |
| Stats bar with per-type document counts | LIVE | |
| Document preview dialog with extracted text | LIVE | |
| Structured metadata view (project number, staff, tags) | LIVE | |
| Image metadata view (structure type, quality, setting, environment, personnel) | LIVE | |
| Selection mode for bulk operations | LIVE | |

### 2.3 Bulk Image Import **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Full-screen modal for 200+ image batch imports | LIVE | |
| Unlimited drag-and-drop with live thumbnail preview | LIVE | |
| Folder name parsing for project/phase/setting hints | LIVE | webkitRelativePath parsing |
| Parallel upload batches of 10 | LIVE | Per-file status icons |
| Gemini Vision captioning queue (batches of 5, 500ms delay) | LIVE | |
| Smart grouping by AEC structure type with icons | LIVE | 12 group types |
| Group-level metadata sheet (project, company, usage, year, tags, phase) | LIVE | |
| Review panel for flagged images (low quality / other type) | LIVE | |
| Confirm & create with progress bar | LIVE | |
| Auto-activate Images filter on completion | LIVE | |

### 2.4 Image Metadata Schema **[LIVE]**

| Column | Type | Status |
|--------|------|--------|
| `imageQuality` | text (high/medium/low) | LIVE |
| `hasPersonnel` | boolean | LIVE |
| `structureType` | text (AEC type) | LIVE |
| `photographer` | text | LIVE |
| `location` | text | LIVE |
| `yearTaken` | integer | LIVE |
| `usageRights` | text (4 options) | LIVE |

### 2.5 PDF Image Extraction **[PLANNED]**

| Feature | Status | Notes |
|---------|--------|-------|
| Server-side PDF page rendering to PNG thumbnails | PLANNED | pdf2pic / Poppler |
| Pages strip in preview dialog | PLANNED | |
| Vision LLM pass to identify and extract photographs | PLANNED | |
| Extracted photos saved as standalone image assets | PLANNED | Tagged to parent document and project |

---

## Category 3: Contract Management

### 3.1 Contract Hierarchy **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Three-tier hierarchy (Primary → Child → Sub-Project) | LIVE | |
| Configurable tier labels per contract (Task Order, PO, Phase, etc.) | LIVE | order_types lookup table |
| amountBehavior per child (adds_to / subtracts_from / utilizes / independent) | LIVE | |
| Recursive financial rollup (L1 = L1+L2+L3, L2 = L2+L3) | LIVE | |

### 3.2 Financial Model **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| NTE_CEILING vs AUTHORIZED billing basis | LIVE | Per-contract toggle |
| Effective Ceiling computation | LIVE | |
| Committed via Task Orders | LIVE | |
| Available NTE | LIVE | |
| Total Billed | LIVE | |
| Remaining | LIVE | |
| Average Monthly Burn | LIVE | |
| Projected exhaustion date | LIVE | |
| Burn-down progress bar with tick marks | LIVE | |
| Over-billed Task Order warning badge | LIVE | |
| NTE ceiling breakdown panel in FinancialSummaryCard | LIVE | |

### 3.3 Amendments & Billing **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Amendment CRUD with amountBehavior | LIVE | |
| Auto-recompute KPIs on amendment save | LIVE | |
| Billing entry management | LIVE | |
| Inline billedAmount edit on Task Order rows | LIVE | |
| QuickBooks CSV import | LIVE | Parse, preview, upsert, recalculate |
| Manual Recalculate button | LIVE | |

### 3.4 Compliance **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| COI received / expiry date tracking | LIVE | |
| Fully executed contract receipt tracking | LIVE | |
| Prime agreement on file tracking | LIVE | |
| Activity log per contract | LIVE | |

### 3.5 Contract Fields & Lookups **[LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| QB Name, Client Project Reference | LIVE | Backend + UI wired in Contracts.tsx |
| Department dropdown (from lookup) | LIVE | Backend + UI wired in Contracts.tsx |
| Service Types multi-select | LIVE | Backend + UI wired in Contracts.tsx |
| Form 254 Code dropdown | LIVE | Backend + UI wired in Contracts.tsx |
| Project Manager / Accountant dropdowns | LIVE | Backend + UI wired in Contracts.tsx |
| Public/Private sector toggle | LIVE | `isPublic` column; Select in ContractDetail Edit dialog |
| Initial contract amount editable in Edit dialog | LIVE | Number input in ContractDetail Edit dialog, seeded from contract.value |

### 3.6 Analytics **[PARTIALLY LIVE]**

| Feature | Status | Notes |
|---------|--------|-------|
| Analytics router (byClient, byOwner, byAmendmentType) | LIVE | Backend only |
| Overview tab: amendment behavior cards | PLANNED | |
| Pre-built CSV reports (6 report types) | PLANNED | |
| Query Builder tab | PLANNED | |

---

## Category 4: Opportunity Management

| Feature | Status | Notes |
|---------|--------|-------|
| Manual opportunity creation (full dialog form) | LIVE | |
| Service line multi-select chips | LIVE | |
| Source dropdown (7 options) | LIVE | |
| File attachments on opportunities | LIVE | |
| Opportunity → Pursuit conversion on Go decision | LIVE | |
| Public portal scraping / automated ingestion | PLANNED | Settings-based, configurable prompts |
| Opportunity scoring / ranking | PLANNED | |

---

## Category 5: AI Configuration & LLM Management

| Feature | Status | Notes |
|---------|--------|-------|
| Named AI skills with editable system + user prompts | LIVE | Stored in ai_skill_configs table |
| Per-skill provider/model selector in Settings | LIVE | UI built |
| Global API key management (OpenAI, Anthropic, Gemini) | LIVE | Settings → AI Skills tab |
| Default to models configured in Settings > AI Skills | LIVE | Falls back to Manus built-in when no skill config found |
| Token usage logging per skill invocation | PLANNED | |
| Token usage visibility dashboard | PLANNED | |
| Per-task LLM routing (different model per skill) | LIVE | |
| dam_image_caption AEC specialist skill | LIVE | 9-field structured vision output |

---

## Category 6: Firm Records & Staff Management

| Feature | Status | Notes |
|---------|--------|-------|
| Staff page with personnel records | LIVE | |
| File attachment panel per staff member | LIVE | Resume PDF, headshot, certs |
| Auto-create staff record on resume upload | LIVE | |
| Projects page with project records | LIVE | |
| File attachment panel per project | LIVE | Photos, drawings, reports |
| Auto-create project record on project sheet upload | LIVE | |
| Linked Knowledge Hub documents on Staff/Projects pages | LIVE | |
| Glossary with CSV import | LIVE | |
| Resource Library (boilerplate text, content library) | RETIRED | Route redirects to /knowledge-hub |

---

## Category 7: Settings & Administration

| Feature | Status | Notes |
|---------|--------|-------|
| User list from Supabase profiles | LIVE | |
| Invite User dialog (Supabase Auth admin invite) | LIVE | Admin-only |
| Lookup table management (Order Types, Departments, Service Types, Form 254 Codes) | LIVE | |
| Organizations and People management | LIVE | |
| Bulk import (9 data types, CSV/Excel) | LIVE | Per-row error reporting, downloadable templates |
| Firm Profile (per-entity: service lines, states, value range, min days, agencies) | LIVE | Settings > Firm Profile tab; entity toggle for JPCL/Strans |
| QB Sync configuration | PLANNED | |

---

## Category 8: Platform & Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Supabase Auth (email/password, JWT) | LIVE | |
| Role-based access control (admin / user) | LIVE | Server-side enforcement |
| Supabase Storage (private dam bucket, 50 MB) | LIVE | |
| Storage proxy with signed URL redirect | LIVE | /manus-storage/:key |
| tRPC end-to-end type safety | LIVE | |
| Superjson serialization (Date stays Date) | LIVE | |
| UUID primary keys throughout | LIVE | |
| TypeScript strict mode, zero errors | LIVE | Enforced at every checkpoint |
| Vitest test suite (25 tests) | LIVE | |
| GitHub sync | LIVE | Auto-push on checkpoint |
| Manus hosting (Cloud Run + CDN) | LIVE | amplifypro-nzkhudzp.manus.space |
| Mobile-responsive optimization | PLANNED | |
| SSO / SAML enterprise auth | PLANNED | |

---

*Last updated: Jun 1, 2026*
