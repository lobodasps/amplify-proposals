/**
 * Supabase client — server-side only.
 * Uses the service role key for full read/write access.
 * Never import this file from client-side code.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Test the Supabase connection by listing tables in the public schema.
 * Returns true if connection is healthy.
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("clients")
      .select("id")
      .limit(1);
    // If error is "relation does not exist" that's still a valid connection
    // Only return false for network/auth errors
    if (error && (error.code === "PGRST301" || error.message?.includes("JWT"))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
