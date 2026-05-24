import "dotenv/config";
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);
const tables = ["projects","personnel","assets","knowledge_base","opportunities","pursuits","proposals","contracts","tasks","personnel_projects"];
for (const t of tables) {
  try {
    const [rows] = await db.execute(`DESCRIBE \`${t}\``);
    console.log(`\n--- ${t} ---`);
    rows.forEach(r => console.log(r.Field));
  } catch(e) { console.log(`${t}: ERROR - ${e.message}`); }
}
await db.end();
