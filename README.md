# Amplify Proposals

> **The AI-powered proposal intelligence platform for AEC firms.**
> From opportunity discovery to contract execution — every pursuit, every proposal, every win.

Purpose-built for Architecture, Engineering, and Construction firms operating in the NJ/NY/NYC public-sector market. Amplify Proposals replaces the fragmented combination of SharePoint folders, Excel trackers, Deltek, and manual InDesign workflows with a single, deeply integrated system that puts the firm's institutional memory to work at proposal time.

---

## What It Does

| Module | Description |
|--------|-------------|
| **Proposal Launchpad** | Two-step wizard: upload an RFP package (PDF, DOCX, XLSX, ZIP) or enter manually → AI Go/No-Go score with strengths, risks, and win themes → one-click pursuit creation |
| **Proposal Workspace** | 12-skill sequential AI orchestrator (RFP parse → compliance matrix → win themes → key personnel → past performance → fee estimate → section drafts → final review) with pause/resume and per-skill editing |
| **Knowledge Hub** | Unified DAM for all proposal content: resumes, project sheets, past proposals, certifications, RFPs, contracts, boilerplate, and AEC project photography with Gemini Vision auto-captioning |
| **Bulk Image Import** | Full-screen modal for ingesting 200+ images at once — folder parsing, parallel upload, Gemini Vision captioning queue, smart AEC grouping, group metadata, review panel, and one-click create |
| **AI Tools Suite** | Document Shredder, RFP Wiki, Conflict Detector, Contract Analyzer, Agent Guidelines, Proposal Scorer |
| **Contract Management** | Three-tier contract hierarchy (Primary → Task Order → Sub-Project), NTE vs. Authorized financial model, amendment tracking, QuickBooks CSV import, compliance tracking |
| **Opportunities** | Manual entry + planned portal scraping; Go/No-Go → Pursuit conversion |
| **Firm Records** | Staff, Projects, Glossary — all linked to Knowledge Hub documents (Resource Library retired, redirects to Knowledge Hub) |
| **Settings** | User management, lookup tables, AI skill prompt editor, Firm Profile (per-entity Quick Signal config), bulk import (9 data types) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Tailwind CSS 4 + shadcn/ui |
| API | tRPC 11 + superjson (end-to-end type safety) |
| Server | Express 4 on Node.js |
| ORM | Drizzle ORM |
| Database | Supabase Postgres (session pooler, port 6543) |
| Auth | Supabase Auth (email/password + JWT) |
| Storage | Supabase Storage (private `dam` bucket) |
| LLM | Configurable per skill — defaults to models in Settings > AI Skills; OpenAI, Anthropic, Gemini, Manus built-in supported |
| Vision | Google Gemini Flash (AEC image captioning via `dam_image_caption` skill) |
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

All secrets are injected via the Manus platform. For local development, create a `.env` file at the project root:

```env
DATABASE_URL=                  # Supabase session pooler connection string (port 6543)
JWT_SECRET=                    # Session cookie signing secret
VITE_APP_ID=                   # Manus OAuth application ID
OAUTH_SERVER_URL=              # Manus OAuth backend base URL
VITE_OAUTH_PORTAL_URL=         # Manus login portal URL (frontend)
OWNER_OPEN_ID=                 # Owner's Manus Open ID
OWNER_NAME=                    # Owner's display name
BUILT_IN_FORGE_API_URL=        # Manus built-in API base URL
BUILT_IN_FORGE_API_KEY=        # Manus built-in API key (server-side)
VITE_FRONTEND_FORGE_API_KEY=   # Manus built-in API key (frontend)
VITE_FRONTEND_FORGE_API_URL=   # Manus built-in API URL (frontend)
SUPABASE_URL=                  # Supabase project URL
SUPABASE_SECRET_KEY=           # Supabase service role key (server-side)
VITE_SUPABASE_URL=             # Supabase project URL (frontend)
VITE_SUPABASE_ANON_KEY=        # Supabase anon key (frontend)
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

## Key Files

```
drizzle/schema.ts              <- 44 Amplify DB tables (UUID PKs throughout)
server/routers.ts              <- tRPC router registry (19 feature routers)
server/routers/dam.ts          <- Knowledge Hub + image upload pipeline
server/routers/proposals.ts    <- Proposal Workspace skill orchestrator
server/routers/pursuits.ts     <- Pursuit and pipeline management
server/routers/contracts.ts    <- Contract hierarchy and financial model
server/_core/llm.ts            <- LLM invocation helper (configurable per skill)
server/_core/llmSkill.ts       <- Named AI skill definitions and DB config loader
client/src/pages/              <- 38 page components
client/src/App.tsx             <- Route definitions
client/src/index.css           <- Design tokens and global theme
```

---

## Documentation

| File | Contents |
|------|----------|
| [SPECIFICATIONS.md](./SPECIFICATIONS.md) | Full product specification v3.7 — all modules, DB schema, auth, integrations, non-functional requirements |
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | Comprehensive categorized feature list with LIVE / PLANNED status for every feature |
| [ROADMAP_AND_DIFFERENTIATION.md](./ROADMAP_AND_DIFFERENTIATION.md) | Prioritized 29-item backlog (5 tiers) + 6 competitive differentiation recommendations vs. Joist.ai, Shred.ai, and Unanet Proposals |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Session-by-session engineering decisions and architectural notes |
| [todo.md](./todo.md) | Full granular task checklist (359 completed, 174 planned) |

---

## Deployment

The application deploys to Manus hosting (Cloud Run backend + CDN frontend) via the Manus Management UI **Publish** button. A checkpoint must be saved before publishing.

**Production URL:** `https://amplifypro-nzkhudzp.manus.space`
**GitHub:** `lobodasps/amplify-proposals`

---

## License

Proprietary — all rights reserved. © 2026 Amplify Proposals.
