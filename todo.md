# Amplify-Proposals — Active TODO

Last updated: 2026-07-05
Current version: v4.21 (post AI Skills Configuration Overhaul)

---

## 🔴 In Progress / Immediate

- [ ] Reassign 7 `manus_builtin` skills to real provider keys in Settings → AI Skills (executive_summary_writer, firm_qualifications_writer, key_personnel_writer, project_experience_writer, requirements_matrix_builder, technical_approach_writer, win_theme_generator)

---

## 🟡 Next Up

- [ ] Step 4 Phase B — Citation-backed proposal generation (inject specific project sheet excerpts, resume passages, and past proposal language as cited evidence into each section)
- [ ] Section Scorecard — full scorer output display (criteria coverage %, gap list, improvement suggestions, win theme coverage)
- [ ] RequirementsMatrixViewer renderer — table with requirementId, requirement text, proposalSection, status badge (for requirements_matrix_builder skill)
- [ ] ConflictDetectorViewer renderer — conflict cards with severity badges, affected sections, resolution recommendations (for conflict_detector skill)

---

## 🟠 Known Issues

- [ ] Some proposal sections may still render as raw JSON if the DB ai_skills outputType record was seeded incorrectly — use the "Re-render as Prose" button as a workaround; run seedDefaultSkills to re-seed if needed
- [ ] Firm name and other firm variables showing as {{placeholder}} in generated content when firm_settings has not been filled in for the active entity
- [ ] Asset matching Step 3 — verify scroll behavior with 10+ cards after CSS layout fix (v4.12)

---

## 🔵 Backlog (see backlog.md for full list)

- [ ] Live public agency portal scraping (NJDOT, NYC Procurement, NJ State, NYC DDC, Port Authority)
- [ ] Adobe UXP InDesign plugin for proposal layout export
- [ ] SF 330 form auto-fill
- [ ] PDF page rendering + photo extraction from documents (Stage 1: thumbnails; Stage 2: vision model photo extraction)
- [ ] pgvector semantic search across Knowledge Hub
- [ ] Navigation restructure (4 zones)
- [ ] App-to-app toggle link (Amplify ↔ v0 timekeeping)
- [ ] Bulk image import — PDF rendering stage 2 (vision model pass on rendered pages)
- [ ] Word/PowerPoint export of completed proposal
- [ ] Mobile responsive pass
- [ ] SSO/SAML
- [ ] Stripe billing
- [ ] Token usage logging per skill invocation + usage dashboard

---

## ✅ Recently Completed

### AI Skills Configuration Overhaul (v4.20–v4.21)
- [x] Add `provider_api_keys` table — unlimited named providers (name, provider, sdkType, baseUrl, apiKey, defaultModel, isDefault)
- [x] Add `sdkType` column (`openai_compatible` | `google_gemini` | `anthropic`) — routing decoupled from provider name string
- [x] Remove all Manus built-in (manus_builtin/forge) references from `invokeLLMWithSkill` and Settings UI
- [x] On any API error, fall back to default provider key; set `_usedDefaultModel` flag on result
- [x] Surface amber "Default model used" banner in SkillOutputRenderer when `_usedDefaultModel` is set
- [x] Rebuild Provider API Keys UI: add/edit/delete any number of providers, mark one as default, SDK type selector
- [x] Per-skill provider dropdown now reads from `provider_api_keys` table (not hardcoded list)
- [x] Provider name field is free-text with datalist suggestions (not locked enum)
- [x] Base URL field auto-appears for non-well-known providers
- [x] Test Connection button in Add/Edit modal — real inference call, validates model name
- [x] sdkType badge shown in key list row
- [x] Zero TypeScript errors throughout

### Contract Management (v4.17)
- [x] Entity filter (JPCL/Strans selector) filters contract list by performingCompanyId
- [x] Contract analyzer results viewable — fixed rawAnalysis field name
