import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "prefer" });

await sql`ALTER TABLE rfp_sessions ADD COLUMN IF NOT EXISTS "uploadedFiles" jsonb`;
const r = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='rfp_sessions' AND column_name='uploadedFiles'`;
console.log("Column uploadedFiles exists:", r.length > 0);
await sql.end();
