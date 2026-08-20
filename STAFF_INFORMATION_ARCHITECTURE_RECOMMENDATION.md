# Staff and Knowledge Hub: Information Architecture Recommendation

## Current State

There are three overlapping views of the same firm people data:

| Surface | Backing data | Current role |
|---|---|---|
| **Firm Records → Staff** (`/staff`) | `personnel` and linked `assets` | Active team-member directory with profile cards, disciplines, keywords, and linked attachments. |
| **Personnel** (`/personnel`) | `personnel` | A second, legacy presentation of the same team-member directory. It is reachable by route but is not linked from navigation. |
| **Knowledge Hub** | `dam_documents` | Uploaded resumes and certifications, currently associated through free-text `staffName`. |

## Confirmed Duplication

Both `/staff` and `/personnel` call `trpc.personnel.list` and both create records with `trpc.personnel.create`. They are duplicate UIs over the same `personnel` table. The **Personnel** route should be treated as legacy and redirected to **Staff**.

Knowledge Hub has a separate document record for resumes/certifications. `dam_documents` includes both `staffId` and `staffName`, but the current upload and edit flows populate only the free-text `staffName`. That creates an unreliable association: a spelling change or a duplicate name can disconnect the document from the canonical staff member.

## Recommendation

> **`personnel` should be the sole canonical staff record. `dam_documents` and `assets` should be the evidence/document layer linked to it by `staffId`.**

The safe immediate correction is to redirect `/personnel` to `/staff`, eliminating the duplicate screen without changing data.

The follow-on consolidation should replace the Knowledge Hub’s free-text staff association with a staff picker backed by `trpc.personnel.list`. Uploads and edits of resumes/certifications should persist `dam_documents.staffId`, while retaining `staffName` only for legacy/unmatched documents. Existing DAM records should be linked through a reviewable migration rather than name matching automatically.

## Implementation Boundary

| Change | Risk | Approval needed? |
|---|---:|---|
| Redirect `/personnel` to `/staff` | Low; both pages query the same data | No substantive data-model decision required |
| Rename Staff to **People & Credentials** or retain **Staff** | Low; navigation copy only | Prefer owner confirmation |
| Show Knowledge Hub documents in Staff detail | Low–medium; additive read-only linkage | Yes, to confirm preferred presentation |
| Use `staffId` picker for new DAM resumes/certifications | Medium; changes future association behavior | Yes |
| Backfill existing `staffName` values to `staffId` | Medium–high; requires ambiguous-name review | Yes, manual review workflow required |

## Evidence

- `client/src/pages/Staff.tsx` and `client/src/pages/Personnel.tsx` both call `trpc.personnel.list`.
- `server/routers/personnel.ts` defines the canonical `personnel` list/create procedures and uses `assets.staffId` for attachments.
- `client/src/pages/KnowledgeHub.tsx` persists `staffName` for resume/certification uploads and does not submit `staffId`.
- `drizzle/schema.ts` defines `dam_documents.staffId` and `dam_documents.staffName`, plus the canonical `personnel` table.
