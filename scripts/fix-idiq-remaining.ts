import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { contracts } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  const nums = ["TEST-S08", "TEST-S09", "TEST-S15", "TEST-S25", "TEST-S29"];
  const rows = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber, billingBasis: contracts.billingBasis })
    .from(contracts)
    .where(inArray(contracts.contractNumber, nums));

  for (const r of rows) {
    if (r.billingBasis === "authorized") {
      console.log(`✓ Already correct: ${r.contractNumber}`);
      continue;
    }
    await db
      .update(contracts)
      .set({ billingBasis: "authorized" })
      .where(inArray(contracts.id, [r.id]));
    console.log(`✅ Fixed ${r.contractNumber}: ${r.billingBasis} → authorized`);
  }

  await conn.end();
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
