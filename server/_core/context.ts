import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { supabase } from "../supabase";

/**
 * Amplify user context — resolved from Supabase Auth JWT.
 * The JWT is passed as a Bearer token in the Authorization header.
 * We resolve the user's profile from the `profiles` table using auth.uid().
 */
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Maps a Supabase profiles row to the User shape expected by the rest of the app.
 * The `amp_users` table is the Amplify-specific user table, but for auth we
 * resolve identity from Supabase's `profiles` table (shared with the v0 app).
 */
function profileToUser(profile: any): User {
  return {
    id: profile.id, // uuid from profiles (= auth.users.id)
    openId: profile.id, // use profile id as openId for compatibility
    name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
    email: profile.email || null,
    loginMethod: "supabase",
    role: profile.role === "admin" ? "admin" : "user",
    title: profile.labor_category || null,
    department: null,
    phone: profile.phone_number || null,
    avatarUrl: null,
    isActive: profile.is_active ?? true,
    createdAt: profile.created_at ? new Date(profile.created_at) : new Date(),
    updatedAt: profile.updated_at ? new Date(profile.updated_at) : new Date(),
    lastSignedIn: new Date(),
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Extract Bearer token from Authorization header
    const authHeader = opts.req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      // Validate the JWT with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.getUser(token);

      if (!authError && authData?.user) {
        const uid = authData.user.id;

        // Resolve the profile row
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .single();

        if (!profileError && profile) {
          user = profileToUser(profile);
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
