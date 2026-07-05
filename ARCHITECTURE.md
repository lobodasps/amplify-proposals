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
| LLM | Fully configurable | Per-skill via `provider_api_keys` table; `sdkType` controls routing (openai_compatible / google_gemini / anthropic); any provider name allowed |
| ZIP Extraction | fflate | 0.8.3, client-side only |
| Excel Parsing | SheetJS (xlsx) | 0.18.5, client-side only |
| Testing | Vitest | 244 tests across 12 files |
| Language | TypeScript | Strict mode, zero errors enforced |

---

## Database Architecture

The Supabase Postgres instance contains **two sets of tables** in the same `public` schema:

### Amplify Tables (45+ tables, managed by Drizzle ORM)

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
| `ai_skills` | Configurable AI skill prompts, provider, model, outputType per skill |
| `provider_api_keys` | Named LLM provider keys with sdkType, baseUrl, defaultModel, isDefault flag |
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

**Cross-app session isolation:** The Supabase client in `client/src/lib/supabase.ts` is initialized with `auth: { storageKey: "amplify-proposals-auth" }`. This namespaces the session in `localStorage` so that a separate app sharing the same Supabase project (e.g., the v0 timekeeping app) cannot inject a stale session and trigger an auth redirect loop.

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

**The LLM layer is fully configurable and provider-agnostic.** All provider credentials are stored in the `provider_api_keys` table and managed through Settings → AI Skills → Provider API Keys. There is no platform-injected LLM key and no Manus built-in fallback.

**Key design principle — `sdkType` decouples routing from provider name:**

| sdkType | SDK used | Covers |
|---------|----------|--------|
| `openai_compatible` | OpenAI Chat Completions HTTP | OpenAI, Azure, Mistral, Groq, Together, DeepSeek, Fireworks, Ollama, any custom endpoint |
| `google_gemini` | `@google/generative-ai` SDK | Any key named anything — routing is explicit, not string-matched |
| `anthropic` | Anthropic Messages API (raw fetch) | Any key named anything |

This means two different Gemini configurations (e.g., `gemini-flash` and `gemini-pro-exp`) can coexist as separate `provider_api_keys` rows, both with `sdkType = 'google_gemini'`.

**Default model fallback:** When a skill's configured provider returns any API error, `invokeLLMWithSkill()` retries with the `provider_api_keys` row where `isDefault = true`. The result carries `_usedDefaultModel: true` and `_defaultModelName` so the Proposal Workspace can surface an amber warning banner.

**CRITICAL RULE:** When seeding missing `ai_skills` records (in `seedDefaultSkills()` or the `aiSkills.list` query), do NOT specify `provider` or `model` values. Leave those columns null. Provider and model selection is managed exclusively through the Settings → AI Configuration UI and must never be hardcoded in migrations, seed scripts, or application code. Only insert: `skillType`, `displayName`, `description`, `systemPrompt`, `userPromptTemplate`, and `outputType`.

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
├── todo.md                # ACTIVE work only — the only file Manus reads for current work context
├── archive.md             # All completed [x] items — append-only history
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

The following major features are planned but not yet implemented. See `backlog.md` for the full prioritized feature list. `todo.md` contains only the active in-progress and next-up items. `archive.md` contains all completed work.

### Near-Term

- **Opportunities Ingestion**: Settings-based portal scraping with cheerio, real DB wiring
- **Pursuit Detail**: Wire mock data to real tRPC queries (tasks, requirements, team)
- **Proposals**: Real DB integration, section CRUD, resume tailoring
- **Image Extraction from PDFs**: PDF page rendering to thumbnails, vision LLM pass for photo extraction from DAM documents
- **Replit Parity — Contract Fields**: QB Name, Client Project Ref, Department, Service Types, Form 254 Code, Project Manager/Accountant fields on contracts; QB Bulk Import page; Analytics module with pre-built reports and query builder

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

## Architecture Changes — May 31, 2026 (Afternoon Session)

### executeSkill: Synchronous → Fire-and-Forget

The `executeSkill` mutation in `server/routers/rfpSessions.ts` was refactored to avoid 504 gateway timeouts on large RFP packages (15+ files).

**Before:** Synchronous — shred all files, call LLM, return output in response body. Timed out at ~300s.

**After:** Fire-and-forget pattern:
1. Mark skill as `running` in DB (`workflowState[skillName].status = "running"`)
2. Return `{ success: true, running: true, output: "" }` immediately
3. Run actual work inside `setImmediate(async () => { ... })` — detached from HTTP request lifecycle
4. On completion: write `status: "complete"`, `output`, `completedAt` to DB
5. On error: write `status: "error"`, `errorMessage` to DB (no `throw` — avoids unhandled rejection)

**Frontend polling pattern (`ProposalWorkspace.tsx` and `ProposalLaunchpad.tsx`):**
- After `mutateAsync` returns `{ running: true }`, poll `getById` every 2 seconds
- Watch `workflowState[skillName].status`, exit on `"complete"` or `"error"`
- Read output from `session.skillOutputs[skillName]` (not from mutation response)
- 15-minute safety timeout

### Extraction Tier System

New `ExtractionTier` type and `LABEL_TIER_MAP` in `shared/types.ts` control per-file processing depth:

| Tier | Labels | Behavior |
|------|--------|----------|
| `full_extract` | Main RFP, Scope of Work, Addendum | XML shred + LLM extraction |
| `metadata_only` | Appendix, Forms, Certificate, Cover Letter, Supplemental, Reference Doc, Other | Store URL/title/note only, no LLM |
| `sheetjs` | Fee Schedule (XLSX) | SheetJS structured parse, no LLM |

The shredding loop in `rfpSessions.ts` reads `file.label` from `uploadedFiles`, looks up the tier from `LABEL_TIER_MAP`, and branches accordingly. Logs a tier summary before processing. Reduces LLM calls on a 15-file package from 15 down to typically 3–4.

### Two-Pass Pre-Classification Architecture

New classification pipeline in `ProposalLaunchpad.tsx` that runs after files are dropped, before the user clicks Process.

**Pass 1 — Client-side (synchronous, zero latency):**
- `readPdfPageCount(file)`: reads PDF binary header (`/Count N`) client-side to extract page count
- `guessClassification(file, pageCount)`: returns `{ label, confidence, keyEvidence }`
  - XLSX → `fee_schedule` (high)
  - Generic names (Doc1, Attachment_1, etc.) → `unclassified`
  - 1-page PDF → `cover_letter` (medium); 1–3 pages → `form` (medium)
  - 20+ pages + RFP keywords → `main_rfp` (high)
  - Keyword match → label (high); no match → `supplemental` (medium)

**Pass 2 — Gemini Flash skim (async, background):**
- Fires only for `unclassified` or `medium` confidence files
- Uploads file to temp storage, calls `trpc.rfpSessions.classifyFile`
- Backend sends file URL to Gemini Flash with structured JSON prompt
- Returns `{ documentType, confidence, keyEvidence, suggestedLabel, extractionDepth }`
- Runs in parallel batches of 5 with 500ms inter-batch delay
- Target: < 20s for 20 files, < $0.10 Gemini Flash cost

**New tRPC procedure:** `rfpSessions.classifyFile` (protected) — accepts `{ fileUrl, fileName, mimeType }`, returns structured classification JSON.

**New shared types in `shared/types.ts`:**
- `ClassificationConfidence`: `"high" | "medium" | "low" | "unclassified"`
- `ClassificationResult`: `{ label, confidence, keyEvidence }`
- `CONFIDENCE_BADGE`: confidence → `{ icon, label, className }`

**Extended `QueuedFile` interface:** `confidence`, `keyEvidence`, `pageCount`, `pass2Running`

**Manifest UI additions:**
- Confidence badge: ✅ High / 〰️ Medium / ⚠️ Review / ? Unclassified
- Key evidence subtitle under filename in small gray text
- Page count and file size shown inline
- Low/unclassified rows highlighted amber
- Global Pass 2 spinner while Gemini is running
- Pre-process `AlertDialog` for low/unclassified files: Review Now | Process Anyway

### File Label Vocabulary (Current — 12 labels)

```
main_rfp | scope | addendum | appendix | fee_schedule | certificate
form | cover_letter | reference | supplemental | other
```

Default when no keywords match: `supplemental` (changed from `main_rfp` — forces explicit designation).
Validation: Process blocked if no file labeled `main_rfp`.

### Checkpoints This Session

| Version | Description |
|---------|-------------|
| `ccfec7b4` | Fix blank RFP fields: frontend polls until rfp_parser completes |
| `147a854c` | Extraction tier control: Full Extract / Metadata Only / SheetJS badges |
| `175b925c` | File auto-classification fix: new keyword rules, Supplemental default |
| `b3846c96` | Two-pass pre-classification: Pass 1 heuristics + Pass 2 Gemini Flash skim |

---

## Architecture Changes — Jun 1, 2026

### Quick Signal Pre-Score (Proposal Launchpad)

A new client-side pre-score card that appears in the Proposal Launchpad **after Pass 2 classification completes, before the user clicks Process**. Zero new routers beyond `firmSettings`.

**Pass 2 extension:**
- `rfpSessions.classifyFile` now accepts an optional `isMainRfp: boolean` flag.
- When `true`, the Gemini Flash prompt returns an additional `quickSignals` object alongside the existing classification fields:
  - `agency`, `projectType`, `estimatedValue`, `dueDate`, `location` (extracted strings)
  - `prequalRequired: boolean`, `prequalType: string | null`
  - `immediateRedFlags: string[]`

**Firm Profile (`firm_settings` table):**
- New table with one row per entity (scoped by `entityId` UUID, unique constraint).
- Fields: `firmName`, `serviceLines` (JSON array), `states` (JSON array), `typicalValueMin`, `typicalValueMax`, `minDaysToRespond` (default 14), `preferredAgencies` (JSON array), `avoidedAgencies` (JSON array).
- Router: `firmSettings.get({ entityId? })` and `firmSettings.upsert({ entityId?, ...fields })` in `server/routers/settings.ts`.
- **Settings > Firm Profile tab**: entity toggle buttons in the card header (JPCL / Strans) when multiple entities exist. Switching entity reloads the form from the correct DB row. Each entity's profile is saved independently.

**Client-side scoring (`client/src/lib/quickSignal.ts`):**
- `computeQuickSignal(signals: QuickSignals, profile: FirmProfile)` scores 6 factors as `favorable | neutral | unfavorable`:
  1. **Agency** — favorable if in `preferredAgencies`, unfavorable if in `avoidedAgencies`
  2. **Project type** — favorable if matches `firmServiceLines`
  3. **Value** — favorable if within `typicalValueMin/Max` range
  4. **Due date** — favorable if > 21 days, neutral if 14–21, unfavorable if < 14
  5. **Location** — favorable if state in `firmStates`
  6. **Red flags** — unfavorable if `immediateRedFlags` array is non-empty
- Returns `{ strength: "strong" | "mixed" | "weak", favorableCount, factors[] }`
- Thresholds: strong ≥ 5 favorable, mixed ≥ 3, else weak.

**Quick Signal card UI:**
- Strength badge: 🟢 Strong Signal / 🟡 Mixed Signal / 🔴 Weak Signal
- Extracted values row (agency, type, value, due date, location, prequal)
- 6-factor checklist with favorable/neutral/unfavorable icons
- Amber warning chips for `immediateRedFlags`
- **"Process & Full Analysis"** — proceeds with existing full extraction + Go/No-Go flow
- **"Archive This RFP"** — creates an `opportunities` record with `status = "archived"`, skips extraction

**Entity scoping in `ProposalLaunchpad.tsx`:**
- `useEntityContext().activeEntityId` is passed to `trpc.firmSettings.get.useQuery({ entityId })` so the scorer always uses the currently active entity's profile.

**New shared types (`shared/types.ts`):**
- `QuickSignals`, `SignalRating`, `SignalFactor`, `QuickSignalStrength`, `QuickSignalScore`, `FirmProfile`

### Checkpoints This Session

| Version | Description |
|---------|-------------|
| `b3ed59cb` | Documentation audit: todo.md, ARCHITECTURE.md, CLAUDE.md, SPECIFICATIONS.md reconciled |
| `4bb9e803` | Quick Signal pre-score + Firm Profile settings (single global profile) |
| `68cc0429` | Per-entity Firm Profile + GitHub sync |
| `b3a67335` | Proposal Workspace Fix v4.2: buildSkillVariables, mapToSkillType, live generation chain |
| `b29a9839` | AI Skills outputType column (json/prose/json_with_prose) |
| `62d88087` | Proposal Workspace Output Renderers (SkillOutputRenderer) |
| `fa3c66f7` | Dynamic outputType lookup from ai_skills at runtime |
| `aad2b8bd` | Proposal Launchpad Step 3 — Asset Matching panel + DAM hydration |

---

## Architecture Changes — Jun 1, 2026 (Afternoon)

### AI Skills `outputType` Column

The `ai_skills` table now includes an `outputType` column (`text`, default `'prose'`) that controls how the Proposal Workspace renders each skill's output. Three values are supported:

| Value | Behavior |
|-------|----------|
| `prose` | Rendered in an inline rich text editor; user edits directly |
| `json` | Parsed and rendered as structured UI (cards, tables, scorecards) |
| `json_with_prose` | Prose in main editor, JSON metadata in collapsible sidebar |

All 23 seeded skills have an assigned `outputType`:

| outputType | Skills |
|------------|--------|
| `json` | rfp_shredder, go_no_go_advisor, opportunity_scorer, contract_analyzer, asset_tagger, proposal_scorer, opportunity_ingestion, xml_shredder, agent_guidelines, autoExtract, triggerExtract, dam_image_caption, conflict_detector, win_theme_generator, requirements_matrix_builder |
| `prose` | resume_tailor, proposal_writer, wiki_compiler, executive_summary_writer, technical_approach_writer, firm_qualifications_writer, project_experience_writer, key_personnel_writer |

`seedDefaultSkills()` and the `aiSkills.list` in-memory fallback both include `outputType`. The Settings > AI Skills UI can update it at runtime.

### Proposal Workspace — SkillOutputRenderer

The old `SkillOutputEditor` component was replaced by `SkillOutputRenderer` (`client/src/components/SkillOutputRenderer.tsx`), which routes display based on `outputType`:

**Prose skills** → `ProseEditor` — inline textarea with Edit/Save/Cancel. Save calls `trpc.rfpSessions.updateSkillOutput` (persists to `rfp_sessions.skillOutputs` JSON column in Supabase Postgres). Explicit save only — no autosave-on-blur.

**JSON skills** — skill-specific structured renderers:

| Skill Type | Renderer | Display |
|------------|----------|--------|
| `win_theme_generator` | `WinThemeCards` | Styled cards with title, statement, rationale, proof, applicable sections |
| `proposal_scorer` | `ProposalScorecard` | Overall score ring, per-criterion progress bars, gaps/improvements lists |
| `requirements_matrix_builder` | `ComplianceChecklist` | Table with status badges, mandatory flags, section mapping |
| `conflict_detector` | `ConflictCards` | Severity badges (critical/high/medium/low), affected sections, recommendations |
| Other JSON | `GenericJsonViewer` | Formatted key/value tree |

**json_with_prose** → `JsonWithProseRenderer` — prose in main editor, JSON metadata in collapsible right sidebar.

**Fallback** → `FallbackRenderer` — monospace code block + amber warning banner (for unknown outputType or JSON parse failure).

### Dynamic outputType Resolution

The static `SKILL_OUTPUT_TYPE` map was removed. The workspace now resolves `outputType` at runtime:

1. `trpc.aiSkills.list.useQuery()` fetches all skill records (including `outputType`)
2. `WORKFLOW_SKILL_TO_SKILL_TYPE` mapping (exported from `shared/workflowTypes.ts`) converts workflow skill names to skill types
3. `resolveOutputType(workflowSkillName, aiSkillRecords)` looks up the matching record and returns its `outputType`

If someone updates `outputType` in Settings → AI Skills, the workspace picks it up on next render.

### Proposal Launchpad Step 3 — Asset Matching

After the GO decision, the Launchpad now transitions to an **asset_matching** step before navigating to the Proposal Workspace. This step lets the user select DAM assets (project sheets, resumes, past proposals) to feed into the generation chain.

**Schema additions** (pursuits table):

| Column | Type | Purpose |
|--------|------|--------|
| `selectedProjectIds` | text (JSON array) | DAM document IDs for project sheets |
| `selectedPastProposalIds` | text (JSON array) | DAM document IDs for past proposals |
| `selectedPersonnel` | text (JSON array) | `[{ documentId, role }]` for resumes |

**Server procedures** (added to existing routers, zero new routers):

| Procedure | Router | Behavior |
|-----------|--------|----------|
| `matchProjectSheets` | dam | Returns top 10 project_sheet docs by service line tag overlap |
| `matchResumes` | dam | Returns top 10 resume docs (base version) by tag overlap |
| `matchPastProposals` | dam | Returns top 5 past_proposal docs by tag overlap |
| `searchForAssetMatching` | dam | Free-text search filtered by docType |
| `saveAssetSelections` | pursuits | Writes JSON arrays to pursuit record |

**Client component:** `AssetMatchingPanel` (`client/src/components/AssetMatchingPanel.tsx`) — three sections with checkboxes, search bars, role inputs for personnel, auto-preselects top 3 project sheets + top 1 past proposal.

**Launchpad integration:** After GO click, `step` transitions to `'asset_matching'` instead of navigating directly. User selects assets → Save & Continue → navigates to workspace. "Continue Without Assets" option available.

**Workspace integration:** "Assets" button in toolbar opens a `Sheet` side panel with `AssetMatchingPanel` for editing selections mid-generation.

### buildSkillVariables() — DAM Hydration

`buildSkillVariables()` in `server/routers/rfpSessions.ts` now reads the pursuit's asset selections from the DB and hydrates skill template variables with real DAM content:

| Variable | Source |
|----------|--------|
| `selectedProjects` | `pursuit.selectedProjectIds` → `dam_documents.extractedMeta` (project name, client, value, description) |
| `selectedPersonnel` | `pursuit.selectedPersonnel` → `dam_documents.extractedText` (name, role, resume text) |
| `pastProposalsSummary` | `pursuit.selectedPastProposalIds` → `dam_documents.extractedText` (title, text summary) |

Fallback: if no DAM selections exist, falls back to legacy `amp_projects` and `personnel` table queries (preserves backward compatibility with sessions created before v4.6).

---

## Architecture Changes — Jul 5, 2026

### AI Skills Configuration Overhaul (v4.20–4.21)

The LLM provider system was completely rebuilt to remove all hardcoded provider dependencies and platform-specific fallbacks.

**New `provider_api_keys` table** (10 columns):

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `name` | text | Human-readable label (e.g. `gemini-flash`, `claude-sonnet-prod`) |
| `provider` | text | Free-text provider identifier (no enum constraint) |
| `sdkType` | text | `openai_compatible` \| `google_gemini` \| `anthropic` |
| `apiKey` | text | Encrypted API key |
| `baseUrl` | text | Required for Azure OpenAI, Ollama, and custom endpoints |
| `defaultModel` | text | Model used when this key is the fallback |
| `isDefault` | boolean | Marks the system-wide fallback provider |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**`sdkType` decouples routing from provider name.** Previously, `invokeLLMWithSkill()` branched on `if (provider === 'google_gemini')` and `if (provider === 'anthropic')`, which meant a typo silently fell through to OpenAI-compatible and a provider could only have one configuration. Now all three routing branches check `sdkType` — the provider name is purely a label.

**Manus built-in removed.** The `manus_builtin` provider and all `ENV.forgeApiKey` references have been removed from `invokeLLMWithSkill()`, `resolveApiKey()`, `resolveEndpoint()`, `sanitizeMessagesForProvider()`, and the Settings UI. The `manus_builtin` enum value no longer exists in the codebase.

**Default model fallback.** When any API error occurs (401, 403, 429, 5xx, auth errors), the system retries with the `provider_api_keys` row where `isDefault = true`. The `SkillStateEntry` type in `shared/workflowTypes.ts` now carries `usedDefaultModel: boolean` and `defaultModelName: string | null`. `SkillOutputRenderer` shows an amber banner when `usedDefaultModel` is true.

**Test Connection procedure** (`aiSkills.providerKeys.testConnection`): sends a real inference call (not a health check) using the configured `sdkType` and model. Validates model names at configuration time, not at proposal generation time.

**Settings UI changes:**
- Provider API Keys manager replaces the old 3-row static key form
- Provider name is a free-text input with datalist suggestions
- SDK / Protocol is a 3-button selector (OpenAI-compatible / Google Gemini / Anthropic)
- Base URL field auto-appears for non-well-known providers
- sdkType badge shown in key list row
- Per-skill provider dropdown reads from `provider_api_keys` table

### Checkpoints This Session

| Version | Description |
|---------|-------------|
| `974470ea` | AI Skills Configuration Overhaul v4.20: provider_api_keys table, sdkType, remove manus_builtin, default fallback |
| `7e63c2bb` | Test Connection button in Provider API Keys modal |
| `168303f1` | Free-form provider field — any provider name allowed |
| `69a71d9c` | sdkType column: routing fully decoupled from provider name string |
| `2680f6e6` | Phase 4: evidenceBundleBuilder.ts, evidenceContext injection into 4 generation skills, evidenceBundles JSONB persistence |
| `1f207c57` | Phase 5: ScorerOutput extended with evidenceCoverage + unsupportedClaims; ProposalScorecard amber panel; scorerEvidenceInput column |
| `d3a71d42` | Phase 6: EvidenceSourcesPanel, getEvidenceSources procedure, scorer analytics telemetry in llm_usage_logs.metadata |
| `b054f5af` | Phase 7: requirements_matrix_builder/conflict_detector renderer routing; ProposalScorecard full display (sorted table, gap/improvement panels, winThemesCoverage matrix); citationFormat parameter on formatEvidenceContext |
| `b7d35e97` | Auth fix: Supabase storageKey isolation to prevent cross-app session collision |
| `e27416d2` | Phase 8 Track C: GROUNDING RULES added to all 4 generation skill system prompts; evidenceContext in templateVariables |
