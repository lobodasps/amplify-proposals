/**
 * One-off migration: add extractionMethod and pageCount columns to dam_documents.
 * Run with: node migrate-add-extraction-method.mjs
 */
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
  await sql`ALTER TABLE dam_documents ADD COLUMN IF NOT EXISTS "extractionMethod" text`;
  console.log("✓ extractionMethod column added (or already exists)");
  await sql`ALTER TABLE dam_documents ADD COLUMN IF NOT EXISTS "pageCount" integer`;
  console.log("✓ pageCount column added (or already exists)");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
