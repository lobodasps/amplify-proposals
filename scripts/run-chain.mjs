// Run with: npx tsx scripts/run-chain.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const pursuitId = 'bbb6482c-cf5c-4c62-bf32-b7737957b064';
const proposalId = 'bfa16d2d-6bbc-464b-ac81-a22c5a1f92a8';
const sessionId = 'ff100e30-0628-4d5a-91ca-183dc03f88a8';

// Check rfp_wikis for this pursuit
const wikis = await sql`SELECT id, "shredId", "wikiContent", "evaluationCriteria", "keyRequirements" FROM rfp_wikis WHERE "pursuitId" = ${pursuitId} LIMIT 10`;
console.log(`=== RFP Wikis for pursuit: ${wikis.length} entries ===`);
for (const w of wikis) {
  console.log(`  ${w.id} | shredId: ${w.shredId} | wikiContent length: ${w.wikiContent?.length || 0} | evalCriteria: ${w.evaluationCriteria?.length || 0} | keyReqs: ${w.keyRequirements?.length || 0}`);
}

// Also check by proposalId
const wikis2 = await sql`SELECT id, "shredId", "wikiContent" FROM rfp_wikis WHERE "proposalId" = ${proposalId} LIMIT 10`;
console.log(`=== RFP Wikis for proposal: ${wikis2.length} entries ===`);

// Check document_shreds for this pursuit
const shreds = await sql`SELECT id, "fileName", "pursuitId", status, "xmlContent" FROM document_shreds WHERE "pursuitId" = ${pursuitId} LIMIT 10`;
console.log(`\n=== Document Shreds for pursuit: ${shreds.length} entries ===`);
for (const s of shreds) {
  console.log(`  ${s.id} | ${s.fileName} | status: ${s.status} | xmlContent length: ${s.xmlContent?.length || 0}`);
}

// Also check all shreds
const allShreds = await sql`SELECT id, "fileName", "pursuitId", status FROM document_shreds LIMIT 10`;
console.log(`\n=== All Document Shreds: ${allShreds.length} entries ===`);
for (const s of allShreds) {
  console.log(`  ${s.id} | ${s.fileName} | pursuitId: ${s.pursuitId} | status: ${s.status}`);
}

// Check personnel
const personnel = await sql`SELECT id, "firstName", "lastName", title, certifications, "yearsExperience" FROM personnel LIMIT 5`;
console.log(`\n=== Personnel: ${personnel.length} records ===`);
for (const p of personnel) {
  console.log(`  ${p.id} | ${p.firstName} ${p.lastName} | ${p.title} | certs: ${p.certifications} | yrs: ${p.yearsExperience}`);
}

// Check projects
const projects = await sql`SELECT id, "projectName", "clientName", "contractValue" FROM projects LIMIT 5`;
console.log(`\n=== Projects: ${projects.length} records ===`);
for (const p of projects) {
  console.log(`  ${p.id} | ${p.projectName} | ${p.clientName} | $${p.contractValue}`);
}

// Check firm_settings
const firm = await sql`SELECT id, "firmName", "serviceLines", states, "typicalValueMin", "typicalValueMax" FROM firm_settings LIMIT 5`;
console.log(`\n=== Firm Settings: ${firm.length} records ===`);
for (const f of firm) {
  console.log(`  ${f.id} | ${f.firmName} | serviceLines: ${JSON.stringify(f.serviceLines)} | states: ${JSON.stringify(f.states)} | range: $${f.typicalValueMin}-$${f.typicalValueMax}`);
}

// Check rfp_structured_index
const idx = await sql`SELECT id, "pursuitId", "sectionTitle" FROM rfp_structured_index WHERE "pursuitId" = ${pursuitId} LIMIT 10`;
console.log(`\n=== Structured Index for pursuit: ${idx.length} entries ===`);

// Also check all structured index
const allIdx = await sql`SELECT id, "pursuitId", "sectionTitle" FROM rfp_structured_index LIMIT 10`;
console.log(`=== All Structured Index: ${allIdx.length} entries ===`);

await sql.end();
