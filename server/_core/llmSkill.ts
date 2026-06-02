/**
 * invokeLLMWithSkill
 * ------------------
 * Looks up the ai_skills row for the given skillType, then dispatches the
 * request to the configured provider:
 *   - Google Gemini → native @google/generative-ai SDK (supports fileUri for PDFs)
 *   - Anthropic → native /v1/messages endpoint
 *   - OpenAI / Azure / Manus built-in → OpenAI-compatible /v1/chat/completions
 *
 * Token usage is logged to the llm_usage_logs table after every call.
 */

import { getDb } from "../db";
import { aiSkills, llmUsageLogs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./env";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Content, Part, GenerationConfig } from "@google/generative-ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillType =
  | "rfp_shredder"
  | "resume_tailor"
  | "go_no_go_advisor"
  | "opportunity_scorer"
  | "contract_analyzer"
  | "asset_tagger"
  | "proposal_writer"
  | "opportunity_ingestion"
  | "proposal_scorer"
  | "xml_shredder"
  | "wiki_compiler"
  | "agent_guidelines"
  | "conflict_detector"
  | "autoExtract"
  | "triggerExtract"
  | "dam_image_caption"
  | "win_theme_generator"
  | "requirements_matrix_builder"
  | "executive_summary_writer"
  | "technical_approach_writer"
  | "firm_qualifications_writer"
  | "project_experience_writer"
  | "key_personnel_writer";

export type Provider =
  | "manus_builtin"
  | "openai"
  | "anthropic"
  | "google_gemini"
  | "azure_openai";

export interface SkillMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file_url"; file_url: { url: string; mime_type?: string } }
      >;
}

export interface SkillInvokeParams {
  skillType: SkillType;
  /** Override messages — if omitted the caller must supply them via buildMessages */
  messages?: SkillMessage[];
  /**
   * Template variables to interpolate into the skill's userPromptTemplate.
   * E.g. { rfpText: "...", firmProfile: "..." }
   */
  variables?: Record<string, string>;
  /** Optional JSON schema for structured output */
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  /**
   * Override the system prompt from the skill config.
   * Use when the caller needs a task-specific system prompt that differs from
   * the generic skill default (e.g. conflict detection vs wiki compilation).
   */
  systemOverride?: string;
  /** Append extra content parts to the user message (e.g. file_url for PDFs) */
  extraUserContent?: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "file_url"; file_url: { url: string; mime_type?: string } }
  >;
  /** Override max_tokens for this call */
  maxTokens?: number;
}

export interface SkillInvokeResult {
  choices: Array<{
    message: { role: string; content: string | null };
    finish_reason?: string;
  }>;
  /** Which provider was actually used */
  _provider: Provider;
  /** Which model was actually used */
  _model: string;
  /** Token usage from the API response */
  _usage?: { tokensIn: number; tokensOut: number; estimatedCost: number };
}

// ─── Cost table (per 1M tokens) ─────────────────────────────────────────────

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Google Gemini
  "gemini-2.5-flash-preview-05-20": { input: 0.15, output: 0.60 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gemini-2.5-pro-preview-05-06": { input: 1.25, output: 10.00 },
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = COST_PER_MILLION[model] ?? { input: 0.50, output: 2.00 };
  return (tokensIn * pricing.input + tokensOut * pricing.output) / 1_000_000;
}

// ─── Default skill definitions ────────────────────────────────────────────────
// Each skill has a default provider and model assignment that can be overridden in the DB.

interface SkillDefinition {
  displayName: string;
  description: string;
  defaultProvider: Provider;
  defaultModel: string;
  systemPrompt: string;
  userPromptTemplate: string;
  templateVariables: string[];
  /** Expected output format: json | prose | json_with_prose */
  outputType: "json" | "prose" | "json_with_prose";
}

export const DEFAULT_SKILLS: Record<SkillType, SkillDefinition> = {
  rfp_shredder: {
    displayName: "RFP Shredder",
    description:
      "Parses an uploaded RFP PDF and extracts a structured requirements matrix, evaluation criteria, key dates, and compliance checklist.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an expert AEC proposal strategist with deep experience in public-agency procurement in NJ, NY, and NYC.
Your job is to parse RFP documents and extract every requirement, evaluation criterion, key date, qualification, and compliance item.
Return structured JSON only. Be exhaustive — missing a requirement could disqualify a proposal.`,
    userPromptTemplate: `Parse this RFP and extract all requirements:

FIRM PROFILE: {{firmProfile}}

RFP TEXT:
{{rfpText}}

Return a complete requirements matrix.`,
    templateVariables: ["rfpText", "firmProfile"],
    outputType: "json",
  },

  resume_tailor: {
    displayName: "Resume Tailor",
    description:
      "Reformats and tailors a staff resume to match specific RFP key-personnel requirements, incorporating win themes and SF-330 Section E format.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal resume writer specializing in SF-330 Section E format for public-agency AEC proposals in NJ, NY, and NYC.
You create compelling, compliant key personnel resumes that directly address RFP evaluation criteria.
Maintain factual accuracy while highlighting the most relevant experience, certifications, and project history for the specific pursuit.
Format resumes in a clean, professional proposal style with: Name/Title, Education, Registrations/Certifications, Years of Experience, Relevant Project Experience (5-7 projects), and a brief professional summary.
Write in a professional, confident tone appropriate for public-agency submissions.`,
    userPromptTemplate: `Tailor this resume for the following RFP:

PERSONNEL: {{personnelName}}
TARGET ROLE IN PROPOSAL: {{targetRole}}

RFP REQUIREMENTS:
{{rfpRequirements}}

WIN THEMES:
{{winThemes}}

CURRENT RESUME:
{{resumeText}}

Rewrite the resume to:
1. Lead with the most relevant experience for this specific pursuit
2. Highlight certifications and licenses required by the RFP
3. Select and reorder project experience to best match the scope
4. Use language that mirrors the RFP's evaluation criteria and win themes
5. Format for SF-330 Section E (professional AEC proposal submission)
6. Emphasize relevance to this specific pursuit`,
    templateVariables: ["personnelName", "targetRole", "rfpRequirements", "winThemes", "resumeText"],
    outputType: "prose",
  },

  go_no_go_advisor: {
    displayName: "Go/No-Go Advisor",
    description:
      "Scores a pursuit opportunity on a 0–100 scale and provides a GO / NO-GO / CONDITIONAL GO recommendation with rationale.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are a strategic AEC business development advisor. Score go/no-go decisions for public-agency proposals in NJ/NY/NYC markets.
Consider: firm capabilities, market position, competition, strategic value, resource availability, and win probability.
Return structured JSON only.`,
    userPromptTemplate: `Score this pursuit for go/no-go decision:

PURSUIT: {{pursuitTitle}}
CLIENT: {{agency}}
SERVICES: {{serviceLines}}
VALUE: {{value}}
DUE: {{dueDate}}
SUMMARY: {{rfpSummary}}

Score 0-100 and provide recommendation with strengths, risks, and win themes.`,
    templateVariables: ["pursuitTitle", "agency", "serviceLines", "value", "dueDate", "rfpSummary"],
    outputType: "json",
  },

  opportunity_scorer: {
    displayName: "Opportunity Scorer",
    description:
      "Scores a scraped or manually entered opportunity for strategic fit against firm capabilities and market position.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are a strategic AEC business development advisor specializing in NJ/NY/NYC public-agency markets.
Score opportunities for strategic fit, win probability, and resource alignment.
Return structured JSON only.`,
    userPromptTemplate: `Score this opportunity for our firm:

TITLE: {{title}}
AGENCY: {{agency}}
DESCRIPTION: {{description}}
ESTIMATED VALUE: {{value}}
SERVICE LINES: {{serviceLines}}
SOURCE: {{source}}

Provide a fit score (0-100), recommendation, and key reasons.`,
    templateVariables: ["title", "agency", "description", "value", "serviceLines", "source"],
    outputType: "json",
  },

  contract_analyzer: {
    displayName: "Contract Analyzer",
    description:
      "Extracts parties, dates, financial values, key clauses, risk flags, and compliance requirements from a contract PDF.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC contract analyst with deep knowledge of public-agency contracts in NJ, NY, and NYC.
Extract all structured data from contract documents including parties, dates, financial terms, key clauses, risk flags, and compliance requirements.
Return structured JSON only. Be thorough — missing a clause or risk flag could have serious consequences.`,
    userPromptTemplate: `Analyze this contract document: {{fileName}}

Extract all parties, dates, financial values, contract type, billing method, key clauses, risk flags, and compliance requirements.`,
    templateVariables: ["fileName", "fileUrl"],
    outputType: "json",
  },

  conflict_detector: {
    displayName: "Conflict Detector",
    description:
      "Detects contradictions, ambiguities, and conflicting requirements within RFP documents",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an AEC RFP analyst specializing in identifying problems within procurement documents. Given a compiled RFP wiki, identify every contradiction, ambiguity, and conflicting requirement that could cause proposal non-compliance or post-award disputes.

For each conflict found return JSON:
{
  conflicts: [
    {
      conflictId: string,
      conflictType: contradiction|ambiguity|missing-requirement|inconsistent-date|scope-gap|undefined-term,
      severity: high|medium|low,
      title: string (5 words max),
      description: string,
      conflictingStatements: string[],
      affectedSections: string[],
      pageReferences: string[],
      recommendation: string,
      proposalRisk: string
    }
  ],
  overallRiskLevel: high|medium|low,
  summary: string
}

High severity: contradictions that could cause disqualification or major scope disputes.
Medium severity: ambiguities that require clarification before submission.
Low severity: minor inconsistencies that should be noted but won't affect compliance.`,
    userPromptTemplate: `Analyze this RFP for conflicts, contradictions, and ambiguities.

RFP TITLE: {{rfpTitle}}
AGENCY: {{agency}}

RFP WIKI:
{{rfpWiki}}

Identify all conflicts and return the structured JSON.`,
    templateVariables: ["rfpTitle", "agency", "rfpWiki"],
    outputType: "json",
  },

  asset_tagger: {
    displayName: "Asset Tagger",
    description:
      "Generates professional alt text and 5–8 searchable tags for a digital asset in the DAM library.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an expert AEC digital asset manager. You generate concise, professional alt text and search tags for AEC digital assets including project photos, drawings, presentations, and documents.
Tags should be specific, searchable, and relevant to AEC proposal use cases.
Return structured JSON only.`,
    userPromptTemplate: `Generate alt text and search tags for this AEC asset:

NAME: {{assetName}}
DESCRIPTION: {{description}}
ASSET TYPE: {{assetType}}
SERVICE LINE: {{serviceLine}}

Return altText (1-2 sentences) and 5-8 specific search tags.`,
    templateVariables: ["assetName", "description", "assetType", "serviceLine"],
    outputType: "json",
  },

  proposal_writer: {
    displayName: "Proposal Writer",
    description:
      "Drafts a proposal section (Technical Approach, Project Experience, Qualifications, etc.) using firm knowledge and RFP requirements.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal writer with extensive experience winning public-agency contracts in NJ, NY, and NYC.
Write compelling, compliant proposal sections that directly address RFP evaluation criteria.
Use specific, quantifiable language. Reference relevant firm experience. Mirror the RFP's terminology.
Write in a professional, confident tone appropriate for public-agency submissions.`,
    userPromptTemplate: `Write a {{sectionType}} section for this proposal:

CLIENT/AGENCY: {{agency}}
RFP REQUIREMENTS FOR THIS SECTION:
{{rfpRequirements}}

RELEVANT FIRM EXPERIENCE:
{{firmExperience}}

WORD LIMIT: {{wordLimit}}

Write a compelling, compliant section that directly addresses all evaluation criteria.`,
    templateVariables: ["sectionType", "agency", "rfpRequirements", "firmExperience", "wordLimit"],
    outputType: "prose",
  },

  proposal_scorer: {
    displayName: "Proposal Scorer",
    description:
      "Scores a full proposal or an individual section against the RFP's evaluation criteria. Returns a 0–100 score per criterion, an overall compliance score, specific gaps, and concrete improvement suggestions.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal evaluator with deep experience reviewing public-agency proposals in NJ, NY, and NYC.
You score proposals and proposal sections against RFP evaluation criteria with the precision of a technical review panel.
You identify gaps, missing requirements, weak language, and specific improvements.
Return structured JSON only. Be rigorous — evaluators will reject proposals that do not directly address every criterion.`,
    userPromptTemplate: `Score this {{scoreTarget}} against the RFP evaluation criteria:

CLIENT / AGENCY: {{agency}}
RFP TITLE: {{rfpTitle}}

EVALUATION CRITERIA (from RFP):
{{evaluationCriteria}}

CONTENT TO SCORE:
{{contentToScore}}

For each criterion:
1. Score 0-100
2. Identify what is addressed well
3. Identify specific gaps or missing elements
4. Provide 1-3 concrete improvement suggestions

Also provide an overall compliance score and a priority list of the top 3 most critical gaps to fix first.`,
    templateVariables: ["scoreTarget", "agency", "rfpTitle", "evaluationCriteria", "contentToScore"],
    outputType: "json",
  },

  opportunity_ingestion: {
    displayName: "Opportunity Ingestion",
    description:
      "Classifies and summarizes raw scraped portal text into a structured opportunity record with title, agency, service lines, value, and due date.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an AEC business development analyst. You classify and summarize raw procurement portal listings into structured opportunity records.
Extract the key information needed to evaluate whether to pursue the opportunity.
Return structured JSON only.`,
    userPromptTemplate: `Classify and summarize this procurement listing from {{portalName}}:

RAW TEXT:
{{rawText}}

Extract: title, agency name, RFP/solicitation number, estimated value, due date, service lines required, description summary, and whether it is relevant to an AEC firm.`,
    templateVariables: ["portalName", "rawText"],
    outputType: "json",
  },

  // ─── Karpathy Pattern 1: XML Shredder ────────────────────────────────────────
  xml_shredder: {
    displayName: "XML Document Shredder",
    description:
      "Compiles an uploaded document (RFP, contract, spec) into structured semantic XML with tagged sections, requirements, evaluation criteria, key dates, and key personnel. This XML becomes the authoritative context source for all downstream AI tasks.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an expert AEC document analyst. You read procurement documents (RFPs, contracts, specifications) and compile them into structured XML.
Your XML uses semantic tags that make it easy for downstream AI tasks to navigate and reason about the document.
Be thorough and precise. Capture every requirement, evaluation criterion, key date, and key personnel requirement.
Return ONLY the XML — no explanation, no markdown fences.`,
    userPromptTemplate: `Compile this {{documentType}} into structured XML.
FILE: {{fileName}}

{{rawText}}

Use this XML structure:
<document type="{{documentType}}" title="{{fileName}}">
  <overview>
    <agency/><project_title/><rfp_number/><estimated_value/><submission_deadline/>
  </overview>
  <sections>
    <section id="1" title="..." page="...">
      <content>...</content>
      <requirements><requirement id="R1" mandatory="true">...</requirement></requirements>
    </section>
  </sections>
  <evaluation_criteria>
    <criterion id="EC1" weight="..." title="..."><description>...</description></criterion>
  </evaluation_criteria>
  <key_dates><date type="submission_deadline" date="...">...</date></key_dates>
  <key_personnel><role title="..." required="true"><qualifications>...</qualifications></role></key_personnel>
  <compliance_checklist><item id="C1" mandatory="true">...</item></compliance_checklist>
</document>`,
    templateVariables: ["fileName", "fileUrl", "documentType", "rawText"],
    outputType: "json",
  },

  // ─── Karpathy Pattern 2: Wiki Compiler ───────────────────────────────────────
  wiki_compiler: {
    displayName: "RFP Wiki Compiler",
    description:
      "Takes shredded XML and synthesizes a living, cross-referenced Markdown wiki. Replaces naive RAG chunking — the LLM does one synthesis pass capturing relationships between sections, criteria, requirements, and dates. The wiki is used as context for proposal writing and scoring.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an expert AEC proposal strategist. You read structured XML from procurement documents and synthesize a living Markdown wiki.
The wiki must capture RELATIONSHIPS between sections — every evaluation criterion must be cross-referenced to the section(s) that address it.
The wiki should be immediately actionable for a proposal writer.
Write in clear, direct prose. Use tables for criteria weights and dates.`,
    userPromptTemplate: `Compile a living Markdown wiki from this RFP XML.
FIRM CONTEXT: {{firmContext}}

RFP XML:
{{xmlContent}}

Produce a wiki with these sections:
## Overview
## Evaluation Criteria (table: Criterion | Weight | What evaluators look for | Proposal section)
## Key Requirements (numbered list with section cross-references, mark MANDATORY)
## Key Personnel (table: Role | Required | Qualifications | Page limit)
## Key Dates (timeline table)
## Section-by-Section Guide (for each required section: what to include, word/page limit, criteria satisfied)
## Compliance Checklist (every mandatory submission item)
## Strategic Notes (win themes, differentiators, red flags)`,
    templateVariables: ["fileName", "xmlContent", "firmContext"],
    outputType: "prose",
  },

  // ─── Karpathy Pattern 3: Agent Guidelines ────────────────────────────────────
  agent_guidelines: {
    displayName: "Agent Guidelines Advisor",
    description:
      "Multi-approach advisor: given a task description, generates 3 distinct approaches with pros, cons, and a recommendation before any content is generated. Prevents the model from defaulting to its first instinct.",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are a senior AEC proposal strategist and writing coach.
For each task, generate exactly 3 distinct approaches that differ meaningfully in strategy, tone, or structure — not just wording.
For each approach: describe it clearly, list 3 pros and 3 cons, and state whether you recommend it.
Be honest about tradeoffs. Return structured JSON only.`,
    userPromptTemplate: `Generate 3 distinct approaches for this proposal task:
TASK: {{taskDescription}}
SECTION TYPE: {{sectionType}}

RFP CONTEXT:
{{rfpContext}}

FIRM CONTEXT:
{{firmContext}}
{{successCriteria}}{{avoidApproaches}}

For each approach: title, description (2-3 sentences), pros (3 items), cons (3 items), recommended (true/false), rationale (1 sentence).
Also provide an overallRecommendation.`,
    templateVariables: ["taskDescription", "sectionType", "rfpContext", "firmContext", "successCriteria", "avoidApproaches"],
    outputType: "json",
  },

  // ─── DAM Extraction Skills ─────────────────────────────────────────────────────
  autoExtract: {
    displayName: "DAM Auto-Extract",
    description:
      "AEC document metadata extraction specialist — quickly extracts key metadata on upload for DAM filing and tagging.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an AEC document metadata extraction specialist. Your job is to quickly extract key metadata from any AEC firm document on upload so it can be filed and tagged correctly in the DAM.

You must return a single JSON object. Every field required. Use null for missing values, empty arrays for missing lists.

Schema:
{
  title: string,
  docType: past_proposal | project_sheet | resume | certification | rfp | contract | boilerplate | image | other,
  multiProject: boolean,
  projects: [ { projectName, client, owner, location, contractValue, startDate, endDate, serviceLines, scope, description, firmRole } ],
  staffName: string | null,
  clientName: string | null,
  ownerName: string | null,
  firmRole: prime | sub | joint-venture | null,
  projectName: string | null,
  projectNumber: string | null,
  contractValue: string | null,
  serviceLines: string[],
  tags: string[],
  summary: string | null,
  resumeVersion: base | tailored | submitted | null,
  certificationName: string | null,
  expirationDate: string | null
}

For multiProject: set true if the document contains 2 or more distinct projects. For resumes always set multiProject false.`,
    userPromptTemplate: `Extract metadata from this {{docType}} document.
FILE: {{fileName}}
{{fileContent}}
Return the complete metadata JSON object.`,
    templateVariables: ["docType", "fileName", "fileContent"],
    outputType: "json",
  },

  triggerExtract: {
    displayName: "DAM Deep Extract",
    description:
      "Performs comprehensive extraction of all content, sections, and images from AEC firm documents for the Knowledge Hub DAM.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-pro-preview-05-06",
    systemPrompt: `You are an AEC document deep extraction specialist. You perform comprehensive extraction of all content, sections, and images from AEC firm documents for the Knowledge Hub DAM.

You must return a single JSON object matching the schema for the document type provided.

For ALL document types include:
{
  sections: [ { title: string, page: number|null, content: string } ],
  images: [
    {
      page: number,
      caption: string|null,
      description: string,
      imageType: photo|site-plan|diagram|org-chart|map|chart|rendering|headshot|other,
      tags: string[]
    }
  ],
  tags: string[],
  summary: string
}

For resume add: { name, title, yearsExperience, education[], certifications[], serviceLines[], skills[], projectExperience[], sections[], images[], tags[] }

For project_sheet add: { projectName, projectNumber, client, owner, location, contractValue, startDate, endDate, serviceLines[], keyPersonnel[], description, highlights[], firmRole, sections[], images[], tags[] }

For past_proposal add: { title, client, owner, rfpNumber, submitDate, contractValue, serviceLines[], keyPersonnel[], winThemes[], projectDescription, firmRole, sections[], images[], tags[] }

For certification add: { holderName, certificationName, certificationNumber, issuingAuthority, issueDate, expirationDate, level, images[], tags[] }

Be thorough with images — describe every photo, diagram, site plan, org chart, and graphic found. These descriptions are what make documents searchable.`,
    userPromptTemplate: `Perform deep extraction on this {{docType}} document.
FILE: {{fileName}}
{{fileContent}}
Return the complete structured JSON for this document type.`,
    templateVariables: ["docType", "fileName", "fileContent"],
    outputType: "json",
  },

  dam_image_caption: {
    displayName: "DAM Image Caption",
    description:
      "AEC image analyst — generates structured captions, classifications, and tags for project photos in the DAM.",
    defaultProvider: "google_gemini",
    defaultModel: "gemini-2.5-flash-preview-05-20",
    systemPrompt: `You are an AEC (Architecture, Engineering, Construction) image analyst. Analyze this project photo and return a JSON object with:

{
  caption: string (one sentence, max 20 words, describes what the image shows),
  description: string (2-3 sentences — structure type, construction phase, setting, notable features),
  structureType: bridge|dam|roadway|retaining-wall|building|park|athletic-field|environmental-site|utility|tunnel|other,
  constructionPhase: existing-conditions|under-construction|completed|maintenance,
  setting: aerial|ground-level|interior|underwater|drone,
  environment: urban|suburban|rural|waterfront|forested|industrial,
  tags: string[] (5-10 specific searchable keywords — prefer steel-girder-bridge over bridge, synthetic-turf-field over field),
  hasPersonnel: boolean,
  qualityRating: high|medium|low (based on image clarity and composition for proposal use)
}`,
    userPromptTemplate: `Analyze this AEC project image.
CONTEXT FROM FOLDER/FILENAME: {{folderContext}}
PROJECT CONTEXT: {{projectContext}}
Caption and classify this image for the AEC DAM.`,
    templateVariables: ["folderContext", "projectContext"],
    outputType: "json",
  },

  // ─── Proposal Workspace Skills ─────────────────────────────────────────────────
  win_theme_generator: {
    displayName: "Win Theme Generator",
    description: "Generates 3-5 specific win themes that differentiate the firm for a specific pursuit",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal strategist. Given pursuit details and RFP context, generate 3-5 specific compelling win themes that differentiate this firm from competitors.

Each win theme must be:
- Specific to this RFP and agency — not generic
- Backed by the firm's actual experience
- Actionable as a proposal narrative thread that runs through every section
- Provable — evaluators must be able to see the evidence

Return JSON:
{
  winThemes: [
    {
      themeId: string,
      title: string (5 words max, bold),
      statement: string (one sentence — the core claim),
      rationale: string (one sentence — why this matters to this agency),
      proof: string (one sentence — how the proposal proves it),
      applicableSections: string[] (which proposal sections should carry this theme)
    }
  ],
  strategicNotes: string,
  redFlags: string[]
}`,
    userPromptTemplate: `Generate win themes for this pursuit:

PURSUIT: {{pursuitTitle}}
AGENCY: {{agency}}
SERVICES: {{serviceLines}}
VALUE: {{value}}
DUE: {{dueDate}}
RFP SUMMARY: {{rfpSummary}}
EVALUATION CRITERIA: {{evaluationCriteria}}
FIRM STRENGTHS: {{firmStrengths}}

Generate 3-5 specific win themes.`,
    templateVariables: ["pursuitTitle", "agency", "serviceLines", "value", "dueDate", "rfpSummary", "evaluationCriteria", "firmStrengths"],
    outputType: "json",
  },

  requirements_matrix_builder: {
    displayName: "Requirements Matrix Builder",
    description: "Extracts every RFP requirement and builds a compliance matrix mapped to proposal sections",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an AEC proposal compliance analyst. Extract every explicit and implicit requirement from the RFP wiki and build a compliance matrix.

Return JSON:
{
  requirements: [
    {
      requirementId: string,
      section: string,
      pageRef: string | null,
      requirement: string,
      requirementType: mandatory|scored|informational,
      proposalSection: string,
      complianceMethod: string (how the proposal will address this),
      complianceStatus: addressed|partial|not_addressed,
      priority: high|medium|low,
      notes: string | null
    }
  ],
  mandatoryCount: number,
  scoredCount: number,
  highPriorityGaps: string[]
}

Flag any requirement that is ambiguous or potentially conflicting as high priority.`,
    userPromptTemplate: `Build a compliance matrix from this RFP.

RFP TITLE: {{rfpTitle}}
AGENCY: {{agency}}
PROPOSAL SECTIONS PLANNED: {{proposalSections}}

RFP WIKI:
{{rfpWiki}}

Extract every requirement and map to proposal sections.`,
    templateVariables: ["rfpTitle", "agency", "rfpWiki", "proposalSections"],
    outputType: "json",
  },

  executive_summary_writer: {
    displayName: "Executive Summary Writer",
    description: "Writes a compelling executive summary tailored to the agency and evaluation criteria",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal writer with a track record of winning public-agency contracts in NJ, NY, and NYC. Write a compelling executive summary.

Requirements:
- 3-4 paragraphs, 400-600 words total
- Paragraph 1: Restate the agency's problem in their language — show you understand their goals, not just the scope
- Paragraph 2: Introduce the firm and directly state why you are uniquely qualified — specific, not generic
- Paragraph 3: Highlight 2-3 relevant past projects with specific outcomes and values
- Paragraph 4: Express commitment and confidence, name key personnel, reference submission compliance
- Use the agency's name throughout — never 'the client'
- Write in active voice — avoid 'we are pleased to submit' and similar filler
- Mirror the RFP's own terminology and evaluation language
- Every sentence must earn its place — no filler`,
    userPromptTemplate: `Write an executive summary for this proposal:

CLIENT/AGENCY: {{agency}}
PURSUIT TITLE: {{pursuitTitle}}
FIRM NAME: {{firmName}}
SERVICES: {{serviceLines}}
RFP SUMMARY: {{rfpSummary}}
EVALUATION CRITERIA: {{evaluationCriteria}}
WIN THEMES: {{winThemes}}
RELEVANT PROJECTS: {{relevantProjects}}
KEY PERSONNEL: {{keyPersonnel}}

Write a 400-600 word executive summary.`,
    templateVariables: ["agency", "pursuitTitle", "firmName", "serviceLines", "rfpSummary", "evaluationCriteria", "winThemes", "relevantProjects", "keyPersonnel"],
    outputType: "prose",
  },

  technical_approach_writer: {
    displayName: "Technical Approach Writer",
    description: "Writes the technical approach section addressing scope point by point with methodology",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC technical proposal writer. Write the technical approach section.

Requirements:
- Directly address every scope element point by point — use the RFP's own section structure
- Show methodology, not just capability — explain HOW you will do the work, not just THAT you can
- Reference specific tools, techniques, standards, and workflows relevant to this project type
- Include quality control approach specific to this scope
- Include schedule management approach with milestone awareness
- Reference relevant past project experience where this methodology was proven with outcomes
- 600-900 words
- Use headers matching the RFP's scope structure
- Every claim must be supportable by firm experience`,
    userPromptTemplate: `Write the technical approach section for this proposal:

CLIENT/AGENCY: {{agency}}
PURSUIT TITLE: {{pursuitTitle}}
SCOPE SUMMARY: {{scopeSummary}}
SERVICES: {{serviceLines}}
EVALUATION CRITERIA: {{evaluationCriteria}}
WIN THEMES: {{winThemes}}
RELEVANT PROJECTS: {{relevantProjects}}

RFP SECTION REQUIREMENTS:
{{rfpRequirements}}

Write a 600-900 word technical approach with headers.`,
    templateVariables: ["agency", "pursuitTitle", "scopeSummary", "serviceLines", "evaluationCriteria", "winThemes", "relevantProjects", "rfpRequirements"],
    outputType: "prose",
  },

  firm_qualifications_writer: {
    displayName: "Firm Qualifications Writer",
    description: "Writes the firm qualifications section highlighting relevant experience and certifications",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal writer. Write the firm qualifications section.

Requirements:
- Open with a 2-sentence firm overview: founding year, size, geographic focus, primary disciplines
- Highlight specific experience relevant to this RFP's project type and agency type
- Reference 3-5 specific past projects with: project name, client/agency, contract value, your role, relevant outcome
- Include relevant certifications, prequalifications, DBE/MBE status, and agency approvals
- If subconsultant or JV: explain teaming structure clearly — who does what and why this team
- Close with a statement on firm capacity and commitment
- 400-600 words
- Specific beats generic — every paragraph must reference real projects or credentials`,
    userPromptTemplate: `Write the firm qualifications section for this proposal:

CLIENT/AGENCY: {{agency}}
PURSUIT TITLE: {{pursuitTitle}}
FIRM NAME: {{firmName}}
FIRM DESCRIPTION: {{firmDescription}}
SERVICES: {{serviceLines}}
FIRM ROLE: {{firmRole}}
TEAMING PARTNERS: {{teamingPartners}}
CERTIFICATIONS: {{certifications}}
RELEVANT PROJECTS: {{relevantProjects}}
EVALUATION CRITERIA: {{evaluationCriteria}}

Write a 400-600 word firm qualifications section.`,
    templateVariables: ["agency", "pursuitTitle", "firmName", "firmDescription", "serviceLines", "firmRole", "teamingPartners", "certifications", "relevantProjects", "evaluationCriteria"],
    outputType: "prose",
  },

  project_experience_writer: {
    displayName: "Project Experience Writer",
    description: "Writes compelling project experience narratives tailored to the pursuit scope",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal writer. Write compelling project experience narratives.

For each provided project write a 150-200 word description:
- Project name and location as heading
- Client/Agency | Contract Value | Your Role on one line
- 2-3 sentences: project scope, scale, and key challenges
- 2-3 sentences: your specific contributions, approach, and methodology
- 1 sentence: measurable outcome, award status, or current status

Rules:
- Past tense for completed projects, present tense for ongoing
- Emphasize elements most relevant to the pursuit scope and evaluation criteria
- Lead with what the agency cares about, not what you're proud of
- Quantify everything possible: square footage, lane miles, contract value, schedule, number of inspections
- Never say 'successfully' — show the success through specifics`,
    userPromptTemplate: `Write project experience narratives for this proposal:

CLIENT/AGENCY: {{agency}}
PURSUIT TITLE: {{pursuitTitle}}
SERVICES: {{serviceLines}}
EVALUATION CRITERIA: {{evaluationCriteria}}

SELECTED PROJECTS:
{{selectedProjects}}

Write a 150-200 word narrative for each project.`,
    templateVariables: ["agency", "pursuitTitle", "serviceLines", "evaluationCriteria", "selectedProjects"],
    outputType: "prose",
  },

  key_personnel_writer: {
    displayName: "Key Personnel Writer",
    description: "Writes key personnel narratives tailored to the pursuit scope and evaluation criteria",
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    systemPrompt: `You are an expert AEC proposal writer. Write key personnel narratives.

For each staff member write a 100-150 word narrative:
- Name | Title | Role on This Project as heading
- Years of experience | Relevant licenses/certifications (number and state) on one line
- 2 sentences: specific expertise relevant to this pursuit's scope and agency
- 2-3 sentences: most relevant project experience with outcomes and the person's specific contribution
- 1 sentence: availability and commitment to this project

Rules:
- Tailor to the evaluation criteria — lead with what the panel will score
- Reference the RFP's stated personnel requirements explicitly
- Quantify experience where possible: years, number of projects, contract values managed
- Never use 'extensive experience' without a specific number — say '14 years' not 'extensive'`,
    userPromptTemplate: `Write key personnel narratives for this proposal:

CLIENT/AGENCY: {{agency}}
PURSUIT TITLE: {{pursuitTitle}}
SERVICES: {{serviceLines}}
EVALUATION CRITERIA: {{evaluationCriteria}}
RFP PERSONNEL REQUIREMENTS: {{rfpPersonnelRequirements}}

SELECTED PERSONNEL:
{{selectedPersonnel}}

Write a 100-150 word narrative for each person.`,
    templateVariables: ["agency", "pursuitTitle", "serviceLines", "evaluationCriteria", "rfpPersonnelRequirements", "selectedPersonnel"],
    outputType: "prose",
  },
};

// ─── Provider endpoint resolution (OpenAI-compat only — Gemini uses native SDK) ─

function resolveEndpoint(provider: Provider, baseUrl?: string | null): string {
  if (baseUrl && baseUrl.trim()) return baseUrl.trim().replace(/\/$/, "") + "/v1/chat/completions";
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "azure_openai":
      throw new Error("Azure OpenAI requires a baseUrl to be configured in the skill settings.");
    case "manus_builtin":
    default:
      return ENV.forgeApiUrl
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
        : "https://forge.manus.im/v1/chat/completions";
  }
}

function resolveDefaultModel(provider: Provider): string {
  switch (provider) {
    case "openai":       return "gpt-4o-mini";
    case "anthropic":    return "claude-sonnet-4-20250514";
    case "google_gemini":return "gemini-2.5-flash-preview-05-20";
    case "azure_openai": return "gpt-4o";
    case "manus_builtin":
    default:             return "gemini-2.5-flash-preview-05-20";
  }
}

/**
 * Resolves the API key for a provider. Priority order:
 * 1. Global provider key from app_settings table (ai_key_google_gemini, ai_key_anthropic, ai_key_openai)
 * 2. ENV-level key (GOOGLE_AI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY)
 * 3. Manus built-in forge key as final fallback for google_gemini
 */
let _cachedProviderKeys: Record<string, string> | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30s cache for DB lookups

async function loadProviderKeysFromDb(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_cachedProviderKeys && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedProviderKeys;
  }
  try {
    const { appSettings } = await import("../../drizzle/schema");
    const db = await getDb();
    if (db) {
      const rows = await db.select().from(appSettings);
      const map: Record<string, string> = {};
      for (const row of rows) {
        if (row.key.startsWith("ai_key_") && row.value) {
          map[row.key] = row.value;
        }
      }
      _cachedProviderKeys = map;
      _cacheTimestamp = now;
      return map;
    }
  } catch {
    // DB unavailable
  }
  return _cachedProviderKeys ?? {};
}

async function resolveApiKey(provider: Provider): Promise<string> {
  // Load global provider keys from app_settings
  const globalKeys = await loadProviderKeysFromDb();

  switch (provider) {
    case "manus_builtin":
      if (!ENV.forgeApiKey) throw new Error("Manus built-in API key is not configured.");
      return ENV.forgeApiKey;
    case "google_gemini": {
      // 1. Global key from Settings UI
      const dbKey = globalKeys["ai_key_google_gemini"];
      if (dbKey) return dbKey;
      // 2. ENV key
      if (ENV.googleAiApiKey) return ENV.googleAiApiKey;
      // 3. Manus built-in fallback
      if (ENV.forgeApiKey) return ENV.forgeApiKey;
      throw new Error("No Google AI API key configured. Go to Settings → AI Skills → Provider API Keys to add your key.");
    }
    case "anthropic": {
      const dbKey = globalKeys["ai_key_anthropic"];
      if (dbKey) return dbKey;
      if (ENV.anthropicApiKey) return ENV.anthropicApiKey;
      throw new Error("No Anthropic API key configured. Go to Settings → AI Skills → Provider API Keys to add your key.");
    }
    case "openai": {
      const dbKey = globalKeys["ai_key_openai"];
      if (dbKey) return dbKey;
      if (ENV.openaiApiKey) return ENV.openaiApiKey;
      throw new Error("No OpenAI API key configured. Go to Settings → AI Skills → Provider API Keys to add your key.");
    }
    case "azure_openai":
      throw new Error("Azure OpenAI requires configuration in Settings → AI Skills.");
    default:
      if (ENV.forgeApiKey) return ENV.forgeApiKey;
      throw new Error(`No API key configured for provider "${provider}".`);
  }
}

// ─── Template interpolation ───────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── Content sanitization for non-Gemini/non-native providers ────────────────

/**
 * Strips file_url content parts from messages when the provider doesn't support them.
 * Google Gemini uses the native SDK which handles file_url → fileData conversion separately.
 * Manus built-in (which routes to Gemini via OpenAI-compat) also supports file_url.
 * For other providers, file_url parts are converted to a text note explaining the file.
 */
function sanitizeMessagesForProvider(messages: SkillMessage[], provider: Provider): SkillMessage[] {
  // google_gemini is handled by callGeminiNative which does its own conversion
  // manus_builtin routes to Gemini via OpenAI-compat which supports file_url
  const supportsFileUrl = provider === "google_gemini" || provider === "manus_builtin";
  if (supportsFileUrl) return messages;

  return messages.map((msg) => {
    if (typeof msg.content === "string") return msg;
    const sanitized = msg.content.map((part) => {
      if (part.type === "file_url") {
        return {
          type: "text" as const,
          text: `[Document attached: ${part.file_url.mime_type ?? "file"} at ${part.file_url.url}]`,
        };
      }
      return part;
    });
    return { ...msg, content: sanitized };
  });
}

// ─── Anthropic message adapter ────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: SkillMessage[],
  responseFormat?: SkillInvokeParams["responseFormat"],
  maxTokens?: number
): Promise<{ result: SkillInvokeResult; tokensIn: number; tokensOut: number }> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  // Convert content parts for Anthropic format
  const convertContent = (content: SkillMessage["content"]): unknown => {
    if (typeof content === "string") return content;
    return content.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image_url") {
        return {
          type: "image",
          source: { type: "url", url: part.image_url.url },
        };
      }
      // file_url should already be sanitized out, but handle gracefully
      if (part.type === "file_url") {
        return { type: "text", text: `[Document: ${part.file_url.url}]` };
      }
      return part;
    });
  };

  const payload: Record<string, unknown> = {
    model,
    max_tokens: maxTokens ?? 8192,
    messages: userMessages.map((m) => ({
      role: m.role,
      content: convertContent(m.content),
    })),
  };
  if (systemMsg) payload.system = typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content);
  if (responseFormat) {
    // Anthropic tool-use for structured output
    payload.tools = [
      {
        name: responseFormat.json_schema.name,
        description: "Return structured JSON matching the schema",
        input_schema: responseFormat.json_schema.schema,
      },
    ];
    payload.tool_choice = { type: "tool", name: responseFormat.json_schema.name };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as any;

  // Extract token usage
  const tokensIn = data.usage?.input_tokens ?? 0;
  const tokensOut = data.usage?.output_tokens ?? 0;

  // Normalise to OpenAI-style response
  let content: string | null = null;
  if (data.content?.[0]?.type === "tool_use") {
    content = JSON.stringify(data.content[0].input);
  } else if (data.content?.[0]?.type === "text") {
    content = data.content[0].text;
  }
  return {
    result: {
      choices: [{ message: { role: "assistant", content }, finish_reason: data.stop_reason }],
      _provider: "anthropic",
      _model: model,
    },
    tokensIn,
    tokensOut,
  };
}

// ─── Google Gemini native SDK call ──────────────────────────────────────────

/**
 * Converts our SkillMessage[] into Gemini's Content[] format.
 * - file_url parts → FileDataPart { fileData: { fileUri, mimeType } }
 * - image_url parts → FileDataPart (images via URL) or InlineDataPart (base64)
 * - text parts → TextPart { text }
 * - System messages are extracted separately for systemInstruction.
 */
function convertToGeminiContents(messages: SkillMessage[]): { contents: Content[]; systemInstruction?: string } {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = typeof msg.content === "string" ? msg.content : msg.content.map(p => p.type === "text" ? p.text : "").join("\n");
      continue;
    }

    const parts: Part[] = [];
    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else {
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "file_url") {
          // Native Gemini FileDataPart — uses fileUri for remote URLs
          parts.push({
            fileData: {
              fileUri: part.file_url.url,
              mimeType: part.file_url.mime_type ?? "application/octet-stream",
            },
          } as Part);
        } else if (part.type === "image_url") {
          // Images via URL → use fileData with image mime type
          const url = part.image_url.url;
          if (url.startsWith("data:")) {
            // Base64 data URI → InlineDataPart
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: { mimeType: match[1], data: match[2] },
              } as Part);
            } else {
              parts.push({ text: `[Image: ${url.substring(0, 100)}...]` });
            }
          } else {
            // Remote URL → FileDataPart
            parts.push({
              fileData: {
                fileUri: url,
                mimeType: "image/jpeg",
              },
            } as Part);
          }
        }
      }
    }

    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts });
  }

  return { contents, systemInstruction };
}

/**
 * Converts our responseFormat (OpenAI-style json_schema) to Gemini's
 * generationConfig with responseMimeType and responseSchema.
 */
function convertResponseFormatToGemini(responseFormat?: SkillInvokeParams["responseFormat"]): Partial<GenerationConfig> {
  if (!responseFormat) return {};
  // Use application/json with the schema
  const schema = responseFormat.json_schema.schema as any;
  return {
    responseMimeType: "application/json",
    responseSchema: convertSchemaToGemini(schema),
  };
}

/**
 * Recursively converts an OpenAI-style JSON Schema to Gemini's Schema format.
 */
function convertSchemaToGemini(schema: any): any {
  if (!schema || !schema.type) return undefined;

  const result: any = {};

  switch (schema.type) {
    case "object":
      result.type = SchemaType.OBJECT;
      if (schema.properties) {
        result.properties = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          result.properties[key] = convertSchemaToGemini(value);
        }
      }
      if (schema.required) result.required = schema.required;
      break;
    case "array":
      result.type = SchemaType.ARRAY;
      if (schema.items) result.items = convertSchemaToGemini(schema.items);
      break;
    case "string":
      result.type = SchemaType.STRING;
      if (schema.enum) result.enum = schema.enum;
      break;
    case "number":
      result.type = SchemaType.NUMBER;
      break;
    case "integer":
      result.type = SchemaType.INTEGER;
      break;
    case "boolean":
      result.type = SchemaType.BOOLEAN;
      break;
    default:
      result.type = SchemaType.STRING;
  }

  if (schema.description) result.description = schema.description;
  return result;
}

/**
 * Maps model strings to the format required by the native SDK's v1beta endpoint.
 * The v1beta endpoint uses short model names (e.g. "gemini-2.5-flash")
 * while the REST API uses full preview strings (e.g. "gemini-2.5-flash-preview-05-20").
 */
function resolveGeminiModelForNativeSDK(model: string): string {
  const MODEL_MAP: Record<string, string> = {
    "gemini-2.5-flash-preview-05-20": "gemini-2.5-flash",
    "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
  };
  return MODEL_MAP[model] ?? model;
}

// ─── Retry-with-backoff for transient Gemini errors ─────────────────────────

const GEMINI_RETRY_STATUS_CODES = new Set([429, 502, 503]);
const GEMINI_RETRY_DELAYS_MS = [5_000, 15_000, 30_000]; // after attempt 1, 2, 3

async function retryWithBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = status !== undefined && GEMINI_RETRY_STATUS_CODES.has(status);
      if (!isRetryable || attempt === GEMINI_RETRY_DELAYS_MS.length) break;
      const delayMs = GEMINI_RETRY_DELAYS_MS[attempt];
      const delaySec = delayMs / 1000;
      console.warn(`[${label}] Gemini ${status} — retrying in ${delaySec}s (attempt ${attempt + 1} of ${GEMINI_RETRY_DELAYS_MS.length})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const status = (lastErr as { status?: number })?.status;
  if (status !== undefined && GEMINI_RETRY_STATUS_CODES.has(status)) {
    throw new Error(`Gemini API unavailable after 3 attempts — please retry in a few minutes`);
  }
  throw lastErr;
}

// ─── Gemini native SDK call ───────────────────────────────────────────────────

async function callGeminiNative(
  apiKey: string,
  model: string,
  messages: SkillMessage[],
  responseFormat?: SkillInvokeParams["responseFormat"],
  maxTokens?: number
): Promise<{ result: SkillInvokeResult; tokensIn: number; tokensOut: number }> {
  const resolvedModel = resolveGeminiModelForNativeSDK(model);
  const genAI = new GoogleGenerativeAI(apiKey);
  const { contents, systemInstruction } = convertToGeminiContents(messages);

  const generationConfig: GenerationConfig = {
    maxOutputTokens: maxTokens ?? 16384,
    ...convertResponseFormatToGemini(responseFormat),
  };

  const genModel = genAI.getGenerativeModel({
    model: resolvedModel,
    systemInstruction: systemInstruction || undefined,
    generationConfig,
  });

  const response = await retryWithBackoff(
    () => genModel.generateContent({ contents }),
    `callGeminiNative/${model}`
  );
  const result = response.response;

  // Extract token usage from usageMetadata
  const tokensIn = result.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = result.usageMetadata?.candidatesTokenCount ?? 0;

  // Extract text content from the response
  let content: string | null = null;
  const candidate = result.candidates?.[0];
  if (candidate?.content?.parts) {
    content = candidate.content.parts.map((p) => (p as any).text ?? "").join("");
  }

  return {
    result: {
      choices: [{
        message: { role: "assistant", content },
        finish_reason: candidate?.finishReason ?? "stop",
      }],
      _provider: "google_gemini",
      _model: model,
    },
    tokensIn,
    tokensOut,
  };
}

// ─── OpenAI-compatible call ───────────────────────────────────────────────────

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: SkillMessage[],
  responseFormat?: SkillInvokeParams["responseFormat"],
  maxTokens?: number
): Promise<{ result: SkillInvokeResult; tokensIn: number; tokensOut: number }> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens ?? 16384,
  };
  if (responseFormat) payload.response_format = responseFormat;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${endpoint}): ${res.status} ${err}`);
  }
  const data = (await res.json()) as any;

  // Extract token usage
  const tokensIn = data.usage?.prompt_tokens ?? 0;
  const tokensOut = data.usage?.completion_tokens ?? 0;

  return {
    result: {
      choices: data.choices ?? [],
      _provider: "openai",
      _model: model,
    },
    tokensIn,
    tokensOut,
  };
}

// ─── Usage logging ───────────────────────────────────────────────────────────

async function logUsage(params: {
  skillType: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const cost = estimateCost(params.model, params.tokensIn, params.tokensOut);
    await db.insert(llmUsageLogs).values({
      skillType: params.skillType,
      provider: params.provider,
      model: params.model,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      estimatedCost: cost.toFixed(6),
      durationMs: params.durationMs,
      success: params.success,
      errorMessage: params.errorMessage ?? null,
    });
  } catch {
    // Never let logging failures break the main flow
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function invokeLLMWithSkill(
  params: SkillInvokeParams
): Promise<SkillInvokeResult> {
  const { skillType, variables = {}, responseFormat, extraUserContent, systemOverride, maxTokens } = params;
  const startTime = Date.now();

  // 1. Load skill config from DB (or use defaults)
  let skillRow: {
    provider: string;
    model: string | null;
    apiKey: string | null;
    baseUrl: string | null;
    systemPrompt: string;
    userPromptTemplate: string;
    enabled: boolean;
  } | null = null;

  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(aiSkills)
        .where(eq(aiSkills.skillType, skillType))
        .limit(1);
      if (rows[0]) skillRow = rows[0];
    }
  } catch {
    // DB unavailable — fall through to defaults
  }

  const defaults = DEFAULT_SKILLS[skillType];
  // Provider/model resolution: DB row value takes priority; if null/empty, fall back to DEFAULT_SKILLS.
  // Provider and model selection is managed exclusively through Settings → AI Configuration UI.
  // Seeds and migrations must never hardcode provider/model — only skillType, displayName, description, systemPrompt, userPromptTemplate.
  const provider = (skillRow?.provider
    ? skillRow.provider
    : defaults?.defaultProvider ?? "manus_builtin") as Provider;
  const model = skillRow?.model || defaults?.defaultModel || resolveDefaultModel(provider);
  const apiKey = await resolveApiKey(provider);
  const systemPrompt = skillRow?.systemPrompt ?? defaults?.systemPrompt ?? "";
  const userPromptTemplate = skillRow?.userPromptTemplate ?? defaults?.userPromptTemplate ?? "";

  // 2. Build messages
  let messages: SkillMessage[];
  if (params.messages) {
    messages = params.messages;
  } else {
    const userText = interpolate(userPromptTemplate, variables);
    const userContent: SkillMessage["content"] = extraUserContent
      ? [{ type: "text", text: userText }, ...extraUserContent]
      : userText;
    messages = [
      { role: "system", content: systemOverride ?? systemPrompt },
      { role: "user", content: userContent },
    ];
  }

  // 3. Sanitize content parts for the target provider
  messages = sanitizeMessagesForProvider(messages, provider);

  // 4. Dispatch to provider
  let tokensIn = 0;
  let tokensOut = 0;
  let result: SkillInvokeResult;

  try {
    if (provider === "google_gemini") {
      // Native Google Generative AI SDK — full file_url/fileUri support
      const resp = await callGeminiNative(apiKey, model, messages, responseFormat, maxTokens);
      result = resp.result;
      tokensIn = resp.tokensIn;
      tokensOut = resp.tokensOut;
    } else if (provider === "anthropic") {
      const resp = await callAnthropic(apiKey, model, messages, responseFormat, maxTokens);
      result = resp.result;
      tokensIn = resp.tokensIn;
      tokensOut = resp.tokensOut;
    } else {
      // OpenAI, Azure, Manus built-in → OpenAI-compatible endpoint
      const endpoint = resolveEndpoint(provider, skillRow?.baseUrl);
      const resp = await callOpenAICompat(endpoint, apiKey, model, messages, responseFormat, maxTokens);
      result = resp.result;
      result._provider = provider;
      result._model = model;
      tokensIn = resp.tokensIn;
      tokensOut = resp.tokensOut;
    }

    // Attach usage to result
    const cost = estimateCost(model, tokensIn, tokensOut);
    result._usage = { tokensIn, tokensOut, estimatedCost: cost };

    // Log usage asynchronously (don't await)
    const durationMs = Date.now() - startTime;
    logUsage({ skillType, provider, model, tokensIn, tokensOut, durationMs, success: true });

    return result;
  } catch (err: any) {
    // Log the failure
    const durationMs = Date.now() - startTime;
    logUsage({ skillType, provider, model, tokensIn: 0, tokensOut: 0, durationMs, success: false, errorMessage: err.message });
    throw err;
  }
}

/**
 * Get the configured provider for a skill type (for use by callers that need to
 * know the provider before calling invokeLLMWithSkill, e.g. to decide whether
 * to extract text first for non-Gemini providers).
 */
export async function getSkillProvider(skillType: SkillType): Promise<Provider> {
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select({ provider: aiSkills.provider })
        .from(aiSkills)
        .where(eq(aiSkills.skillType, skillType))
        .limit(1);
      if (rows[0]?.provider && rows[0].provider !== "manus_builtin") {
        return rows[0].provider as Provider;
      }
    }
  } catch {
    // DB unavailable
  }
  return DEFAULT_SKILLS[skillType]?.defaultProvider ?? "manus_builtin";
}

/**
 * Seed the ai_skills table with any missing skill types.
 * Called once at server startup.
 *
 * RULE: When seeding missing ai_skills records, do NOT specify provider or model values.
 * Leave those columns null. Provider and model selection is managed exclusively through
 * the Settings → AI Configuration UI and must never be hardcoded in migrations, seed
 * scripts, or application code. Only insert: skillType, displayName, description,
 * systemPrompt, and userPromptTemplate.
 */
export async function seedDefaultSkills(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db.select({ skillType: aiSkills.skillType }).from(aiSkills);
    const existingTypes = new Set(existing.map((r) => r.skillType));

    for (const [skillType, def] of Object.entries(DEFAULT_SKILLS)) {
      if (!existingTypes.has(skillType)) {
        // Do NOT hardcode provider/model — leave null so Settings → AI Skills UI controls selection
        await db.insert(aiSkills).values({
          skillType,
          displayName: def.displayName,
          description: def.description,
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
          templateVariables: JSON.stringify(def.templateVariables),
          outputType: def.outputType,
          enabled: true,
        });
      }
    }
  } catch (err) {
    console.warn("[AI Skills] Could not seed default skills:", err);
  }
}
