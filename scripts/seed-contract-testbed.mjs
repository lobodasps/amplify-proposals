/**
 * seed-contract-testbed.mjs
 *
 * Comprehensive contract test bed — covers every financial and hierarchy scenario:
 *
 * SCENARIO INDEX
 * ─────────────────────────────────────────────────────────────────────────────
 * S01  LUMP_SUM — Clean, on-budget, fully executed, COI on file
 * S02  LUMP_SUM — Amendment adds scope, still under budget
 * S03  LUMP_SUM — Multiple amendments, over authorized value (overbilled)
 * S04  LUMP_SUM — Deduct amendment reduces contract value
 * S05  T&M — Under NTE ceiling, normal billing
 * S06  T&M — NTE ceiling, task orders committed > ceiling (over-committed)
 * S07  T&M — Billed amount exceeds NTE ceiling (over-billed)
 * S08  IDIQ/MSA — Level 1 with multiple Level 2 Task Orders, rollup correct
 * S09  IDIQ/MSA — Level 1 with Level 2 TOs, one TO has Level 3 Sub-Projects
 * S10  IDIQ/MSA — Level 2 TO exceeds its own authorized value (over-budget TO)
 * S11  IDIQ/MSA — Level 3 sub-project over its own budget
 * S12  IDIQ/MSA — Unbudgeted Level 2 (no value set, billing exists)
 * S13  Change Order — Multiple COs push contract over original value
 * S14  Change Order — CO deducts scope, net value below original
 * S15  NTE Ceiling — Available NTE exhausted, new TO would exceed ceiling
 * S16  Compliance — COI required but not received
 * S17  Compliance — Executed contract not on file
 * S18  Compliance — Prime agreement required but missing
 * S19  Compliance — All flags missing (worst case)
 * S20  Status: Draft — not yet activated
 * S21  Status: Negotiation — in negotiation
 * S22  Status: On Hold — suspended
 * S23  Status: Completed — fully closed out
 * S24  Status: Terminated — terminated for convenience
 * S25  Multi-entity — JPCL prime, Strans sub (primeOrgId set)
 * S26  Retainage — 10% retainage held on all invoices
 * S27  Zero-dollar amendment — scope change with no cost impact
 * S28  Negative billing entry — credit memo / correction
 * S29  Large IDIQ — 5 Task Orders, 3 with sub-projects, full rollup
 * S30  Cost-Plus — billing exceeds authorized (no ceiling)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

// ─── Schema imports ───────────────────────────────────────────────────────────
import {
  entities, orderTypes,
  organizations, people, contracts, contractAmendments, billingEntries,
} from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const connection = postgres(DB_URL, { ssl: { rejectUnauthorized: false }, prepare: false, max: 5 });
const db = drizzle(connection);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const d = (s) => new Date(s);
const log = (msg) => console.log(`  ✓ ${msg}`);

// ─── Step 0: Ensure lookup data exists ───────────────────────────────────────
console.log("\n[1/7] Ensuring lookup tables are seeded…");

// Entities
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

// Order Types
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
let [otPO] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Purchase Order")).limit(1);
if (!otPO) {
  await db.insert(orderTypes).values({ name: "Purchase Order", description: "Purchase order", active: true });
  [otPO] = await db.select().from(orderTypes).where(eq(orderTypes.name, "Purchase Order")).limit(1);
}
log(`Order Types: Task Order(${otTaskOrder.id}), Phase(${otPhase.id}), PO(${otPO.id})`);

// ─── Step 1: Organizations ────────────────────────────────────────────────────
console.log("\n[2/7] Seeding organizations…");

const orgData = [
  { name: "NJDOT", orgType: "OWNER", city: "Trenton", state: "NJ", phone: "609-530-2000", email: "info@dot.nj.gov", active: true },
  { name: "NYC DDC", orgType: "OWNER", city: "New York", state: "NY", phone: "212-312-7000", email: "info@ddc.nyc.gov", active: true },
  { name: "PANYNJ", orgType: "OWNER", city: "Jersey City", state: "NJ", phone: "212-435-7000", email: "info@panynj.gov", active: true },
  { name: "Middlesex County", orgType: "CLIENT", city: "New Brunswick", state: "NJ", phone: "732-745-3000", active: true },
  { name: "Bergen County", orgType: "CLIENT", city: "Hackensack", state: "NJ", phone: "201-336-6000", active: true },
  { name: "Parsons Transportation", orgType: "PRIME_CONTRACTOR", city: "Parsippany", state: "NJ", phone: "973-394-6000", active: true },
  { name: "WSP USA", orgType: "PRIME_CONTRACTOR", city: "New York", state: "NY", phone: "212-465-5000", active: true },
  { name: "Jacobs Engineering", orgType: "PRIME_CONTRACTOR", city: "Dallas", state: "TX", phone: "214-638-0145", active: true },
];

const orgIds = {};
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

// ─── Step 2: People ───────────────────────────────────────────────────────────
console.log("\n[3/7] Seeding people…");

const peopleData = [
  // Project Managers — JPCL
  { firstName: "Michael", lastName: "Torres", role: "PM", organizationName: "JPCL", email: "mtorres@jpcl.com", title: "Senior Project Manager", active: true },
  { firstName: "Sandra", lastName: "Kim", role: "PM", organizationName: "JPCL", email: "skim@jpcl.com", title: "Project Manager", active: true },
  { firstName: "Robert", lastName: "Nguyen", role: "PM", organizationName: "JPCL", email: "rnguyen@jpcl.com", title: "Project Manager II", active: true },
  // Project Managers — Strans
  { firstName: "Elena", lastName: "Vasquez", role: "PM", organizationName: "Strans Engineering", email: "evasquez@strans.com", title: "Principal-in-Charge", active: true },
  { firstName: "James", lastName: "Okafor", role: "PM", organizationName: "Strans Engineering", email: "jokafor@strans.com", title: "Project Manager", active: true },
  // Accountants — JPCL
  { firstName: "Patricia", lastName: "Chen", role: "ACCOUNTANT", organizationName: "JPCL", email: "pchen@jpcl.com", title: "Contract Accountant", active: true },
  { firstName: "David", lastName: "Russo", role: "ACCOUNTANT", organizationName: "JPCL", email: "drusso@jpcl.com", title: "Senior Accountant", active: true },
  // Accountants — Strans
  { firstName: "Amara", lastName: "Diallo", role: "ACCOUNTANT", organizationName: "Strans Engineering", email: "adiallo@strans.com", title: "Project Accountant", active: true },
  // Contract Admins
  { firstName: "Thomas", lastName: "Walsh", role: "CONTRACT_ADMIN", organizationName: "JPCL", email: "twalsh@jpcl.com", title: "Contract Administrator", active: true },
  { firstName: "Lisa", lastName: "Patel", role: "CONTRACT_ADMIN", organizationName: "Strans Engineering", email: "lpatel@strans.com", title: "Contract Administrator", active: true },
];

const personIds = {};
for (const person of peopleData) {
  const key = `${person.firstName} ${person.lastName}`;
  const existing = await db.select({ id: people.id }).from(people)
    .where(eq(people.email, person.email)).limit(1);
  if (existing.length > 0) {
    personIds[key] = existing[0].id;
  } else {
    await db.insert(people).values(person);
    const [row] = await db.select({ id: people.id }).from(people).where(eq(people.email, person.email)).limit(1);
    personIds[key] = row.id;
  }
  log(`Person: ${key} [${person.role}] (id=${personIds[key]})`);
}

// ─── Step 3: Helper to insert contract + return id ────────────────────────────
async function insertContract(data) {
  await db.insert(contracts).values(data);
  let rows;
  if (data.contractNumber) {
    rows = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, data.contractNumber)).limit(1);
  } else {
    rows = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.title, data.title)).limit(1);
  }
  return rows[0].id;
}

async function addAmendment(contractId, data) {
  await db.insert(contractAmendments).values({ contractId, ...data });
}

async function addBilling(contractId, data) {
  await db.insert(billingEntries).values({ contractId, source: "import", ...data });
}

// ─── Step 4: Seed all test contracts ─────────────────────────────────────────
console.log("\n[4/7] Seeding test contracts…");

const PM_TORRES = personIds["Michael Torres"];
const PM_KIM = personIds["Sandra Kim"];
const PM_NGUYEN = personIds["Robert Nguyen"];
const PM_VASQUEZ = personIds["Elena Vasquez"];
const PM_OKAFOR = personIds["James Okafor"];
const ACCT_CHEN = personIds["Patricia Chen"];
const ACCT_RUSSO = personIds["David Russo"];
const ACCT_DIALLO = personIds["Amara Diallo"];
const ADMIN_WALSH = personIds["Thomas Walsh"];

const ORG_NJDOT = orgIds["NJDOT"];
const ORG_DDC = orgIds["NYC DDC"];
const ORG_PANYNJ = orgIds["PANYNJ"];
const ORG_MIDDLESEX = orgIds["Middlesex County"];
const ORG_BERGEN = orgIds["Bergen County"];
const ORG_PARSONS = orgIds["Parsons Transportation"];
const ORG_WSP = orgIds["WSP USA"];
const ORG_JACOBS = orgIds["Jacobs Engineering"];

const JPCL_ID = jpcl.id;
const STRANS_ID = strans.id;

// ─────────────────────────────────────────────────────────────────────────────
// S01 — LUMP_SUM: Clean, on-budget, fully executed, COI on file
// ─────────────────────────────────────────────────────────────────────────────
const s01 = await insertContract({
  title: "S01 — Lump Sum: Clean On-Budget, All Compliance Green",
  contractNumber: "TEST-S01",
  projectNumber: "TS-001",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 250000, computedContractValue: 250000,
  billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-15"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, coiReceivedDate: d("2024-01-10"),
  coiExpirationDate: d("2025-01-10"), hasCOI: true,
  fullyExecutedContractReceived: true, fullyExecutedContractDate: d("2024-01-12"),
  hasSignedContract: true,
  primeAgreementRequired: false,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S01: Lump sum, clean record. All compliance flags green. Billed 60% of authorized. No amendments.",
});
await addBilling(s01, { invoiceNumber: "INV-S01-001", invoiceDate: d("2024-03-31"), amount: 75000, billedAmount: 75000, retainageAmount: 0, description: "Q1 2024 Progress Payment" });
await addBilling(s01, { invoiceNumber: "INV-S01-002", invoiceDate: d("2024-06-30"), amount: 75000, billedAmount: 75000, retainageAmount: 0, description: "Q2 2024 Progress Payment" });
await addBilling(s01, { invoiceNumber: "INV-S01-003", invoiceDate: d("2024-09-30"), amount: 75000, billedAmount: 75000, retainageAmount: 0, description: "Q3 2024 Progress Payment" });
log(`S01 created (id=${s01})`);

// ─────────────────────────────────────────────────────────────────────────────
// S02 — LUMP_SUM: Amendment adds scope, still under budget
// ─────────────────────────────────────────────────────────────────────────────
const s02 = await insertContract({
  title: "S02 — Lump Sum: Amendment Adds Scope, Still Under Authorized",
  contractNumber: "TEST-S02",
  projectNumber: "TS-002",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX,
  ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 180000, computedContractValue: 210000,
  billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-02-01"), endDate: d("2025-01-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S02: Original $180K. Amendment A001 adds $30K for additional survey scope. Billed $120K of $210K authorized. Under budget.",
});
await addAmendment(s02, { amendmentNumber: "A001", amendmentType: "amendment", amount: 30000, amountBehavior: "adds_to_value", amountChange: 30000, description: "Additional topographic survey scope", amendmentDate: d("2024-04-15"), approvalStatus: "approved" });
await addBilling(s02, { invoiceNumber: "INV-S02-001", invoiceDate: d("2024-04-30"), amount: 60000, billedAmount: 60000, description: "Phase 1 completion" });
await addBilling(s02, { invoiceNumber: "INV-S02-002", invoiceDate: d("2024-07-31"), amount: 60000, billedAmount: 60000, description: "Phase 2 completion" });
log(`S02 created (id=${s02})`);

// ─────────────────────────────────────────────────────────────────────────────
// S03 — LUMP_SUM: Multiple amendments, OVERBILLED (billed > authorized)
// ─────────────────────────────────────────────────────────────────────────────
const s03 = await insertContract({
  title: "S03 — Lump Sum: Multiple Amendments, OVERBILLED vs Authorized",
  contractNumber: "TEST-S03",
  projectNumber: "TS-003",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN,
  ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 120000, computedContractValue: 145000,
  billingBasis: "authorized",
  totalBilledAmount: 152000,
  isBillingOverCeiling: true,
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-09-01"), endDate: d("2024-08-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S03: Original $120K. Two amendments add $25K total. Authorized = $145K. Billed $152K — OVER by $7K. Compliance issue.",
});
await addAmendment(s03, { amendmentNumber: "A001", amendmentType: "amendment", amount: 15000, amountBehavior: "adds_to_value", amountChange: 15000, description: "Additional drainage analysis", amendmentDate: d("2023-11-01"), approvalStatus: "approved" });
await addAmendment(s03, { amendmentNumber: "A002", amendmentType: "amendment", amount: 10000, amountBehavior: "adds_to_value", amountChange: 10000, description: "Extended construction support", amendmentDate: d("2024-02-15"), approvalStatus: "approved" });
await addBilling(s03, { invoiceNumber: "INV-S03-001", invoiceDate: d("2023-11-30"), amount: 50000, billedAmount: 50000, description: "Phase 1" });
await addBilling(s03, { invoiceNumber: "INV-S03-002", invoiceDate: d("2024-02-28"), amount: 52000, billedAmount: 52000, description: "Phase 2" });
await addBilling(s03, { invoiceNumber: "INV-S03-003", invoiceDate: d("2024-05-31"), amount: 50000, billedAmount: 50000, description: "Phase 3 — OVER AUTHORIZED" });
log(`S03 created (id=${s03}) — OVERBILLED scenario`);

// ─────────────────────────────────────────────────────────────────────────────
// S04 — LUMP_SUM: Deduct amendment reduces contract value
// ─────────────────────────────────────────────────────────────────────────────
const s04 = await insertContract({
  title: "S04 — Lump Sum: Deduct Amendment Reduces Contract Value",
  contractNumber: "TEST-S04",
  projectNumber: "TS-004",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 200000, computedContractValue: 175000,
  billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-03-01"), endDate: d("2025-02-28"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S04: Original $200K. Amendment A001 DEDUCTS $25K (scope deleted by client). Net authorized = $175K. Billed $100K.",
});
await addAmendment(s04, { amendmentNumber: "A001", amendmentType: "amendment", amount: -25000, amountBehavior: "subtracts_from_value", amountChange: 25000, description: "Deleted: Phase 3 environmental assessment (scope removed by client)", amendmentDate: d("2024-05-01"), approvalStatus: "approved" });
await addBilling(s04, { invoiceNumber: "INV-S04-001", invoiceDate: d("2024-05-31"), amount: 50000, billedAmount: 50000, description: "Phase 1" });
await addBilling(s04, { invoiceNumber: "INV-S04-002", invoiceDate: d("2024-08-31"), amount: 50000, billedAmount: 50000, description: "Phase 2" });
log(`S04 created (id=${s04}) — DEDUCT amendment`);

// ─────────────────────────────────────────────────────────────────────────────
// S05 — T&M: Under NTE ceiling, normal billing
// ─────────────────────────────────────────────────────────────────────────────
const s05 = await insertContract({
  title: "S05 — T&M: Under NTE Ceiling, Normal Billing Progress",
  contractNumber: "TEST-S05",
  projectNumber: "TS-005",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 500000, billingBasis: "nte_ceiling",
  totalBilledAmount: 185000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S05: T&M with $500K NTE ceiling. Billed $185K (37% of ceiling). Healthy — well under ceiling.",
});
await addBilling(s05, { invoiceNumber: "INV-S05-001", invoiceDate: d("2024-03-31"), amount: 62000, billedAmount: 62000, description: "Q1 T&M services" });
await addBilling(s05, { invoiceNumber: "INV-S05-002", invoiceDate: d("2024-06-30"), amount: 65000, billedAmount: 65000, description: "Q2 T&M services" });
await addBilling(s05, { invoiceNumber: "INV-S05-003", invoiceDate: d("2024-09-30"), amount: 58000, billedAmount: 58000, description: "Q3 T&M services" });
log(`S05 created (id=${s05}) — T&M under NTE`);

// ─────────────────────────────────────────────────────────────────────────────
// S06 — T&M/IDIQ: NTE ceiling, task orders committed > ceiling (OVER-COMMITTED)
// ─────────────────────────────────────────────────────────────────────────────
const s06 = await insertContract({
  title: "S06 — IDIQ NTE: Task Orders Committed OVER NTE Ceiling",
  contractNumber: "TEST-S06",
  projectNumber: "TS-006",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ,
  ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 1000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-06-01"), endDate: d("2026-05-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S06: IDIQ with $1M NTE ceiling. Three task orders issued totaling $1.15M — OVER-COMMITTED by $150K. Alert should fire.",
});
// Task Order 1 — $400K
const s06_to1 = await insertContract({
  title: "S06-TO1 — Bridge Inspection Task Order (Authorized $400K)",
  contractNumber: "TEST-S06-TO1",
  projectNumber: "TS-006-001",
  parentContractId: s06, level: 2,
  tierLabelId: otTaskOrder.id,
  amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL",
  status: "active", value: 400000, computedContractValue: 400000,
  billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-07-01"), endDate: d("2024-06-30"),
  notes: "TO1 under S06 — $400K authorized, $320K billed.",
});
await addBilling(s06_to1, { invoiceNumber: "INV-S06-TO1-001", invoiceDate: d("2023-10-31"), amount: 160000, billedAmount: 160000, description: "TO1 Phase 1" });
await addBilling(s06_to1, { invoiceNumber: "INV-S06-TO1-002", invoiceDate: d("2024-01-31"), amount: 160000, billedAmount: 160000, description: "TO1 Phase 2" });
// Task Order 2 — $450K
const s06_to2 = await insertContract({
  title: "S06-TO2 — Structural Assessment Task Order (Authorized $450K)",
  contractNumber: "TEST-S06-TO2",
  projectNumber: "TS-006-002",
  parentContractId: s06, level: 2,
  tierLabelId: otTaskOrder.id,
  amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL",
  status: "active", value: 450000, computedContractValue: 450000,
  billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "TO2 under S06 — $450K authorized, $200K billed.",
});
await addBilling(s06_to2, { invoiceNumber: "INV-S06-TO2-001", invoiceDate: d("2024-04-30"), amount: 200000, billedAmount: 200000, description: "TO2 Phase 1" });
// Task Order 3 — $300K (this pushes total to $1.15M, over $1M ceiling)
const s06_to3 = await insertContract({
  title: "S06-TO3 — Drainage Study Task Order (Authorized $300K — EXCEEDS NTE CEILING)",
  contractNumber: "TEST-S06-TO3",
  projectNumber: "TS-006-003",
  parentContractId: s06, level: 2,
  tierLabelId: otTaskOrder.id,
  amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL",
  status: "active", value: 300000, computedContractValue: 300000,
  billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-06-01"), endDate: d("2025-12-31"),
  notes: "TO3 under S06 — $300K authorized. Combined TOs = $1.15M > $1M NTE ceiling. OVER-COMMITTED alert.",
});
log(`S06 created (id=${s06}) with 3 TOs — OVER-COMMITTED`);

// ─────────────────────────────────────────────────────────────────────────────
// S07 — T&M: Billed amount EXCEEDS NTE ceiling (OVER-BILLED vs ceiling)
// ─────────────────────────────────────────────────────────────────────────────
const s07 = await insertContract({
  title: "S07 — T&M: Billed Amount EXCEEDS NTE Ceiling (Over-Billed)",
  contractNumber: "TEST-S07",
  projectNumber: "TS-007",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 300000, billingBasis: "nte_ceiling",
  totalBilledAmount: 328500,
  isBillingOverCeiling: true,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-04-01"), endDate: d("2024-03-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S07: T&M NTE $300K. Billed $328.5K — OVER NTE CEILING by $28.5K. Critical compliance issue requiring amendment or write-down.",
});
await addBilling(s07, { invoiceNumber: "INV-S07-001", invoiceDate: d("2023-06-30"), amount: 95000, billedAmount: 95000, description: "Q1-Q2 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-002", invoiceDate: d("2023-09-30"), amount: 98000, billedAmount: 98000, description: "Q3 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-003", invoiceDate: d("2023-12-31"), amount: 87000, billedAmount: 87000, description: "Q4 T&M" });
await addBilling(s07, { invoiceNumber: "INV-S07-004", invoiceDate: d("2024-02-29"), amount: 48500, billedAmount: 48500, description: "Final billing — OVER NTE" });
log(`S07 created (id=${s07}) — OVER NTE CEILING`);

// ─────────────────────────────────────────────────────────────────────────────
// S08 — IDIQ/MSA: Level 1 with multiple Level 2 TOs, correct rollup
// ─────────────────────────────────────────────────────────────────────────────
const s08 = await insertContract({
  title: "S08 — IDIQ/MSA: Level 1 with 3 Task Orders, Correct Financial Rollup",
  contractNumber: "TEST-S08",
  projectNumber: "TS-008",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 2000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-01-01"), endDate: d("2027-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S08: IDIQ MSA with $2M NTE. Three TOs: $350K, $425K, $280K. Total committed = $1.055M. Total billed = $720K. Rollup test.",
});
const s08_to1 = await insertContract({
  title: "S08-TO1 — Route 9 Bridge Inspection (Authorized $350K)",
  contractNumber: "TEST-S08-TO1", projectNumber: "TS-008-001",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 350000, computedContractValue: 350000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-03-01"), endDate: d("2023-02-28"),
  notes: "TO1 under S08. Fully billed.",
});
await addBilling(s08_to1, { invoiceNumber: "INV-S08-TO1-001", invoiceDate: d("2022-06-30"), amount: 175000, billedAmount: 175000, description: "Phase 1" });
await addBilling(s08_to1, { invoiceNumber: "INV-S08-TO1-002", invoiceDate: d("2022-12-31"), amount: 175000, billedAmount: 175000, description: "Phase 2 — Final" });
const s08_to2 = await insertContract({
  title: "S08-TO2 — Route 35 Corridor Study (Authorized $425K)",
  contractNumber: "TEST-S08-TO2", projectNumber: "TS-008-002",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 425000, computedContractValue: 425000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-01-01"), endDate: d("2024-06-30"),
  notes: "TO2 under S08. Partially billed.",
});
await addBilling(s08_to2, { invoiceNumber: "INV-S08-TO2-001", invoiceDate: d("2023-04-30"), amount: 145000, billedAmount: 145000, description: "Phase 1" });
await addBilling(s08_to2, { invoiceNumber: "INV-S08-TO2-002", invoiceDate: d("2023-10-31"), amount: 105000, billedAmount: 105000, description: "Phase 2" });
const s08_to3 = await insertContract({
  title: "S08-TO3 — Pavement Condition Survey (Authorized $280K)",
  contractNumber: "TEST-S08-TO3", projectNumber: "TS-008-003",
  parentContractId: s08, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 280000, computedContractValue: 280000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "TO3 under S08. Early stage.",
});
await addBilling(s08_to3, { invoiceNumber: "INV-S08-TO3-001", invoiceDate: d("2024-03-31"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
log(`S08 created (id=${s08}) with 3 TOs — rollup test`);

// ─────────────────────────────────────────────────────────────────────────────
// S09 — 3-TIER: Level 1 IDIQ → Level 2 TO → Level 3 Sub-Projects
// ─────────────────────────────────────────────────────────────────────────────
const s09 = await insertContract({
  title: "S09 — 3-Tier Hierarchy: IDIQ → Task Order → Sub-Projects (Full Rollup)",
  contractNumber: "TEST-S09",
  projectNumber: "TS-009",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ,
  ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 3000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-07-01"), endDate: d("2027-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S09: Full 3-tier hierarchy. L1 IDIQ $3M NTE → L2 Task Order → L3 Sub-Projects. Rollup: L1 shows all, L2 shows L2+L3.",
});
// Level 2 Task Order
const s09_to1 = await insertContract({
  title: "S09-TO1 — Airport Roadway Improvements Task Order (Authorized $800K)",
  contractNumber: "TEST-S09-TO1", projectNumber: "TS-009-001",
  parentContractId: s09, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 800000, computedContractValue: 800000, billingBasis: "authorized",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-09-01"), endDate: d("2025-08-31"),
  notes: "TO1 under S09. Has 3 sub-projects (Level 3).",
});
// Level 3 Sub-Projects under TO1
const s09_sp1 = await insertContract({
  title: "S09-TO1-SP1 — Terminal A Approach Road (Sub-Project $250K)",
  contractNumber: "TEST-S09-TO1-SP1", projectNumber: "TS-009-001-001",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 250000, computedContractValue: 250000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-09-01"), endDate: d("2023-12-31"),
  notes: "SP1 under S09-TO1. Completed.",
});
await addBilling(s09_sp1, { invoiceNumber: "INV-S09-SP1-001", invoiceDate: d("2023-03-31"), amount: 125000, billedAmount: 125000, description: "Phase 1" });
await addBilling(s09_sp1, { invoiceNumber: "INV-S09-SP1-002", invoiceDate: d("2023-09-30"), amount: 125000, billedAmount: 125000, description: "Phase 2 — Final" });
const s09_sp2 = await insertContract({
  title: "S09-TO1-SP2 — Terminal B Connector Road (Sub-Project $310K)",
  contractNumber: "TEST-S09-TO1-SP2", projectNumber: "TS-009-001-002",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 310000, computedContractValue: 310000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-06-01"), endDate: d("2024-12-31"),
  notes: "SP2 under S09-TO1. In progress.",
});
await addBilling(s09_sp2, { invoiceNumber: "INV-S09-SP2-001", invoiceDate: d("2023-12-31"), amount: 155000, billedAmount: 155000, description: "Phase 1" });
const s09_sp3 = await insertContract({
  title: "S09-TO1-SP3 — Cargo Area Access Road (Sub-Project $240K)",
  contractNumber: "TEST-S09-TO1-SP3", projectNumber: "TS-009-001-003",
  parentContractId: s09_to1, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 240000, computedContractValue: 240000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  notes: "SP3 under S09-TO1. Early stage.",
});
await addBilling(s09_sp3, { invoiceNumber: "INV-S09-SP3-001", invoiceDate: d("2024-06-30"), amount: 80000, billedAmount: 80000, description: "Phase 1" });
log(`S09 created (id=${s09}) — 3-tier hierarchy`);

// ─────────────────────────────────────────────────────────────────────────────
// S10 — Level 2 Task Order OVER its own authorized value
// ─────────────────────────────────────────────────────────────────────────────
const s10 = await insertContract({
  title: "S10 — IDIQ: Level 2 Task Order OVER Its Own Authorized Value",
  contractNumber: "TEST-S10",
  projectNumber: "TS-010",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 1500000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S10: IDIQ $1.5M NTE. TO1 authorized $300K but billed $347K — OVER its own authorized by $47K.",
});
const s10_to1 = await insertContract({
  title: "S10-TO1 — Traffic Signal Design (Authorized $300K — OVER-BILLED at TO Level)",
  contractNumber: "TEST-S10-TO1", projectNumber: "TS-010-001",
  parentContractId: s10, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "Strans Engineering", status: "active",
  value: 300000, computedContractValue: 300000, billingBasis: "authorized",
  totalBilledAmount: 347000, isBillingOverCeiling: true,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-03-01"), endDate: d("2024-02-29"),
  notes: "TO1 over its own $300K authorized. Billed $347K. Needs amendment.",
});
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-001", invoiceDate: d("2023-06-30"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-002", invoiceDate: d("2023-10-31"), amount: 130000, billedAmount: 130000, description: "Phase 2" });
await addBilling(s10_to1, { invoiceNumber: "INV-S10-TO1-003", invoiceDate: d("2024-01-31"), amount: 97000, billedAmount: 97000, description: "Phase 3 — OVER AUTHORIZED" });
log(`S10 created (id=${s10}) — TO over authorized`);

// ─────────────────────────────────────────────────────────────────────────────
// S11 — Level 3 sub-project over its own budget
// ─────────────────────────────────────────────────────────────────────────────
const s11 = await insertContract({
  title: "S11 — 3-Tier: Level 3 Sub-Project OVER Its Own Budget",
  contractNumber: "TEST-S11",
  projectNumber: "TS-011",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN,
  ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 800000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-07-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S11: 3-tier. L3 sub-project billed over its own $150K budget.",
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
  title: "S11-TO1-SP1 — Route 17 Segment (Sub-Project $150K — OVER-BILLED)",
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
log(`S11 created (id=${s11}) — L3 sub-project over budget`);

// ─────────────────────────────────────────────────────────────────────────────
// S12 — UNBUDGETED Level 2 (no value set, billing exists)
// ─────────────────────────────────────────────────────────────────────────────
const s12 = await insertContract({
  title: "S12 — IDIQ: Unbudgeted Task Order (No Value Set, Billing Exists)",
  contractNumber: "TEST-S12",
  projectNumber: "TS-012",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX,
  ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 600000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S12: IDIQ with one unbudgeted TO (value=0, billing=$45K). Should flag as unbudgeted.",
});
const s12_to1 = await insertContract({
  title: "S12-TO1 — Emergency Drainage Repair (UNBUDGETED — value $0, billed $45K)",
  contractNumber: "TEST-S12-TO1", projectNumber: "TS-012-001",
  parentContractId: s12, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "Middlesex County", performingCompanyName: "JPCL", status: "active",
  value: 0, computedContractValue: 0, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-03-01"), endDate: d("2024-09-30"),
  notes: "UNBUDGETED TO — no authorized value set. Emergency work commenced before TO was formally priced.",
});
await addBilling(s12_to1, { invoiceNumber: "INV-S12-TO1-001", invoiceDate: d("2024-04-30"), amount: 22000, billedAmount: 22000, description: "Emergency work week 1-4" });
await addBilling(s12_to1, { invoiceNumber: "INV-S12-TO1-002", invoiceDate: d("2024-06-30"), amount: 23000, billedAmount: 23000, description: "Emergency work week 5-8" });
log(`S12 created (id=${s12}) — unbudgeted TO`);

// ─────────────────────────────────────────────────────────────────────────────
// S13 — Change Orders push contract OVER original value
// ─────────────────────────────────────────────────────────────────────────────
const s13 = await insertContract({
  title: "S13 — Change Orders: Multiple COs Push Contract Over Original Value",
  contractNumber: "TEST-S13",
  projectNumber: "TS-013",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 400000, computedContractValue: 512000,
  billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-05-01"), endDate: d("2025-04-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S13: Original $400K. Three change orders add $112K total. Authorized = $512K. Billed $380K (74%). Under authorized.",
});
await addAmendment(s13, { amendmentNumber: "CO-001", amendmentType: "change_order", amount: 45000, amountBehavior: "adds_to_value", amountChange: 45000, description: "Additional subsurface investigation", amendmentDate: d("2023-08-15"), approvalStatus: "approved" });
await addAmendment(s13, { amendmentNumber: "CO-002", amendmentType: "change_order", amount: 38000, amountBehavior: "adds_to_value", amountChange: 38000, description: "Utility conflict resolution design", amendmentDate: d("2024-01-20"), approvalStatus: "approved" });
await addAmendment(s13, { amendmentNumber: "CO-003", amendmentType: "change_order", amount: 29000, amountBehavior: "adds_to_value", amountChange: 29000, description: "Extended construction inspection period", amendmentDate: d("2024-06-01"), approvalStatus: "approved" });
await addBilling(s13, { invoiceNumber: "INV-S13-001", invoiceDate: d("2023-08-31"), amount: 120000, billedAmount: 120000, description: "Phase 1" });
await addBilling(s13, { invoiceNumber: "INV-S13-002", invoiceDate: d("2023-12-31"), amount: 130000, billedAmount: 130000, description: "Phase 2" });
await addBilling(s13, { invoiceNumber: "INV-S13-003", invoiceDate: d("2024-05-31"), amount: 130000, billedAmount: 130000, description: "Phase 3" });
log(`S13 created (id=${s13}) — multiple COs`);

// ─────────────────────────────────────────────────────────────────────────────
// S14 — Change Order DEDUCTS scope, net value below original
// ─────────────────────────────────────────────────────────────────────────────
const s14 = await insertContract({
  title: "S14 — Change Order: CO Deducts Scope, Net Value Below Original",
  contractNumber: "TEST-S14",
  projectNumber: "TS-014",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "active", level: 1,
  value: 350000, computedContractValue: 295000,
  billingBasis: "authorized",
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S14: Original $350K. CO-001 deducts $55K (Phase 3 deleted). Net = $295K. Billed $180K.",
});
await addAmendment(s14, { amendmentNumber: "CO-001", amendmentType: "change_order", amount: -55000, amountBehavior: "subtracts_from_value", amountChange: 55000, description: "Delete Phase 3 — Intersection Improvement (client budget cut)", amendmentDate: d("2024-04-01"), approvalStatus: "approved" });
await addBilling(s14, { invoiceNumber: "INV-S14-001", invoiceDate: d("2024-04-30"), amount: 90000, billedAmount: 90000, description: "Phase 1" });
await addBilling(s14, { invoiceNumber: "INV-S14-002", invoiceDate: d("2024-08-31"), amount: 90000, billedAmount: 90000, description: "Phase 2" });
log(`S14 created (id=${s14}) — CO deducts scope`);

// ─────────────────────────────────────────────────────────────────────────────
// S15 — NTE Ceiling EXHAUSTED — new TO would exceed ceiling
// ─────────────────────────────────────────────────────────────────────────────
const s15 = await insertContract({
  title: "S15 — NTE Ceiling EXHAUSTED: Available NTE = $0, New TO Cannot Be Issued",
  contractNumber: "TEST-S15",
  projectNumber: "TS-015",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ,
  ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 750000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2021-01-01"), endDate: d("2025-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S15: NTE $750K. TOs committed = $750K exactly. Available = $0. Any new TO would exceed ceiling.",
});
const s15_to1 = await insertContract({
  title: "S15-TO1 — Runway Lighting Study ($350K — Committed)",
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
  title: "S15-TO2 — Terminal Signage Program ($400K — NTE NOW EXHAUSTED)",
  contractNumber: "TEST-S15-TO2", projectNumber: "TS-015-002",
  parentContractId: s15, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "PANYNJ", performingCompanyName: "JPCL", status: "active",
  value: 400000, computedContractValue: 400000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2023-01-01"), endDate: d("2025-06-30"),
  notes: "TO2 — $400K. Combined with TO1 = $750K = NTE ceiling. No more TOs can be issued.",
});
await addBilling(s15_to2, { invoiceNumber: "INV-S15-TO2-001", invoiceDate: d("2023-06-30"), amount: 200000, billedAmount: 200000, description: "Phase 1" });
log(`S15 created (id=${s15}) — NTE exhausted`);

// ─────────────────────────────────────────────────────────────────────────────
// S16 — Compliance: COI required but NOT received
// ─────────────────────────────────────────────────────────────────────────────
const s16 = await insertContract({
  title: "S16 — Compliance: COI Required But NOT Received (Blocker)",
  contractNumber: "TEST-S16",
  projectNumber: "TS-016",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 175000, computedContractValue: 175000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-06-01"), endDate: d("2025-05-31"),
  coiRequired: true, coiReceived: false, hasCOI: false,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S16: COI required but not received. Should show BLOCKER compliance flag. Work should not proceed until COI is on file.",
});
log(`S16 created (id=${s16}) — COI missing`);

// ─────────────────────────────────────────────────────────────────────────────
// S17 — Compliance: Executed contract NOT on file
// ─────────────────────────────────────────────────────────────────────────────
const s17 = await insertContract({
  title: "S17 — Compliance: Executed Contract NOT On File (Warning)",
  contractNumber: "TEST-S17",
  projectNumber: "TS-017",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN,
  ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "active", level: 1,
  value: 220000, computedContractValue: 220000, billingBasis: "authorized",
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-04-01"), endDate: d("2025-03-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: false, hasSignedContract: false,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S17: COI on file. But executed/signed contract has NOT been received. WARN flag.",
});
log(`S17 created (id=${s17}) — executed contract missing`);

// ─────────────────────────────────────────────────────────────────────────────
// S18 — Compliance: Prime agreement required but missing
// ─────────────────────────────────────────────────────────────────────────────
const s18 = await insertContract({
  title: "S18 — Compliance: Prime Agreement Required But NOT On File (Sub Role)",
  contractNumber: "TEST-S18",
  projectNumber: "TS-018",
  clientName: "Parsons Transportation", clientOrgId: ORG_PARSONS,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  primeOrgId: ORG_PARSONS,
  status: "active", level: 1,
  value: 380000, computedContractValue: 380000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-02-01"), endDate: d("2025-07-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  primeAgreementRequired: true, primeAgreementOnFile: false,
  clientBillingInfoOnFile: false,
  notes: "TEST SCENARIO S18: JPCL is subconsultant to Parsons. Prime agreement required but not on file. Client billing info also missing.",
});
log(`S18 created (id=${s18}) — prime agreement missing`);

// ─────────────────────────────────────────────────────────────────────────────
// S19 — Compliance: ALL flags missing (worst case)
// ─────────────────────────────────────────────────────────────────────────────
const s19 = await insertContract({
  title: "S19 — Compliance: ALL Flags Missing — Worst Case Scenario",
  contractNumber: "TEST-S19",
  projectNumber: "TS-019",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 450000, computedContractValue: 450000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-07-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: false, hasCOI: false,
  fullyExecutedContractReceived: false, hasSignedContract: false,
  primeAgreementRequired: true, primeAgreementOnFile: false,
  clientBillingInfoOnFile: false,
  notes: "TEST SCENARIO S19: WORST CASE — COI missing, executed contract missing, prime agreement missing, billing info missing. All 4 compliance blockers active.",
});
log(`S19 created (id=${s19}) — ALL compliance flags missing`);

// ─────────────────────────────────────────────────────────────────────────────
// S20-S24 — Status lifecycle scenarios
// ─────────────────────────────────────────────────────────────────────────────
const s20 = await insertContract({
  title: "S20 — Status: DRAFT — Awarded, Not Yet Activated",
  contractNumber: "TEST-S20", projectNumber: "TS-020",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX,
  ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "draft", level: 1,
  value: 195000, computedContractValue: 195000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-10-01"), endDate: d("2025-09-30"),
  notes: "TEST SCENARIO S20: Draft contract. Awarded but not yet executed or activated in timekeeping.",
});
log(`S20 created (id=${s20}) — DRAFT`);

const s21 = await insertContract({
  title: "S21 — Status: NEGOTIATION — In Active Contract Negotiation",
  contractNumber: "TEST-S21", projectNumber: "TS-021",
  clientName: "PANYNJ", clientOrgId: ORG_PANYNJ,
  ownerName: "PANYNJ", ownerOrgId: ORG_PANYNJ,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "negotiation", level: 1,
  value: 620000, computedContractValue: 620000, billingBasis: "authorized",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2025-01-01"), endDate: d("2026-12-31"),
  notes: "TEST SCENARIO S21: In negotiation. Scope and fee being finalized with client. No billing yet.",
});
log(`S21 created (id=${s21}) — NEGOTIATION`);

const s22 = await insertContract({
  title: "S22 — Status: ON HOLD — Work Suspended by Client",
  contractNumber: "TEST-S22", projectNumber: "TS-022",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "on_hold", level: 1,
  value: 310000, computedContractValue: 310000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2023-03-01"), endDate: d("2025-02-28"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S22: On hold. Client suspended work due to funding delay. $145K billed before suspension.",
});
await addBilling(s22, { invoiceNumber: "INV-S22-001", invoiceDate: d("2023-06-30"), amount: 75000, billedAmount: 75000, description: "Phase 1" });
await addBilling(s22, { invoiceNumber: "INV-S22-002", invoiceDate: d("2023-10-31"), amount: 70000, billedAmount: 70000, description: "Phase 2 — work suspended after this invoice" });
log(`S22 created (id=${s22}) — ON HOLD`);

const s23 = await insertContract({
  title: "S23 — Status: COMPLETED — Fully Closed Out, Final Invoice Paid",
  contractNumber: "TEST-S23", projectNumber: "TS-023",
  clientName: "Bergen County", clientOrgId: ORG_BERGEN,
  ownerName: "Bergen County", ownerOrgId: ORG_BERGEN,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "completed", level: 1,
  value: 165000, computedContractValue: 165000, billingBasis: "authorized",
  totalBilledAmount: 165000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_CHEN,
  startDate: d("2022-01-01"), endDate: d("2023-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S23: Completed. Fully billed to $165K. Final invoice paid. Contract closed.",
});
await addBilling(s23, { invoiceNumber: "INV-S23-001", invoiceDate: d("2022-06-30"), amount: 55000, billedAmount: 55000, description: "Phase 1" });
await addBilling(s23, { invoiceNumber: "INV-S23-002", invoiceDate: d("2022-12-31"), amount: 55000, billedAmount: 55000, description: "Phase 2" });
await addBilling(s23, { invoiceNumber: "INV-S23-003", invoiceDate: d("2023-05-31"), amount: 55000, billedAmount: 55000, description: "Phase 3 — Final" });
log(`S23 created (id=${s23}) — COMPLETED`);

const s24 = await insertContract({
  title: "S24 — Status: TERMINATED — Terminated for Convenience, Partial Payment",
  contractNumber: "TEST-S24", projectNumber: "TS-024",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "terminated", level: 1,
  value: 480000, computedContractValue: 480000, billingBasis: "authorized",
  totalBilledAmount: 127000,
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-01-01"), endDate: d("2024-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S24: Terminated for convenience at 26% completion. $127K billed of $480K authorized. Termination settlement pending.",
});
await addBilling(s24, { invoiceNumber: "INV-S24-001", invoiceDate: d("2023-04-30"), amount: 65000, billedAmount: 65000, description: "Phase 1" });
await addBilling(s24, { invoiceNumber: "INV-S24-002", invoiceDate: d("2023-08-31"), amount: 62000, billedAmount: 62000, description: "Phase 2 — final before termination" });
log(`S24 created (id=${s24}) — TERMINATED`);

// ─────────────────────────────────────────────────────────────────────────────
// S25 — Multi-entity: JPCL prime, Strans sub (primeOrgId set)
// ─────────────────────────────────────────────────────────────────────────────
const s25 = await insertContract({
  title: "S25 — Multi-Entity: JPCL Prime, Strans Subconsultant (primeOrgId Set)",
  contractNumber: "TEST-S25", projectNumber: "TS-025",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 850000, computedContractValue: 850000, billingBasis: "authorized",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-01-01"), endDate: d("2026-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S25: JPCL is prime. Strans is subconsultant. Both entities visible in hierarchy.",
});
// Strans sub-contract under JPCL prime
const s25_sub = await insertContract({
  title: "S25-SUB — Strans Subconsultant Scope (Traffic Engineering, $180K)",
  contractNumber: "TEST-S25-SUB", projectNumber: "TS-025-SUB",
  parentContractId: s25, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "adds_to_parent",
  clientName: "JPCL", performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  primeOrgId: ORG_PARSONS,
  status: "active", value: 180000, computedContractValue: 180000, billingBasis: "authorized",
  projectManagerId: PM_VASQUEZ, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-02-01"), endDate: d("2026-06-30"),
  notes: "Strans sub-scope under JPCL prime contract S25. Traffic engineering deliverables.",
});
await addBilling(s25_sub, { invoiceNumber: "INV-S25-SUB-001", invoiceDate: d("2024-06-30"), amount: 60000, billedAmount: 60000, description: "Traffic study Phase 1" });
log(`S25 created (id=${s25}) — multi-entity`);

// ─────────────────────────────────────────────────────────────────────────────
// S26 — Retainage: 10% retainage held on all invoices
// ─────────────────────────────────────────────────────────────────────────────
const s26 = await insertContract({
  title: "S26 — Retainage: 10% Retainage Held on All Invoices",
  contractNumber: "TEST-S26", projectNumber: "TS-026",
  clientName: "NYC DDC", clientOrgId: ORG_DDC,
  ownerName: "NYC DDC", ownerOrgId: ORG_DDC,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 320000, computedContractValue: 320000, billingBasis: "authorized",
  totalBilledAmount: 240000, retainageAmount: 24000,
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2024-01-01"), endDate: d("2025-06-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S26: 10% retainage on all invoices. Billed $240K gross, $24K held as retainage. Net received = $216K.",
});
await addBilling(s26, { invoiceNumber: "INV-S26-001", invoiceDate: d("2024-03-31"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 1 (10% retainage held)" });
await addBilling(s26, { invoiceNumber: "INV-S26-002", invoiceDate: d("2024-06-30"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 2 (10% retainage held)" });
await addBilling(s26, { invoiceNumber: "INV-S26-003", invoiceDate: d("2024-09-30"), amount: 80000, billedAmount: 80000, retainageAmount: 8000, description: "Phase 3 (10% retainage held)" });
log(`S26 created (id=${s26}) — retainage`);

// ─────────────────────────────────────────────────────────────────────────────
// S27 — Zero-dollar amendment (scope change, no cost impact)
// ─────────────────────────────────────────────────────────────────────────────
const s27 = await insertContract({
  title: "S27 — Zero-Dollar Amendment: Scope Change, No Cost Impact",
  contractNumber: "TEST-S27", projectNumber: "TS-027",
  clientName: "Middlesex County", clientOrgId: ORG_MIDDLESEX,
  ownerName: "Middlesex County", ownerOrgId: ORG_MIDDLESEX,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 145000, computedContractValue: 145000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_CHEN,
  startDate: d("2024-05-01"), endDate: d("2025-04-30"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S27: $0 amendment — scope substitution (replace one deliverable with another of equal value). No financial impact.",
});
await addAmendment(s27, { amendmentNumber: "A001", amendmentType: "amendment", amount: 0, amountBehavior: "adds_to_value", amountChange: 0, description: "Scope substitution: Replace Deliverable 3A (traffic count) with Deliverable 3B (turning movement count) — no cost change", amendmentDate: d("2024-07-15"), approvalStatus: "approved" });
await addBilling(s27, { invoiceNumber: "INV-S27-001", invoiceDate: d("2024-07-31"), amount: 48000, billedAmount: 48000, description: "Phase 1" });
log(`S27 created (id=${s27}) — zero-dollar amendment`);

// ─────────────────────────────────────────────────────────────────────────────
// S28 — Negative billing entry (credit memo / correction)
// ─────────────────────────────────────────────────────────────────────────────
const s28 = await insertContract({
  title: "S28 — Negative Billing: Credit Memo / Invoice Correction",
  contractNumber: "TEST-S28", projectNumber: "TS-028",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  status: "active", level: 1,
  value: 275000, computedContractValue: 275000, billingBasis: "authorized",
  totalBilledAmount: 118000,
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2024-02-01"), endDate: d("2025-07-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  notes: "TEST SCENARIO S28: Invoice 001 had an error ($15K over-billed). Credit memo CM-001 corrects it. Net billed = $118K.",
});
await addBilling(s28, { invoiceNumber: "INV-S28-001", invoiceDate: d("2024-04-30"), amount: 85000, billedAmount: 85000, description: "Phase 1 (contains $15K billing error)" });
await addBilling(s28, { invoiceNumber: "CM-S28-001", invoiceDate: d("2024-05-15"), amount: -15000, billedAmount: -15000, description: "CREDIT MEMO — correction of INV-S28-001 over-billing" });
await addBilling(s28, { invoiceNumber: "INV-S28-002", invoiceDate: d("2024-07-31"), amount: 48000, billedAmount: 48000, description: "Phase 2" });
log(`S28 created (id=${s28}) — credit memo`);

// ─────────────────────────────────────────────────────────────────────────────
// S29 — Large IDIQ: 5 TOs, 3 with sub-projects, full rollup
// ─────────────────────────────────────────────────────────────────────────────
const s29 = await insertContract({
  title: "S29 — Large IDIQ: 5 Task Orders, 3 with Sub-Projects, Full 3-Tier Rollup",
  contractNumber: "TEST-S29", projectNumber: "TS-029",
  clientName: "NJDOT", clientOrgId: ORG_NJDOT,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "JPCL", performingCompanyId: JPCL_ID,
  status: "active", level: 1,
  value: 0, computedContractValue: 0,
  hasNteCeiling: true, nteCeilingAmount: 5000000, billingBasis: "nte_ceiling",
  structureType: "CONTRACT_HAS_SUBPROJECTS",
  projectManagerId: PM_TORRES, projectAccountantId: ACCT_RUSSO,
  startDate: d("2020-01-01"), endDate: d("2030-12-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S29: Large IDIQ $5M NTE. 5 TOs, 3 have sub-projects. Tests full 3-tier rollup at scale.",
});
// TO1 — simple, no subs
const s29_to1 = await insertContract({
  title: "S29-TO1 — Statewide Bridge Inspection ($600K, No Sub-Projects)",
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
  title: "S29-TO2 — Route 1 Corridor Improvements ($900K, Has Sub-Projects)",
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
  title: "S29-TO2-SP1 — Route 1 North Segment ($420K)",
  contractNumber: "TEST-S29-TO2-SP1", projectNumber: "TS-029-002-001",
  parentContractId: s29_to2, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 420000, computedContractValue: 420000, billingBasis: "authorized",
  projectManagerId: PM_KIM, projectAccountantId: ACCT_RUSSO,
  startDate: d("2021-06-01"), endDate: d("2023-05-31"),
  notes: "SP1 under S29-TO2.",
});
await addBilling(s29_to2_sp1, { invoiceNumber: "INV-S29-TO2-SP1-001", invoiceDate: d("2022-03-31"), amount: 210000, billedAmount: 210000, description: "Phase 1" });
await addBilling(s29_to2_sp1, { invoiceNumber: "INV-S29-TO2-SP1-002", invoiceDate: d("2022-12-31"), amount: 210000, billedAmount: 210000, description: "Phase 2 — Final" });
const s29_to2_sp2 = await insertContract({
  title: "S29-TO2-SP2 — Route 1 South Segment ($480K)",
  contractNumber: "TEST-S29-TO2-SP2", projectNumber: "TS-029-002-002",
  parentContractId: s29_to2, level: 3, tierLabelId: otPhase.id, amountBehavior: "adds_to_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 480000, computedContractValue: 480000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2022-06-01"), endDate: d("2024-05-31"),
  notes: "SP2 under S29-TO2.",
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
  notes: "TO3 — no sub-projects.",
});
await addBilling(s29_to3, { invoiceNumber: "INV-S29-TO3-001", invoiceDate: d("2023-06-30"), amount: 150000, billedAmount: 150000, description: "Phase 1" });
await addBilling(s29_to3, { invoiceNumber: "INV-S29-TO3-002", invoiceDate: d("2023-12-31"), amount: 150000, billedAmount: 150000, description: "Phase 2" });
// TO4 — with 1 sub-project
const s29_to4 = await insertContract({
  title: "S29-TO4 — Pedestrian Safety Improvements ($550K, Has Sub-Project)",
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
  notes: "SP1 under S29-TO4.",
});
await addBilling(s29_to4_sp1, { invoiceNumber: "INV-S29-TO4-SP1-001", invoiceDate: d("2024-09-30"), amount: 100000, billedAmount: 100000, description: "Phase 1" });
// TO5 — simple, just started
const s29_to5 = await insertContract({
  title: "S29-TO5 — ADA Transition Plan ($380K, Just Started)",
  contractNumber: "TEST-S29-TO5", projectNumber: "TS-029-005",
  parentContractId: s29, level: 2, tierLabelId: otTaskOrder.id, amountBehavior: "utilizes_parent",
  clientName: "NJDOT", performingCompanyName: "JPCL", status: "active",
  value: 380000, computedContractValue: 380000, billingBasis: "authorized",
  projectManagerId: PM_NGUYEN, projectAccountantId: ACCT_RUSSO,
  startDate: d("2025-01-01"), endDate: d("2026-12-31"),
  notes: "TO5 — just started, no billing yet.",
});
log(`S29 created (id=${s29}) — large IDIQ with 5 TOs`);

// ─────────────────────────────────────────────────────────────────────────────
// S30 — Cost-Plus: billing exceeds authorized (no ceiling)
// ─────────────────────────────────────────────────────────────────────────────
const s30 = await insertContract({
  title: "S30 — Cost-Plus: Billing Exceeds Authorized Value (No Ceiling Contract)",
  contractNumber: "TEST-S30", projectNumber: "TS-030",
  clientName: "WSP USA", clientOrgId: ORG_WSP,
  ownerName: "NJDOT", ownerOrgId: ORG_NJDOT,
  performingCompanyName: "Strans Engineering", performingCompanyId: STRANS_ID,
  primeOrgId: ORG_WSP,
  status: "active", level: 1,
  value: 225000, computedContractValue: 225000, billingBasis: "authorized",
  totalBilledAmount: 248000, isBillingOverCeiling: true,
  projectManagerId: PM_OKAFOR, projectAccountantId: ACCT_DIALLO,
  startDate: d("2023-09-01"), endDate: d("2025-08-31"),
  coiRequired: true, coiReceived: true, hasCOI: true,
  fullyExecutedContractReceived: true, hasSignedContract: true,
  primeAgreementRequired: true, primeAgreementOnFile: true, primeAgreementDate: d("2023-08-15"),
  clientBillingInfoOnFile: true,
  notes: "TEST SCENARIO S30: Cost-plus sub to WSP. No NTE ceiling. Billed $248K against $225K authorized. Over by $23K — needs amendment from prime.",
});
await addAmendment(s30, { amendmentNumber: "A001", amendmentType: "amendment", amount: 25000, amountBehavior: "adds_to_value", amountChange: 25000, description: "Additional geotechnical investigation — cost overrun approved by WSP", amendmentDate: d("2024-06-01"), approvalStatus: "pending" });
await addBilling(s30, { invoiceNumber: "INV-S30-001", invoiceDate: d("2023-12-31"), amount: 85000, billedAmount: 85000, description: "Q4 2023 cost-plus billing" });
await addBilling(s30, { invoiceNumber: "INV-S30-002", invoiceDate: d("2024-03-31"), amount: 90000, billedAmount: 90000, description: "Q1 2024 cost-plus billing" });
await addBilling(s30, { invoiceNumber: "INV-S30-003", invoiceDate: d("2024-06-30"), amount: 73000, billedAmount: 73000, description: "Q2 2024 — OVER AUTHORIZED" });
log(`S30 created (id=${s30}) — cost-plus over authorized`);

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log("\n[5/7] Counting inserted records…");
const contractCount = await db.select({ id: contracts.id }).from(contracts);
const amendmentCount = await db.select({ id: contractAmendments.id }).from(contractAmendments);
const billingCount = await db.select({ id: billingEntries.id }).from(billingEntries);
console.log(`  Contracts: ${contractCount.length}`);
console.log(`  Amendments: ${amendmentCount.length}`);
console.log(`  Billing entries: ${billingCount.length}`);

console.log("\n✅ Contract test bed seeded successfully!");
console.log("\nScenario Index:");
console.log("  S01  Lump Sum — Clean, on-budget, all compliance green");
console.log("  S02  Lump Sum — Amendment adds scope, under budget");
console.log("  S03  Lump Sum — Multiple amendments, OVERBILLED");
console.log("  S04  Lump Sum — Deduct amendment reduces value");
console.log("  S05  T&M — Under NTE ceiling, normal billing");
console.log("  S06  IDIQ NTE — Task orders OVER-COMMITTED vs ceiling");
console.log("  S07  T&M — Billed OVER NTE ceiling");
console.log("  S08  IDIQ — 3 TOs, correct L1 rollup");
console.log("  S09  3-Tier — IDIQ → TO → Sub-Projects, full rollup");
console.log("  S10  IDIQ — Level 2 TO over its own authorized value");
console.log("  S11  3-Tier — Level 3 sub-project over its own budget");
console.log("  S12  IDIQ — Unbudgeted TO (value=0, billing exists)");
console.log("  S13  Change Orders — Multiple COs push over original value");
console.log("  S14  Change Order — CO deducts scope, net below original");
console.log("  S15  NTE Ceiling — Exhausted, no room for new TOs");
console.log("  S16  Compliance — COI required, NOT received (BLOCKER)");
console.log("  S17  Compliance — Executed contract NOT on file");
console.log("  S18  Compliance — Prime agreement required, missing");
console.log("  S19  Compliance — ALL 4 flags missing (worst case)");
console.log("  S20  Status: DRAFT");
console.log("  S21  Status: NEGOTIATION");
console.log("  S22  Status: ON HOLD");
console.log("  S23  Status: COMPLETED");
console.log("  S24  Status: TERMINATED");
console.log("  S25  Multi-entity — JPCL prime, Strans sub");
console.log("  S26  Retainage — 10% held on all invoices");
console.log("  S27  Zero-dollar amendment — scope change, no cost");
console.log("  S28  Negative billing — credit memo / correction");
console.log("  S29  Large IDIQ — 5 TOs, 3 with sub-projects");
console.log("  S30  Cost-Plus — billing exceeds authorized, no ceiling");

await connection.end();
process.exit(0);
