# Amplify-Proposals — Active TODO

Last updated: 2026-07-05
Current version: v4.29 (post Pipeline Upgrade Phases 4–8 + auth storage-key isolation)

---

## 🔴 Immediate Action Required

- [ ] Reassign 7 `manus_builtin` skills to real provider keys in Settings → AI Skills (executive_summary_writer, firm_qualifications_writer, key_personnel_writer, project_experience_writer, requirements_matrix_builder, technical_approach_writer, win_theme_generator)
- [ ] Apply updated GROUNDING RULES prompts to existing deployments: Settings → AI Skills → Reset to Default for each of the 4 generation skills (win_theme_generator, technical_approach_writer, key_personnel_writer, project_experience_writer) — or run `seedDefaultSkills({ force: true })` from admin panel

---

## 🟠 Known Issues

- [ ] Some proposal sections may still render as raw JSON if the DB ai_skills outputType record was seeded incorrectly — use the "Re-render as Prose" button as a workaround; run seedDefaultSkills to re-seed if needed
- [ ] Firm name and other firm variables showing as `{{placeholder}}` in generated content when firm_settings has not been filled in for the active entity
- [ ] Asset matching Step 3 — verify scroll behavior with 10+ cards after CSS layout fix (v4.12)

---

## 🟡 Next Up — Core Workflow Gaps

- [ ] **Proposal export to PDF** — Workspace produces structured content but has no export path; required before platform can be used in a live pursuit
- [ ] **RFP file upload UI in Workspace** — direct drag-and-drop for users who skip the Launchpad
- [ ] **PursuitDetail: wire tasks, team, and requirements tabs to real DB** — currently show mock data
- [ ] **Proposals page: remove DEMO_PROPOSALS fallback** — masks real data and confuses users
- [ ] **Fee estimator: wire to real billing rates from Timekeeping** — currently uses estimated values

---

## 🔵 Backlog (see backlog.md for full list)

- [ ] Live public agency portal scraping (NJDOT, NYC Procurement, NJ State, NYC DDC, Port Authority)
- [ ] Adobe UXP InDesign plugin for proposal layout export
- [ ] SF 330 form auto-fill
- [ ] PDF page rendering + photo extraction from documents (Stage 1: thumbnails; Stage 2: vision model photo extraction)
- [ ] pgvector semantic search across Knowledge Hub
- [ ] Navigation restructure (4 zones)
- [ ] App-to-app toggle link (Amplify ↔ v0 timekeeping)
- [ ] Word/PowerPoint export of completed proposal
- [ ] Mobile responsive pass
- [ ] SSO/SAML
- [ ] Stripe billing
- [ ] Token usage logging per skill invocation + usage dashboard
