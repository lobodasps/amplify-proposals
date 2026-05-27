/**
 * Storage proxy — serves files from Supabase Storage.
 *
 * GET /manus-storage/:key  →  generates a Supabase signed URL and 307-redirects.
 *
 * This keeps the URL pattern (/manus-storage/...) stable so no client code
 * needs to change. The proxy generates a fresh signed URL on each request,
 * so stored keys never expire.
 */
import type { Express } from "express";
import { supabase } from "../supabase";

const BUCKET = "dam";
const SIGNED_URL_TTL = 3600; // 1 hour

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(key, SIGNED_URL_TTL);

      if (error || !data?.signedUrl) {
        console.error(`[StorageProxy] Supabase error for key "${key}":`, error?.message);
        res.status(502).send("Storage backend error");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, data.signedUrl);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
