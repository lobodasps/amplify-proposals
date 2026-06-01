/**
 * run-gen-chain.mjs
 * Runs the live generation chain by calling executeSkill via appRouter.createCaller()
 * (bypasses HTTP auth). Forces re-run of win_themes and technical_writer skills,
 * then reads the DB to report outputs and missingVariables.
 *
 * Usage: cd /home/ubuntu/amplify-proposals && npx tsx scripts/run-gen-chain.mjs
 */

import { appRouter } from "../server/routers.js";
import { getDb } from "../server/db.js";
import { rfpSessions } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

const SESSION_ID = "ff100e30-0628-4d5a-91ca-183dc03f88a8";

const mockCtx = {
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    openId: "script-runner",
    email: "script@amplify.test",
    name: "Script Runner",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
};

const caller = appRouter.createCaller(mockCtx);

async function waitForSkillComplete(skillName, timeoutMs = 180000) {
  const start = Date.now();
  const db = await getDb();
  while (Date.now() - start < timeoutMs) {
    const rows = await db.select().from(rfpSessions).where(eq(rfpSessions.id, SESSION_ID)).limit(1);
    const ws = rows[0]?.workflowState;
    if (ws && ws[skillName]) {
      const entry = ws[skillName];
      if (entry.status === "complete") return entry;
      if (entry.status === "error") {
        console.error(`  SKILL ERROR: ${entry.errorMessage}`);
        return entry;
      }
      if (entry.subStepMessage) {
        process.stdout.write(`\r  [${skillName}] ${entry.subStepMessage}                    `);
      }
    }
    await new Promise(r => setTimeout(r, 2500));
  }
  console.error(`  TIMEOUT after ${timeoutMs / 1000}s`);
  return null;
}

console.log("\n=== Running win_themes (uses win_theme_generator skill) ===");
try {
  const result = await caller.rfpSessions.executeSkill({
    sessionId: SESSION_ID,
    skillName: "win_themes",
    force: true,
  });
  console.log("  executeSkill returned:", result.cached ? "CACHED" : "DISPATCHED");
} catch (err) {
  console.error("  executeSkill error:", err.message);
}

console.log("  Waiting for LLM completion...");
const winEntry = await waitForSkillComplete("win_themes");
console.log("");

const db = await getDb();
let rows = await db.select().from(rfpSessions).where(eq(rfpSessions.id, SESSION_ID)).limit(1);
let session = rows[0];

if (session?.skillOutputs?.win_themes) {
  console.log("\n=== win_theme_generator OUTPUT (first 200 words) ===");
  const words = session.skillOutputs.win_themes.split(/\s+/).slice(0, 200).join(" ");
  console.log(words);
} else {
  console.log("\n  [No win_themes output found in DB]");
}

if (winEntry?.missingVariables?.length > 0) {
  console.log(`\n  Missing variables: ${winEntry.missingVariables.join(", ")}`);
} else {
  console.log("\n  All variables populated (no fallbacks)");
}

console.log("\n=== Running technical_writer (uses technical_approach_writer skill) ===");
try {
  const result = await caller.rfpSessions.executeSkill({
    sessionId: SESSION_ID,
    skillName: "technical_writer",
    force: true,
  });
  console.log("  executeSkill returned:", result.cached ? "CACHED" : "DISPATCHED");
} catch (err) {
  console.error("  executeSkill error:", err.message);
}

console.log("  Waiting for LLM completion...");
const techEntry = await waitForSkillComplete("technical_writer");
console.log("");

rows = await db.select().from(rfpSessions).where(eq(rfpSessions.id, SESSION_ID)).limit(1);
session = rows[0];

if (session?.skillOutputs?.technical_writer) {
  console.log("\n=== technical_approach_writer OUTPUT (first 200 words) ===");
  const words = session.skillOutputs.technical_writer.split(/\s+/).slice(0, 200).join(" ");
  console.log(words);
} else {
  console.log("\n  [No technical_writer output found in DB]");
}

if (techEntry?.missingVariables?.length > 0) {
  console.log(`\n  Missing variables: ${techEntry.missingVariables.join(", ")}`);
} else {
  console.log("\n  All variables populated (no fallbacks)");
}

console.log("\n=== FULL WORKFLOW STATE ===");
const ws = session?.workflowState ?? {};
for (const [key, val] of Object.entries(ws)) {
  const mv = val.missingVariables?.length > 0 ? ` | missing: ${val.missingVariables.join(", ")}` : "";
  const model = val.model ? ` | model: ${val.model}` : "";
  console.log(`  ${key}: ${val.status}${model}${mv}`);
}

console.log("\nDone.");
process.exit(0);
