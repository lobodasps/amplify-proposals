# Amplify Proposals

> **The AI-powered proposal intelligence platform for AEC firms.**
> From opportunity discovery to contract execution — every pursuit, every proposal, every win.

Purpose-built for Architecture, Engineering, and Construction firms operating in the NJ/NY/NYC public-sector market. Amplify Proposals replaces the fragmented combination of SharePoint folders, Excel trackers, Deltek, and manual InDesign workflows with a single, deeply integrated system that puts the firm's institutional memory to work at proposal time.

**Production URL:** `https://amplifypro-nzkhudzp.manus.space`
**GitHub:** `lobodasps/amplify-proposals`

---

## What It Does

| Module | Description |
|--------|-------------|
| **Proposal Launchpad** | Two-step wizard: upload an RFP package (PDF, DOCX, XLSX, ZIP) or enter manually → two-pass AI pre-classification → Quick Signal pre-score → Go/No-Go recommendation → one-click pursuit creation |
| **Proposal Workspace** | Sequential AI skill orchestrator with 24 configurable skills (RFP parse → compliance matrix → win themes → key personnel → past performance → section drafts → final review) with pause/resume, per-skill editing, and asset matching |
| **Knowledge Hub** | Unified DAM for all proposal content: resumes, project sheets, past proposals, certifications, RFPs, contracts, boilerplate, and AEC project photography with Gemini Vision auto-captioning |
| **Bulk Image Import** | Full-screen modal for ingesting 200+ images at once — folder parsing, parallel upload, Gemini Vision captioning queue, smart AEC grouping, group metadata, review panel, and one-click create |
| **AI Tools Suite** | Document Shredder, RFP Wiki, Conflict Detector, Contract Analyzer, Agent Guidelines, Proposal Scorer |
| **Contract Management** | Three-tier contract hierarchy (Primary → Task Order → Sub-Project), NTE vs. Authorized financial model, amendment tracking, QuickBooks CSV import, compliance tracking |
| **Opportunities** | Manual entry with Go/No-Go → Pursuit conversion; portal scraping planned |
| **Firm Records** | Staff, Projects, Glossary — all linked to Knowledge Hub documents |
| **Settings** | User management, lookup tables, AI skill prompt editor, Firm Profile (per-entity Quick Signal config), bulk import (9 data types), Provider API Keys manager |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Tailwind CSS 4 + shadcn/ui |
| API | tRPC 11 + superjson (end-to-end type safety) |
| Server | Express 4 on Node.js |
| ORM | Drizzle ORM (postgres-js driver) |
| Database | Supabase Postgres (session pooler, port 6543) |
| Auth | Supabase Auth (email/password + JWT) |
| Storage | Supabase Storage (private `dam` bucket, 50 MB limit) |
| LLM | Fully configurable per skill via `provider_api_keys` table — OpenAI-compatible, Google Gemini SDK, Anthropic SDK; any provider name, explicit SDK type |
| Vision | Google Gemini Flash (AEC image captioning via `dam_image_caption` skill) |
| ZIP Extraction | fflate 0.8.3 (client-side) |
| Excel Parsing | SheetJS (client-side, 5 sheets × 30 rows) |
| Testing | Vitest |
| Language | TypeScript (strict mode, zero errors enforced) |

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 22+
- pnpm 9+
- A Supabase project with the schema applied

### Install

```bash
pnpm install
```

### Environment Variables

All secrets are injected via the Manus platform. For local development, create a `.env` file at the project root. See [SECRETS_REFERENCE.md](./SECRETS_REFERENCE.md) for the full variable list and where to obtain each value.

**Minimum required to start:**

```env
DATABASE_URL=          # Supabase session pooler connection string (port 6543)
SUPABASE_URL=          # Supabase project URL
SUPABASE_SECRET_KEY=   # Supabase service role key (server-side)
VITE_SUPABASE_URL=     # Supabase project URL (frontend)
VITE_SUPABASE_ANON_KEY=# Supabase anon key (frontend)
JWT_SECRET=            # Session cookie signing secret
```

### Database

Push the schema to your Supabase instance:

```bash
pnpm db:push
```

### Run

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

### Test

```bash
pnpm test
```

---

## AI Provider Configuration

Amplify Proposals does **not** use any hardcoded or platform-injected LLM API keys. All AI calls are routed through the `provider_api_keys` table, which you manage in **Settings → AI Skills → Provider API Keys**.

### Adding a Provider

1. Go to **Settings → AI Skills → Configuration**
2. Click **Add Key** in the Provider API Keys section
3. Fill in:
   - **Name** — any label (e.g. `gemini-flash`, `claude-sonnet-prod`)
   - **Provider** — free-text identifier (e.g. `google_gemini`, `anthropic`, `openai`, `groq`)
   - **SDK / Protocol** — select the routing SDK (see table below)
   - **API Key** — your key from the provider
   - **Base URL** — required for Azure OpenAI, Ollama, and any custom endpoint
   - **Default Model** — used when this key is the fallback provider
4. Toggle **Set as default fallback provider** on the key you want used when a skill's primary provider fails

### SDK / Protocol Options

| SDK Type | Covers | Required fields |
|----------|--------|-----------------|
| `openai_compatible` | OpenAI, Azure OpenAI, Mistral, Groq, Together, DeepSeek, Fireworks, Ollama, any custom endpoint | API Key; Base URL required for non-OpenAI |
| `google_gemini` | Any Google Generative AI key (gemini-* models) | API Key |
| `anthropic` | Any Anthropic key (claude-* models) | API Key |

The **SDK type is decoupled from the provider name** — you can name a key `gemini-flash-experimental` and still select the Google Gemini SDK. Routing is explicit, not string-matched.

### Default Model Fallback

When a skill's configured provider returns any API error (401, 403, 429, 5xx), the system automatically retries with the **default provider key**. If the default was used, an amber banner appears above the skill output in the Proposal Workspace:

> ⚠️ **Default model used:** The configured skill provider failed. This output was generated using the system default provider.

### Test Connection

Every Add/Edit modal includes a **⚡ Test Connection** button that sends a real inference call (not just a health check) to the provider using the model you specified. A model typo will fail the test immediately.

### Current Skills and Their Providers

As of the initial setup, 24 skills are seeded. The providers configured in the database are:

| Provider | Skills |
|----------|--------|
| `anthropic` / `claude-sonnet-4-20250514` | agent_guidelines, conflict_detector, contract_analyzer, go_no_go_advisor, opportunity_scorer, proposal_scorer, proposal_writer, resume_tailor, tailored_resume |
| `google_gemini` / `gemini-2.5-flash-preview-05-20` | asset_tagger, autoExtract, dam_image_caption, opportunity_ingestion, rfp_shredder, wiki_compiler, xml_shredder |
| `google_gemini` / `gemini-2.5-pro-preview-05-06` | triggerExtract |
| `manus_builtin` (needs update) | executive_summary_writer, firm_qualifications_writer, key_personnel_writer, project_experience_writer, requirements_matrix_builder, technical_approach_writer, win_theme_generator |

The 7 `manus_builtin` skills must be reassigned to a real provider key in Settings → AI Skills before they will work.

---

## Key Files

```
drizzle/schema.ts              ← All Amplify DB tables (UUID PKs throughout)
server/routers.ts              ← tRPC router registry (25+ feature routers)
server/routers/rfpSessions.ts  ← Proposal Workspace skill orchestrator
server/routers/dam.ts          ← Knowledge Hub + image upload pipeline
server/routers/contracts.ts    ← Contract hierarchy and financial model
server/routers/aiSkills.ts     ← AI skill config + provider_api_keys CRUD
server/_core/llmSkill.ts       ← invokeLLMWithSkill — provider routing via sdkType
server/_core/llm.ts            ← Low-level LLM invocation helper
client/src/pages/              ← Page components (29 routes)
client/src/App.tsx             ← Route definitions
client/src/index.css           ← Design tokens and global theme
shared/workflowTypes.ts        ← Proposal Workspace skill types and state
```

---

## Documentation

| File | Contents |
|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full technical architecture: stack, DB schema, auth, storage, LLM routing, session-by-session engineering decisions |
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | Comprehensive categorized feature list with LIVE / PLANNED status |
| [SECRETS_REFERENCE.md](./SECRETS_REFERENCE.md) | Every environment variable, where to find it, and session recovery checklist |
| [SPECIFICATIONS.md](./SPECIFICATIONS.md) | Product specification — all modules, DB schema, auth, integrations |
| [ROADMAP_AND_DIFFERENTIATION.md](./ROADMAP_AND_DIFFERENTIATION.md) | Prioritized backlog + competitive differentiation vs. Joist.ai, Shred.ai, Unanet Proposals |
| [CLAUDE.md](./CLAUDE.md) | Mirror of ARCHITECTURE.md — for Claude Code / Cursor sessions |
| [todo.md](./todo.md) | Active work items only |
| [backlog.md](./backlog.md) | Full prioritized feature backlog (not yet started) |
| [archive.md](./archive.md) | Completed work history (append-only) |

---

## Deployment

The application deploys to Manus hosting (Cloud Run backend + CDN frontend) via the Manus Management UI **Publish** button. A checkpoint must be saved before publishing.

---

## License

Proprietary — all rights reserved. © 2026 Amplify Proposals.
