import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { supabase } from "../supabase";
import { TRPCError } from "@trpc/server";

export const userManagementRouter = router({
  /**
   * List all users from the profiles table.
   * Returns id, email, first_name, last_name, role, is_active, created_at.
   */
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, is_active, created_at")
      .order("last_name", { ascending: true });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      email: (p.email ?? "") as string,
      firstName: (p.first_name ?? "") as string,
      lastName: (p.last_name ?? "") as string,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown",
      role: (p.role ?? "user") as string,
      isActive: (p.is_active ?? true) as boolean,
      createdAt: (p.created_at ?? null) as string | null,
    }));
  }),

  /**
   * Invite a user by email using Supabase Auth's inviteUserByEmail().
   * Sends a magic-link invite email; the user sets their password on first sign-in.
   */
  inviteUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        role: z.enum(["admin", "user"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.email, {
        data: {
          first_name: input.firstName ?? "",
          last_name: input.lastName ?? "",
          role: input.role,
        },
      });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true, userId: data?.user?.id ?? null };
    }),
});
