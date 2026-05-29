import type { Express } from "express";

/**
 * OAuth routes — NO-OP.
 * Manus OAuth has been replaced by Supabase Auth.
 * This file is kept to avoid breaking imports in server/_core/index.ts.
 * The frontend will handle Supabase Auth login directly.
 */
export function registerOAuthRoutes(_app: Express) {
  // No-op: Supabase Auth is handled client-side.
  // The /api/oauth/callback route is no longer needed.
  console.log("[OAuth] Manus OAuth disabled — using Supabase Auth");
}
