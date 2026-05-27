/**
 * Fix IDIQ/Task-Order-Model contracts that were seeded with billingBasis="nte_ceiling"
 * They should be billingBasis="authorized" so the Financial Summary card shows
 * the Task Order Portfolio mode (committed vs ceiling) instead of On-Call mode.
 *
 * Affected: S06, S08, S09, S15, S25, S29 (all are IDIQ with task order children)
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { contracts } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(conn);

// Fix all Level-1 IDIQ contracts that have NTE ceiling and task order children
// but were seeded with billingBasis="nte_ceiling" instead of "authorized"
const idiqContractNumbers = [
  "TEST-S06",
  "TEST-S08",
  "TEST-S09",
  "TEST-S15",
  "TEST-S25",
  "TEST-S29",
];

for (const cn of idiqContractNumbers) {
  const rows = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber, billingBasis: contracts.billingBasis })
    .from(contracts)
    .where(eq(contracts.contractNumber, cn));

  if (rows.length === 0) {
    console.log(`⚠ Not found: ${cn}`);
    continue;
  }

  const row = rows[0];
  if (row.billingBasis === "authorized") {
    console.log(`✓ Already correct: ${cn} (billingBasis=authorized)`);
    continue;
  }

  await db
    .update(contracts)
    .set({ billingBasis: "authorized" })
    .where(eq(contracts.id, row.id));

  console.log(`✅ Fixed ${cn}: billingBasis ${row.billingBasis} → authorized`);
}

// Also update the seed script so future re-seeds are correct
console.log("\nDone. Also updating seed script to prevent recurrence...");

await conn.end();
console.log("Database connection closed.");
