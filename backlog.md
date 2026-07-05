# Amplify-Proposals — Feature Backlog

> Full prioritized list of planned features not yet started.
> Active work is tracked in `todo.md`. Completed work is in `archive.md`.
> Last updated: 2026-07-05

---

## Priority 1 — Core Proposal Workflow Completions

These items complete the primary proposal generation loop and are the next logical build targets after Step 4B.

- [x] **Step 4B — Citation-backed generation**: `evidenceContext` injected into win_themes, technical_writer, key_personnel, past_performance; GROUNDING RULES in all 4 system prompts; `formatEvidenceContext(citationFormat: "inline")` for source attribution. **Done in Phases 4 + 8.**
- [x] **Section Scorecard full display**: criteriaScores sorted table (score desc, name asc), topGaps red-bordered panel, topImprovements green-bordered panel, winThemesCoverage matrix, evidenceCoverage bar, unsupportedClaims amber panel. **Done in Phases 5 + 7.**
- [x] **RequirementsMatrixViewer renderer**: `requirements_matrix_builder` skill now routes to `<ComplianceChecklist>` in `SkillOutputRenderer`. **Done in Phase 7 Track A.**
- [x] **ConflictDetectorViewer renderer**: `conflict_detector` skill now routes to `<ConflictCards>` in `SkillOutputRenderer`. **Done in Phase 7 Track A.**
- [ ] **Tailored Resume generator**: per-section resume tailoring — take base resume from Knowledge Hub, reformat to match RFP key personnel requirements (role title, years exp, certifications, project relevance).
- [ ] **Proposal export — Word/DOCX**: export completed proposal sections as a formatted Word document with proper heading styles, page breaks, and table of contents.
- [ ] **Proposal export — PDF**: export completed proposal as PDF with firm branding, page numbers, and section headers.
- [ ] **Proposal export — PowerPoint**: export win themes and executive summary as a presentation deck.

---

## Priority 2 — Proposal Intelligence Enhancements

- [ ] **pgvector semantic search**: replace tag-based asset matching with vector embeddings for semantic similarity search across all Knowledge Hub documents. Use pgvector extension on Supabase.
- [ ] **RFP conflict detection**: run conflict_detector skill across all RFP documents to surface contradictions between addenda, scope documents, and fee schedules before proposal generation begins.
- [ ] **Win rate analytics by section**: track which proposal sections correlate with wins vs. losses; surface insights in the Analytics dashboard.
- [ ] **Proposal template library**: save and reuse section templates across proposals; tag by agency type, project type, service line.
- [ ] **RFP comparison**: compare two RFPs side-by-side to identify reuse opportunities from a prior proposal.

---

## Priority 3 — Knowledge Hub Enhancements

- [ ] **PDF page rendering — Stage 1**: server-side page rendering on upload — render each PDF page to PNG thumbnails using pdf2pic/Poppler, store in Supabase Storage under `dam-images/` bucket, link back to parent `dam_documents` record, show "Pages" strip in preview dialog.
- [ ] **PDF page rendering — Stage 2 (Photo Extraction)**: "Extract Photos" button on preview — run vision LLM pass on rendered page PNGs, identify pages containing photographs, save those pages as standalone image assets tagged to parent document and project, make searchable with auto-generated captions.
- [ ] **Bulk image import — PDF rendering stage 2**: vision model pass on rendered PDF pages to identify and extract photographs as standalone assets.
- [ ] **Knowledge Hub full-text search**: implement full-text search across extractedText field using PostgreSQL `tsvector` / `tsquery` or Supabase full-text search.
- [ ] **Document version history**: show version history for any dam_document record — who uploaded each version, when, and what changed.
- [ ] **Staff profile page enhancements**: add skills matrix, certification expiry tracking, utilization rate from timekeeping data.

---

## Priority 4 — Opportunity Ingestion & Business Development

- [ ] **Live public agency portal scraping**: automated scraping of NJDOT, NYC Procurement, NJ State, NYC DDC, and Port Authority portals. Scheduled daily job, deduplication against existing opportunities, auto-score against firm profile.
- [ ] **GovWin / BidNet integration**: API integration with GovWin IQ and BidNet for federal and state opportunity feeds.
- [ ] **Opportunity scoring refinement**: improve go/no-go scoring model with historical win/loss data; weight criteria by firm's actual win rate per agency and project type.
- [ ] **Teaming partner tracking**: record teaming partners on pursuits; track partner win rates and availability.
- [ ] **Client relationship tracking**: CRM-lite features — contact log, last touch date, relationship health score per agency/client.

---

## Priority 5 — Integrations & Export

- [ ] **Adobe UXP InDesign plugin**: plugin that reads proposal JSON export and populates InDesign Data Merge fields; supports firm templates with branded layouts.
- [ ] **SF 330 form auto-fill**: generate SF 330 Part I and Part II from proposal data and personnel records; export as filled PDF.
- [ ] **App-to-app toggle link (Amplify ↔ v0)**: persistent toggle button in both apps to switch between Amplify (proposals) and v0 (timekeeping/contracts) with session continuity.
- [ ] **QuickBooks Online sync**: bidirectional sync of contract billing data with QBO; replace manual QB CSV import with live API connection.
- [ ] **DocuSign integration**: send executed contract for signature directly from the Contracts module.

---

## Priority 6 — Platform & Infrastructure

- [ ] **Navigation restructure (4 zones)**: reorganize sidebar into 4 top-level zones: (1) Business Development, (2) Proposal Production, (3) Firm Knowledge, (4) Contracts & Finance. Each zone has a distinct color accent.
- [ ] **Mobile responsive pass**: audit all pages for mobile breakpoints; priority pages are Dashboard, Pursuits, and Proposal Workspace.
- [ ] **SSO/SAML**: enterprise single sign-on via SAML 2.0 or OIDC; integrate with Microsoft Entra ID (Azure AD) for JPCL/Strans staff.
- [ ] **Stripe billing**: subscription billing for multi-firm/multi-user licensing; integrate Stripe Checkout and Customer Portal.
- [ ] **Role-based feature gating**: enforce feature access by role at the UI level (hide, not just disable); align with the 9 defined AEC roles.
- [ ] **Audit log**: record all create/update/delete actions with user, timestamp, and before/after values; expose in Settings → Audit Log tab.
- [ ] **Email notifications**: notify assigned users when a proposal section is ready for review, when a pursuit status changes, or when a contract milestone is approaching.

---

## Deferred / Under Review

- [ ] **Image extraction Stage 1**: server-side PDF page rendering to thumbnails on upload (pdf-lib / pdfjs-dist) — deferred pending decision on Supabase Storage limits and compute cost.
- [ ] **Image extraction Stage 2**: vision model pass on rendered pages — deferred until Stage 1 is complete.
- [ ] **RFP Wiki (hybrid architecture)**: extractIndex + query tabs for building a searchable index of past RFP language — partially built, needs completion.
- [ ] **Contract Analyzer AI**: AI PDF extraction for contract documents (stub exists in ContractDetail tabs) — needs full implementation with contract_analyzer skill.
