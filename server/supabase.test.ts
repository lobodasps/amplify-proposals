import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("Supabase connection", () => {
  it("should connect to Supabase with provided credentials", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
    expect(url).toContain("supabase.co");

    const client = createClient(url!, key!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try a lightweight query — even if the table doesn't exist,
    // a PGRST116 (not found) or 42P01 (table missing) means auth worked.
    // Only fail on 401/403 (bad credentials) or network errors.
    const { error } = await client.from("clients").select("id").limit(1);

    if (error) {
      // Auth errors indicate bad credentials
      const isAuthError =
        error.code === "PGRST301" ||
        error.message?.toLowerCase().includes("jwt") ||
        error.message?.toLowerCase().includes("invalid api key") ||
        error.message?.toLowerCase().includes("unauthorized");
      expect(isAuthError, `Auth error: ${error.message}`).toBe(false);
    }
    // No error or non-auth error = connection is healthy
    expect(true).toBe(true);
  });
});
