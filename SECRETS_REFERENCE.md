# Amplify Proposals — Secrets Reference

This file documents every environment variable required by the application.
**No values are stored here.** This file exists so that any new AI session or developer
can quickly identify which secrets to restore and where to find them.

---

## How to Restore Secrets in a New Chat Session

If a new chat session is missing secrets (app won't start, DB errors, auth broken), use this
procedure — **do not type values manually**:

```
Call webdev_request_secrets for each group below.
The Manus platform will auto-match values from its secret store.
Do NOT ask the user to type values unless auto-match fails.
```

If auto-match fails for a specific variable, refer to the "Where to find it" column below
and ask the user for only that specific value.

---

## Group 1 — Database (Required for app startup)

| Variable | Purpose | Where to find it |
|----------|---------|-----------------|
| `DATABASE_URL` | Primary Postgres connection string (Supabase) | Supabase Dashboard → Project → Settings → Database → Connection string → URI (use the "pooler" URL for production) |
| `SUPABASE_URL` | Supabase project REST/API base URL | Supabase Dashboard → Project → Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase service-role key (server-side, never expose to client) | Supabase Dashboard → Project → Settings → API → service_role key |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` — exposed to frontend | Same as above |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client) | Supabase Dashboard → Project → Settings → API → anon public key |

---

## Group 2 — Authentication (Required for login)

| Variable | Purpose | Where to find it |
|----------|---------|-----------------|
| `JWT_SECRET` | Signs session cookies | Manus platform secret store — auto-injected; if missing, generate a 64-char random string |
| `VITE_APP_ID` | Manus OAuth application ID | Manus platform — auto-injected |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL | Manus platform — auto-injected (typically `https://api.manus.im`) |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL shown to frontend | Manus platform — auto-injected |
| `OWNER_OPEN_ID` | Owner's Manus user ID | Manus platform — auto-injected |
| `OWNER_NAME` | Owner's display name | Manus platform — auto-injected |

---

## Group 3 — AI / LLM (Required for all AI features)

| Variable | Purpose | Where to find it |
|----------|---------|-----------------|
| `GOOGLE_AI_API_KEY` | Gemini Flash/Pro vision + text (rfp_parser, dam_image_caption, classifyFile, all workspace skills) | Google AI Studio → [aistudio.google.com](https://aistudio.google.com) → Get API key |
| `OPENAI_API_KEY` | OpenAI fallback / Whisper transcription | OpenAI Platform → [platform.openai.com](https://platform.openai.com) → API keys |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in AI APIs (server-side) | Manus platform — auto-injected |
| `BUILT_IN_FORGE_API_URL` | Manus built-in AI API base URL | Manus platform — auto-injected |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus built-in AI APIs (client-side) | Manus platform — auto-injected |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in AI API URL for frontend | Manus platform — auto-injected |

---

## Group 4 — App Identity (Required for branding)

| Variable | Purpose | Where to find it |
|----------|---------|-----------------|
| `VITE_APP_TITLE` | App display name shown in browser tab | Set to: `Amplify Proposals` |
| `VITE_APP_LOGO` | App logo URL | Manus platform — auto-injected or set to the uploaded logo URL |

---

## Group 5 — Analytics (Optional — app works without these)

| Variable | Purpose | Where to find it |
|----------|---------|-----------------|
| `VITE_ANALYTICS_ENDPOINT` | Umami/analytics ingest URL | Manus platform — auto-injected |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics site identifier | Manus platform — auto-injected |

---

## Minimum Set to Get the App Running

If you need the app running quickly and can only restore a subset, prioritize in this order:

1. `DATABASE_URL` — without this, nothing works
2. `SUPABASE_URL` + `SUPABASE_SECRET_KEY` — needed for auth and file storage
3. `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — needed for frontend queries
4. `JWT_SECRET` — needed for login sessions
5. `GOOGLE_AI_API_KEY` — needed for all AI extraction and classification features

The Manus-injected variables (`BUILT_IN_FORGE_*`, `VITE_FRONTEND_FORGE_*`, `OAUTH_*`, `OWNER_*`, `VITE_APP_ID`) are always auto-injected by the platform and do not need manual entry.

---

## Session Recovery Checklist for New AI Chats

When starting a new chat to continue work on this project:

- [ ] Open chat from the **Amplify-Proposals project card** in the Management UI (not "New task" from sidebar)
- [ ] Run `webdev_check_status` to confirm dev server is running
- [ ] Read `CLAUDE.md` for full session history and architectural decisions
- [ ] Read `todo.md` for pending work items
- [ ] If secrets are missing, call `webdev_request_secrets` — do NOT ask user to type values
- [ ] Run `pnpm db:push` only if schema changes are pending (check `drizzle/schema.ts` git diff first)

---

## Supabase Project Details

- **Project name:** amplify-proposals (or similar — check Supabase dashboard)
- **Region:** us-east-1 (or wherever it was created)
- **Database:** PostgreSQL 15 via Supabase
- **Tables:** 43 tables — see `drizzle/schema.ts` for full schema
- **Migrations:** Managed via Drizzle Kit (`pnpm db:push`)

---

*Last updated: May 31, 2026 — all variables confirmed present and working.*
