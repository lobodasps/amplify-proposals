/**
 * update-output-types.mjs
 * Sets the correct outputType on all existing ai_skills rows in the DB.
 * Usage: cd /home/ubuntu/amplify-proposals && npx tsx scripts/update-output-types.mjs
 */

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const OUTPUT_TYPES = {
  rfp_shredder: "json",
  resume_tailor: "prose",
  go_no_go_advisor: "json",
  opportunity_scorer: "json",
  contract_analyzer: "json",
  asset_tagger: "json",
  proposal_writer: "prose",
  proposal_scorer: "json",
  opportunity_ingestion: "json",
  xml_shredder: "json",
  wiki_compiler: "prose",
  agent_guidelines: "json",
  autoExtract: "json",
  triggerExtract: "json",
  dam_image_caption: "json",
  conflict_detector: "json",
  win_theme_generator: "json",
  requirements_matrix_builder: "json",
  executive_summary_writer: "prose",
  technical_approach_writer: "prose",
  firm_qualifications_writer: "prose",
  project_experience_writer: "prose",
  key_personnel_writer: "prose",
};

let updated = 0;
for (const [skillType, outputType] of Object.entries(OUTPUT_TYPES)) {
  const result = await sql`
    UPDATE ai_skills
    SET "outputType" = ${outputType}
    WHERE "skillType" = ${skillType}
  `;
  if (result.count > 0) {
    console.log(`  ✓ ${skillType} → ${outputType}`);
    updated++;
  } else {
    console.log(`  - ${skillType}: row not found (will be seeded on next startup)`);
  }
}

console.log(`\nUpdated ${updated} rows.`);

// Verify
const rows = await sql`SELECT "skillType", "outputType" FROM ai_skills ORDER BY "skillType"`;
console.log("\nFinal state:");
for (const r of rows) {
  console.log(`  ${r.skillType}: ${r.outputType}`);
}

await sql.end();
