# Amplify Proposals — Roadmap & Competitive Differentiation

**Version:** 4.29 (Jul 5, 2026)
**Purpose:** Prioritized development backlog with competitive context and strategic recommendations.

---

## Part 1: Prioritized To-Do List

Items are grouped by strategic priority tier. Each tier should be completed before moving to the next. Within a tier, items are ordered by dependency and impact.

---

### Tier 1 — Close the Core Workflow Gaps (Next 2–4 Weeks)

These items complete the primary user journey from RFP to proposal. Nothing in Tier 2 or 3 matters if a user cannot complete a full pursuit cycle.

| # | Item | Why It Matters |
|---|------|---------------|
| 1 | ~~**Proposal Workspace: wire key_personnel skill to real staff data**~~ **DONE (Phase 4)** | Evidence bundle assembly reads real resume chunks from `document_chunks`; `evidenceContext` injected into key_personnel skill with GROUNDING RULES. |
| 2 | ~~**Proposal Workspace: wire past_performance skill to real project briefs**~~ **DONE (Phase 4)** | Evidence bundle reads real project_sheet chunks from `document_chunks`; `evidenceContext` injected into past_performance and win_themes skills. |
| 3 | **Proposal Workspace: wire fee_estimator to real billing rates from Timekeeping** | The fee estimator currently uses estimated values. Connecting it to the v0 `billing_rules` table would produce defensible, firm-specific fee proposals. |
| 4 | **Proposal export to PDF** | The Workspace produces structured content but has no export path. A clean PDF export (even a simple one) is required before the platform can be used in a live pursuit. |
| 5 | **RFP file upload UI in Workspace** | The Workspace currently assumes the RFP file was uploaded via the Launchpad. A direct drag-and-drop on the Workspace page is needed for users who skip the Launchpad. |
| 6 | **PursuitDetail: wire tasks, team, and requirements tabs to real DB** | These tabs currently show mock data. Real DB wiring is needed before the platform can replace a team's existing pursuit tracker. |
| 7 | **Proposals page: remove DEMO_PROPOSALS fallback** | The page falls back to demo data when the DB is empty. This masks real data and confuses users. |

---

### Tier 2 — Complete the Contract Management Module (Next 4–6 Weeks)

The contract module is the most differentiated feature in the platform (no competitor combines proposal intelligence with contract lifecycle management). Completing it unlocks a second major user persona (Contract Administrator).

| # | Item | Why It Matters |
|---|------|---------------|
| 8 | **ContractDetail: tier label and amountBehavior badge on child orders** | The schema and backend are complete; the UI just needs to display these fields. |
| 9 | **EditContractDialog: compliance fields (COI, executed contract, prime agreement)** | Compliance tracking is a major pain point for contract admins. The schema is ready. |
| 10 | **EditContractDialog: billingMethods, structureType, contractOwnerId, primeOrgId** | These fields are in the schema but not yet exposed in the UI. |
| 11 | **QB Bulk Import page** (`/qb-import`) | The CSV import procedure is built; it needs a dedicated page with preview, template download, and error reporting. |
| 12 | **Analytics module: Overview tab** | Amendment behavior cards and client/owner analytics tables. The `analyticsRouter` is built; the UI is not. |
| 13 | **Analytics module: Pre-built CSV reports (6 types)** | Contracts by Status, Revenue by Client, Revenue by Owner, Expiring Contracts, Billed vs Authorized NTE, Retainage Summary. |
| 14 | **Analytics module: Query Builder** | Table selector, field/operator/value filters, run query, export CSV. This is a significant differentiator — no competitor offers ad-hoc contract analytics. |

---

### Tier 3 — Deepen the AI Intelligence Layer (Next 6–10 Weeks)

These items transform Amplify from a "smart document manager" into a genuine AI co-pilot for BD and proposal teams.

| # | Item | Why It Matters |
|---|------|---------------|
| 15 | **XML Shredder as first step in RFP ingestion** | Wire the Shredder as the mandatory pre-processor before `rfp_parser`. Structured XML input dramatically improves extraction quality and enables section-level citation in the Workspace. |
| 16 | **RFP Wiki context injection into Workspace** | Fetch the compiled wiki for the pursuit's RFP and inject it as `firmContext` in every skill call. This gives the model full cross-referenced RFP context rather than just the raw document. |
| 17 | **Multi-approach advisor in generateSection** | "Suggest Approaches" button shows 3 approaches with pros/cons before generating. This is the single highest-impact UX improvement for proposal quality. |
| 18 | **Per-section success criteria checklist** | Wire Agent Guidelines into the Workspace so users must confirm criteria before a section generates. Reduces AI hallucination and improves reviewer confidence. |
| 19 | ~~**LLM token usage logging**~~ **PARTIALLY DONE (Phase 6)** | Scorer analytics logged to `llm_usage_logs.metadata` JSONB per run. Full per-skill token logging and dashboard still planned. |
| 20 | **PDF image extraction from DAM documents** | Stage 1: render PDF pages to PNG thumbnails on upload. Stage 2: vision LLM pass to identify and extract photographs as standalone image assets. This would make the Knowledge Hub a complete visual archive. |

---

### Tier 4 — Opportunity Ingestion & Pipeline Automation (Next 10–14 Weeks)

| # | Item | Why It Matters |
|---|------|---------------|
| 21 | **Public portal scraping (settings-based)** | Automated ingestion from SAM.gov, NYS Contract Reporter, NYC Procurement, NJ DPMC. Settings-based with configurable prompts and API keys. This is the feature that makes the platform proactive rather than reactive. |
| 22 | **Opportunity scoring and ranking** | Score each ingested opportunity against the firm's capability profile and historical win rate. Surface the top 5 opportunities each week. |
| 23 | **Bid calendar integration** | Export pursuit due dates to Google Calendar / Outlook via iCal feed. |
| 24 | **Email notification on new opportunities** | Send a digest email when new opportunities matching the firm's service lines are ingested. |

---

### Tier 5 — Export, Integration & Enterprise Readiness (Next 14–20 Weeks)

| # | Item | Why It Matters |
|---|------|---------------|
| 25 | **SF 330 form auto-fill and PDF export** | The SF 330 is the federal standard qualification form. Auto-filling it from staff and project data would save 8–12 hours per submission. No competitor does this well. |
| 26 | **Adobe InDesign UXP plugin** | Export proposal content directly into branded InDesign templates. This is the final mile of the proposal workflow that currently requires a graphic designer. |
| 27 | **Word / PowerPoint export with branded templates** | For firms that do not use InDesign. |
| 28 | **SSO / SAML enterprise authentication** | Required for firms with 50+ employees or enterprise IT policies. |
| 29 | **Mobile-responsive optimization pass** | The current UI is desktop-first. A responsive pass would enable field staff to access project photos and staff records from a phone. |

---

## Part 2: Strategic Differentiation Recommendations

The following recommendations are based on an analysis of the three leading competitors — **Joist.ai**, **Shred.ai**, and **Unanet Proposals (formerly Cosential/Proposal.ai)** — and the specific needs of NJ/NY/NYC public-sector AEC firms. Each recommendation identifies a gap in the competitive landscape that Amplify is uniquely positioned to fill.

---

### Recommendation 1: Make the Knowledge Hub a Visual Intelligence Layer

**The gap:** No competitor has a serious image management capability. Joist.ai and Shred.ai treat images as attachments. Unanet has a basic photo library. None of them use vision AI to understand what is in a photo.

**The opportunity:** Amplify's `dam_image_caption` skill already generates AEC-specific structured metadata (structure type, construction phase, setting, quality rating, personnel presence) for every uploaded image. The next step is to make this metadata searchable and proposal-ready.

**Specific features to build:**
- **Image search by project type and setting:** "Show me all completed bridge photos, aerial, high quality, no personnel" — a query that currently requires a human to manually tag hundreds of photos.
- **Proposal image selector:** In the Workspace, when generating a section, surface a panel of relevant images from the Knowledge Hub (matched by structureType, projectId, or service line) that the user can drag into the proposal layout.
- **Automatic photo credit and usage rights enforcement:** Flag images with `usageRights = 'internal_only'` when a user tries to include them in a proposal.

This would make Amplify the only AEC proposal platform with an AI-powered visual content library. It is a feature that resonates immediately with proposal managers who spend hours hunting for "a good bridge photo."

---

### Recommendation 2: Build a Compliance Intelligence Engine

**The gap:** Compliance is the most painful part of public-sector AEC proposals. MBE/WBE/SDVOB goals, COI requirements, prevailing wage certifications, and SF 330 sections are all highly structured, highly repetitive, and highly error-prone. No competitor has automated this well.

**The opportunity:** Amplify already tracks COI dates, DBE certifications, and compliance fields on contracts. The next step is to close the loop between the RFP's compliance requirements and the firm's current compliance posture.

**Specific features to build:**
- **Compliance matrix auto-generation:** When an RFP is shredded, automatically extract all compliance requirements (MBE/WBE/SDVOB goals, insurance minimums, prevailing wage, bonding) and create a checklist.
- **Certification expiry alerts:** Surface a warning when a required certification (DBE, COI) will expire before the contract period ends.
- **Sub-consultant compliance tracker:** Track MBE/WBE/SDVOB participation percentages across the team and flag when the goal is not met.
- **Compliance section auto-draft:** Generate the compliance narrative section of a proposal from the firm's actual certification data.

This is a feature that would resonate with every public-sector AEC firm in NJ/NY/NYC, where MBE/WBE/SDVOB compliance is a legal requirement on virtually every public contract.

---

### Recommendation 3: Build a Win-Rate Intelligence Dashboard

**The gap:** Joist.ai and Shred.ai focus on proposal generation. Unanet has basic CRM analytics. None of them close the feedback loop between proposal content and win/loss outcomes.

**The opportunity:** Amplify already stores every pursuit, every proposal, every Go/No-Go score, and every contract. The data to build a win-rate intelligence dashboard already exists.

**Specific features to build:**
- **Win rate by service line, agency, and project type:** "We win 68% of NYSDOT bridge inspection pursuits but only 22% of NYC Parks landscape pursuits."
- **Proposal score vs. win rate correlation:** Do higher Go/No-Go scores actually predict wins? Show the scatter plot.
- **Competitor analysis:** Track which firms appear in the same awards and build a competitive landscape view.
- **Best-performing boilerplate identification:** Which boilerplate blocks appear most often in winning proposals? Surface them first in the content library.
- **Pursuit velocity tracking:** How long does it take from identification to submission? Where are the bottlenecks?

This would make Amplify the only AEC proposal platform that learns from its own data and improves its recommendations over time.

---

### Recommendation 4: Automate the RFP-to-Fee Proposal Pipeline

**The gap:** Fee estimation is the most time-consuming part of technical proposal preparation. Every firm does it differently, and no software tool automates it well. Joist.ai and Shred.ai do not touch fee estimation. Unanet has a basic fee template system.

**The opportunity:** Amplify already has the `fee_estimator` skill and access to the v0 timekeeping system's billing rates. The missing piece is a structured fee template system that maps RFP scope items to labor categories and hours.

**Specific features to build:**
- **Scope-to-task decomposition:** When an RFP scope is extracted, automatically decompose it into a list of tasks with estimated hours per labor category.
- **Fee template library:** Store reusable fee templates by project type (bridge inspection, roadway design, environmental assessment) with default hours and rates.
- **Fee proposal PDF export:** Generate a formatted fee proposal table with labor categories, hours, rates, and totals.
- **Fee vs. budget tracking:** After award, track actual hours against the fee proposal and flag overruns.

This would make Amplify the only platform that connects the proposal fee estimate to the post-award contract financial model — a complete closed loop.

---

### Recommendation 5: Build a Firm-Specific Institutional Memory System

**The gap:** Every AEC firm has decades of institutional knowledge trapped in the heads of senior staff, in old hard drives, and in filing cabinets. When a senior PM retires, that knowledge is gone. No competitor has a systematic approach to capturing and surfacing this knowledge.

**The opportunity:** Amplify's Knowledge Hub is already the right foundation. The next step is to make it proactive rather than passive.

**Specific features to build:**
- **"What do we know about this agency?" query:** Before starting a pursuit, ask the system "What do we know about NYSDOT?" and get a synthesized briefing from all past proposals, contracts, and project sheets involving that agency.
- **Lessons learned capture:** After each pursuit closes (win or loss), prompt the team to record 3–5 lessons learned. Store them in a structured format and surface them automatically on the next similar pursuit.
- **Expert finder:** "Who on our staff has experience with bridge inspection on the Palisades Parkway?" — query staff resumes and project sheets simultaneously.
- **Proposal section similarity search:** Before generating a new section, show the 3 most similar sections from past winning proposals. Let the user use them as starting points rather than generating from scratch.

This is a feature that resonates deeply with firm principals who worry about knowledge transfer and institutional continuity.

---

### Recommendation 6: Build a Public-Sector Relationship Intelligence Layer

**The gap:** In the NJ/NY/NYC public-sector market, relationships with agency staff are critical to winning work. No competitor tracks these relationships systematically.

**The opportunity:** Amplify already has an Organizations and People module. The next step is to connect it to pursuit and contract history.

**Specific features to build:**
- **Agency contact history:** Track every interaction with every agency contact (meetings, calls, proposal submissions, contract awards).
- **Agency relationship score:** Based on number of active contracts, win rate, and recency of interaction.
- **"Who do we know at this agency?" query:** Surface all contacts at an agency with their relationship history before starting a pursuit.
- **Teaming partner intelligence:** Track which sub-consultants appear on winning teams for each agency and project type.

---

### Summary: Competitive Positioning Matrix

The table below shows how Amplify compares to the three leading competitors across the key capability dimensions, including the recommended features.

| Capability | Amplify (Current) | Amplify (With Recommendations) | Joist.ai | Shred.ai | Unanet Proposals |
|-----------|-------------------|-------------------------------|----------|----------|-----------------|
| RFP ingestion and parsing | Strong | Strong | Strong | Strong | Moderate |
| Proposal section generation | Strong | Strong | Strong | Moderate | Moderate |
| Go/No-Go scoring | Strong | Strong | Moderate | Weak | Weak |
| Contract lifecycle management | **Unique** | **Unique** | None | None | Basic |
| AI image library with vision metadata | **Unique** | **Unique** | None | None | None |
| Bulk image import with AEC grouping | **Unique** | **Unique** | None | None | None |
| Compliance intelligence engine | Partial | **Strong** | Weak | Weak | Moderate |
| Win-rate analytics | Partial | **Strong** | Weak | None | Moderate |
| Fee estimation automation | Partial | **Strong** | None | None | Basic |
| Institutional memory / knowledge graph | Partial | **Strong** | None | None | Weak |
| Public-sector relationship intelligence | Weak | **Strong** | None | None | Moderate |
| SF 330 auto-fill | None | **Planned** | None | None | Partial |
| InDesign / Word export | None | **Planned** | Partial | None | Partial |

The cells marked **Unique** represent features that no competitor currently offers. The platform's contract management module combined with its AI image library is already a defensible competitive moat. The recommendations in this document would extend that moat across five additional dimensions.

---

*Last updated: May 31, 2026*
