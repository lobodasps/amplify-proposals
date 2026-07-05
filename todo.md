# Amplify-Proposals — Active TODO

Last updated: 2026-06-03
Current version: v4.16

---

## 🔴 In Progress

- [ ] Firm Profile Settings (v4.14) — entity switcher requires entities to be created first in Settings → Entities tab; UUID field removed from Entities form (v4.16)

---

## 🟡 Next Up

- [ ] Step 4 Phase B — Citation-backed proposal generation (inject specific project sheet excerpts, resume passages, and past proposal language as cited evidence into each section)
- [ ] Section Scorecard — full scorer output display (criteria coverage %, gap list, improvement suggestions, win theme coverage)
- [ ] RequirementsMatrixViewer renderer — table with requirementId, requirement text, proposalSection, status badge (for requirements_matrix_builder skill)
- [ ] ConflictDetectorViewer renderer — conflict cards with severity badges, affected sections, resolution recommendations (for conflict_detector skill)

---

## 🟠 Known Issues

- [x] Contract Management: entity filter (JPCL/Strans selector) does not filter contract list — reads activeEntityId from EntityContext, filters by performingCompanyId (v4.17)
- [x] Contract Management: contract analyzer results not viewable — AnalysisCard was reading analysis.analysisResult but DB column is rawAnalysis; fixed field name (v4.17)

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

## AI Skills Configuration Overhaul (v4.20) — COMPLETE
- [x] Add provider_api_keys table — unlimited named providers (name, baseUrl, apiKey, isDefault)
- [x] Remove all Manus built-in (manus_builtin/forge) references from invokeLLMWithSkill and Settings
- [x] Add system-wide default model setting (provider + model) in provider_api_keys.isDefault
- [x] On any API error, fall back to default model; set _usedDefaultModel flag on result
- [x] Surface "Used default model" amber indicator in SkillOutputRenderer when _usedDefaultModel is set
- [x] Rebuild Provider API Keys UI: add/edit/delete any number of providers, mark one as default
- [x] Per-skill provider dropdown now accepts any string (not hardcoded enum)
- [x] Zero TypeScript errors
