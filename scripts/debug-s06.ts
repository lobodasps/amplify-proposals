import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, like } from "drizzle-orm";
import { contracts } from "../drizzle/schema.js";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  const db = drizzle(conn);

  // Find S06 contracts
  const s06rows = await db
    .select()
    .from(contracts)
    .where(like(contracts.projectNumber, "TEST-S06%"));

  console.log("\n=== S06 CONTRACTS ===");
  for (const c of s06rows) {
    console.log({
      id: c.id,
      projectNumber: c.projectNumber,
      name: c.name,
      level: c.level,
      value: c.value,
      computedContractValue: c.computedContractValue,
      hasNteCeiling: c.hasNteCeiling,
      nteCeilingAmount: c.nteCeilingAmount,
      totalBilledAmount: c.totalBilledAmount,
      billingBasis: c.billingBasis,
      amountBehavior: c.amountBehavior,
      parentContractId: c.parentContractId,
    });
  }

  const root = s06rows.find((c) => c.level === 1);
  if (root) {
    const children = s06rows.filter((c) => c.parentContractId === root.id);
    const childTotal = children.reduce((sum, c) => sum + (c.value ?? 0), 0);
    const childBilled = children.reduce((sum, c) => sum + (c.totalBilledAmount ?? 0), 0);

    console.log("\n=== ROLLUP SUMMARY ===");
    console.log(`Root NTE Ceiling:      $${root.nteCeilingAmount?.toLocaleString()}`);
    console.log(`Root value:            $${root.value?.toLocaleString()}`);
    console.log(`Root computedValue:    $${root.computedContractValue?.toLocaleString()}`);
    console.log(`Root totalBilled:      $${root.totalBilledAmount?.toLocaleString()}`);
    console.log(`Sum of TO values:      $${childTotal.toLocaleString()}`);
    console.log(`Sum of TO billed:      $${childBilled.toLocaleString()}`);
    console.log(`Over-committed by:     $${(childTotal - (root.nteCeilingAmount ?? 0)).toLocaleString()}`);
    console.log(`Children count:        ${children.length}`);
  }

  await conn.end();
}

main().catch(console.error);
