import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const r = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_skills' ORDER BY ordinal_position`;
console.log("ai_skills columns:", r.map(c => c.column_name));
const rows = await sql`SELECT "skillType", "outputType" FROM ai_skills ORDER BY "skillType"`;
console.log("Current outputType values:", rows.map(r => `${r.skillType}: ${r.outputType}`));
await sql.end();
