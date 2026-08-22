import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
try {
  const rows = await sql`
    SELECT
      "docType",
      "processingStatus",
      COUNT(*)::int AS count
    FROM dam_documents
    GROUP BY "docType", "processingStatus"
    ORDER BY "docType", "processingStatus"
  `;
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
