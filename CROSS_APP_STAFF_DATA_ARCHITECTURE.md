# Cross-Application Staff Data Architecture

## Decision Principle

Use a **single shared person identity** across the v0 Timekeeping and Amplify-Proposals applications, but keep each application responsible only for the data required by its domain.

> **v0 Timekeeping should be authoritative for employee identity, employment status, company, and credentials. Amplify-Proposals should own proposal-specific positioning, curated content, and evidence associations.**

## Recommended System of Record

| Data domain | Authoritative system/table | Amplify-Proposals behavior |
|---|---|---|
| Person identity: name, email, phone, employee identifier, active status, employer company | v0 `profiles` | Read and display; link by `profiles.id` rather than duplicate |
| Certifications: type, issuer, issue/expiration dates, certificate file path, notes | v0 `certification_types` + `user_certifications` | Read and display in Staff profile; select as proposal qualifications; do not create a second certification ledger |
| Payroll, costs, burdens, hourly pay, billing rates, overtime, holidays, payroll classifications | v0 timekeeping/rate tables | Do not load into the Amplify UI or copy into Amplify tables |
| Proposal biography, resume variants, project roles, differentiators, availability for a pursuit, curated qualifications | Amplify proposal domain | Own and edit in Amplify, keyed to `profiles.id` |
| Resume, certification scan, headshot, project sheet, and other source files | `dam_documents` / `assets` | Store proposal evidence with a durable `staffId = profiles.id` reference |

## Why This Resolves the Current Duplication

The current Amplify `personnel` table duplicates basic identity and certification fields that v0 already maintains. It also allows a resume/certification in Knowledge Hub to be connected only by the mutable free-text `staffName` field. This produces three potential sources of truth: `profiles`, `personnel`, and `dam_documents.staffName`.

The recommended design changes that to a single identity key:

```text
profiles.id (canonical person)
   ├── user_certifications.user_id (v0 credentials)
   ├── dam_documents.staffId (Amplify source documents)
   ├── assets.staffId (Amplify attachments)
   └── proposal-specific profile extension (if needed)
```

## Amplify Data Model Direction

Do not use `personnel` as a second employee master. Instead, convert it into a proposal-specific extension keyed by `profiles.id`, or replace it with a clearly named table such as `proposal_staff_profiles`.

Suggested extension fields are `profileId`, curated bio, proposal headline, service lines, selected project experience, resume preferences, proposal tags, and internal proposal availability. Do **not** duplicate first name, last name, email, phone, employment status, or certification facts.

## Phased Migration

1. **Read-only unification:** Make Staff list from `profiles` with certifications joined from `user_certifications`; retain `personnel` as compatibility data.
2. **Document linkage:** For new Knowledge Hub resumes/certifications, require a staff selector backed by `profiles`; persist `dam_documents.staffId`.
3. **Legacy review:** Produce a review queue for existing `personnel` and `dam_documents.staffName` records. Match only unique, high-confidence cases; require manual resolution for ambiguous names.
4. **Extension migration:** Move proposal-specific fields from `personnel` to a `profiles.id`-keyed extension; remove duplicate identity/certification editing from Amplify.
5. **Navigation cleanup:** Redirect `/personnel` to `/staff`; label the canonical view **Staff & Qualifications** or **People & Credentials**.

## Guardrails

- Never synchronize payroll, rates, burden, overtime, or timekeeping fields into Amplify-Proposals.
- Do not backfill IDs from names automatically when duplicate or incomplete names are possible.
- Keep certification certificates available as evidence in Knowledge Hub, but treat their status and expiry data as v0-owned.
- Ensure UI permissions do not let proposal users modify v0 employment or payroll records.
