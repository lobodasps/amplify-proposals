import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { aiSkills } from "./drizzle/schema.ts";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);
const rows = await db.select({ skillType: aiSkills.skillType, provider: aiSkills.provider, model: aiSkills.model }).from(aiSkills);
console.table(rows);
await conn.end();
