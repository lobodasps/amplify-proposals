/**
 * Storage helpers — backed by Supabase Storage (bucket: dam).
 *
 * storagePut  — upload bytes, returns { key, url }
 * storageGet  — return a signed download URL (1 hour TTL), returns { key, url }
 * storageGetSignedUrl — same as storageGet but returns the URL string directly
 *
 * The `url` returned by storagePut is a signed URL valid for 1 hour.
 * For long-lived references, save the `key` in the database and call
 * storageGet() at request time to generate a fresh signed URL.
 *
 * Bucket: dam (private, 50 MB per-file limit)
 */

import { supabase } from "./supabase";

const BUCKET = "dam";
const SIGNED_URL_TTL = 3600; // seconds (1 hour)

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * Upload a file to Supabase Storage.
 * Returns { key, url } where url is a signed download URL (1 hour TTL).
 * Save `key` in the database; regenerate `url` on demand via storageGet().
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  const body =
    typeof data === "string"
      ? Buffer.from(data, "utf-8")
      : Buffer.from(data as Uint8Array);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(key, body, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  // Return a signed URL so the caller can immediately use it
  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Supabase Storage signed URL failed: ${signError?.message}`);
  }

  return { key, url: signedData.signedUrl };
}

/**
 * Get a fresh signed download URL for an existing file.
 * Call this at request time — do not persist the returned URL.
 */
export async function storageGet(
  relKey: string,
  expiresIn = SIGNED_URL_TTL,
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Supabase Storage get signed URL failed: ${error?.message}`);
  }

  return { key, url: data.signedUrl };
}

/**
 * Convenience wrapper — returns the signed URL string directly.
 */
export async function storageGetSignedUrl(
  relKey: string,
  expiresIn = SIGNED_URL_TTL,
): Promise<string> {
  const { url } = await storageGet(relKey, expiresIn);
  return url;
}
