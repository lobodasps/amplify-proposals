/**
 * invokeLLMWithSkill
 * ------------------
 * Looks up the ai_skills row for the given skillType, then dispatches the
 * request to the configured provider (OpenAI-compatible endpoint, Anthropic,
 * Google Gemini, or the Manus built-in forge).  Falls back to the Manus
 * built-in if no skill is configured or the skill is disabled.
 *
 * All providers are called via their OpenAI-compatible /v1/chat/completions
 * endpoint where possible, so the same payload shape works everywhere.
 * Anthropic uses its own /v1/messages endpoint.
 */

import { getDb } from "../db";
import { aiSkills } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./env";

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
  | "agent_guidelines";

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
}

// ─── Default skill definitions ────────────────────────────────────────────────

export const DEFAULT_SKILLS: Record<
  SkillType,
  {
    displayName: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    templateVariables: string[];
  }
> = {
  rfp_shredder: {
    displayName: "RFP Shredder",
    description:
      "Parses an uploaded RFP PDF and extracts a structured requirements matrix, evaluation criteria, key dates, and compliance checklist.",
    systemPrompt: `You are an expert AEC proposal strategist with deep experience in public-agency procurement in NJ, NY, and NYC.
Your job is to parse RFP documents and extract every requirement, evaluation criterion, key date, qualification, and compliance item.
Return structured JSON only. Be exhaustive — missing a requirement could disqualify a proposal.`,
    userPromptTemplate: `Parse this RFP and extract all requirements:

FIRM PROFILE: {{firmProfile}}

RFP TEXT:
{{rfpText}}

Return a complete requirements matrix.`,
    templateVariables: ["rfpText", "firmProfile"],
  },

  resume_tailor: {
    displayName: "Resume Tailor",
    description:
      "Reformats and tailors a staff resume to match specific RFP key-personnel requirements for a named role.",
    systemPrompt: `You are an expert AEC proposal resume writer. You reformat and tailor professional resumes to match specific RFP requirements for public-agency AEC proposals in NJ, NY, and NYC.
You maintain factual accuracy while highlighting the most relevant experience, certifications, and project history for the specific pursuit.
Format resumes in a clean, professional proposal style with: Name/Title, Education, Registrations/Certifications, Years of Experience, Relevant Project Experience (5-7 projects), and a brief professional summary.`,
    userPromptTemplate: `Tailor this resume for the following RFP:

PERSONNEL: {{personnelName}}
TARGET ROLE IN PROPOSAL: {{targetRole}}

RFP REQUIREMENTS:
{{rfpRequirements}}

CURRENT RESUME:
{{resumeText}}

Rewrite the resume to:
1. Lead with the most relevant experience for this specific pursuit
2. Highlight certifications and licenses required by the RFP
3. Select and reorder project experience to best match the scope
4. Use language that mirrors the RFP's evaluation criteria
5. Format for a professional AEC proposal submission`,
    templateVariables: ["personnelName", "targetRole", "rfpRequirements", "resumeText"],
  },

  go_no_go_advisor: {
    displayName: "Go/No-Go Advisor",
    description:
      "Scores a pursuit opportunity on a 0–100 scale and provides a GO / NO-GO / CONDITIONAL GO recommendation with rationale.",
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
  },

  opportunity_scorer: {
    displayName: "Opportunity Scorer",
    description:
      "Scores a scraped or manually entered opportunity for strategic fit against firm capabilities and market position.",
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
  },

  contract_analyzer: {
    displayName: "Contract Analyzer",
    description:
      "Extracts parties, dates, financial values, key clauses, risk flags, and compliance requirements from a contract PDF.",
    systemPrompt: `You are an expert AEC contract analyst with deep knowledge of public-agency contracts in NJ, NY, and NYC.
Extract all structured data from contract documents including parties, dates, financial terms, key clauses, risk flags, and compliance requirements.
Return structured JSON only. Be thorough — missing a clause or risk flag could have serious consequences.`,
    userPromptTemplate: `Analyze this contract document: {{fileName}}

Extract all parties, dates, financial values, contract type, billing method, key clauses, risk flags, and compliance requirements.`,
    templateVariables: ["fileName", "fileUrl"],
  },

  asset_tagger: {
    displayName: "Asset Tagger",
    description:
      "Generates professional alt text and 5–8 searchable tags for a digital asset in the DAM library.",
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
  },

  proposal_writer: {
    displayName: "Proposal Writer",
    description:
      "Drafts a proposal section (Technical Approach, Project Experience, Qualifications, etc.) using firm knowledge and RFP requirements.",
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
  },

  proposal_scorer: {
    displayName: "Proposal Scorer",
    description:
      "Scores a full proposal or an individual section against the RFP's evaluation criteria. Returns a 0–100 score per criterion, an overall compliance score, specific gaps, and concrete improvement suggestions.",
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
  },

  opportunity_ingestion: {
    displayName: "Opportunity Ingestion",
    description:
      "Classifies and summarizes raw scraped portal text into a structured opportunity record with title, agency, service lines, value, and due date.",
    systemPrompt: `You are an AEC business development analyst. You classify and summarize raw procurement portal listings into structured opportunity records.
Extract the key information needed to evaluate whether to pursue the opportunity.
Return structured JSON only.`,
    userPromptTemplate: `Classify and summarize this procurement listing from {{portalName}}:

RAW TEXT:
{{rawText}}

Extract: title, agency name, RFP/solicitation number, estimated value, due date, service lines required, description summary, and whether it is relevant to an AEC firm.`,
    templateVariables: ["portalName", "rawText"],
  },

  // ─── Karpathy Pattern 1: XML Shredder ────────────────────────────────────────
  xml_shredder: {
    displayName: "XML Document Shredder",
    description:
      "Compiles an uploaded document (RFP, contract, spec) into structured semantic XML with tagged sections, requirements, evaluation criteria, key dates, and key personnel. This XML becomes the authoritative context source for all downstream AI tasks.",
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
  },

  // ─── Karpathy Pattern 2: Wiki Compiler ───────────────────────────────────────
  wiki_compiler: {
    displayName: "RFP Wiki Compiler",
    description:
      "Takes shredded XML and synthesizes a living, cross-referenced Markdown wiki. Replaces naive RAG chunking — the LLM does one synthesis pass capturing relationships between sections, criteria, requirements, and dates. The wiki is used as context for proposal writing and scoring.",
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
  },

  // ─── Karpathy Pattern 3: Agent Guidelines ────────────────────────────────────
  agent_guidelines: {
    displayName: "Agent Guidelines Advisor",
    description:
      "Multi-approach advisor: given a task description, generates 3 distinct approaches with pros, cons, and a recommendation before any content is generated. Prevents the model from defaulting to its first instinct.",
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
  },
};

// ─── Provider endpoint resolution ─────────────────────────────────────────────

function resolveEndpoint(provider: Provider, baseUrl?: string | null): string {
  if (baseUrl && baseUrl.trim()) return baseUrl.trim().replace(/\/$/, "") + "/v1/chat/completions";
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "google_gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
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
    case "openai":       return "gpt-4o";
    case "anthropic":    return "claude-3-5-sonnet-20241022";
    case "google_gemini":return "gemini-2.5-flash";
    case "azure_openai": return "gpt-4o";
    case "manus_builtin":
    default:             return "gemini-2.5-flash";
  }
}

function resolveApiKey(provider: Provider, skillApiKey?: string | null): string {
  if (skillApiKey && skillApiKey.trim()) return skillApiKey.trim();
  if (provider === "manus_builtin") {
    if (!ENV.forgeApiKey) throw new Error("Manus built-in API key is not configured.");
    return ENV.forgeApiKey;
  }
  throw new Error(
    `No API key configured for provider "${provider}". Add one in Settings → AI Skills.`
  );
}

// ─── Template interpolation ───────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── Anthropic message adapter ────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: SkillMessage[],
  responseFormat?: SkillInvokeParams["responseFormat"]
): Promise<SkillInvokeResult> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const payload: Record<string, unknown> = {
    model,
    max_tokens: 8192,
    messages: userMessages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : m.content,
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
  // Normalise to OpenAI-style response
  let content: string | null = null;
  if (data.content?.[0]?.type === "tool_use") {
    content = JSON.stringify(data.content[0].input);
  } else if (data.content?.[0]?.type === "text") {
    content = data.content[0].text;
  }
  return {
    choices: [{ message: { role: "assistant", content }, finish_reason: data.stop_reason }],
    _provider: "anthropic",
    _model: model,
  };
}

// ─── OpenAI-compatible call ───────────────────────────────────────────────────

async function callOpenAICompat(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: SkillMessage[],
  responseFormat?: SkillInvokeParams["responseFormat"]
): Promise<SkillInvokeResult> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: 16384,
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
  return {
    choices: data.choices ?? [],
    _provider: "openai",
    _model: model,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function invokeLLMWithSkill(
  params: SkillInvokeParams
): Promise<SkillInvokeResult> {
  const { skillType, variables = {}, responseFormat, extraUserContent, systemOverride } = params;

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
  const provider = (skillRow?.provider ?? "manus_builtin") as Provider;
  const model = skillRow?.model || resolveDefaultModel(provider);
  const apiKey = resolveApiKey(provider, skillRow?.apiKey);
  const systemPrompt = skillRow?.systemPrompt ?? defaults.systemPrompt;
  const userPromptTemplate = skillRow?.userPromptTemplate ?? defaults.userPromptTemplate;

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

  // 3. Dispatch to provider
  if (provider === "anthropic") {
    return callAnthropic(apiKey, model, messages, responseFormat);
  }

  const endpoint = resolveEndpoint(provider, skillRow?.baseUrl);
  const result = await callOpenAICompat(endpoint, apiKey, model, messages, responseFormat);
  result._provider = provider;
  result._model = model;
  return result;
}

/**
 * Seed the ai_skills table with default values if it is empty.
 * Call this once at server startup.
 */
export async function seedDefaultSkills(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db.select({ skillType: aiSkills.skillType }).from(aiSkills);
    const existingTypes = new Set(existing.map((r) => r.skillType));

    for (const [skillType, def] of Object.entries(DEFAULT_SKILLS)) {
      if (!existingTypes.has(skillType)) {
        await db.insert(aiSkills).values({
          skillType,
          displayName: def.displayName,
          description: def.description,
          provider: "manus_builtin",
          model: "gemini-2.5-flash",
          systemPrompt: def.systemPrompt,
          userPromptTemplate: def.userPromptTemplate,
          templateVariables: JSON.stringify(def.templateVariables),
          enabled: true,
        });
      }
    }
  } catch (err) {
    console.warn("[AI Skills] Could not seed default skills:", err);
  }
}
