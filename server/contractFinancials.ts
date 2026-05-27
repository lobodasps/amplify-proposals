/**
 * Contract Financial Model — server-side calculation helper
 *
 * Implements all 15 rules (R1–R15) from docs/contract-financial-model.md
 *
 * Two billing modes:
 *  - AUTHORIZED  (Task Order model): children commit value against the NTE ceiling.
 *                 Authorized Value = Σ child computedContractValue.
 *                 Over-ceiling = billed > NTE ceiling.
 *  - NTE_CEILING (On-Call / Direct Bill): no child orders issued; invoices are
 *                 billed directly against the ceiling.
 *                 Authorized Value = ceiling itself.
 *                 Over-ceiling = billed > NTE ceiling.
 *
 * For non-NTE contracts (hasNteCeiling = false):
 *  - computedContractValue = initialAmount ± ADDS/SUBTRACTS amendments (R1)
 *  - Over-ceiling = billed > computedContractValue (R7)
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { contracts, contractAmendments, billingEntries } from "../drizzle/schema";

export interface ContractFinancialsResult {
  // Core values
  initialAmount: number;
  effectiveCeiling: number | null;      // null when hasNteCeiling = false
  computedContractValue: number;        // authorized value (ceiling or initial ± amendments)
  authorizedValue: number;             // for display: ceiling (NTE) or computedContractValue (non-NTE)

  // NTE-specific (only meaningful when hasNteCeiling = true)
  ceilingCommittedByChildren: number;  // Σ child computedContractValue (AUTHORIZED mode)
  ceilingAvailable: number;            // effectiveCeiling − ceilingCommittedByChildren (AUTHORIZED)
                                       // effectiveCeiling − billedToDate (NTE_CEILING mode)

  // Billing
  billedToDate: number;
  retainageAmount: number;
  remaining: number;                   // computedContractValue − billedToDate (non-NTE)
                                       // effectiveCeiling − billedToDate (NTE)

  // Flags
  isBillingOverCeiling: boolean;
  hasOverBilledChildren: boolean;      // any child where billed > child.computedContractValue
  billingPercentage: number;           // round(billed / ceiling * 100)

  // Burn-rate analytics (NTE contracts only)
  avgMonthlyBurn: number | null;
  projectedExhaustionDate: Date | null;
  daysRemaining: number | null;

  // Child summary
  childCount: number;
  billingBasis: string;
  hasNteCeiling: boolean;
}

export async function getContractFinancials(
  contractId: number
): Promise<ContractFinancialsResult | null> {
  const db = await getDb();
  if (!db) return null;

  // Load contract
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  if (!contract) return null;

  const billingBasis = contract.billingBasis ?? "authorized";
  const hasNTE = contract.hasNteCeiling ?? false;
  const nteCeilingAmount = contract.nteCeilingAmount ?? 0;
  const initialAmount = contract.value ?? 0;

  // Load amendments for this contract
  const amendments = await db
    .select()
    .from(contractAmendments)
    .where(eq(contractAmendments.contractId, contractId));

  // Compute adds and subtracts from amendments (R1, R2, R15)
  let addsTotal = 0;
  let subtractsTotal = 0;
  for (const a of amendments) {
    const behavior = a.amountBehavior ?? "adds_to_value";
    const magnitude = a.amountChange != null ? Math.abs(a.amountChange) : Math.abs(a.amount ?? 0);
    if (behavior === "adds_to_value") addsTotal += magnitude;
    else if (behavior === "subtracts_from_value") subtractsTotal += magnitude;
    // Legacy: if amountBehavior not set but amount is negative, treat as subtraction
    else if ((a.amount ?? 0) < 0) subtractsTotal += Math.abs(a.amount ?? 0);
    else addsTotal += Math.abs(a.amount ?? 0);
  }

  // Effective ceiling (R2, R15): ADDS/SUBTRACTS change the ceiling; no other amendment type does
  const effectiveCeiling = hasNTE ? nteCeilingAmount + addsTotal - subtractsTotal : null;

  // computedContractValue (R1 non-NTE, R2 NTE)
  const computedContractValue = hasNTE
    ? (effectiveCeiling ?? 0)
    : initialAmount + addsTotal - subtractsTotal;

  // Load direct children
  const children = await db
    .select()
    .from(contracts)
    .where(eq(contracts.parentContractId, contractId));

  const childCount = children.length;

  // Ceiling committed by children (AUTHORIZED mode only — R4 analog)
  const ceilingCommittedByChildren = children.reduce(
    (sum, c) => sum + (c.computedContractValue ?? c.value ?? 0),
    0
  );

  // Billed to date
  // For NTE_CEILING (on-call): use contract.totalBilledAmount (QB feed / billing entries)
  // For AUTHORIZED (task order): roll up billed from children (R4 analog)
  let billedToDate: number;
  if (hasNTE && billingBasis === "authorized") {
    // Roll up from children
    billedToDate = children.reduce(
      (sum, c) => sum + (c.totalBilledAmount ?? 0),
      0
    );
  } else {
    // Direct billing (on-call) or non-NTE: use contract's own totalBilledAmount
    billedToDate = contract.totalBilledAmount ?? 0;
  }

  // Retainage
  const retainageAmount = contract.retainageAmount ?? 0;

  // Remaining (R6)
  const ceiling = effectiveCeiling ?? computedContractValue;
  const remaining = ceiling - billedToDate;

  // Available for new orders
  let ceilingAvailable: number;
  if (hasNTE && billingBasis === "authorized") {
    // Available = ceiling − committed by children
    ceilingAvailable = (effectiveCeiling ?? 0) - ceilingCommittedByChildren;
  } else if (hasNTE && billingBasis === "nte_ceiling") {
    // On-call: available = ceiling − billed
    ceilingAvailable = (effectiveCeiling ?? 0) - billedToDate;
  } else {
    ceilingAvailable = 0;
  }

  // Over-ceiling check (R7)
  // Always compare billed against the NTE ceiling (not authorized value) when hasNTE
  const isBillingOverCeiling = hasNTE
    ? billedToDate > (effectiveCeiling ?? 0)
    : billedToDate > computedContractValue;

  // Over-billed children (R8 analog): any child where billed > child authorized
  const hasOverBilledChildren = children.some(
    (c) => (c.totalBilledAmount ?? 0) > (c.computedContractValue ?? c.value ?? 0)
  );

  // Billing percentage (R9): always against ceiling when NTE
  const denominator = hasNTE ? (effectiveCeiling ?? 0) : computedContractValue;
  const billingPercentage = denominator > 0 ? Math.round((billedToDate / denominator) * 100) : 0;

  // Authorized value for display
  const authorizedValue = hasNTE
    ? (billingBasis === "authorized" ? ceilingCommittedByChildren : (effectiveCeiling ?? 0))
    : computedContractValue;

  // Burn-rate analytics (NTE contracts only)
  let avgMonthlyBurn: number | null = null;
  let projectedExhaustionDate: Date | null = null;
  let daysRemaining: number | null = null;

  if (hasNTE && contract.startDate && billedToDate > 0) {
    const startMs = new Date(contract.startDate).getTime();
    const nowMs = Date.now();
    const monthsElapsed = (nowMs - startMs) / (1000 * 60 * 60 * 24 * 30.44);
    if (monthsElapsed > 0) {
      avgMonthlyBurn = billedToDate / monthsElapsed;
      const ceilForBurn = effectiveCeiling ?? 0;
      if (avgMonthlyBurn > 0 && ceilForBurn > billedToDate) {
        const monthsLeft = (ceilForBurn - billedToDate) / avgMonthlyBurn;
        projectedExhaustionDate = new Date(nowMs + monthsLeft * 30.44 * 24 * 60 * 60 * 1000);
      }
    }
  }

  if (contract.endDate) {
    const endMs = new Date(contract.endDate).getTime();
    daysRemaining = Math.max(0, Math.round((endMs - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  return {
    initialAmount,
    effectiveCeiling,
    computedContractValue,
    authorizedValue,
    ceilingCommittedByChildren,
    ceilingAvailable,
    billedToDate,
    retainageAmount,
    remaining,
    isBillingOverCeiling,
    hasOverBilledChildren,
    billingPercentage,
    avgMonthlyBurn,
    projectedExhaustionDate,
    daysRemaining,
    childCount,
    billingBasis,
    hasNteCeiling: hasNTE,
  };
}

/**
 * Persist the computed financials back to the contract row so the list view
 * and other queries always see up-to-date KPIs without re-computing.
 */
export async function persistContractFinancials(contractId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const fin = await getContractFinancials(contractId);
  if (!fin) return;

  await db
    .update(contracts)
    .set({
      computedContractValue: fin.computedContractValue,
      totalBilledAmount: fin.billedToDate,
      billingPercentage: fin.billingPercentage,
      isBillingOverCeiling: fin.isBillingOverCeiling,
    } as any)
    .where(eq(contracts.id, contractId));
}
