import { profiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const userManagementRouter = router({
  /**
   * Read-only shared Timekeeping identity view. Roles and permissions are
   * assigned exclusively in Timekeeping/V0, never in Amplify Proposals.
   */
  listUsers: permissionProcedure("proposalsSettingsAdmin").query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const rows = await db.select({
      id: profiles.id,
      email: profiles.email,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      isActive: profiles.isActive,
      createdAt: profiles.createdAt,
    }).from(profiles).orderBy(profiles.lastName);

    return rows.map((profile) => ({
      ...profile,
      name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Unknown",
    }));
  }),
});
