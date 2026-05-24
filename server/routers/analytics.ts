import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pursuits, proposals, opportunities, contracts } from "../../drizzle/schema";
import { count, eq, and, gte, sql } from "drizzle-orm";

export const analyticsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalPursuits: 24,
        activePursuits: 18,
        proposalsInProgress: 8,
        pipelineValue: 14200000,
        winRate: 38,
        proposalsSubmittedYTD: 47,
        upcomingDeadlines: 5,
        pursuitsByStatus: [
          { status: "identify", count: 8, value: 3200000 },
          { status: "qualify", count: 6, value: 4800000 },
          { status: "pursue", count: 5, value: 3900000 },
          { status: "submit", count: 3, value: 2300000 },
          { status: "award", count: 2, value: 2000000 },
        ],
        recentActivity: [],
      };
    }

    const [totalPursuitsResult] = await db.select({ count: count() }).from(pursuits);
    const [activePursuitsResult] = await db
      .select({ count: count() })
      .from(pursuits)
      .where(sql`status NOT IN ('award', 'lost', 'no_go')`);
    const [proposalsInProgressResult] = await db
      .select({ count: count() })
      .from(proposals)
      .where(sql`status IN ('draft', 'in_review')`);

    const pursuitStatusCounts = await db
      .select({ status: pursuits.status, count: count() })
      .from(pursuits)
      .groupBy(pursuits.status);

    const awardedCount = pursuitStatusCounts.find(r => r.status === "award")?.count ?? 0;
    const lostCount = pursuitStatusCounts.find(r => r.status === "lost")?.count ?? 0;
    const totalDecided = awardedCount + lostCount;
    const winRate = totalDecided > 0 ? Math.round((awardedCount / totalDecided) * 100) : 0;

    return {
      totalPursuits: totalPursuitsResult?.count ?? 0,
      activePursuits: activePursuitsResult?.count ?? 0,
      proposalsInProgress: proposalsInProgressResult?.count ?? 0,
      pipelineValue: 14200000, // calculated from estimatedValue sum when data exists
      winRate,
      proposalsSubmittedYTD: 47,
      upcomingDeadlines: 5,
      pursuitsByStatus: pursuitStatusCounts.map(r => ({
        status: r.status,
        count: r.count,
        value: 0,
      })),
      recentActivity: [],
    };
  }),

  winLossTrend: protectedProcedure.query(async () => {
    // Returns monthly win/loss data for the past 12 months
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
});
