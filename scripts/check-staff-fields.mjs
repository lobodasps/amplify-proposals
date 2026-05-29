import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load env
const envFile = readFileSync('/home/ubuntu/amplify-proposals/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
}

const conn = await createConnection(env.DATABASE_URL || process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT id, name, service_lines, tags, years_experience FROM personnel ORDER BY created_at ASC LIMIT 15'
);
for (const r of rows) {
  console.log(`\n--- ${r.name} (id:${r.id}) ---`);
  console.log('service_lines:', r.service_lines);
  console.log('tags:', r.tags);
  console.log('years_experience:', r.years_experience);
}
await conn.end();
