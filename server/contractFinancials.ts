/**
 * Contract Financial Model — server-side calculation helper
 *
 * Three-tier recursive rollup:
 *   Level 1 (root): financials represent L1 own + all L2 + all L3 beneath it
 *   Level 2 (mid):  financials represent L2 own + all L3 beneath it
 *   Level 3 (leaf): financials represent L3 own only
 *
 * Child amountBehavior on contracts:
 *   independent          — child value is standalone; does NOT roll up into parent
 *   adds_to_parent       — child value adds to parent authorized value
 *   subtracts_from_parent — child value reduces parent authorized value
 *   utilizes_parent      — child draws from parent NTE ceiling (AUTHORIZED mode)
 *
 * Amendment amountBehavior:
 *   adds_to_value        — increases authorized value / ceiling
 *   subtracts_from_value — decreases authorized value / ceiling
 *
 * Two billing modes (billingBasis on root NTE contracts):
 *   authorized  — children commit value against the NTE ceiling
 *   nte_ceiling — on-call/direct-bill; no children; invoices billed directly
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { contracts, contractAmendments } from "../drizzle/schema";

export interface ContractFinancialsResult {
  // Core values
  initialAmount: number;
  effectiveCeiling: number | null;      // null when hasNteCeiling = false
  computedContractValue: number;        // authorized value (ceiling or initial ± amendments)
  authorizedValue: number;             // for display

  // NTE-specific
  ceilingCommittedByChildren: number;
  ceilingAvailable: number;

  // Billing (recursive: includes all descendants)
  billedToDate: number;
  retainageAmount: number;
  remaining: number;

  // Flags
  isBillingOverCeiling: boolean;
  hasOverBilledChildren: boolean;
  billingPercentage: number;

  // Burn-rate analytics (NTE contracts only)
  avgMonthlyBurn: number | null;
  projectedExhaustionDate: Date | null;
  daysRemaining: number | null;

  // Child summary
  childCount: number;
  billingBasis: string;
  hasNteCeiling: boolean;

  // Hierarchy rollup totals (useful for display)
  totalDescendantValue: number;   // Σ all descendant computedContractValue
  totalDescendantBilled: number;  // Σ all descendant billedToDate
}

// ─── Helper: load all descendants of a contract ───────────────────────────────

async function loadAllDescendants(rootId: string): Promise<typeof contracts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  // Load ALL contracts once, then build tree in memory (avoids N+1 queries)
  const allContracts = await db.select().from(contracts);
  const byParent = new Map<string, typeof contracts.$inferSelect[]>();
  for (const c of allContracts) {
    if (c.parentContractId != null) {
      const list = byParent.get(c.parentContractId) ?? [];
      list.push(c);
      byParent.set(c.parentContractId, list);
    }
  }

  const result: typeof contracts.$inferSelect[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}

// ─── Helper: compute amendment totals for a single contract ──────────────────

function computeAmendmentTotals(amendments: typeof contractAmendments.$inferSelect[]) {
  let addsTotal = 0;
  let subtractsTotal = 0;
  for (const a of amendments) {
    // Skip inactive amendments — only active ones affect the effective value/ceiling
    const status = (a as any).approvalStatus ?? "active";
    if (status === "inactive") continue;
    const behavior = a.amountBehavior ?? "adds_to_value";
    const amountChange = a.amountChange != null ? Number(a.amountChange) : 0;
    const amount = a.amount != null ? Number(a.amount) : 0;
    const magnitude = amountChange !== 0 ? Math.abs(amountChange) : Math.abs(amount);
    if (behavior === "adds_to_value") addsTotal += magnitude;
    else if (behavior === "subtracts_from_value") subtractsTotal += magnitude;
    else if (amount < 0) subtractsTotal += Math.abs(amount);
    else addsTotal += Math.abs(amount);
  }
  return { addsTotal, subtractsTotal };
}

// ─── Main financial calculation ───────────────────────────────────────────────

export async function getContractFinancials(
  contractId: string
): Promise<ContractFinancialsResult | null> {
  const db = await getDb();
  if (!db) return null;

  // Load the contract itself
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  if (!contract) return null;

  const billingBasis = contract.billingBasis ?? "authorized";
  const hasNTE = contract.hasNteCeiling ?? false;
  const nteCeilingAmount = Number(contract.nteCeilingAmount ?? 0);
  const initialAmount = Number(contract.value ?? 0);

  // Load amendments for this contract
  const ownAmendments = await db
    .select()
    .from(contractAmendments)
    .where(eq(contractAmendments.contractId, contractId));

  const { addsTotal, subtractsTotal } = computeAmendmentTotals(ownAmendments);

  // Effective ceiling and own computed value
  const effectiveCeiling = hasNTE ? nteCeilingAmount + addsTotal - subtractsTotal : null;
  const ownComputedValue = hasNTE
    ? (effectiveCeiling ?? 0)
    : initialAmount + addsTotal - subtractsTotal;

  // Load all descendants (recursive)
  const descendants = await loadAllDescendants(contractId);
  const directChildren = descendants.filter(c => c.parentContractId === contractId);
  const childCount = directChildren.length;

  // Compute recursive descendant totals
  // For each descendant, its contribution to the root depends on amountBehavior
  let totalDescendantValue = 0;
  let totalDescendantBilled = 0;
  let hasOverBilledChildren = false;

  for (const desc of descendants) {
    const behavior = (desc as any).amountBehavior ?? "independent";
    const descValue = Number(desc.computedContractValue ?? desc.value ?? 0);
    const descBilled = Number(desc.totalBilledAmount ?? 0);

    // Only roll up value for non-independent children
    if (behavior !== "independent") {
      if (behavior === "adds_to_parent" || behavior === "utilizes_parent") {
        totalDescendantValue += descValue;
      } else if (behavior === "subtracts_from_parent") {
        totalDescendantValue -= descValue;
      }
    }

    totalDescendantBilled += descBilled;

    if (descBilled > descValue && descValue > 0) {
      hasOverBilledChildren = true;
    }
  }

  // Ceiling committed by direct children (AUTHORIZED mode)
  const ceilingCommittedByChildren = directChildren.reduce(
    (sum, c) => sum + Number(c.computedContractValue ?? c.value ?? 0),
    0
  );

  // computedContractValue for this node
  // For non-NTE: own value ± non-independent descendant values
  const computedContractValue = hasNTE
    ? (effectiveCeiling ?? 0)
    : ownComputedValue + Math.max(0, totalDescendantValue);

  // Billed to date (recursive)
  let billedToDate: number;
  if (hasNTE && billingBasis === "authorized") {
    // Roll up from direct children (they in turn roll up from their children)
    billedToDate = directChildren.reduce(
      (sum, c) => sum + Number(c.totalBilledAmount ?? 0),
      0
    );
  } else if (descendants.length > 0) {
    // Non-NTE with children: own billed + all descendant billed
    billedToDate = Number(contract.totalBilledAmount ?? 0) + totalDescendantBilled;
  } else {
    billedToDate = Number(contract.totalBilledAmount ?? 0);
  }

  // Retainage (own only — descendants track their own)
  const retainageAmount = Number(contract.retainageAmount ?? 0);

  // Remaining
  const ceiling = effectiveCeiling ?? computedContractValue;
  const remaining = ceiling - billedToDate;

  // Available for new orders
  let ceilingAvailable: number;
  if (hasNTE && billingBasis === "authorized") {
    ceilingAvailable = (effectiveCeiling ?? 0) - ceilingCommittedByChildren;
  } else if (hasNTE && billingBasis === "nte_ceiling") {
    ceilingAvailable = (effectiveCeiling ?? 0) - billedToDate;
  } else {
    ceilingAvailable = 0;
  }

  // Over-ceiling check
  const isBillingOverCeiling = hasNTE
    ? billedToDate > (effectiveCeiling ?? 0)
    : billedToDate > computedContractValue;

  // Billing percentage
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
    totalDescendantValue,
    totalDescendantBilled,
  };
}

/**
 * Persist the computed financials back to the contract row so the list view
 * and other queries always see up-to-date KPIs without re-computing.
 * Also cascades up to the parent chain so L1 always reflects L2+L3 changes.
 */
export async function persistContractFinancials(contractId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const fin = await getContractFinancials(contractId);
  if (!fin) return;

  await db
    .update(contracts)
    .set({
      computedContractValue: fin.computedContractValue.toString(),
      totalBilledAmount: fin.billedToDate.toString(),
      billingPercentage: fin.billingPercentage.toString(),
      isBillingOverCeiling: fin.isBillingOverCeiling,
    } as any)
    .where(eq(contracts.id, contractId));

  // Cascade up: if this contract has a parent, recalculate the parent too
  const [self] = await db.select({ parentContractId: contracts.parentContractId })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (self?.parentContractId) {
    await persistContractFinancials(self.parentContractId);
  }
}
