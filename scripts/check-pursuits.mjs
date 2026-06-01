// Run with: npx tsx scripts/check-pursuits.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

// We already know there's 1 pursuit: bbb6482c... "OUTREACH VALUE ENGINEERING SERVICES ON A TASK ORDER BASIS"
const pursuitId = 'bbb6482c-cf5c-4c62-bf32-b7737957b064';

const sessions = await sql`SELECT id, "pursuitId" FROM rfp_sessions WHERE "pursuitId" = ${pursuitId} LIMIT 5`;
console.log("=== RFP Sessions for pursuit ===");
console.table(sessions);

const proposals = await sql`SELECT id, "pursuitId", title FROM proposals WHERE "pursuitId" = ${pursuitId} LIMIT 5`;
console.log("=== Proposals for pursuit ===");
console.table(proposals);

// Check if there are any rfp_sessions at all
const allSessions = await sql`SELECT id, "pursuitId" FROM rfp_sessions LIMIT 5`;
console.log("=== All RFP Sessions ===");
console.table(allSessions);

// Check proposals
const allProposals = await sql`SELECT id, "pursuitId", title FROM proposals LIMIT 5`;
console.log("=== All Proposals ===");
console.table(allProposals);

await sql.end();
