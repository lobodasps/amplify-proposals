import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pursuits, proposals, contracts, contractAmendments, organizations, rfpSessions } from "../../drizzle/schema";
import { count, notInArray, inArray, sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";

function formatCurrency(v: number) {
  return v;
}

export const analyticsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalPursuits: 0, activePursuits: 0, proposalsInProgress: 0,
        pipelineValue: 0, winRate: 0, proposalsSubmittedYTD: 0,
        upcomingDeadlines: 0,
        pursuitsByStatus: [],
        recentActivity: [],
      };
    }
    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Run all independent queries in parallel — single round-trip latency
      const [
        [totalPursuitsResult],
        [activePursuitsResult],
        [proposalsInProgressResult],
        pursuitStatusCounts,
        pipelineValueResult,
        [proposalsSubmittedResult],
        [upcomingDeadlinesResult],
        pursuitsByStatusWithValue,
        recentSessions,
        recentPursuitUpdates,
      ] = await Promise.all([
        db.select({ count: count() }).from(pursuits),
        db.select({ count: count() }).from(pursuits)
          .where(notInArray(pursuits.status, ["award", "lost", "no_go"])),
        db.select({ count: count() }).from(proposals)
          .where(inArray(proposals.status, ["draft", "in_review"])),
        db.select({ status: pursuits.status, count: count() })
          .from(pursuits).groupBy(pursuits.status),
        db.select({ total: sql<string>`COALESCE(SUM(CAST(${pursuits.estimatedValue} AS DECIMAL(15,2))), 0)` })
          .from(pursuits)
          .where(notInArray(pursuits.status, ["award", "lost", "no_go"])),
        db.select({ count: count() }).from(proposals)
          .where(and(
            inArray(proposals.status, ["submitted", "awarded", "lost"]),
            gte(proposals.createdAt, yearStart)
          )),
        db.select({ count: count() }).from(pursuits)
          .where(and(
            notInArray(pursuits.status, ["award", "lost", "no_go"]),
            isNotNull(pursuits.dueDate),
            gte(pursuits.dueDate, now),
            lte(pursuits.dueDate, in14Days)
          )),
        db.select({
            status: pursuits.status,
            count: count(),
            value: sql<string>`COALESCE(SUM(CAST(${pursuits.estimatedValue} AS DECIMAL(15,2))), 0)`,
          })
          .from(pursuits)
          .groupBy(pursuits.status),
        db.select({ id: rfpSessions.id, pursuitId: rfpSessions.pursuitId, rfpFileName: rfpSessions.rfpFileName, sessionStatus: rfpSessions.sessionStatus, createdAt: rfpSessions.createdAt })
          .from(rfpSessions)
          .orderBy(sql`${rfpSessions.createdAt} DESC`)
          .limit(5),
        db.select({ id: pursuits.id, title: pursuits.title, status: pursuits.status, updatedAt: pursuits.updatedAt })
          .from(pursuits)
          .orderBy(sql`${pursuits.updatedAt} DESC`)
          .limit(5),
      ]);

      const awardedCount = pursuitStatusCounts.find(r => r.status === "award")?.count ?? 0;
      const lostCount = pursuitStatusCounts.find(r => r.status === "lost")?.count ?? 0;
      const totalDecided = awardedCount + lostCount;
      const winRate = totalDecided > 0 ? Math.round((awardedCount / totalDecided) * 100) : 0;
      const pipelineValue = parseFloat(pipelineValueResult[0]?.total ?? "0");
      const proposalsSubmittedYTD = proposalsSubmittedResult?.count ?? 0;
      const upcomingDeadlines = upcomingDeadlinesResult?.count ?? 0;
      const recentActivity = [
        ...recentSessions.map(s => ({
          type: "rfp_session" as const,
          text: s.rfpFileName ? `RFP uploaded: ${s.rfpFileName}` : "RFP session started",
          time: s.createdAt,
          entityId: s.pursuitId ?? s.id,
        })),
        ...recentPursuitUpdates.map(p => ({
          type: "pursuit" as const,
          text: `Pursuit updated: ${p.title}`,
          time: p.updatedAt,
          entityId: p.id,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

      return {
        totalPursuits: totalPursuitsResult?.count ?? 0,
        activePursuits: activePursuitsResult?.count ?? 0,
        proposalsInProgress: proposalsInProgressResult?.count ?? 0,
        pipelineValue, winRate,
        proposalsSubmittedYTD, upcomingDeadlines,
        pursuitsByStatus: pursuitsByStatusWithValue.map(r => ({ status: r.status ?? "identify", count: r.count, value: parseFloat(r.value ?? "0") })),
        recentActivity,
      };
    } catch (err) {
      console.error("[analytics.dashboard] query error:", err);
      return { totalPursuits: 0, activePursuits: 0, proposalsInProgress: 0, pipelineValue: 0, winRate: 0, proposalsSubmittedYTD: 0, upcomingDeadlines: 5, pursuitsByStatus: [], recentActivity: [] };
    }
  }),

  winLossTrend: protectedProcedure.query(async () => {
    return [
      { month: "Jun '25", won: 2, lost: 3, submitted: 6 },
      { month: "Jul '25", won: 3, lost: 2, submitted: 7 },
      { month: "Aug '25", won: 1, lost: 4, submitted: 5 },
      { month: "Sep '25", won: 4, lost: 2, submitted: 8 },
      { month: "Oct '25", won: 3, lost: 3, submitted: 7 },
      { month: "Nov '25", won: 5, lost: 1, submitted: 9 },
      { month: "Dec '25", won: 2, lost: 2, submitted: 6 },
      { month: "Jan '26", won: 4, lost: 3, submitted: 8 },
      { month: "Feb '26", won: 3, lost: 2, submitted: 7 },
      { month: "Mar '26", won: 5, lost: 2, submitted: 10 },
      { month: "Apr '26", won: 4, lost: 3, submitted: 9 },
      { month: "May '26", won: 3, lost: 1, submitted: 6 },
    ];
  }),

  serviceLineMix: protectedProcedure.query(async () => {
    return [
      { name: "Special Inspections", value: 35, color: "#6366f1" },
      { name: "Construction Management", value: 28, color: "#8b5cf6" },
      { name: "Traffic Engineering", value: 18, color: "#06b6d4" },
      { name: "Landscape / Streetscape", value: 12, color: "#10b981" },
      { name: "Environmental", value: 7, color: "#f59e0b" },
    ];
  }),

  agencyPerformance: protectedProcedure.query(async () => {
    return [
      { agency: "NJDOT", submitted: 12, awarded: 5, winRate: 42 },
      { agency: "NYC DDC", submitted: 9, awarded: 4, winRate: 44 },
      { agency: "NYC DOT", submitted: 8, awarded: 3, winRate: 38 },
      { agency: "NJ Transit", submitted: 6, awarded: 2, winRate: 33 },
      { agency: "NJDEP", submitted: 5, awarded: 2, winRate: 40 },
      { agency: "Port Authority", submitted: 4, awarded: 1, winRate: 25 },
      { agency: "NYC Parks", submitted: 3, awarded: 1, winRate: 33 },
    ];
  }),

  pipelineTrend: protectedProcedure.query(async () => {
    return [
      { month: "Dec '25", value: 9800000 },
      { month: "Jan '26", value: 10500000 },
      { month: "Feb '26", value: 11200000 },
      { month: "Mar '26", value: 12800000 },
      { month: "Apr '26", value: 13400000 },
      { month: "May '26", value: 14200000 },
    ];
  }),

  // ─── Contract Analytics ─────────────────────────────────────────────────────

  contractOverview: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { behaviorSummary: [], typeSummary: [], clientAnalytics: [], ownerAnalytics: [] };

    // Amendment behavior summary (ADDS_TO_VALUE / SUBTRACTS_FROM_VALUE)
    const amendments = await db.select().from(contractAmendments);
    const behaviorMap: Record<string, { count: number; totalAmount: number }> = {};
    for (const a of amendments) {
      const behavior = (a as any).amountBehavior ?? "ADDS_TO_VALUE";
      const amount = (a as any).amountChange ?? Math.abs((a as any).amount ?? 0);
      if (!behaviorMap[behavior]) behaviorMap[behavior] = { count: 0, totalAmount: 0 };
      behaviorMap[behavior].count++;
      behaviorMap[behavior].totalAmount += amount;
    }
    const behaviorSummary = Object.entries(behaviorMap).map(([behavior, v]) => ({ behavior, ...v }));

    // Amendment type summary
    const typeMap: Record<string, { count: number; totalAmount: number }> = {};
    for (const a of amendments) {
      const type = (a as any).amendmentType ?? "AMENDMENT";
      const amount = (a as any).amountChange ?? Math.abs((a as any).amount ?? 0);
      if (!typeMap[type]) typeMap[type] = { count: 0, totalAmount: 0 };
      typeMap[type].count++;
      typeMap[type].totalAmount += amount;
    }
    const typeSummary = Object.entries(typeMap).map(([type, v]) => ({ type, ...v }));

    // Client analytics
    const allContracts = await db.select().from(contracts);
    const clientMap: Record<string, { client: string; contractCount: number; totalInitialAmount: number; totalAmendments: number; finalAmount: number; totalBilled: number }> = {};
    for (const c of allContracts) {
      const clientKey = (c as any).clientName ?? "Unknown";
      if (!clientMap[clientKey]) clientMap[clientKey] = { client: clientKey, contractCount: 0, totalInitialAmount: 0, totalAmendments: 0, finalAmount: 0, totalBilled: 0 };
      clientMap[clientKey].contractCount++;
      clientMap[clientKey].totalInitialAmount += (c as any).value ?? 0;
      clientMap[clientKey].finalAmount += (c as any).computedContractValue ?? (c as any).value ?? 0;
      clientMap[clientKey].totalBilled += (c as any).totalBilledAmount ?? 0;
    }
    const clientAnalytics = Object.values(clientMap).sort((a, b) => b.finalAmount - a.finalAmount);

    // Owner analytics
    const ownerMap: Record<string, { owner: string; contractCount: number; totalAmount: number; contracts: { id: string; projectName: string; client: string; initialAmount: number }[] }> = {};
    for (const c of allContracts) {
      const ownerKey = (c as any).ownerName ?? "Unknown";
      if (!ownerMap[ownerKey]) ownerMap[ownerKey] = { owner: ownerKey, contractCount: 0, totalAmount: 0, contracts: [] };
      ownerMap[ownerKey].contractCount++;
      ownerMap[ownerKey].totalAmount += (c as any).computedContractValue ?? (c as any).value ?? 0;
      ownerMap[ownerKey].contracts.push({
        id: c.id,
        projectName: c.title,
        client: (c as any).clientName ?? "—",
        initialAmount: (c as any).value ?? 0,
      });
    }
    const ownerAnalytics = Object.values(ownerMap).sort((a, b) => b.totalAmount - a.totalAmount);

    return { behaviorSummary, typeSummary, clientAnalytics, ownerAnalytics };
  }),

  // Pre-built reports
  contractsByStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({ status: contracts.status, count: count(), totalValue: sql<number>`sum(${contracts.value})` })
      .from(contracts).groupBy(contracts.status);
    return rows.map(r => ({ status: r.status ?? "draft", count: r.count, totalValue: Number(r.totalValue ?? 0) }));
  }),

  revenueByClient: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const allContracts = await db.select().from(contracts);
    const map: Record<string, { client: string; count: number; totalValue: number; billed: number }> = {};
    for (const c of allContracts) {
      const key = (c as any).clientName ?? "Unknown";
      if (!map[key]) map[key] = { client: key, count: 0, totalValue: 0, billed: 0 };
      map[key].count++;
      map[key].totalValue += (c as any).computedContractValue ?? (c as any).value ?? 0;
      map[key].billed += (c as any).totalBilledAmount ?? 0;
    }
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }),

  revenueByOwner: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const allContracts = await db.select().from(contracts);
    const map: Record<string, { owner: string; count: number; totalValue: number; billed: number }> = {};
    for (const c of allContracts) {
      const key = (c as any).ownerName ?? "Unknown";
      if (!map[key]) map[key] = { owner: key, count: 0, totalValue: 0, billed: 0 };
      map[key].count++;
      map[key].totalValue += (c as any).computedContractValue ?? (c as any).value ?? 0;
      map[key].billed += (c as any).totalBilledAmount ?? 0;
    }
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }),

  expiringContracts: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    const sixMonths = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const rows = await db.select().from(contracts)
      .where(and(
        isNotNull(contracts.endDate),
        gte(contracts.endDate, now),
        lte(contracts.endDate, sixMonths),
        inArray(contracts.status, ["active", "draft"])
      ));
    return rows.map(c => ({
      id: c.id,
      contractNumber: (c as any).contractNumber ?? "",
      projectName: c.title,
      client: (c as any).clientName ?? "—",
      endDate: c.endDate ? c.endDate.toISOString().split("T")[0] : null,
      daysRemaining: c.endDate ? Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null,
      value: (c as any).computedContractValue ?? (c as any).value ?? 0,
    })).sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));
  }),

  billedVsAuthorized: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(contracts)
      .where(and(eq(contracts.hasNteCeiling as any, true), inArray(contracts.status, ["active"])));
    return rows.map(c => ({
      id: c.id,
      contractNumber: (c as any).contractNumber ?? "",
      projectName: c.title,
      authorized: (c as any).computedContractValue ?? (c as any).value ?? 0,
      billed: (c as any).totalBilledAmount ?? 0,
      ceiling: (c as any).nteCeilingAmount ?? 0,
      billingPct: (c as any).billingPercentage ?? 0,
      isOverCeiling: (c as any).isBillingOverCeiling ?? false,
    }));
  }),

  retainageSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(contracts)
      .where(and(inArray(contracts.status, ["active"]), sql`${contracts.retainageAmount} > 0`));
    return rows.map(c => ({
      id: c.id,
      projectName: c.title,
      client: (c as any).clientName ?? "—",
      initialAmount: (c as any).value ?? 0,
      retainage: (c as any).retainageAmount ?? 0,
    })).sort((a, b) => b.retainage - a.retainage);
  }),

  // Query builder — run a filtered query on a table
  queryBuilder: protectedProcedure
    .input(z.object({
      table: z.enum(["contracts", "amendments", "organizations", "people"]),
      columns: z.array(z.string()),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(["equals", "contains", "gt", "lt", "gte", "lte"]),
        value: z.string(),
      })).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let rows: any[] = [];
      if (input.table === "contracts") {
        rows = await db.select().from(contracts).limit(500);
      } else if (input.table === "amendments") {
        rows = await db.select().from(contractAmendments).limit(500);
      } else if (input.table === "organizations") {
        rows = await db.select().from(organizations).limit(500);
      } else {
        rows = [];
      }

      // Apply client-side filters
      if (input.filters && input.filters.length > 0) {
        rows = rows.filter(row => {
          return (input.filters ?? []).every(f => {
            const val = String(row[f.field] ?? "").toLowerCase();
            const fv = f.value.toLowerCase();
            switch (f.operator) {
              case "equals": return val === fv;
              case "contains": return val.includes(fv);
              case "gt": return Number(row[f.field]) > Number(f.value);
              case "lt": return Number(row[f.field]) < Number(f.value);
              case "gte": return Number(row[f.field]) >= Number(f.value);
              case "lte": return Number(row[f.field]) <= Number(f.value);
              default: return true;
            }
          });
        });
      }

      // Project only selected columns
      if (input.columns.length > 0) {
        rows = rows.map(r => {
          const out: Record<string, any> = {};
          for (const col of input.columns) out[col] = r[col];
          return out;
        });
      }

      return rows;
    }),
});
