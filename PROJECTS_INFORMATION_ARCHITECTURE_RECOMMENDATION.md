# Projects and Knowledge Hub: Information Architecture Recommendation

## Current State

The application currently represents project experience in two separate places:

| Surface | Backing table | Current purpose |
|---|---|---|
| **Firm Records → Projects** (`/projects`) | `amp_projects` | Structured firm project/past-performance records: project name, client, service line, scope, contract value, location, dates, status, tags, and attachments. |
| **Knowledge Hub** (`/knowledge-hub`) | `dam_documents` | Source-document library: uploaded project sheets, past proposals, resumes, certifications, RFPs, contracts, images, and boilerplate, with extraction, chunks, tags, and retrieval metadata. |

The intended difference is legitimate: **Projects are canonical business records; Knowledge Hub is the evidence/document layer.** The implementation currently blurs that distinction because project sheets can be saved in Knowledge Hub with project metadata, but that flow creates `dam_documents` rows only. It does not create or update `amp_projects` records.

## Redundancy Risk

From an end-user perspective, the overlap is substantial. Both surfaces show project title, client, scope, contract value, and project-related files. Because they do not automatically synchronize, users can create a project in the Knowledge Hub that does not appear in Firm Records, or create a Firm Record project without the relevant source documents in Knowledge Hub.

## Recommendation

Retain both surfaces but establish a one-to-many relationship:

> **`amp_projects` should be the canonical project-experience record. `dam_documents` should hold the evidence and source files attached to that record.**

The recommended user experience is:

1. Rename the firm-record menu item to **Project Experience** or **Past Performance** to make its role explicit.
2. Retain Knowledge Hub as the single place for document ingestion, extraction, chunking, and search.
3. When a user uploads or splits a `project_sheet` in Knowledge Hub, offer **Create or link a Project Experience record**. This should create/update `amp_projects` and set `dam_documents.projectId` to that canonical ID.
4. In Project Experience, show a linked **Evidence & Files** panel populated from `dam_documents` as well as existing `assets` attachments.
5. Replace free-text-only `projectName` association in Knowledge Hub with a searchable project selector when an `amp_projects` record exists; preserve `projectName` only as an ingestion fallback.

This preserves the purpose of both areas while eliminating duplicate sources of truth.

## Current Implementation Evidence

- `client/src/pages/Projects.tsx` calls `trpc.projects.list` and creates structured `amp_projects` records through `projectsRouter`.
- `server/routers/personnel.ts` (`projectsRouter`) creates `amp_projects` and stores its file attachments in `assets` with `projectId`.
- `client/src/pages/KnowledgeHub.tsx` calls `trpc.dam.create` for project-sheet uploads and split project sheets.
- `client/src/pages/KnowledgeHub.tsx:handleSaveSplit()` persists `docType: "project_sheet"` to `dam_documents`; it does not call `trpc.projects.create`.
- `drizzle/schema.ts` defines `dam_documents.projectId` and `dam_documents.projectName` alongside the separate `amp_projects` table.
