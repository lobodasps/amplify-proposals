import { getDb } from "../server/db";

async function main() {
  const db = await getDb();
  if (!db) { console.log("no db"); process.exit(0); }
  const result = await db.execute(
    "SELECT id, name, serviceLines, tags, yearsExperience, LEFT(summary,80) as sum80 FROM personnel ORDER BY id ASC LIMIT 15"
  ) as any;
  // mysql2 drizzle returns [rows, fields]
  const rows = result[0];
  for (const r of rows) {
    console.log(`\n--- ${r.name} (id:${r.id}) ---`);
    console.log("serviceLines:", JSON.stringify(r.serviceLines));
    console.log("tags:", JSON.stringify(r.tags));
    console.log("yearsExperience:", r.yearsExperience);
    console.log("summary:", r.sum80);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
