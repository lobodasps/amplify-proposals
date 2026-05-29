import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Ensure port 6543 for Supabase session-mode pooler
const url = connectionString.includes(":6543")
  ? connectionString
  : connectionString.replace(/:5432\//, ":6543/");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: url,
    ssl: "prefer",
  },
});
