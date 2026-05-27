/**
 * seed-contract-testbed.ts
 * Run with: cd /home/ubuntu/amplify-proposals && npx tsx scripts/seed-contract-testbed.ts
 *
 * Comprehensive contract test bed — covers every financial and hierarchy scenario.
 *
 * SCENARIO INDEX
 * S01  LUMP_SUM — Clean, on-budget, fully executed, COI on file
 * S02  LUMP_SUM — Amendment adds scope, still under budget
 * S03  LUMP_SUM — Multiple amendments, OVERBILLED (billed > authorized)
 * S04  LUMP_SUM — Deduct amendment reduces contract value
 * S05  T&M — Under NTE ceiling, normal billing
 * S06  T&M/IDIQ — NTE ceiling, task orders committed > ceiling (OVER-COMMITTED)
 * S07  T&M — Billed amount EXCEEDS NTE ceiling (OVER-BILLED)
 * S08  IDIQ/MSA — Level 1 with 3 Task Orders, correct rollup
 * S09  3-TIER — Level 1 IDIQ → Level 2 TO → Level 3 Sub-Projects
 * S10  IDIQ — Level 2 Task Order OVER its own authorized value
 * S11  3-TIER — Level 3 sub-project over its own budget
 * S12  IDIQ — Unbudgeted Level 2 (no value set, billing exists)
 * S13  Change Orders — Multiple COs push contract over original value
 * S14  Change Order — CO deducts scope, net value below original
 * S15  NTE Ceiling — Available NTE exhausted, new TO would exceed ceiling
 * S16  Compliance — COI required but NOT received (BLOCKER)
 * S17  Compliance — Executed contract NOT on file
 * S18  Compliance — Prime agreement required but missing
 * S19  Compliance — ALL flags missing (worst case)
 * S20  Status: DRAFT
 * S21  Status: NEGOTIATION
 * S22  Status: ON HOLD
 * S23  Status: COMPLETED
 * S24  Status: TERMINATED
 * S25  Multi-entity — JPCL prime, Strans subconsultant
 * S26  Retainage — 10% retainage held on all invoices
 * S27  Zero-dollar amendment — scope change, no cost impact
 * S28  Negative billing — credit memo / correction
 * S29  Large IDIQ — 5 Task Orders, 3 with sub-projects, full rollup
 * S30  Cost-Plus — billing exceeds authorized, no ceiling
 */

import * as dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import {
  entities, orderTypes, organizations, people,
  contracts, contractAmendments, billingEntries,
} from "../drizzle/schema";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const connection = await mysql.createConnection(DB_URL);
const db = drizzle(connection);

const d = (s: string) => new Date(s);
const log = (msg: string) => console.log(`  ✓ ${msg}`);

// ─── Step 1: Ensure lookup data exists ───────────────────────────────────────
console.log("\n[1/6] Ensuring lookup tables are seeded…");

let [jpcl] = await db.select().from(entities).where(eq(entities.shortName, "JPCL")).limit(1);
if (!jpcl) {
  await db.insert(entities).values({ name: "JPCL", shortName: "JPCL", badgeColor: "blue", isDefault: true, active: true });
  [jpcl] = await db.select().from(entities).where(eq(entities.shortName, "JPCL")).limit(1);
}
let [strans] = await db.select().from(entities).where(eq(entities.shortName, "Strans")).limit(1);
if (!strans) {
  await db.insert(entities).values({ name: "Strans Engineering", shortName: "Strans", badgeColor: "emerald", isDefault: false, active: true });
  [strans] = await db.select().from(entities).where(eq(entities.shortName, "Strans")).limit(1);
}
log(`Entities: JPCL(id=${jpcl.id}), Strans(id=${strans.id})`);

let [otTaskOrder] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Task Order")).limit(1);
if (!otTaskOrder) {
  await db.insert(orderTypes).values({ name: "Task Order", description: "Standard task order", active: true });
  [otTaskOrder] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Task Order")).limit(1);
}
let [otPhase] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Phase")).limit(1);
if (!otPhase) {
  await db.insert(orderTypes).values({ name: "Phase", description: "Project phase", active: true });
  [otPhase] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Phase")).limit(1);
}
log(`Order Types: Task Order(${otTaskOrder.id}), Phase(${otPhase.id})`);

// ─── Step 2: Organizations ────────────────────────────────────────────────────
console.log("\n[2/6] Seeding organizations…");

const orgData = [
  { name: "NJDOT", orgType: "OWNER" as const, city: "Trenton", state: "NJ", active: true },
  { name: "NYC DDC", orgType: "OWNER" as const, city: "New York", state: "NY", active: true },
  { name: "PANYNJ", orgType: "OWNER" as const, city: "Jersey City", state: "NJ", active: true },
  { name: "Middlesex County", orgType: "CLIENT" as const, city: "New Brunswick", state: "NJ", active: true },
  { name: "Bergen County", orgType: "CLIENT" as const, city: "Hackensack", state: "NJ", active: true },
  { name: "Parsons Transportation", orgType: "PRIME_CONTRACTOR" as const, city: "Parsippany", state: "NJ", active: true },
  { name: "WSP USA", orgType: "PRIME_CONTRACTOR" as const, city: "New York", state: "NY", active: true },
];

const orgIds: Record<string, number> = {};
for (const org of orgData) {
  const existing = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, org.name)).limit(1);
  if (existing.length > 0) {
    orgIds[org.name] = existing[0].id;
  } else {
    await db.insert(organizations).values(org);
    const [row] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, org.name)).limit(1);
    orgIds[org.name] = row.id;
  }
  log(`Org: ${org.name} (id=${orgIds[org.name]})`);
}

// ─── Step 3: People ───────────────────────────────────────────────────────────
console.log("\n[3/6] Seeding people…");

const peopleData = [
  { firstName: "Michael", lastName: "Torres", role: "PM" as const, organizationName: "JPCL", email: "mtorres@jpcl.com", title: "Senior Project Manager", active: true },
  { firstName: "Sandra", lastName: "Kim", role: "PM" as const, organizationName: "JPCL", email: "skim@jpcl.com", title: "Project Manager", active: true },
  { firstName: "Robert", lastName: "Nguyen", role: "PM" as const, organizationName: "JPCL", email: "rnguyen@jpcl.com", title: "Project Manager II", active: true },
  { firstName: "Elena", lastName: "Vasquez", role: "PM" as const, organizationName: "Strans Engineering", email: "evasquez@strans.com", title: "Principal-in-Charge", active: true },
  { firstName: "James", lastName: "Okafor", role: "PM" as const, organizationName: "Strans Engineering", email: "jokafor@strans.com", title: "Project Manager", active: true },
  { firstName: "Patricia", lastName: "Chen", role: "ACCOUNTANT" as const, organizationName: "JPCL", email: "pchen@jpcl.com", title: "Contract Accountant", active: true },
  { firstName: "David", lastName: "Russo", role: "ACCOUNTANT" as const, organizationName: "JPCL", email: "drusso@jpcl.com", title: "Senior Accountant", active: true },
  { firstName: "Amara", lastName: "Diallo", role: "ACCOUNTANT" as const, organizationName: "Strans Engineering", email: "adiallo@strans.com", title: "Project Accountant", active: true },
];

const personIds: Record<string, number> = {};
for (const person of peopleData) {
  const key = `${person.firstName} ${person.lastName}`;
  const existing = await db.select({ id: people.id }).from(people).where(eq(people.email, person.email)).limit(1);
  if (existing.length > 0) {
    personIds[key] = existing[0].id;
  } else {
    await db.insert(people).values(person);
    const [row] = await db.select({ id: people.id }).from(people).where(eq(people.email, person.email)).limit(1);
    personIds[key] = row.id;
  }
  log(`Person: ${key} [${person.role}] (id=${personIds[key]})`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ContractInsert = typeof contracts.$inferInsert;
type AmendmentInsert = Omit<typeof contractAmendments.$inferInsert, "contractId">;
type BillingInsert = Omit<typeof billingEntries.$inferInsert, "contractId">;

async function insertContract(data: ContractInsert): Promise<number> {
  await db.insert(contracts).values(data);
  const key = data.contractNumber ?? data.title ?? "";
  let rows: { id: number }[];
  if (data.contractNumber) {
    rows = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, data.contractNumber!)).limit(1);
  } else {
    rows = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.title, data.title!)).limit(1);
  }
  return rows[0].id;
}

async function addAmendment(contractId: number, data: AmendmentInsert) {
  await db.insert(contractAmendments).values({ contractId, ...data });
}

async function addBilling(contractId: number, data: BillingInsert) {
  await db.insert(billingEntries).values({ contractId, source: "import", ...data });
}

// ─── Step 4: Seed test contracts ─────────────────────────────────────────────
console.log("\n[4/6] Seeding test contracts…");

const PM_TORRES = personIds["Michael Torres"];
const PM_KIM = personIds["Sandra Kim"];
const PM_NGUYEN = personIds["Robert Nguyen"];
const PM_VASQUEZ = personIds["Elena Vasquez"];
const PM_OKAFOR = personIds["James Okafor"];
const ACCT_CHEN = personIds["Patricia Chen"];
const ACCT_RUSSO = personIds["David Russo"];
const ACCT_DIALLO = personIds["Amara Diallo"];

const ORG_NJDOT = orgIds["NJDOT"];
const ORG_DDC = orgIds["NYC DDC"];
const ORG_PANYNJ = orgIds["PANYNJ"];
const ORG_MIDDLESEX = orgIds["Middlesex County"];
const ORG_BERGEN = orgIds["Bergen County"];
const ORG_PARSONS = orgIds["Parsons Transportation"];
const ORG_WSP = orgIds["WSP USA"];

// ─── S01: Lump Sum — Clean, on-budget, all compliance green ──────────────────
const s01 = await insertContract({
  title: "S01 — Lump Sum: Clean On-Budget, All Compliance Green",
  contractNumber: "TEST-S01", projectNumber: "TS-001",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 250000, computedContractValue: 250000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-15"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, coiReceivedDate: d("2024-01-10"), coiExpirationDate: d("2025-01-10"), hasCOI: true,
  fullyExecutedContractReceived: true, fullyExecutedContractDate: d("2024-01-12"), hasSignedContract: true,
  primeAgreementRequired: false, clientBillingInfoOnFile: true,
  notes: "TEST S01: Lump sum, clean record. All compliance green. Billed $225K of $250K authorized.",
});
await addBilling(s01, { invoiceNumber: "INV-S01-001", invoiceDate: d("2024-03-31"), amount: 75000, billedAmount: 75000, description: "Q1 Progress Payment" });
await addBilling(s01, { invoiceNumber: "INV-S01-002", invoiceDate: d("2024-06-30"), amount: 75000, billedAmount: 75000, description: "Q2 Progress Payment" });
await addBilling(s01, { invoiceNumber: "INV-S01-003", invoiceDate: d("2024-09-30"), amount: 75000, billedAmount: 75000, description: "Q3 Progress Payment" });
log(`S01 (id=${s01}) — Lump Sum clean`);

// ─── S02: Lump Sum — Amendment adds scope, still under budget ────────────────
const s02 = await insertContract({
  title: "S02 — Lump Sum: Amendment Adds Scope, Still Under Authorized",
  contractNumber: "TEST-S02", projectNumber: "TS-002",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX, ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 180000, computedContractValue: 210000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-02-01"), endDate: d("2025-01-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S02: Original $180K. Amendment A001 adds $30K. Authorized = $210K. Billed $120K.",
});
await addAmendment(s02, { amendmentNumber: "A001", amendmentType: "amendment", amount: 30000, amountBehavior: "adds_to_value", amountChange: 30000, description: "Additional topographic survey scope", amendmentDate: d("2024-04-15"), approvalStatus: "approved" });
await addBilling(s02, { invoiceNumber: "INV-S02-001", invoiceDate: d("2024-04-30"), amount: 60000, billedAmount: 60000, description: "Phase 1" });
await addBilling(s02, { invoiceNumber: "INV-S02-002", invoiceDate: d("2024-07-31"), amount: 60000, billedAmount: 60000, description: "Phase 2" });
log(`S02 (id=${s02}) — Amendment adds scope`);

// ─── S03: Lump Sum — Multiple amendments, OVERBILLED ────────────────────────
const s03 = await insertContract({
  title: "S03 — Lump Sum: Multiple Amendments, OVERBILLED vs Authorized",
  contractNumber: "TEST-S03", projectNumber: "TS-003",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN, ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 120000, computedContractValue: 145000, billingBasis: "authorized",
  totalBilledAmount: 152000, isBillingOverCeiling: true,
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-09-01"), endDate: d("2024-08-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S03: Original $120K. Two amendments add $25K total. Authorized=$145K. Billed $152K — OVER by $7K.",
});
await addAmendment(s03, { amendmentNumber: "A001", amendmentType: "amendment", amount: 15000, amountBehavior: "adds_to_value", amountChange: 15000, description: "Additional drainage analysis", amendmentDate: d("2023-11-01"), approvalStatus: "approved" });
await addAmendment(s03, { amendmentNumber: "A002", amendmentType: "amendment", amount: 10000, amountBehavior: "adds_to_value", amountChange: 10000, description: "Extended construction support", amendmentDate: d("2024-02-15"), approvalStatus: "approved" });
await addBilling(s03, { invoiceNumber: "INV-S03-001", invoiceDate: d("2023-11-30"), amount: 50000, billedAmount: 50000, description: "Phase 1" });
await addBilling(s03, { invoiceNumber: "INV-S03-002", invoiceDate: d("2024-02-28"), amount: 52000, billedAmount: 52000, description: "Phase 2" });
await addBilling(s03, { invoiceNumber: "INV-S03-003", invoiceDate: d("2024-05-31"), amount: 50000, billedAmount: 50000, description: "Phase 3 — OVER AUTHORIZED" });
log(`S03 (id=${s03}) — OVERBILLED`);

// ─── S04: Lump Sum — Deduct amendment ────────────────────────────────────────
const s04 = await insertContract({
  title: "S04 — Lump Sum: Deduct Amendment Reduces Contract Value",
  contractNumber: "TEST-S04", projectNumber: "TS-004",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 200000, computedContractValue: 175000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-03-01"), endDate: d("2025-02-28"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S04: Original $200K. Amendment A001 DEDUCTS $25K (scope deleted). Net authorized=$175K. Billed $100K.",
});
await addAmendment(s04, { amendmentNumber: "A001", amendmentType: "amendment", amount: -25000, amountBehavior: "subtracts_from_value", amountChange: 25000, description: "Deleted: Phase 3 environmental assessment (scope removed by client)", amendmentDate: d("2024-05-01"), approvalStatus: "approved" });
await addBilling(s04, { invoiceNumber: "INV-S04-001", invoiceDate: d("2024-05-31"), amount: 50000, billedAmount: 50000, description: "Phase 1" });
await addBilling(s04, { invoiceNumber: "INV-S04-002", invoiceDate: d("2024-08-31"), amount: 50000, billedAmount: 50000, description: "Phase 2" });
log(`S04 (id=${s04}) — Deduct amendment`);

// ─── S05: T&M — Under NTE ceiling ────────────────────────────────────────────
const s05 = await insertContract({
  title: "S05 — T&M: Under NTE Ceiling, Normal Billing Progress",
  contractNumber: "TEST-S05", projectNumber: "TS-005",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 500000, billingBasis: "nte_ceiling",
  totalBilledAmount: 185000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S05: T&M $500K NTE. Billed $185K (37%). Healthy — well under ceiling.",
});
await addBilling(s05, { invoiceNumber: "INV-S05-001", invoiceDate: d("2024-03-31"), amount: 62000, billedAmount: 62000, description: "Q1 T&M" });
await addBilling(s05, { invoiceNumber: "INV-S05-002", invoiceDate: d("2024-06-30"), amount: 65000, billedAmount: 65000, description: "Q2 T&M" });
await addBilling(s05, { invoiceNumber: "INV-S05-003", invoiceDate: d("2024-09-30"), amount: 58000, billedAmount: 58000, description: "Q3 T&M" });
log(`S05 (id=${s05}) — T&M under NTE`);

// ─── S06: IDIQ NTE — Task orders OVER-COMMITTED vs ceiling ───────────────────
const s06 = await insertContract({
  title: "S06 — IDIQ NTE: Task Orders Committed OVER NTE Ceiling ($1.15M vs $1M)",
  contractNumber: "TEST-S06", projectNumber: "TS-006",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ, ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 1000000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-06-01"), endDate: d("2026-05-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S06: IDIQ $1M NTE. Task Order Model. Three TOs totaling $1.15M — OVER-COMMITTED by $150K.",
});
const s06_to1 = await insertContract({
  title: "S06-TO1 — Bridge Inspection Task Order ($400K)",
  contractNumber: "TEST-S06-TO1", projectNumber: "TS-006-001",
  parentContractId: s06, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 400000, computedContractValue: 400000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-07-01"), endDate: d("2024-06-30"),
  notes: "TO1 under S06. $400K authorized, $320K billed.",
});
await addBilling(s06_to1, { invoiceNumber: "INV-S06-TO1-001", invoiceDate: d("2023-10-31"), amount: 160000, billedAmount: 160000, description: "Phase 1" });
await addBilling(s06_to1, { invoiceNumber: "INV-S06-TO1-002", invoiceDate: d("2024-01-31"), amount: 160000, billedAmount: 160000, description: "Phase 2" });
const s06_to2 = await insertContract({
  title: "S06-TO2 — Structural Assessment Task Order ($450K)",
  contractNumber: "TEST-S06-TO2", projectNumber: "TS-006-002",
  parentContractId: s06, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 450000, computedContractValue: 450000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "TO2 under S06. $450K authorized, $200K billed.",
});
await addBilling(s06_to2, { invoiceNumber: "INV-S06-TO2-001", invoiceDate: d("2024-04-30"), amount: 200000, billedAmount: 200000, description: "Phase 1" });
const s06_to3 = await insertContract({
  title: "S06-TO3 — Drainage Study Task Order ($300K — PUSHES OVER NTE CEILING)",
  contractNumber: "TEST-S06-TO3", projectNumber: "TS-006-003",
  parentContractId: s06, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 300000, computedContractValue: 300000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-06-01"), endDate: d("2025-12-31"),
  notes: "TO3 under S06. Combined TOs = $1.15M > $1M NTE. OVER-COMMITTED.",
});
log(`S06 (id=${s06}) — OVER-COMMITTED IDIQ`);

// ─── S07: T&M — Billed OVER NTE ceiling ──────────────────────────────────────
const s07 = await insertContract({
  title: "S07 — T&M: Billed Amount EXCEEDS NTE Ceiling ($328.5K vs $300K NTE)",
  contractNumber: "TEST-S07", projectNumber: "TS-007",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "Strans Engineering", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 300000, billingBasis: "nte_ceiling",
  totalBilledAmount: 328500, isBillingOverCeiling: true,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-04-01"), endDate: d("2024-03-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S07: T&M NTE $300K. Billed $328.5K — OVER NTE by $28.5K. Critical issue.",
});
await addBilling(s07, { invoiceNumber: "INV-S07-001", invoiceDate: d("2023-06-30"), amount: 95000, billedAmount: 95000, description: "Q1-Q2 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-002", invoiceDate: d("2023-09-30"), amount: 98000, billedAmount: 98000, description: "Q3 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-003", invoiceDate: d("2023-12-31"), amount: 87000, billedAmount: 87000, description: "Q4 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-004", invoiceDate: d("2024-02-29"), amount: 48500, billedAmount: 48500, description: "Final billing — OVER NTE" });
log(`S07 (id=${s07}) — OVER NTE ceiling`);

// ─── S08: IDIQ — 3 TOs, correct L1 rollup ────────────────────────────────────
const s08 = await insertContract({
  title: "S08 — IDIQ/MSA: Level 1 with 3 Task Orders, Correct Financial Rollup",
  contractNumber: "TEST-S08", projectNumber: "TS-008",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 2000000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-01-01"), endDate: d("2027-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S08: IDIQ $2M NTE. Task Order Model. 3 TOs: $350K+$425K+$280K=$1.055M committed. Billed $720K. L1 rollup test.",
});
const s08_to1 = await insertContract({
  title: "S08-TO1 — Route 9 Bridge Inspection ($350K, Fully Billed)",
  contractNumber: "TEST-S08-TO1", projectNumber: "TS-008-001",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 350000, computedContractValue: 350000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-03-01"), endDate: d("2023-02-28"),
  notes: "TO1 under S08. Fully billed $350K.",
});
await addBilling(s08_to1, { invoiceNumber: "INV-S08-TO1-001", invoiceDate: d("2022-06-30"), amount: 175000, billedAmount: 175000, description: "Phase 1" });
await addBilling(s08_to1, { invoiceNumber: "INV-S08-TO1-002", invoiceDate: d("2022-12-31"), amount: 175000, billedAmount: 175000, description: "Phase 2 — Final" });
const s08_to2 = await insertContract({
  title: "S08-TO2 — Route 35 Corridor Study ($425K, Partially Billed)",
  contractNumber: "TEST-S08-TO2", projectNumber: "TS-008-002",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 425000, computedContractValue: 425000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-01-01"), endDate: d("2024-06-30"),
  notes: "TO2 under S08. Billed $250K of $425K.",
});
await addBilling(s08_to2, { invoiceNumber: "INV-S08-TO2-001", invoiceDate: d("2023-04-30"), amount: 145000, billedAmount: 145000, description: "Phase 1" });
await addBilling(s08_to2, { invoiceNumber: "INV-S08-TO2-002", invoiceDate: d("2023-10-31"), amount: 105000, billedAmount: 105000, description: "Phase 2" });
const s08_to3 = await insertContract({
  title: "S08-TO3 — Pavement Condition Survey ($280K, Early Stage)",
  contractNumber: "TEST-S08-TO3", projectNumber: "TS-008-003",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 280000, computedContractValue: 280000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "TO3 under S08. Billed $120K of $280K.",
});
await addBilling(s08_to3, { invoiceNumber: "INV-S08-TO3-001", invoiceDate: d("2024-03-31"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
log(`S08 (id=${s08}) — IDIQ 3-TO rollup`);

// ─── S09: 3-Tier — IDIQ → TO → Sub-Projects ──────────────────────────────────
const s09 = await insertContract({
  title: "S09 — 3-Tier Hierarchy: IDIQ → Task Order → Sub-Projects (Full Rollup)",
  contractNumber: "TEST-S09", projectNumber: "TS-009",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ, ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 3000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-07-01"), endDate: d("2027-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S09: Full 3-tier. L1 IDIQ $3M NTE → L2 Task Order → L3 Sub-Projects.",
});
const s09_to1 = await insertContract({
  title: "S09-TO1 — Airport Roadway Improvements Task Order ($800K with Sub-Projects)",
  contractNumber: "TEST-S09-TO1", projectNumber: "TS-009-001",
  parentContractId: s09, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 800000, computedContractValue: 800000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-09-01"), endDate: d("2025-08-31"),
  notes: "TO1 under S09. Has 3 sub-projects (Level 3).",
});
const s09_sp1 = await insertContract({
  title: "S09-TO1-SP1 — Terminal A Approach Road ($250K, Completed)",
  contractNumber: "TEST-S09-TO1-SP1", projectNumber: "TS-009-001-001",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 250000, computedContractValue: 250000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-09-01"), endDate: d("2023-12-31"),
  notes: "SP1 under S09-TO1. Fully billed $250K.",
});
await addBilling(s09_sp1, { invoiceNumber: "INV-S09-SP1-001", invoiceDate: d("2023-03-31"), amount: 125000, billedAmount: 125000, description: "Phase 1" });
await addBilling(s09_sp1, { invoiceNumber: "INV-S09-SP1-002", invoiceDate: d("2023-09-30"), amount: 125000, billedAmount: 125000, description: "Phase 2 — Final" });
const s09_sp2 = await insertContract({
  title: "S09-TO1-SP2 — Terminal B Connector Road ($310K, In Progress)",
  contractNumber: "TEST-S09-TO1-SP2", projectNumber: "TS-009-001-002",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 310000, computedContractValue: 310000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-06-01"), endDate: d("2024-12-31"),
  notes: "SP2 under S09-TO1. Billed $155K of $310K.",
});
await addBilling(s09_sp2, { invoiceNumber: "INV-S09-SP2-001", invoiceDate: d("2023-12-31"), amount: 155000, billedAmount: 155000, description: "Phase 1" });
const s09_sp3 = await insertContract({
  title: "S09-TO1-SP3 — Cargo Area Access Road ($240K, Early Stage)",
  contractNumber: "TEST-S09-TO1-SP3", projectNumber: "TS-009-001-003",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 240000, computedContractValue: 240000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "SP3 under S09-TO1. Billed $80K of $240K.",
});
await addBilling(s09_sp3, { invoiceNumber: "INV-S09-SP3-001", invoiceDate: d("2024-06-30"), amount: 80000, billedAmount: 80000, description: "Phase 1" });
log(`S09 (id=${s09}) — 3-tier full hierarchy`);

// ─── S10: IDIQ — Level 2 TO over its own authorized value ────────────────────
const s10 = await insertContract({
  title: "S10 — IDIQ: Level 2 Task Order OVER Its Own Authorized Value ($347K vs $300K)",
  contractNumber: "TEST-S10", projectNumber: "TS-010",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 1500000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S10: IDIQ $1.5M NTE. TO1 authorized $300K but billed $347K — OVER by $47K.",
});
const s10_to1 = await insertContract({
  title: "S10-TO1 — Traffic Signal Design ($300K Authorized — OVER-BILLED at TO Level)",
  contractNumber: "TEST-S10-TO1", projectNumber: "TS-010-001",
  parentContractId: s10, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "Strans Engineering", status: "active",
  value: 300000, computedContractValue: 300000, billingBasis: "authorized",
  totalBilledAmount: 347000, isBillingOverCeiling: true,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-03-01"), endDate: d("2024-02-29"),
  notes: "TO1 over its $300K authorized. Billed $347K. Needs amendment.",
});
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-001", invoiceDate: d("2023-06-30"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-002", invoiceDate: d("2023-10-31"), amount: 130000, billedAmount: 130000, description: "Phase 2" });
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-003", invoiceDate: d("2024-01-31"), amount: 97000, billedAmount: 97000, description: "Phase 3 — OVER AUTHORIZED" });
log(`S10 (id=${s10}) — TO over authorized`);

// ─── S11: 3-Tier — Level 3 sub-project over its own budget ───────────────────
const s11 = await insertContract({
  title: "S11 — 3-Tier: Level 3 Sub-Project OVER Its Own Budget ($178K vs $150K)",
  contractNumber: "TEST-S11", projectNumber: "TS-011",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN, ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 800000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-07-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S11: 3-tier. L3 sub-project billed over its own $150K budget.",
});
const s11_to1 = await insertContract({
  title: "S11-TO1 — County Road Resurfacing Program Task Order ($500K)",
  contractNumber: "TEST-S11-TO1", projectNumber: "TS-011-001",
  parentContractId: s11, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "Bergen County", performingCompanyName: "JPCL", status: "active",
  value: 500000, computedContractValue: 500000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-09-01"), endDate: d("2025-06-30"),
  notes: "TO1 under S11.",
});
const s11_sp1 = await insertContract({
  title: "S11-TO1-SP1 — Route 17 Segment ($150K Authorized — OVER-BILLED $178K)",
  contractNumber: "TEST-S11-TO1-SP1", projectNumber: "TS-011-001-001",
  parentContractId: s11_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "Bergen County", performingCompanyName: "JPCL", status: "active",
  value: 150000, computedContractValue: 150000, billingBasis: "authorized",
  totalBilledAmount: 178000, isBillingOverCeiling: true,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-09-01"), endDate: d("2024-06-30"),
  notes: "SP1 over its $150K budget. Billed $178K. Needs CO.",
});
await addBilling(s11_sp1, { invoiceNumber: "INV-S11-SP1-001", invoiceDate: d("2024-01-31"), amount: 90000, billedAmount: 90000, description: "Phase 1" });
await addBilling(s11_sp1, { invoiceNumber: "INV-S11-SP1-002", invoiceDate: d("2024-04-30"), amount: 88000, billedAmount: 88000, description: "Phase 2 — OVER BUDGET" });
log(`S11 (id=${s11}) — L3 sub-project over budget`);

// ─── S12: IDIQ — Unbudgeted Task Order ───────────────────────────────────────
const s12 = await insertContract({
  title: "S12 — IDIQ: Unbudgeted Task Order (Value=$0, Billing=$45K Exists)",
  contractNumber: "TEST-S12", projectNumber: "TS-012",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX, ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 600000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S12: IDIQ with one unbudgeted TO (value=0, billing=$45K). Should flag as unbudgeted.",
});
const s12_to1 = await insertContract({
  title: "S12-TO1 — Emergency Drainage Repair (UNBUDGETED — $0 Value, $45K Billed)",
  contractNumber: "TEST-S12-TO1", projectNumber: "TS-012-001",
  parentContractId: s12, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "Middlesex County", performingCompanyName: "JPCL", status: "active",
  value: 0, computedContractValue: 0, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-03-01"), endDate: d("2024-09-30"),
  notes: "UNBUDGETED TO — emergency work commenced before formal pricing.",
});
await addBilling(s12_to1, { invoiceNumber: "INV-S12-TO1-001", invoiceDate: d("2024-04-30"), amount: 22000, billedAmount: 22000, description: "Emergency work week 1-4" });
await addBilling(s12_to1, { invoiceNumber: "INV-S12-TO1-002", invoiceDate: d("2024-06-30"), amount: 23000, billedAmount: 23000, description: "Emergency work week 5-8" });
log(`S12 (id=${s12}) — unbudgeted TO`);

// ─── S13: Change Orders — Multiple COs push over original value ───────────────
const s13 = await insertContract({
  title: "S13 — Change Orders: 3 COs Add $112K, Push Over Original $400K Value",
  contractNumber: "TEST-S13", projectNumber: "TS-013",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 400000, computedContractValue: 512000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-05-01"), endDate: d("2025-04-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S13: Original $400K. Three COs add $112K total. Authorized=$512K. Billed $380K.",
});
await addAmendment(s13, { amendmentNumber: "CO-001", amendmentType: "change_order", amount: 45000, amountBehavior: "adds_to_value", amountChange: 45000, description: "Additional subsurface investigation", amendmentDate: d("2023-08-15"), approvalStatus: "approved" });
await addAmendment(s13, { amendmentNumber: "CO-002", amendmentType: "change_order", amount: 38000, amountBehavior: "adds_to_value", amountChange: 38000, description: "Utility conflict resolution design", amendmentDate: d("2024-01-20"), approvalStatus: "approved" });
await addAmendment(s13, { amendmentNumber: "CO-003", amendmentType: "change_order", amount: 29000, amountBehavior: "adds_to_value", amountChange: 29000, description: "Extended construction inspection period", amendmentDate: d("2024-06-01"), approvalStatus: "approved" });
await addBilling(s13, { invoiceNumber: "INV-S13-001", invoiceDate: d("2023-08-31"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
await addBilling(s13, { invoiceNumber: "INV-S13-002", invoiceDate: d("2023-12-31"), amount: 130000, billedAmount: 130000, description: "Phase 2" });
await addBilling(s13, { invoiceNumber: "INV-S13-003", invoiceDate: d("2024-05-31"), amount: 130000, billedAmount: 130000, description: "Phase 3" });
log(`S13 (id=${s13}) — multiple COs`);

// ─── S14: Change Order — CO deducts scope ────────────────────────────────────
const s14 = await insertContract({
  title: "S14 — Change Order: CO Deducts $55K Scope, Net Value Below Original",
  contractNumber: "TEST-S14", projectNumber: "TS-014",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", status: "active", level: 1,
  value: 350000, computedContractValue: 295000, billingBasis: "authorized",
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S14: Original $350K. CO-001 DEDUCTS $55K (Phase 3 deleted). Net=$295K. Billed $180K.",
});
await addAmendment(s14, { amendmentNumber: "CO-001", amendmentType: "change_order", amount: -55000, amountBehavior: "subtracts_from_value", amountChange: 55000, description: "Delete Phase 3 — Intersection Improvement (client budget cut)", amendmentDate: d("2024-04-01"), approvalStatus: "approved" });
await addBilling(s14, { invoiceNumber: "INV-S14-001", invoiceDate: d("2024-04-30"), amount: 90000, billedAmount: 90000, description: "Phase 1" });
await addBilling(s14, { invoiceNumber: "INV-S14-002", invoiceDate: d("2024-08-31"), amount: 90000, billedAmount: 90000, description: "Phase 2" });
log(`S14 (id=${s14}) — CO deducts scope`);

// ─── S15: NTE Ceiling EXHAUSTED ───────────────────────────────────────────────
const s15 = await insertContract({
  title: "S15 — NTE Ceiling EXHAUSTED: $750K Committed = $750K NTE, No Room for New TOs",
  contractNumber: "TEST-S15", projectNumber: "TS-015",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ, ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 750000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2021-01-01"), endDate: d("2025-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S15: NTE $750K. TOs committed = $750K exactly. Available = $0. Any new TO would exceed ceiling.",
});
const s15_to1 = await insertContract({
  title: "S15-TO1 — Runway Lighting Study ($350K, Completed)",
  contractNumber: "TEST-S15-TO1", projectNumber: "TS-015-001",
  parentContractId: s15, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "completed",
  value: 350000, computedContractValue: 350000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2021-03-01"), endDate: d("2022-12-31"),
  notes: "TO1 — completed, fully billed.",
});
await addBilling(s15_to1, { invoiceNumber: "INV-S15-TO1-001", invoiceDate: d("2021-12-31"), amount: 175000, billedAmount: 175000, description: "Phase 1" });
await addBilling(s15_to1, { invoiceNumber: "INV-S15-TO1-002", invoiceDate: d("2022-09-30"), amount: 175000, billedAmount: 175000, description: "Phase 2 — Final" });
const s15_to2 = await insertContract({
  title: "S15-TO2 — Terminal Signage Program ($400K — NTE NOW EXHAUSTED, No More TOs)",
  contractNumber: "TEST-S15-TO2", projectNumber: "TS-015-002",
  parentContractId: s15, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 400000, computedContractValue: 400000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-01-01"), endDate: d("2025-06-30"),
  notes: "TO2 — $400K. Combined TO1+TO2 = $750K = NTE ceiling. No more TOs can be issued.",
});
await addBilling(s15_to2, { invoiceNumber: "INV-S15-TO2-001", invoiceDate: d("2023-06-30"), amount: 200000, billedAmount: 200000, description: "Phase 1" });
log(`S15 (id=${s15}) — NTE exhausted`);

// ─── S16: Compliance — COI required, NOT received ────────────────────────────
const s16 = await insertContract({
  title: "S16 — Compliance: COI Required But NOT Received (BLOCKER)",
  contractNumber: "TEST-S16", projectNumber: "TS-016",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 175000, computedContractValue: 175000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-06-01"), endDate: d("2025-05-31"),
  coiRequired: true, coiReceived: false, hasCOI: false,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S16: COI required but not received. BLOCKER compliance flag. Work should not proceed.",
});
log(`S16 (id=${s16}) — COI missing`);

// ─── S17: Compliance — Executed contract NOT on file ─────────────────────────
const s17 = await insertContract({
  title: "S17 — Compliance: Executed Contract NOT On File (Warning)",
  contractNumber: "TEST-S17", projectNumber: "TS-017",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN, ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "Strans Engineering", status: "active", level: 1,
  value: 220000, computedContractValue: 220000, billingBasis: "authorized",
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-04-01"), endDate: d("2025-03-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: false, hasSignedContract: false, clientBillingInfoOnFile: true,
  notes: "TEST S17: COI on file. Executed/signed contract NOT received. WARN flag.",
});
log(`S17 (id=${s17}) — executed contract missing`);

// ─── S18: Compliance — Prime agreement required but missing ──────────────────
const s18 = await insertContract({
  title: "S18 — Compliance: Prime Agreement Required But NOT On File (Sub Role)",
  contractNumber: "TEST-S18", projectNumber: "TS-018",
  clientName: "Parsons Transportation", clientOrgId: ORG_PARSONS, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", primeOrgId: ORG_PARSONS, status: "active", level: 1,
  value: 380000, computedContractValue: 380000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-02-01"), endDate: d("2025-07-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  primeAgreementRequired: true, primeAgreementOnFile: false, clientBillingInfoOnFile: false,
  notes: "TEST S18: JPCL is sub to Parsons. Prime agreement required but not on file. Client billing info also missing.",
});
log(`S18 (id=${s18}) — prime agreement missing`);

// ─── S19: Compliance — ALL flags missing (worst case) ────────────────────────
const s19 = await insertContract({
  title: "S19 — Compliance: ALL 4 Flags Missing — Worst Case Scenario",
  contractNumber: "TEST-S19", projectNumber: "TS-019",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 450000, computedContractValue: 450000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-07-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: false, hasCOI: false,
  fullyExecutedContractReceived: false, hasSignedContract: false,
  primeAgreementRequired: true, primeAgreementOnFile: false, clientBillingInfoOnFile: false,
  notes: "TEST S19: WORST CASE — COI missing, executed contract missing, prime agreement missing, billing info missing.",
});
log(`S19 (id=${s19}) — ALL compliance flags missing`);

// ─── S20-S24: Status lifecycle scenarios ─────────────────────────────────────
const s20 = await insertContract({
  title: "S20 — Status: DRAFT — Awarded, Not Yet Activated",
  contractNumber: "TEST-S20", projectNumber: "TS-020",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX, ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", status: "draft", level: 1,
  value: 195000, computedContractValue: 195000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-10-01"), endDate: d("2025-09-30"),
  notes: "TEST S20: Draft. Awarded but not yet executed or activated.",
});
log(`S20 (id=${s20}) — DRAFT`);

const s21 = await insertContract({
  title: "S21 — Status: NEGOTIATION — In Active Contract Negotiation",
  contractNumber: "TEST-S21", projectNumber: "TS-021",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ, ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "Strans Engineering", status: "negotiation", level: 1,
  value: 620000, computedContractValue: 620000, billingBasis: "authorized",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2025-01-01"), endDate: d("2026-12-31"),
  notes: "TEST S21: In negotiation. Scope and fee being finalized. No billing yet.",
});
log(`S21 (id=${s21}) — NEGOTIATION`);

const s22 = await insertContract({
  title: "S22 — Status: ON HOLD — Work Suspended by Client (Funding Delay)",
  contractNumber: "TEST-S22", projectNumber: "TS-022",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "on_hold", level: 1,
  value: 310000, computedContractValue: 310000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-03-01"), endDate: d("2025-02-28"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S22: On hold. Client suspended due to funding delay. $145K billed before suspension.",
});
await addBilling(s22, { invoiceNumber: "INV-S22-001", invoiceDate: d("2023-06-30"), amount: 75000, billedAmount: 75000, description: "Phase 1" });
await addBilling(s22, { invoiceNumber: "INV-S22-002", invoiceDate: d("2023-10-31"), amount: 70000, billedAmount: 70000, description: "Phase 2 — work suspended after this invoice" });
log(`S22 (id=${s22}) — ON HOLD`);

const s23 = await insertContract({
  title: "S23 — Status: COMPLETED — Fully Closed Out, Final Invoice Paid",
  contractNumber: "TEST-S23", projectNumber: "TS-023",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN, ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", status: "completed", level: 1,
  value: 165000, computedContractValue: 165000, billingBasis: "authorized",
  totalBilledAmount: 165000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-01-01"), endDate: d("2023-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S23: Completed. Fully billed $165K. Final invoice paid. Contract closed.",
});
await addBilling(s23, { invoiceNumber: "INV-S23-001", invoiceDate: d("2022-06-30"), amount: 55000, billedAmount: 55000, description: "Phase 1" });
await addBilling(s23, { invoiceNumber: "INV-S23-002", invoiceDate: d("2022-12-31"), amount: 55000, billedAmount: 55000, description: "Phase 2" });
await addBilling(s23, { invoiceNumber: "INV-S23-003", invoiceDate: d("2023-05-31"), amount: 55000, billedAmount: 55000, description: "Phase 3 — Final" });
log(`S23 (id=${s23}) — COMPLETED`);

const s24 = await insertContract({
  title: "S24 — Status: TERMINATED — Terminated for Convenience, 26% Complete",
  contractNumber: "TEST-S24", projectNumber: "TS-024",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "Strans Engineering", status: "terminated", level: 1,
  value: 480000, computedContractValue: 480000, billingBasis: "authorized",
  totalBilledAmount: 127000,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-01-01"), endDate: d("2024-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S24: Terminated for convenience. $127K billed of $480K. Termination settlement pending.",
});
await addBilling(s24, { invoiceNumber: "INV-S24-001", invoiceDate: d("2023-04-30"), amount: 65000, billedAmount: 65000, description: "Phase 1" });
await addBilling(s24, { invoiceNumber: "INV-S24-002", invoiceDate: d("2023-08-31"), amount: 62000, billedAmount: 62000, description: "Phase 2 — final before termination" });
log(`S24 (id=${s24}) — TERMINATED`);

// ─── S25: Multi-entity — JPCL prime, Strans sub ──────────────────────────────
const s25 = await insertContract({
  title: "S25 — Multi-Entity: JPCL Prime ($850K), Strans Subconsultant ($180K Sub-Scope)",
  contractNumber: "TEST-S25", projectNumber: "TS-025",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 850000, computedContractValue: 850000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S25: JPCL prime. Strans sub-scope as Level 2 child.",
});
const s25_sub = await insertContract({
  title: "S25-SUB — Strans Traffic Engineering Sub-Scope ($180K)",
  contractNumber: "TEST-S25-SUB", projectNumber: "TS-025-SUB",
  parentContractId: s25, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "adds_to_parent",
  clientName: "JPCL", performingCompanyName: "Strans Engineering", status: "active",
  value: 180000, computedContractValue: 180000, billingBasis: "authorized",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-02-01"), endDate: d("2026-06-30"),
  notes: "Strans sub-scope under JPCL prime S25. Traffic engineering deliverables.",
});
await addBilling(s25_sub, { invoiceNumber: "INV-S25-SUB-001", invoiceDate: d("2024-06-30"), amount: 60000, billedAmount: 60000, description: "Traffic study Phase 1" });
log(`S25 (id=${s25}) — multi-entity`);

// ─── S26: Retainage — 10% held on all invoices ───────────────────────────────
const s26 = await insertContract({
  title: "S26 — Retainage: 10% Held on All Invoices ($24K Retainage on $240K Billed)",
  contractNumber: "TEST-S26", projectNumber: "TS-026",
  clientName: "NYC DDC", clientOrgId: ORG_DDC, ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 320000, computedContractValue: 320000, billingBasis: "authorized",
  totalBilledAmount: 240000, retainageAmount: 24000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S26: 10% retainage. Billed $240K gross, $24K held. Net received = $216K.",
});
await addBilling(s26, { invoiceNumber: "INV-S26-001", invoiceDate: d("2024-03-31"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 1 (10% retainage held)" });
await addBilling(s26, { invoiceNumber: "INV-S26-002", invoiceDate: d("2024-06-30"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 2 (10% retainage held)" });
await addBilling(s26, { invoiceNumber: "INV-S26-003", invoiceDate: d("2024-09-30"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 3 (10% retainage held)" });
log(`S26 (id=${s26}) — retainage`);

// ─── S27: Zero-dollar amendment ───────────────────────────────────────────────
const s27 = await insertContract({
  title: "S27 — Zero-Dollar Amendment: Scope Substitution, No Cost Impact",
  contractNumber: "TEST-S27", projectNumber: "TS-027",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX, ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 145000, computedContractValue: 145000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-05-01"), endDate: d("2025-04-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S27: $0 amendment — scope substitution (replace one deliverable with another of equal value).",
});
await addAmendment(s27, { amendmentNumber: "A001", amendmentType: "amendment", amount: 0, amountBehavior: "adds_to_value", amountChange: 0, description: "Scope substitution: Replace Deliverable 3A (traffic count) with Deliverable 3B (turning movement count) — no cost change", amendmentDate: d("2024-07-15"), approvalStatus: "approved" });
await addBilling(s27, { invoiceNumber: "INV-S27-001", invoiceDate: d("2024-07-31"), amount: 48000, billedAmount: 48000, description: "Phase 1" });
log(`S27 (id=${s27}) — zero-dollar amendment`);

// ─── S28: Negative billing — credit memo ─────────────────────────────────────
const s28 = await insertContract({
  title: "S28 — Negative Billing: Credit Memo Corrects $15K Over-Billing Error",
  contractNumber: "TEST-S28", projectNumber: "TS-028",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", status: "active", level: 1,
  value: 275000, computedContractValue: 275000, billingBasis: "authorized",
  totalBilledAmount: 118000,
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-02-01"), endDate: d("2025-07-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST S28: INV-001 had $15K error. CM-001 credit memo corrects it. Net billed = $118K.",
});
await addBilling(s28, { invoiceNumber: "INV-S28-001", invoiceDate: d("2024-04-30"), amount: 85000, billedAmount: 85000, description: "Phase 1 (contains $15K billing error)" });
await addBilling(s28, { invoiceNumber: "CM-S28-001", invoiceDate: d("2024-05-15"), amount: -15000, billedAmount: -15000, description: "CREDIT MEMO — correction of INV-S28-001 over-billing" });
await addBilling(s28, { invoiceNumber: "INV-S28-002", invoiceDate: d("2024-07-31"), amount: 48000, billedAmount: 48000, description: "Phase 2" });
log(`S28 (id=${s28}) — credit memo`);

// ─── S29: Large IDIQ — 5 TOs, 3 with sub-projects ────────────────────────────
const s29 = await insertContract({
  title: "S29 — Large IDIQ: 5 Task Orders, 3 with Sub-Projects, Full 3-Tier Rollup ($5M NTE)",
  contractNumber: "TEST-S29", projectNumber: "TS-029",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 5000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2020-01-01"), endDate: d("2030-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true, clientBillingInfoOnFile: true,
  notes: "TEST S29: Large IDIQ $5M NTE. 5 TOs, 3 have sub-projects. Full 3-tier rollup at scale.",
});
// TO1 — simple, completed
const s29_to1 = await insertContract({
  title: "S29-TO1 — Statewide Bridge Inspection ($600K, Completed)",
  contractNumber: "TEST-S29-TO1", projectNumber: "TS-029-001",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "completed",
  value: 600000, computedContractValue: 600000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2020-03-01"), endDate: d("2021-12-31"),
  notes: "TO1 — completed, fully billed.",
});
await addBilling(s29_to1, { invoiceNumber: "INV-S29-TO1-001", invoiceDate: d("2020-09-30"), amount: 300000, billedAmount: 300000, description: "Phase 1" });
await addBilling(s29_to1, { invoiceNumber: "INV-S29-TO1-002", invoiceDate: d("2021-06-30"), amount: 300000, billedAmount: 300000, description: "Phase 2 — Final" });
// TO2 — with 2 sub-projects
const s29_to2 = await insertContract({
  title: "S29-TO2 — Route 1 Corridor Improvements ($900K, Has 2 Sub-Projects)",
  contractNumber: "TEST-S29-TO2", projectNumber: "TS-029-002",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 900000, computedContractValue: 900000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2021-06-01"), endDate: d("2024-05-31"),
  notes: "TO2 — has 2 sub-projects.",
});
const s29_to2_sp1 = await insertContract({
  title: "S29-TO2-SP1 — Route 1 North Segment ($420K, Completed)",
  contractNumber: "TEST-S29-TO2-SP1", projectNumber: "TS-029-002-001",
  parentContractId: s29_to2, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 420000, computedContractValue: 420000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2021-06-01"), endDate: d("2023-05-31"),
  notes: "SP1 under S29-TO2. Fully billed.",
});
await addBilling(s29_to2_sp1, { invoiceNumber: "INV-S29-TO2-SP1-001", invoiceDate: d("2022-03-31"), amount: 210000, billedAmount: 210000, description: "Phase 1" });
await addBilling(s29_to2_sp1, { invoiceNumber: "INV-S29-TO2-SP1-002", invoiceDate: d("2022-12-31"), amount: 210000, billedAmount: 210000, description: "Phase 2 — Final" });
const s29_to2_sp2 = await insertContract({
  title: "S29-TO2-SP2 — Route 1 South Segment ($480K, In Progress)",
  contractNumber: "TEST-S29-TO2-SP2", projectNumber: "TS-029-002-002",
  parentContractId: s29_to2, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 480000, computedContractValue: 480000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-06-01"), endDate: d("2024-05-31"),
  notes: "SP2 under S29-TO2. Billed $240K.",
});
await addBilling(s29_to2_sp2, { invoiceNumber: "INV-S29-TO2-SP2-001", invoiceDate: d("2023-03-31"), amount: 240000, billedAmount: 240000, description: "Phase 1" });
// TO3 — simple
const s29_to3 = await insertContract({
  title: "S29-TO3 — Traffic Signal Retiming Program ($450K)",
  contractNumber: "TEST-S29-TO3", projectNumber: "TS-029-003",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 450000, computedContractValue: 450000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-01-01"), endDate: d("2024-12-31"),
  notes: "TO3 — no sub-projects. Billed $300K.",
});
await addBilling(s29_to3, { invoiceNumber: "INV-S29-TO3-001", invoiceDate: d("2023-06-30"), amount: 150000, billedAmount: 150000, description: "Phase 1" });
await addBilling(s29_to3, { invoiceNumber: "INV-S29-TO3-002", invoiceDate: d("2023-12-31"), amount: 150000, billedAmount: 150000, description: "Phase 2" });
// TO4 — with 1 sub-project
const s29_to4 = await insertContract({
  title: "S29-TO4 — Pedestrian Safety Improvements ($550K, Has 1 Sub-Project)",
  contractNumber: "TEST-S29-TO4", projectNumber: "TS-029-004",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 550000, computedContractValue: 550000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2026-12-31"),
  notes: "TO4 — has 1 sub-project.",
});
const s29_to4_sp1 = await insertContract({
  title: "S29-TO4-SP1 — School Zone Safety Package ($280K)",
  contractNumber: "TEST-S29-TO4-SP1", projectNumber: "TS-029-004-001",
  parentContractId: s29_to4, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 280000, computedContractValue: 280000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-03-01"), endDate: d("2025-12-31"),
  notes: "SP1 under S29-TO4. Billed $100K.",
});
await addBilling(s29_to4_sp1, { invoiceNumber: "INV-S29-TO4-SP1-001", invoiceDate: d("2024-09-30"), amount: 100000, billedAmount: 100000, description: "Phase 1" });
// TO5 — just started
const s29_to5 = await insertContract({
  title: "S29-TO5 — ADA Transition Plan ($380K, Just Started, No Billing)",
  contractNumber: "TEST-S29-TO5", projectNumber: "TS-029-005",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 380000, computedContractValue: 380000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2025-01-01"), endDate: d("2026-12-31"),
  notes: "TO5 — just started, no billing yet.",
});
log(`S29 (id=${s29}) — large IDIQ 5 TOs`);

// ─── S30: Cost-Plus — billing exceeds authorized ──────────────────────────────
const s30 = await insertContract({
  title: "S30 — Cost-Plus Sub: Billing Exceeds Authorized ($248K vs $225K, Pending Amendment)",
  contractNumber: "TEST-S30", projectNumber: "TS-030",
  clientName: "WSP USA", clientOrgId: ORG_WSP, ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", primeOrgId: ORG_WSP, status: "active", level: 1,
  value: 225000, computedContractValue: 225000, billingBasis: "authorized",
  totalBilledAmount: 248000, isBillingOverCeiling: true,
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-09-01"), endDate: d("2025-08-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  primeAgreementRequired: true, primeAgreementOnFile: true, primeAgreementDate: d("2023-08-15"),
  clientBillingInfoOnFile: true,
  notes: "TEST S30: Cost-plus sub to WSP. Billed $248K vs $225K authorized. Over by $23K. Amendment pending.",
});
await addAmendment(s30, { amendmentNumber: "A001", amendmentType: "amendment", amount: 25000, amountBehavior: "adds_to_value", amountChange: 25000, description: "Additional geotechnical investigation — cost overrun approved by WSP", amendmentDate: d("2024-06-01"), approvalStatus: "pending" });
await addBilling(s30, { invoiceNumber: "INV-S30-001", invoiceDate: d("2023-12-31"), amount: 85000, billedAmount: 85000, description: "Q4 2023 cost-plus billing" });
await addBilling(s30, { invoiceNumber: "INV-S30-002", invoiceDate: d("2024-03-31"), amount: 90000, billedAmount: 90000, description: "Q1 2024 cost-plus billing" });
await addBilling(s30, { invoiceNumber: "INV-S30-003", invoiceDate: d("2024-06-30"), amount: 73000, billedAmount: 73000, description: "Q2 2024 — OVER AUTHORIZED" });
log(`S30 (id=${s30}) — cost-plus over authorized`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n[5/6] Counting inserted records…");
const contractCount = await db.select({ id: contracts.id }).from(contracts);
const amendmentCount = await db.select({ id: contractAmendments.id }).from(contractAmendments);
const billingCount = await db.select({ id: billingEntries.id }).from(billingEntries);
console.log(`  Total contracts (all levels): ${contractCount.length}`);
console.log(`  Total amendments: ${amendmentCount.length}`);
console.log(`  Total billing entries: ${billingCount.length}`);

console.log("\n[6/6] ✅ Contract test bed seeded successfully!\n");
console.log("Scenario Index:");
const scenarios = [
  "S01  Lump Sum — Clean, on-budget, all compliance green",
  "S02  Lump Sum — Amendment adds scope, under budget",
  "S03  Lump Sum — Multiple amendments, OVERBILLED (billed > authorized)",
  "S04  Lump Sum — Deduct amendment reduces contract value",
  "S05  T&M — Under NTE ceiling, normal billing",
  "S06  IDIQ NTE — Task orders OVER-COMMITTED vs ceiling",
  "S07  T&M — Billed OVER NTE ceiling",
  "S08  IDIQ — 3 TOs, correct L1 rollup",
  "S09  3-Tier — IDIQ → TO → Sub-Projects, full rollup",
  "S10  IDIQ — Level 2 TO over its own authorized value",
  "S11  3-Tier — Level 3 sub-project over its own budget",
  "S12  IDIQ — Unbudgeted TO (value=0, billing exists)",
  "S13  Change Orders — Multiple COs push over original value",
  "S14  Change Order — CO deducts scope, net below original",
  "S15  NTE Ceiling — Exhausted, no room for new TOs",
  "S16  Compliance — COI required, NOT received (BLOCKER)",
  "S17  Compliance — Executed contract NOT on file",
  "S18  Compliance — Prime agreement required, missing",
  "S19  Compliance — ALL 4 flags missing (worst case)",
  "S20  Status: DRAFT",
  "S21  Status: NEGOTIATION",
  "S22  Status: ON HOLD",
  "S23  Status: COMPLETED",
  "S24  Status: TERMINATED",
  "S25  Multi-entity — JPCL prime, Strans sub",
  "S26  Retainage — 10% held on all invoices",
  "S27  Zero-dollar amendment — scope change, no cost",
  "S28  Negative billing — credit memo / correction",
  "S29  Large IDIQ — 5 TOs, 3 with sub-projects, full rollup",
  "S30  Cost-Plus — billing exceeds authorized, no ceiling",
];
scenarios.forEach(s => console.log(`  ${s}`));

await connection.end();
process.exit(0);
