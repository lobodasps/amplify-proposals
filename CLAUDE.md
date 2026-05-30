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
| LLM | Manus Built-in | `invokeLLM()` helper, supports file_url |
| ZIP Extraction | fflate | 0.8.3, client-side only |
| Excel Parsing | SheetJS (xlsx) | 0.18.5, client-side only |
| Testing | Vitest | 16 tests across 3 files |
| Language | TypeScript | Strict mode, zero errors enforced |

---

## Database Architecture

The Supabase Postgres instance contains **two sets of tables** in the same `public` schema:

### Amplify Tables (43 tables, managed by Drizzle ORM)

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
│   ├── schema.ts          # All 43 Amplify table definitions (pgTable)
│   └── relations.ts       # Drizzle relation definitions
├── shared/
│   ├── workflowTypes.ts   # Proposal Workspace skill types
│   └── types.ts           # Shared TypeScript types
├── ARCHITECTURE.md        # This file
├── CLAUDE.md              # Same content (for Claude Code)
└── todo.md                # Task tracking with completion status
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
pnpm test             # Run vitest (16 tests)
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

**Step 2 — Go/No-Go:**
- `proposals.scoreGoNoGo` → score (0–100), recommendation (GO/NO-GO/CONDITIONAL GO), strengths, risks, win themes
- GO → `pursuits.create` → redirect to `/pursuits/:id`; NO-GO → archived state

**Navigation:** "Proposal Launchpad" nav item (Rocket icon, AI badge) in Pursuits & Proposals sidebar group.

---

## Remaining Work

The following major features are planned but not yet implemented. See `todo.md` for the full granular checklist.

### Near-Term

- **LLM Configuration System**: Admin UI for per-task LLM provider/model/prompt selection (currently hardcoded to Manus built-in)
- **Opportunities Ingestion**: Settings-based portal scraping with cheerio, real DB wiring
- **Pursuit Detail**: Wire mock data to real tRPC queries (tasks, requirements, team)
- **Proposals**: Real DB integration, section CRUD, resume tailoring
- **Image Extraction**: PDF page rendering to thumbnails, vision LLM pass for photo extraction from DAM documents

### Medium-Term

- **Karpathy AI Patterns** (v2.1): XML Shredder as RFP pre-processor, LLM Wiki for context injection, Agent Guidelines with multi-approach advisor
- **RFP-Centric Pipeline** (v2.2): Pursuit-scoped AI tools, RFP Workspace page, proposal scoring with history
- **Contract Enhancements**: Tier labels on child orders, compliance field editing, sortable contracts list with rolled-up financials

### Long-Term

- SF 330 form auto-fill and PDF export
- Adobe UXP InDesign plugin
- Word/PowerPoint/PDF export with branded templates
- SSO/SAML enterprise authentication
- Mobile-responsive optimization pass
- Live public agency portal scraping
