/**
 * Update the dam_image_caption skill system prompt and user prompt template in the database.
 * Run with: node scripts/update-image-caption-skill.mjs
 */

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const NEW_SYSTEM_PROMPT = `You are an AEC (Architecture, Engineering, Construction) image analyst. Analyze this project photo and return a JSON object with:

caption: one sentence describing what the image shows (max 20 words)
description: 2-3 sentence detailed description including structure type, construction phase, setting, and notable features
structureType: primary structure shown — bridge, dam, roadway, retaining-wall, building, park, athletic-field, environmental-site, utility, tunnel, other
constructionPhase: design | under-construction | completed | maintenance
setting: aerial | ground-level | interior | underwater | drone
environment: urban | suburban | rural | waterfront | forested | industrial
tags: array of 5-10 searchable keywords — be specific: prefer steel-girder-bridge over just bridge, synthetic-turf-field over just field
hasPersonnel: boolean — are people visible in the image?
qualityRating: high | medium | low — based on image clarity and composition for proposal use`;

const NEW_USER_TEMPLATE = `Analyze this AEC project image:
FILE: {{fileName}}
CONTEXT: {{context}}

Return a JSON object with exactly these fields: caption, description, structureType, constructionPhase, setting, environment, tags (array), hasPersonnel (boolean), qualityRating.`;

// Use raw SQL to avoid importing schema types
const result = await sql`
  UPDATE "ai_skills"
  SET "systemPrompt" = ${NEW_SYSTEM_PROMPT},
      "userPromptTemplate" = ${NEW_USER_TEMPLATE},
      "updatedAt" = NOW()
  WHERE "skillType" = 'dam_image_caption'
  RETURNING "skillType", "displayName"
`;

if (result.length === 0) {
  console.log("⚠️  No row found for dam_image_caption — inserting is handled by the seed logic at runtime.");
} else {
  console.log(`✅  Updated dam_image_caption skill (${result[0].displayName})`);
}

await sql.end();
