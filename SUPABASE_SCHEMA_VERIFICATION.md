# Supabase Schema Verification

**Verified:** 2026-08-20  
**Live database:** Supabase PostgreSQL 17.6  
**Authoritative application schema:** `drizzle/schema.ts`

## Result

The live Supabase `public` schema matches the Drizzle application schema with **no detected drift**.

| Verification area | Result |
|---|---|
| Drizzle-defined tables | 48 / 48 present |
| Expected columns | All present |
| Unexpected columns within Amplify tables | None |
| PostgreSQL column types | All match |
| Nullability | All match |
| Default presence | All match |
| Primary and unique constraints declared by Drizzle | All present |
| Explicit Drizzle indexes | All present |
| Drizzle foreign keys | None declared in `drizzle/schema.ts` |

The two explicit indexes on `document_chunks` are present in the live Supabase schema:

| Index | Live definition |
|---|---|
| `document_chunks_content_fts_idx` | GIN index over `to_tsvector('english', content)` |
| `document_chunks_dam_document_id_idx` | B-tree index over `damDocumentId` |

## Coexisting v0 / Timekeeping Schema

The live Supabase `public` schema contains **114** tables. The **66 tables not defined in `drizzle/schema.ts`** belong to the pre-existing v0/timekeeping system, including `profiles`, `companies`, `time_entries`, `billing_*`, `rate_*`, `project_*`, and `user_*` tables. They are not missing Amplify-Proposals migrations and must not be dropped or altered as part of Amplify schema work.

## Important Connection Distinction

The application’s runtime `DATABASE_URL` points to the Supabase PostgreSQL pooler. The managed project SQL inspection channel is independently configured against TiDB and therefore must not be used to judge or migrate the Supabase schema. Future schema verification and migrations for this application should target the Supabase PostgreSQL connection used by `server/db.ts` and `drizzle.config.ts`.

## Comparison Scope

The check compared the live `information_schema` and `pg_indexes` catalog against Drizzle-defined tables, columns, types, nullability, default presence, primary/unique constraints, and explicit indexes. It is a structural audit; it does not compare table row contents, row-level security policies, Supabase Storage bucket policies, functions, triggers, extensions, or grants.
