import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "prefer" });

await sql`ALTER TABLE pursuits ADD COLUMN IF NOT EXISTS "rfpSessionId" uuid`;
const r = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='pursuits' AND column_name='rfpSessionId'`;
console.log("Column rfpSessionId exists:", r.length > 0);
await sql.end();
