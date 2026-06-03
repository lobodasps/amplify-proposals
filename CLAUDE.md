# Amplify Proposals — Architecture

This document describes the current technical architecture of the Amplify Proposals platform. It is intended for developers joining the project or AI coding assistants (Claude Code, Cursor, etc.) starting a new session.

---

## Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Frontend | React | 19 |
| Styling | Tailwind CSS | 4 |
| UI Components | shadcn/ui | Radix primitives |
| Routing | Wouter | Client-side SPA |
| API Layer | tRPC | 11 (superjson serialization) |
| Server | Express | 4 |
| ORM | Drizzle ORM | postgres-js driver |
| Database | Supabase Postgres | Session pooler (port 6543) |
| Auth | Supabase Auth | Email/password, JWT |
| Storage | Supabase Storage | Private `dam` bucket, 50 MB limit |
| LLM | Configurable | Defaults to models defined in Settings > AI Skills; supports OpenAI, Anthropic, Google Gemini per task type |
| ZIP Extraction | fflate | 0.8.3, client-side only |
| Excel Parsing | SheetJS (xlsx) | 0.18.5, client-side only |
| Testing | Vitest | 25 tests across 4 files |
| Language | TypeScript | Strict mode, zero errors enforced |

---

## Database Architecture

The Supabase Postgres instance contains **two sets of tables** in the same `public` schema:

### Amplify Tables (44 tables, managed by Drizzle ORM)

These are defined in `drizzle/schema.ts` and pushed via `pnpm db:push` (which runs `drizzle-kit generate && drizzle-kit migrate`). All primary keys are UUID strings generated with `gen_random_uuid()`. Key tables include:

| Table | Purpose |
|-------|---------|
| `dam_documents` | Knowledge Hub / DAM file records with extractedMeta (JSONB), extractedText, tags |
| `contracts` | Full contract lifecycle with hierarchy (primary → child → sub-project) |
| `contract_amendments` | Amendments and change orders with amountBehavior logic |
| `personnel` | Staff records linked to Supabase profiles |
| `amp_projects` | Amplify project records (renamed from `projects` to avoid conflict) |
| `amp_users` | Amplify user/role records (renamed from `users`) |
| `amp_clients` | Amplify client records (renamed from `clients`) |
| `amp_tasks` | Amplify task records (renamed from `tasks`) |
| `pursuits` | Bid pipeline / pursuit tracking |
| `proposals` | Proposal records linked to pursuits |
| `rfp_sessions` | Proposal Workspace AI skill workflow state; `extractedData.rfpFiles[]` stores multi-file manifest |
| `opportunities` | Public opportunity ingestion records |
| `ai_skill_configs` | Configurable AI skill prompts |
| `document_shreds` | XML-shredded RFP sections |
| `rfp_wikis` | Compiled RFP wiki documents |
| `assets` | General file assets with tagging |
| `asset_tags` | Tag lookup table for DAM |
| `order_types` | Contract hierarchy tier labels |
| `organizations` | Companies/firms for contracts |
| `people` | Contact/personnel for contracts |
| `glossary_terms` | Industry glossary |
| `firm_settings` | Per-entity firm profile for Quick Signal scoring (one row per entity) |

### v0 / Timekeeping Tables (66 tables, managed externally)

These pre-existing tables power the JPCL/Strans timekeeping and billing system. They include `profiles`, `projects`, `companies`, `clients`, `tasks`, `time_entries`, `billing_rules`, `phases`, `owners`, etc. Amplify reads from these tables (particularly `profiles` for auth resolution and `companies` for entity IDs) but does not write to them except during contract activation (creates a project record).

---

## Authentication

Authentication uses **Supabase Auth** with email/password login. The flow is:

1. **Frontend**: `@supabase/supabase-js` client initialized with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The `AuthContext` manages session state and exposes `isAuthenticated`, `loading`, `user`, and `signOut`.

2. **tRPC Client**: Every request includes the Supabase JWT as a `Bearer` token in the `Authorization` header (configured in `client/src/main.tsx`).

3. **Server Context** (`server/_core/context.ts`): Validates the JWT using `supabase.auth.getUser(token)`, then resolves the authenticated user from the `profiles` table (not `amp_users`). The resolved profile is available as `ctx.user` in protected procedures.

4. **Route Protection**: All routes except `/login` are wrapped in a `ProtectedRoute` component that redirects unauthenticated users. Queries use `enabled: isAuthenticated && !loading` to prevent unauthenticated tRPC calls.

There is **no Manus OAuth** in this project — it was replaced with Supabase Auth during the migration.

---

## Storage

File storage uses **Supabase Storage** with a private `dam` bucket (50 MB file size limit).

| Helper | Location | Purpose |
|--------|----------|---------|
| `storagePut(relKey, data, contentType?)` | `server/storage.ts` | Upload file bytes to Supabase Storage |
| `storageGet(relKey, expiresIn?)` | `server/storage.ts` | Generate signed download URL, returns `{ key, url }` |
| `storageGetSignedUrl(relKey, expiresIn?)` | `server/storage.ts` | Thin wrapper, returns just the URL string |

The storage proxy at `/manus-storage/:key` generates a Supabase signed URL and 307-redirects the client. File uploads go through `POST /api/upload` which calls `storagePut` and returns the `fileKey` and `fileUrl` to the client.

---

## Key Architectural Decisions

### Renamed Tables

Four Amplify tables conflicted with pre-existing v0/timekeeping table names. They were renamed with an `amp_` prefix:

| Original Name | Renamed To | Reason |
|---------------|-----------|--------|
| `users` | `amp_users` | Conflicts with v0 `users` table |
| `clients` | `amp_clients` | Conflicts with v0 `clients` table |
| `projects` | `amp_projects` | Conflicts with v0 `projects` table |
| `tasks` | `amp_tasks` | Conflicts with v0 `tasks` table |

### UUID Primary Keys

All Amplify tables use UUID primary keys (`uuid` type with `gen_random_uuid()` default). All Zod input schemas use `z.string().uuid()` for ID fields. This matches the v0 schema convention and avoids integer sequence conflicts.

### Cross-App FK Columns (Soft References)

Several Amplify tables reference v0 tables via UUID columns, but **without hard foreign key constraints** in Postgres. This avoids migration coupling between the two systems:

- `dam_documents.staffId` → references `profiles.id`
- `dam_documents.projectId` → references v0 `projects.id`
- `contracts.performingCompanyId` → references `companies.id`

### Numeric Column Handling

Postgres `numeric` columns return strings from Drizzle ORM. All arithmetic on these values uses `parseFloat()` or `Number()` conversion. Inserts use `.toString()` for numeric fields.

### LLM Integration Pattern

All LLM calls go through `invokeLLM()` from `server/_core/llm.ts`. The function accepts a `messages` array (system + user roles) and optional `response_format`. There is **no top-level `system` parameter** — system prompts must be passed as `{ role: "system", content: "..." }` in the messages array. For document analysis, use `file_url` content type with a signed URL from `storageGet()`.

**The LLM layer is now fully configurable.** The `ai_skill_configs` table stores per-task provider, model, system prompt, and user prompt template. Global provider API keys (OpenAI, Anthropic, Google Gemini) are stored in `app_settings` and resolved at call time. The Settings > AI Skills tab exposes the full configuration UI. The planned `llmConfigs` table referenced in earlier sessions has been superseded by this implementation.

| Task | Configurable? | Planned Providers |
|------|--------------|-------------------|
| RFP Shredding | Yes | OpenAI, Anthropic, Gemini, Manus |
| Resume Tailoring | Yes | OpenAI, Anthropic, Gemini, Manus |
| Go/No-Go Scoring | Yes | OpenAI, Anthropic, Gemini, Manus |
| Opportunity Scoring | Yes | OpenAI, Anthropic, Gemini, Manus |
| Contract Analyzer | Yes | OpenAI, Anthropic, Gemini, Manus |
| DAM autoExtract | Yes | OpenAI, Anthropic, Gemini, Manus |
| DAM triggerExtract | Yes | OpenAI, Anthropic, Gemini, Manus |

The `invokeLLMWithSkill()` helper checks the `ai_skills` table for a task-specific config (provider, model, API key, prompts). If the DB row has null provider/model, it falls back to `DEFAULT_SKILLS` in `server/_core/llmSkill.ts`. **No existing AI procedures need to change their call signatures** — only the helper routes correctly.

**CRITICAL RULE:** When seeding missing `ai_skills` records (in `seedDefaultSkills()` or the `aiSkills.list` query), do NOT specify `provider` or `model` values. Leave those columns null. Provider and model selection is managed exclusively through the Settings → AI Configuration UI and must never be hardcoded in migrations, seed scripts, or application code. Only insert: `skillType`, `displayName`, `description`, `systemPrompt`, and `userPromptTemplate`.

---

## Project Structure

```
amplify-proposals/
├── client/
│   └── src/
│       ├── pages/          # Page components (KnowledgeHub, Contracts, Staff, etc.)
│       ├── components/     # Reusable UI (DashboardLayout, shadcn/ui)
│       ├── contexts/       # AuthContext, ThemeContext, EntityContext, RfpContext
│       ├── hooks/          # Custom hooks
│       ├── lib/            # trpc.ts, supabase.ts, utils.ts
│       ├── App.tsx         # Routes and layout
│       └── main.tsx        # Providers and tRPC client config
├── server/
│   ├── _core/             # Framework plumbing (DO NOT EDIT)
│   │   ├── context.ts     # tRPC context with Supabase JWT validation
│   │   ├── llm.ts         # invokeLLM helper
│   │   ├── index.ts       # Express server entry
│   │   └── trpc.ts        # tRPC instance and procedures
│   ├── routers/           # Feature routers (dam.ts, contracts.ts, pursuits.ts, etc.)
│   ├── db.ts              # Drizzle ORM connection (postgres-js, Supabase pooler)
│   ├── storage.ts         # Supabase Storage helpers
│   └── supabase.ts        # Supabase admin client
├── drizzle/
│   ├── schema.ts          # All 44 Amplify table definitions (pgTable)
│   └── relations.ts       # Drizzle relation definitions
├── shared/
│   ├── workflowTypes.ts   # Proposal Workspace skill types
│   └── types.ts           # Shared TypeScript types
├── ARCHITECTURE.md        # This file
├── CLAUDE.md              # Same content (for Claude Code)
├── todo.md                # ACTIVE work only — the ONLY file Manus reads for current work context
├── archive.md             # All completed [x] items — append-only history, do not edit
└── backlog.md             # Full prioritized feature backlog (not yet started)
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres Session pooler connection string (port 6543) |
| `SUPABASE_URL` | Supabase project URL (server-side) |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-side) |
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| `JWT_SECRET` | Session signing (legacy, kept for compatibility) |
| `BUILT_IN_FORGE_API_URL` | Manus LLM/storage API base URL |
| `BUILT_IN_FORGE_API_KEY` | Manus API bearer token (server-side) |

---

## Key Companies

| Company | ID | Badge Color |
|---------|-----|-------------|
| JPCL | `fddf0d5c-...` | Blue |
| Strans | `e45a26d6-...` | Emerald |

---

## Development Commands

```bash
pnpm dev              # Start dev server (tsx watch)
pnpm db:push          # Push schema changes (drizzle-kit generate + migrate)
pnpm test             # Run vitest (25 tests)
npx tsc --noEmit      # TypeScript check (must be zero errors)
```

---

## Recent Additions (Session — May 29, 2026)

### Proposal Launchpad (`/launch`)

A new 2-step wizard page for rapid RFP intake and Go/No-Go decision. No new backend code — only existing tRPC procedures and `/api/upload` are used.

**Step 1 — Upload RFP Package (multi-file):**
- Accepts PDF, DOCX (.doc/.docx), XLSX (.xls/.xlsx), and ZIP files — multiple files simultaneously
- ZIP files are extracted **client-side** using `fflate` before upload; each inner file is queued individually
- Per-file label selector (7 labels: Main RFP, Scope of Work, Appendix, Addendum, Fee Schedule, Reference Doc, Other) with auto-guess from filename keywords
- All files uploaded via `/api/upload` (rfp folder); primary file saved via `rfpSessions.saveRfpFile`; full manifest stored in `rfp_sessions.extractedData.rfpFiles[]`
- PDF + DOCX → `rfp_parser` LLM skill; XLSX → client-side SheetJS parse (up to 5 sheets × 30 rows)
- Per-file status icons in processing view; multi-file manifest card in review step

**Step 1 — Enter Manually (alternative path):**
- Two entry point cards: "Upload RFP Package" vs "Enter Manually"
- Manual form: Title, Agency, RFP Number, Due Date, Estimated Value, Service Lines (chip toggles), Scope Summary
- Skips upload/processing entirely; proceeds directly to review card → Go/No-Go

**Step 2 — Go/No-Go:**
- `proposals.scoreGoNoGo` → score (0–100), recommendation (GO/NO-GO/CONDITIONAL GO), strengths, risks, win themes
- GO → `pursuits.create` → redirect to `/pursuits/:id`; NO-GO → archived state

**Navigation:** "Proposal Launchpad" nav item (Rocket icon, AI badge) in Pursuits & Proposals sidebar group.

---

## Recent Additions (Session — May 30, 2026)

### Enhanced `triggerExtract`

- `SYSTEM_PROMPTS` constant with per-docType prompts (resume, project_sheet, past_proposal, certification, other) — each extracts `sections[]` and `images[]` arrays
- `buildTagString()` helper — merges tags from LLM output, serviceLines, certifications, and image-level tags
- `buildExtractedText()` helper — assembles searchable text from summaries, section content, image descriptions
- Tags written back to `dam_documents.tags` column

### Owner / Client / Firm Role Distinction

For AEC project sheets, the system now distinguishes between:

| Field | Definition | Example |
|-------|-----------|----------|
| `ownerName` | Public agency or end client who owns the asset | NYSDOT, NYC Parks, FHWA |
| `clientName` | Firm that contracted directly with Strans/JPCL | AECOM, Naik Consulting |
| `firmRole` | Relationship to the project | `prime` \| `sub` \| `joint-venture` |

- Schema: `ownerName` (text) and `firmRole` (text) columns added to `dam_documents`
- `autoExtract` prompt returns `owner[]`, `client`, `firmRole` per project
- `triggerExtract` SYSTEM_PROMPTS for `project_sheet` and `past_proposal` updated
- Multi-project split panel UI: Owner(s) text input, Client text input, Our Role dropdown

### DAM Duplicate Detection & Versioning

- **Schema**: `resumeVersion` and `pursuitContext` columns added to `dam_documents`
- **Server procedures**: `checkFileDuplicate` (matches by fileName), `checkContentDuplicate` (per-docType logic: project_sheet by projectNumber/projectName, resume by staffName+version, past_proposal by rfpNumber, certification by staffName+title, rfp by rfpNumber, contract by contractNumber, boilerplate by title), `replaceFile` (updates file columns on existing record)
- **Upload flow**: File-level duplicate banner (amber) with Replace/Keep Both/Cancel; content-level duplicate warning (orange) with dismiss
- **Resume fields**: Version dropdown (Short/Long/Project-Specific) and Pursuit Context text input, shown for resume docType
- **Library grid**: Version badges (violet for resumeVersion, blue for firmRole), Owner field in meta section

### Opportunities — Manual Entry

- "New Opportunity" button on Opportunities page header
- Full dialog form: Title (required), Agency/Client (required), RFP Number, Estimated Value, Due Date, Service Lines (multi-select chips), Source dropdown (7 options), Description/Notes, optional file attachments
- Calls `opportunities.create` mutation; DB records shown with "DB" badge in list

### Settings — Users Tab

- Replaced placeholder text with real user list from `profiles` table (name, email, role badge, status, joined date)
- "Invite User" button: dialog with email, first/last name, role selector; calls `supabase.auth.admin.inviteUserByEmail()` on server
- Admin-only access (enforced server-side)

### Sidebar Navigation Fix

- Removed all role restrictions from sidebar nav groups and items
- All authenticated users see all menu items; access control enforced at procedure level
- Pursuits & Proposals and Contracts & Compliance groups default to expanded

### Multi-Project Resume UX Fix

- When `autoExtract` returns `multiProject=true`, the upload form's **Confirm & Save** button is replaced with an amber redirect banner pointing to the Split Panel
- Split Panel now shows a shared metadata bar at the top: Staff Name (required) and Company/Entity dropdown, applied to all project records on Create X Records
- `splitStaffName` and `splitCompanyTag` state vars pre-filled from `autoExtract`, cleared on reset
- `autoExtract` forces `multiProject=false` when `docType=resume`; client-side guard also prevents split mode for resume docType
- Resume records show a project count badge in the library grid (e.g. "14 in resume")

### DAM Bulk Extract

Selection mode in the Knowledge Hub library grid allows batch AI extraction without uploading new files.

**How it works:**
1. User clicks "Select" button in the toolbar to enter selection mode — checkboxes appear on each card
2. Only non-indexed documents (no `extractedText`) are selectable; already-indexed cards are greyed out
3. "Select All Unextracted" shortcut selects all eligible documents in the current view
4. Maximum 10 documents per batch (enforced with a toast warning if exceeded)
5. "Extract Selected" button triggers sequential processing: each document is sent through `dam.triggerExtract` one at a time with a **1.5-second delay** between calls (rate-limit safety)
6. A progress panel shows `Processing X of Y` with the current document title
7. Errors do not stop the batch — the error is logged, the document is marked as failed, and processing continues
8. Re-runnable: already-indexed documents are automatically skipped if re-selected
9. On completion, the library grid refreshes and selection mode is exited

**Key state variables in `KnowledgeHub.tsx`:**
- `selectionMode: boolean` — toggles selection UI
- `selectedIds: Set<string>` — selected document IDs
- `extractProgress: { current, total, currentTitle, errors[] } | null` — progress panel state

---

## Recent Additions (Session — May 31, 2026)

### Knowledge Hub — Image Upload Support (Part A)

Single-file image upload is now fully supported in Knowledge Hub alongside existing document types.

**Schema additions** (`dam_documents` table):

| Column | Type | Purpose |
|--------|------|---------|
| `imageQuality` | text | `high` \| `medium` \| `low` — from Gemini vision output |
| `hasPersonnel` | boolean | Whether people are visible in the image |
| `structureType` | text | Primary structure type (bridge, roadway, building, etc.) |
| `photographer` | text | Optional photographer credit |
| `location` | text | Location where photo was taken |
| `yearTaken` | integer | Year the photo was taken |
| `usageRights` | text | `internal_only` \| `proposal_use` \| `marketing` \| `unrestricted` |

**`dam_image_caption` AI skill** — updated system prompt to an AEC-specialist analyst that returns a structured JSON object with 9 fields: `caption`, `description`, `structureType`, `constructionPhase`, `setting`, `environment`, `tags[]`, `hasPersonnel`, and `qualityRating`. The skill is stored in the `ai_skills` DB table and seeded on server startup.

**Upload flow for images:**
1. File MIME type is detected client-side (`image/jpeg`, `image/png`, `image/tiff`, `image/webp`).
2. `autoExtract` is skipped — no document LLM analysis.
3. `docType` is automatically set to `image`.
4. After the record is created, `triggerExtract` is called server-side, which routes image files to `invokeLLMWithSkill('dam_image_caption', ...)` instead of the document extraction path.
5. The vision output is stored: `caption` → `title`, `description` → `extractedText`, full JSON → `extractedMeta`, and the three new dedicated columns (`imageQuality`, `hasPersonnel`, `structureType`) are also written.

**Knowledge Hub UI changes:**
- Image docType added to `DOC_TYPE_CONFIG` with a camera icon.
- Upload form shows image-specific fields: Project Association, Location, Year Taken, Photographer (optional), Usage Rights.
- Library grid shows an actual image thumbnail instead of a document icon for `docType = 'image'`.
- Preview dialog shows a large image preview at the top, followed by structured vision metadata (structure type, quality rating, setting, environment, personnel indicator).
- Extract Content button is hidden for image records (already processed on upload).
- Quality filter (All / High / Medium / Low) appears in the toolbar when the Images docType filter is active.

---

### Bulk Image Import (Parts 1–9, Part B)

A new full-screen modal for importing hundreds of AEC project photos at once. Accessed via the **"Bulk Import Images"** button (violet outline) in the Knowledge Hub toolbar. Does not change any existing single-file upload flow.

**Entry point and drop zone (Parts 1–2):**
- Full-screen `Dialog` modal with a large drag-and-drop zone.
- Accepts JPG, JPEG, PNG, TIFF, WEBP — no file count limit, designed for 200+ photos.
- Live thumbnail grid preview as files are dropped; total count and combined size shown.
- Rejected file types trigger a toast with accepted format list.
- "Select Files" and "Select Folder" buttons as alternatives to drag-and-drop.

**Folder name parsing (Part 3):**
Before uploading, each file's `webkitRelativePath` is parsed to extract metadata hints:

| Folder keyword | Hint set |
|---------------|----------|
| `construction`, `under-construction`, `active` | `constructionPhase = 'under-construction'` |
| `complete`, `completed`, `final`, `finished` | `constructionPhase = 'completed'` |
| `before`, `existing` | `constructionPhase = 'existing-conditions'` |
| `aerial`, `drone` | `setting = 'aerial'` |
| Last folder before filename | `projectName` hint |

These hints are passed as context to Gemini Vision and stored on the record. Vision output overrides hints if it contradicts them.

**Upload stage (Part 4):**
- Files uploaded in parallel batches of 10 via `POST /api/upload` (folder: `dam`).
- Per-file status icons: waiting (gray dot) → uploading (blue spinner) → uploaded (green check) → error (red X).
- Overall progress bar: `Uploading N of M`.
- Errors do not stop the batch — failed files are assigned to the "Upload Failed" group.

**Gemini Vision captioning queue (Part 5):**
- Uploaded images processed sequentially in batches of 5 with a 500 ms delay between batches (rate-limit safe).
- Each image goes through `dam.triggerExtract` which invokes `dam_image_caption` skill.
- Returns: `caption`, `description`, `structureType`, `constructionPhase`, `setting`, `environment`, `tags[]`, `hasPersonnel`, `qualityRating`.
- Low-confidence images (`qualityRating = 'low'` or `structureType = 'other'`) are flagged for manual review.
- Caption progress bar: `Captioning N of M`.
- As captions complete, images populate dynamically into structure-type groups.

**Smart grouping UI (Part 6):**
Images are grouped by `structureType` with AEC-specific icons:

| Group key | Icon | Label |
|-----------|------|-------|
| `bridge` | 🌉 | Bridges & Overpasses |
| `roadway` | 🛣️ | Roadways & Highways |
| `under-construction` | 🏗️ | Under Construction |
| `environmental-site` | 🌿 | Environmental Sites |
| `athletic-field` / `park` | 🏟️ | Athletic Fields & Parks |
| `building` | 🏢 | Buildings & Structures |
| `dam` | 🌊 | Waterfront & Marine |
| `utility` / `tunnel` | 🔧 | Utilities & Infrastructure |
| `aerial` | ✈️ | Aerial & Drone |
| `other` | 📁 | Other |
| `needs_review` | ⚠️ | Needs Manual Review |
| `upload_failed` | ❌ | Upload Failed |

Groups are ordered by count descending; special groups always appear last. Each group is collapsible; the first group is expanded by default. Within each group, a 4-column thumbnail grid shows caption, tags chips, and quality badge.

**Group-level metadata sheet (Part 7):**
Each group header has an "Apply Group Metadata" button that opens a `Sheet` slide-out with: Project Association, Company Tag (JPCL / Strans / Both), Usage Rights, Year From/To, Additional Tags (comma-separated, appended to auto-tags), Override Construction Phase. Applied values are stored per group and merged at record creation time.

**Review panel for flagged images (Part 8):**
Images in "Needs Manual Review" show a larger thumbnail, the full Gemini output, a "What does this image show?" text field, a Move to Group dropdown, and a Discard button.

**Confirm and create (Part 9):**
- Sticky footer shows ready count, needs-review count (with warning), and a "Skip unresolved" checkbox.
- "Create X Records" button is disabled if unresolved images exist unless skip is checked.
- On confirm, each image's `dam_documents` record is updated with merged group metadata, tags, and final caption.
- Creation progress bar shown; on completion a summary card with "View in Knowledge Hub" button closes the modal and activates the Images filter.

**Key file:** `client/src/pages/BulkImageImport.tsx` (self-contained, ~900 lines, zero new routers).

---

## Remaining Work

The following major features are planned but not yet implemented. See `backlog.md` for the full prioritized feature list.

**Documentation system:** `todo.md` is the ONLY file Manus reads for current work context — it contains only active in-progress and next-up items. `archive.md` is append-only and holds all completed [x] items. `backlog.md` holds the full feature backlog. When starting a new session, read `todo.md` first, then `CLAUDE.md`.

### Near-Term

- **Replit Parity — Contract Fields**: QB Name, Client Project Ref, Department, Service Types, Form 254 Code, Project Manager/Accountant fields on contracts; QB Bulk Import page; Analytics module with pre-built reports and query builder
- **Opportunities Ingestion**: Settings-based portal scraping with cheerio, real DB wiring
- **Pursuit Detail**: Wire mock data to real tRPC queries (tasks, requirements, team)
- **Proposals**: Real DB integration, section CRUD, resume tailoring
- **Image Extraction from PDFs**: PDF page rendering to thumbnails, vision LLM pass for photo extraction from DAM documents

### Medium-Term

- **Karpathy AI Patterns** (v2.1): XML Shredder as RFP pre-processor, LLM Wiki for context injection, Agent Guidelines with multi-approach advisor
- **RFP-Centric Pipeline** (v2.2): Pursuit-scoped AI tools, RFP Workspace page, proposal scoring with history
- **Contract Enhancements**: Tier labels on child orders, compliance field editing, sortable contracts list with rolled-up financials
- **Bulk Import — Folder Project Matching**: Server-side fuzzy match of folder names against existing `dam_documents.projectName` values (currently client-side hint only)

### Long-Term

- SF 330 form auto-fill and PDF export
- Adobe UXP InDesign plugin
- Word/PowerPoint/PDF export with branded templates
- SSO/SAML enterprise authentication
- Mobile-responsive optimization pass
- Live public agency portal scraping

---

## Documentation Audit & Corrections (Session — May 31, 2026, Evening)

### Contract Fields — All Now Confirmed LIVE

A documentation audit via GitHub connector and direct code inspection confirmed that all seven contract fields previously listed as PLANNED in `FEATURE_CATALOG.md` were already fully implemented. The following were incorrectly marked PLANNED:

| Field | Actual Status | Location |
|-------|--------------|----------|
| QB Name, Client Project Reference | **LIVE** | `server/routers/personnel.ts` create/update + `Contracts.tsx` form |
| Department dropdown (from lookup) | **LIVE** | `server/routers/personnel.ts` + `Contracts.tsx` Select |
| Service Types multi-select | **LIVE** | `server/routers/personnel.ts` + `Contracts.tsx` chip multi-select |
| Form 254 Code dropdown | **LIVE** | `server/routers/personnel.ts` + `Contracts.tsx` Select |
| Project Manager / Accountant dropdowns | **LIVE** | `server/routers/personnel.ts` + `Contracts.tsx` Select |
| Public/Private sector toggle | **LIVE** | `isPublic` boolean column (schema line 394); Select in `ContractDetail.tsx` Edit dialog |
| Initial contract amount editable in Edit dialog | **LIVE** | Number input in `ContractDetail.tsx` Edit dialog, seeded from `contract.value` |

`FEATURE_CATALOG.md` section 3.5 updated from **[MOSTLY LIVE]** to **[LIVE]** accordingly.

A redundant `isPublicSector` column was briefly added to the schema in error (it duplicated the existing `isPublic` column) and was immediately removed via migration `drizzle/0009_vengeful_banshee.sql`.

### New Documentation Files Added

Three strategic documents added to the repository root and linked from `README.md`:

- **`SPECIFICATIONS.md`** — Full product specification v3.7 (all modules, DB schema, auth, integrations, non-functional requirements)
- **`FEATURE_CATALOG.md`** — Comprehensive categorized feature list with LIVE / PLANNED status for every feature across 8 categories
- **`ROADMAP_AND_DIFFERENTIATION.md`** — Prioritized 29-item backlog in 5 tiers + 6 competitive differentiation recommendations vs. Joist.ai, Shred.ai, and Unanet Proposals with positioning matrix

### README.md Rewritten

`README.md` replaced the generic Manus framework template with a project-specific document covering: product vision, module summary table, full tech stack table, local dev setup, key files reference, documentation index, deployment info, and license. Original template preserved as `README.template.md`.

### GitHub Connector Verified

The `user_github` remote is confirmed working. Live data fetched from `lobodasps/amplify-proposals`:
- 261 tracked files, 86 commits, TypeScript primary language (2.03 MB)
- Repo is private, created May 29 2026, last push May 31 2026
- 0 open issues, 0 open PRs

---

## Session Notes — May 31, 2026 (Afternoon)

### 504 Timeout Fix: executeSkill Fire-and-Forget
The `executeSkill` tRPC mutation in `server/routers/rfpSessions.ts` was refactored from synchronous to fire-and-forget to prevent 504 gateway timeouts on large RFP packages.

**Pattern:**
- Mutation marks skill as `running` in DB, then immediately returns `{ success: true, running: true }`
- Actual LLM work (file shredding + Gemini call) runs inside a detached `setImmediate(async () => { ... })` callback
- Error catch block inside `setImmediate` writes `status: "error"` + `errorMessage` to DB — does NOT throw (avoids unhandled promise rejection)
- Frontend (`ProposalWorkspace.tsx`) polls `getById` every 2 seconds after receiving `running: true`, reads `workflowState[skillName].status`, exits on `complete` or `error`, 15-minute safety timeout

**Fix for blank RFP fields (`ProposalLaunchpad.tsx`):**
- Root cause: frontend was reading `result.output` from the mutation response (now always `""`)
- Fix: after `executeSkill.mutateAsync`, frontend polls `getById` until `workflowState.rfp_parser.status === "complete"`, then reads actual output from `session.skillOutputs.rfp_parser`

### Extraction Tier Control
Per-file extraction depth control added to the Proposal Launchpad manifest.

**Tier map (`shared/types.ts` → `LABEL_TIER_MAP`):**
| Label | Tier | Behavior |
|-------|------|----------|
| Main RFP, Scope of Work, Addendum | `full_extract` | XML shred + LLM extraction |
| Appendix, Forms, Certificate, Reference Doc, Cover Letter, Supplemental, Other | `metadata_only` | Title/URL/note stored, no LLM |
| Fee Schedule (XLSX) | `sheetjs` | SheetJS structured parse, no LLM |

**Backend (`rfpSessions.ts`):** Shredding loop reads `file.label` from `uploadedFiles`, looks up tier from `LABEL_TIER_MAP`, branches accordingly. Logs tier summary: `[rfp_parser] tier summary: 3 full-extract, 8 metadata-only, 1 sheetjs`.

**Frontend:** Extraction tier badge shown next to label selector. `TIER_BADGE` map in `shared/types.ts` provides label + CSS class per tier.

### File Auto-Classification Rules (Updated)
`guessLabel()` in `ProposalLaunchpad.tsx` updated with corrected keyword priority order:

| Keywords | Label |
|----------|-------|
| "cover letter", "cover sheet", "transmittal" | Cover Letter |
| "rfp", "solicitation", "ifb", "invitation for bid", "request for proposal" | Main RFP |
| "scope", "sow", "scope of work" | Scope of Work |
| "addend", "add-", "amendment" | Addendum |
| "append" or `attach[ment]_N` (regex) | Appendix |
| "fee schedule" or fee/cost/price/budget + .xlsx | Fee Schedule |
| "insurance", "coi", "certificate", "cert" | Certificate |
| "form", "exhibit" | Forms |
| "ref", "standard", "guide" | Reference Doc |
| *(no match)* | Supplemental (new default — was Main RFP) |

**Validation:** Clicking Process without any file labeled "Main RFP" shows toast error.

### Two-Pass Pre-Classification System
Full two-pass classification system added to the Proposal Launchpad file manifest.

**Pass 1 — Instant client-side (no API call):**
- `readPdfPageCount(file)` reads PDF binary header client-side to extract page count
- `guessClassification(file, pageCount)` returns `{ label, confidence, keyEvidence }`
- XLSX → `fee_schedule` (high); generic names → `unclassified`; page count heuristics for PDFs; keyword rules for all others
- Runs synchronously on file drop, zero latency

**Pass 2 — Gemini Flash skim (async, background):**
- Fires for `unclassified` or `medium` confidence files only
- Uploads file to temp storage, calls `trpc.rfpSessions.classifyFile` (new protected procedure)
- Backend sends file URL to Gemini Flash with structured JSON prompt: returns `documentType`, `confidence`, `keyEvidence`, `suggestedLabel`, `extractionDepth`
- Runs in parallel batches of 5 with 500ms inter-batch delay
- Updates label + confidence in manifest row in real time

**New backend procedure:** `rfpSessions.classifyFile` — protected procedure, accepts `{ fileUrl, fileName, mimeType }`, returns `{ documentType, confidence, keyEvidence, suggestedLabel, extractionDepth }`.

**Manifest UI updates:**
- Confidence badge: ✅ High (green) / 〰️ Medium (yellow) / ⚠️ Review (amber) / ? Unclassified (gray)
- Key evidence subtitle under filename in small gray text
- Page count (e.g., `12pp`) and file size shown inline
- Low/unclassified rows highlighted with amber border + background
- Global "Gemini reviewing N files…" spinner while Pass 2 runs
- Per-row "Analyzing with Gemini…" spinner during Pass 2

**Pre-process warning dialog (`AlertDialog`):**
- Shown when user clicks Process with any low/unclassified files
- Lists each flagged file with key evidence
- Options: **Review Now** (closes dialog) | **Process Anyway** (calls `doProcess()`)

**New types in `shared/types.ts`:**
- `ClassificationConfidence`: `"high" | "medium" | "low" | "unclassified"`
- `ClassificationResult`: `{ label, confidence, keyEvidence }`
- `CONFIDENCE_BADGE`: map of confidence → `{ icon, label, className }`

**New `QueuedFile` fields:** `confidence`, `keyEvidence`, `pageCount`, `pass2Running`

### Schema Changes
No new schema migrations in this session. All changes were router/frontend only.

### Checkpoints This Session
| Version | Description |
|---------|-------------|
| `ccfec7b4` | Fix blank RFP fields: frontend polls until rfp_parser completes |
| `147a854c` | Extraction tier control: Full Extract / Metadata Only / SheetJS badges |
| `175b925c` | File auto-classification fix: new keyword rules, Supplemental default, Main RFP validation |
| `b3846c96` | Two-pass pre-classification: Pass 1 heuristics + Pass 2 Gemini Flash skim |

---

## Session Notes — May 31, 2026 (Knowledge Hub Consolidation Reconciliation)

### v3.7 Tracking Reconciled and ResourceLibrary Retired

A follow-up audit resolved a tracking discrepancy where `todo.md` still showed v3.7 Knowledge Hub consolidation, Bulk Image Import Phase 2, Extraction Tier Control v3.8, and Two-Pass Pre-Classification v3.9 items as unchecked even though prior session notes documented most of that work as complete.

**Verified and completed in this session:**

- `client/src/pages/ResourceLibrary.tsx` was audited and removed. The `/resource-library` route already redirects to `/knowledge-hub`, and Resource Library is no longer present in `AppLayout` navigation.
- Resource Library-era document categories were merged into Knowledge Hub and DAM validation: `proposal_template`, `rate_sheet`, `content_block`, `presentation`, `spreadsheet`, and `video`.
- `server/routers/dam.ts` auto-classification guidance now permits the merged categories so new uploads can be classified directly into Knowledge Hub.
- Knowledge Hub image-only filtering now uses a larger thumbnail grid, matching the remaining Bulk Image Import checklist item.
- `todo.md` checkboxes were reconciled for the verified duplicate/stale sections: v3.7, Bulk Image Import Phase 2, Extraction Tier Control v3.8, and Two-Pass Pre-Classification v3.9.

**Validation:** `pnpm check` passed after the implementation updates.

**Remaining caveat:** The separate `/file-library` route and `server/routers/assets.ts` legacy asset/tag system are still live and remain separate from Knowledge Hub. They were not removed in this pass because they support a broader cross-module file library surface, not just the retired `ResourceLibrary.tsx` page.

---

## Session Notes — Jun 1, 2026

### Quick Signal Pre-Score + Per-Entity Firm Profile

**New feature:** Quick Signal pre-score card in Proposal Launchpad, appearing after Pass 2 classification completes and before the user clicks Process.

**Pass 2 extension:** `rfpSessions.classifyFile` now accepts `isMainRfp: boolean`. When true, the Gemini Flash prompt returns a `quickSignals` object: `agency`, `projectType`, `estimatedValue`, `dueDate`, `location`, `prequalRequired`, `prequalType`, `immediateRedFlags[]`.

**`firm_settings` table (new, 44th Amplify table):** One row per entity. Fields: `firmName`, `serviceLines` (JSON), `states` (JSON), `typicalValueMin`, `typicalValueMax`, `minDaysToRespond` (default 14), `preferredAgencies` (JSON), `avoidedAgencies` (JSON), `entityId` (UUID, unique). Router: `firmSettings.get({ entityId? })` and `firmSettings.upsert({ entityId?, ...fields })`.

**Settings > Firm Profile tab:** Entity toggle buttons (JPCL / Strans) in the card header when multiple entities exist. Switching entity reloads the form from the correct DB row. Each entity's profile is saved independently.

**`client/src/lib/quickSignal.ts`:** Pure client-side scoring utility. `computeQuickSignal(signals, profile)` scores 6 factors (agency, project type, value, due date, location, red flags) as favorable/neutral/unfavorable. Returns `{ strength, favorableCount, factors[] }`. Thresholds: strong ≥ 5, mixed ≥ 3, else weak. No API call.

**Quick Signal card UI:** Strength badge (🟢/🟡/🔴), extracted values row, 6-factor checklist, red flag chips, "Process & Full Analysis" button, "Archive This RFP" button (creates `opportunities` record with `status=archived`).

**Entity scoping:** `ProposalLaunchpad.tsx` uses `useEntityContext().activeEntityId` to pass to `firmSettings.get` so the scorer always uses the active entity's profile.

**New shared types:** `QuickSignals`, `SignalRating`, `SignalFactor`, `QuickSignalStrength`, `QuickSignalScore`, `FirmProfile` in `shared/types.ts`.

**Documentation corrections this session:**
- ARCHITECTURE.md, CLAUDE.md, SPECIFICATIONS.md, FEATURE_CATALOG.md, README.md: corrected LLM default description from "Manus built-in" to "defaults to models defined in Settings > AI Skills"
- All docs: updated test count from 16/25 to 25, table count from 43 to 44
- SPECIFICATIONS.md: corrected Settings tab count to 14 (added Firm Profile), corrected AI tool routes
- Removed "LLM Configuration System" from Near-Term Remaining Work (it is live as `ai_skill_configs`)

### Checkpoints This Session

| Version | Description |
|---------|-------------|
| `b3ed59cb` | Documentation audit: todo.md, ARCHITECTURE.md, CLAUDE.md, SPECIFICATIONS.md reconciled |
| `4bb9e803` | Quick Signal pre-score + Firm Profile settings (single global profile) |
| `68cc0429` | Per-entity Firm Profile + all docs updated + GitHub sync |
| `b3a67335` | Proposal Workspace Fix v4.2: buildSkillVariables, mapToSkillType, live generation chain |
| `b29a9839` | AI Skills outputType column (json/prose/json_with_prose) |
| `62d88087` | Proposal Workspace Output Renderers (SkillOutputRenderer) |
| `fa3c66f7` | Dynamic outputType lookup from ai_skills at runtime |
| `aad2b8bd` | Proposal Launchpad Step 3 — Asset Matching panel + DAM hydration |

---

## Session Notes — Jun 1, 2026 (Afternoon)

### Proposal Workspace Fix (v4.2)

The generation chain was broken due to mismatches between workflow skill names and the `ai_skills` DB records. Fixed:

- `mapToSkillType()` now routes workflow skills to dedicated skill types: `win_themes` → `win_theme_generator`, `technical_outline`/`technical_writer` → `technical_approach_writer`, `key_personnel` → `key_personnel_writer`, `past_performance` → `project_experience_writer`, `fee_estimator` → `proposal_writer`, `proposal_scorer` → `proposal_scorer`.
- `buildSkillVariables()` is now async and queries pursuit, rfpSession, firm_settings, wiki, personnel, and projects from DB.
- Substitution validator checks for unresolved `{variable}` patterns before LLM call; replaces with `'[Not provided]'` fallback and surfaces `missingVariables` warning in UI.
- Live generation chain verified: `win_themes` + `technical_writer` ran against real DB data (Claude Sonnet 4), all variables populated, zero fallbacks.

### AI Skills `outputType` Column (v4.3)

New column on `ai_skills` table: `outputType text default 'prose' not null`. Controls how the Proposal Workspace renders each skill's output.

| Value | Rendering behavior |
|-------|-------------------|
| `prose` | Inline rich text editor; user edits directly |
| `json` | Parsed and rendered as structured UI (cards, tables, scorecards) |
| `json_with_prose` | Prose in main editor, JSON metadata in collapsible sidebar |

All 23 skills assigned:
- **json**: rfp_shredder, go_no_go_advisor, opportunity_scorer, contract_analyzer, asset_tagger, proposal_scorer, opportunity_ingestion, xml_shredder, agent_guidelines, autoExtract, triggerExtract, dam_image_caption, conflict_detector, win_theme_generator, requirements_matrix_builder
- **prose**: resume_tailor, proposal_writer, wiki_compiler, executive_summary_writer, technical_approach_writer, firm_qualifications_writer, project_experience_writer, key_personnel_writer

`seedDefaultSkills()` includes `outputType`. Settings > AI Skills can update it at runtime.

### SkillOutputRenderer (v4.4)

Replaced `SkillOutputEditor` with `SkillOutputRenderer` (`client/src/components/SkillOutputRenderer.tsx`). Routes display by `outputType`:

| Skill Type | Renderer | Display |
|------------|----------|--------|
| `win_theme_generator` | `WinThemeCards` | Cards with title, statement, rationale, proof, applicable sections |
| `proposal_scorer` | `ProposalScorecard` | Overall score ring, criterion bars, gaps/improvements |
| `requirements_matrix_builder` | `ComplianceChecklist` | Table with status badges, mandatory flags, section mapping |
| `conflict_detector` | `ConflictCards` | Severity badges, affected sections, recommendations |
| Other JSON | `GenericJsonViewer` | Formatted key/value tree |
| Prose | `ProseEditor` | Inline textarea, Edit/Save/Cancel, persists via `trpc.rfpSessions.updateSkillOutput` |
| Fallback | `FallbackRenderer` | Monospace code block + amber warning banner |

**Persistence:** `ProseEditor` saves to `rfp_sessions.skillOutputs` JSON column via `updateSkillOutput` mutation. Explicit save only (no autosave-on-blur).

### Dynamic outputType Resolution (v4.5)

Static `SKILL_OUTPUT_TYPE` map removed. Runtime resolution:
1. `trpc.aiSkills.list.useQuery()` fetches all skill records (including `outputType`)
2. `WORKFLOW_SKILL_TO_SKILL_TYPE` (exported from `shared/workflowTypes.ts`) maps workflow names → skill types
3. `resolveOutputType(workflowSkillName, aiSkillRecords)` returns the live `outputType`

Updating `outputType` in Settings → AI Skills takes effect on next workspace render.

### Proposal Launchpad Step 3 — Asset Matching (v4.6)

New wizard step between GO decision and workspace navigation. Lets user select DAM assets to feed into the generation chain.

**Schema** (pursuits table): `selectedProjectIds` (JSON array), `selectedPastProposalIds` (JSON array), `selectedPersonnel` (JSON array of `{ documentId, role }`).

**Server procedures** (zero new routers):
- `dam.matchProjectSheets` — top 10 project_sheet docs by service line tag overlap
- `dam.matchResumes` — top 10 resume docs (base version) by tag overlap
- `dam.matchPastProposals` — top 5 past_proposal docs by tag overlap
- `dam.searchForAssetMatching` — free-text search filtered by docType
- `pursuits.saveAssetSelections` — writes JSON arrays to pursuit record

**Client:** `AssetMatchingPanel` component with 3 sections (project sheets, resumes, past proposals), checkboxes, search bars, role inputs, auto-preselects top 3 + top 1.

**Launchpad flow:** GO → `asset_matching` step → Save & Continue → workspace. "Continue Without Assets" option available.

**Workspace:** "Assets" toolbar button opens `Sheet` side panel with `AssetMatchingPanel` for mid-generation edits.

### buildSkillVariables() — DAM Hydration

`buildSkillVariables()` now reads pursuit asset selections and hydrates skill variables from real DAM content:

| Variable | Source |
|----------|--------|
| `selectedProjects` | `pursuit.selectedProjectIds` → `dam_documents.extractedMeta` |
| `selectedPersonnel` | `pursuit.selectedPersonnel` → `dam_documents.extractedText` |
| `pastProposalsSummary` | `pursuit.selectedPastProposalIds` → `dam_documents.extractedText` |

Fallback: if no DAM selections exist, falls back to legacy `amp_projects` and `personnel` table queries.

### Key Rules for AI Assistants

1. **Never hardcode provider/model in `seedDefaultSkills()` or `aiSkills.list` seed paths.** Leave null. Settings UI manages provider/model.
2. **`outputType` must be included** when seeding new skills. Valid values: `json`, `prose`, `json_with_prose`.
3. **Zero new routers** for asset matching — procedures added to existing `dam` and `pursuits` routers.
4. **`WORKFLOW_SKILL_TO_SKILL_TYPE`** in `shared/workflowTypes.ts` is the single source of truth for workflow → skill type mapping. Keep it in sync with `mapToSkillType()` on the server.
5. **ProseEditor persistence** is explicit save (not autosave-on-blur). The `updateSkillOutput` mutation writes to `rfp_sessions.skillOutputs` JSON column.
