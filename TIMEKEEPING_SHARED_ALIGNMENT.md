# Timekeeping/V0 Shared-Model Alignment

**Status:** Implemented and validated on the shared Supabase PostgreSQL database.

Amplify Proposals now treats Timekeeping/V0 as the authoritative source for staff identity, certification records, and access permissions. The application does not create shared identity, certification, or permission tables, and it no longer relies on `amp_users.role` for access control.

| Requested alignment item | Implemented behavior | Verification evidence |
|---|---|---|
| Typed shared-table stubs | Added read-only Drizzle declarations for `profiles`, `user_certifications`, `certification_types`, `user_permissions`, `permission_roles`, and `user_role_assignments`. | TypeScript passes with typed joins in Staff Directory, proposal skill hydration, and permission resolution. |
| Personnel identity link | `personnel.userId` now has an enforced foreign key to `profiles.id`; `personnel.employerType` is non-null with an `internal` default. | Live audit found 17 personnel records, one linked profile, and zero invalid links. The database reports `FOREIGN KEY ("userId") REFERENCES profiles(id) ON DELETE SET NULL`. |
| Live certifications | Proposal skill variables resolve certifications through `personnel.userId` or resume `staffId` to `user_certifications` and `certification_types`; legacy `personnel.certifications` is no longer read. | Live join returned named certifications. The shared table currently has 8 active/unexpired records and no expired record to demonstrate exclusion. |
| Staff Directory | Staff Directory reads shared profiles and active/non-expired certifications through typed Drizzle queries. | No Supabase table-client access remains in `staffDirectory.ts`. |
| Permission source | Server permission resolver merges `user_permissions` and role-derived `permission_roles` records. Timekeeping-managed `profiles.permission_scope = all` or `profiles.role = admin` preserves all shared access when detailed proposal flags are not populated. | The active owner profile resolves all 12 Amplify permissions from the shared Timekeeping profile scope. |
| Legacy role retirement | `amp_users.role` is no longer written by `upsertUser` and no server/client access check uses it. Navigation is filtered by the read-only `permissions.me` response. | Repository scan found no remaining `ctx.user.role`, `user.role ===`, or role-array access gate. |
| Permission UI boundary | Settings now provides a read-only Shared Users view. In-app invite and role-assignment controls were removed. | Timekeeping/V0 remains the sole permission and role assignment authority. |

## Migration notes

Migration `0023_gray_deathbird.sql` adds only the Amplify-owned `personnel.employerType` field and the foreign key to the existing shared `profiles` table. Migration `0024_little_ultimo.sql` is a safe no-op that advances the local Drizzle snapshot for existing Timekeeping-owned columns; it does not alter any shared table.

## Validation

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm check` | Passed with 0 TypeScript errors |
| `pnpm test` | Passed: 46 test files, 333 tests |
| `pnpm build` | Passed |
| Live database certification join | Passed |
| Live personnel FK and employer field audit | Passed |
| Effective shared owner-permission query | Passed |

## Intentional limitation

No new permission-management UI or in-app role assignment was added. Detailed proposal permission flags are currently unset in the shared records examined during validation, so the resolver respects the existing Timekeeping-managed all-access profile scope for those profiles. As Timekeeping/V0 populates the named flags or role permissions, those direct and role-derived grants are merged automatically.
