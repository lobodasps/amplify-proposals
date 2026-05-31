import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'dam_documents' 
    AND column_name IN ('imageQuality','hasPersonnel','structureType','photographer','yearTaken','usageRights')
  ORDER BY column_name
`;
console.log("Columns found:", JSON.stringify(rows, null, 2));
await sql.end();
