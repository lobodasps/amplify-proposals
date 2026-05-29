import { getDb } from "../server/db";
import { personnel } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Maps raw LLM keyword tags to Amplify service line slugs
const SERVICE_LINE_MAP: Record<string, string> = {
  "civil engineering": "civil_engineering",
  "construction management": "construction_management",
  "construction": "construction_management",
  "resident engineering": "construction_management",
  "special inspections": "special_inspections",
  "inspection": "special_inspections",
  "traffic engineering": "traffic_engineering",
  "traffic": "traffic_engineering",
  "transportation": "traffic_engineering",
  "landscape architecture": "landscape_streetscape",
  "landscape": "landscape_streetscape",
  "streetscape": "landscape_streetscape",
  "urban design": "landscape_streetscape",
  "parks": "landscape_streetscape",
  "environmental": "environmental",
  "environmental management": "environmental",
  "gis": "environmental",
  "soil & water sciences": "environmental",
  "water resources": "environmental",
  "pollution": "environmental",
  "contamination": "environmental",
  "nepa": "environmental",
  "seqr": "environmental",
  "sustainability": "environmental",
  "infrastructure": "civil_engineering",
  "water main": "civil_engineering",
  "sewer": "civil_engineering",
  "highway": "civil_engineering",
  "project management": "construction_management",
  "project administration": "construction_management",
  "proposal coordination": "construction_management",
};

function inferServiceLines(tags: string[]): string[] {
  const found = new Set<string>();
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [keyword, slug] of Object.entries(SERVICE_LINE_MAP)) {
      if (lower.includes(keyword)) {
        found.add(slug);
      }
    }
  }
  return Array.from(found);
}

async function main() {
  const db = await getDb();
  if (!db) { console.log("no db"); process.exit(0); }

  // Get all real staff records (id >= 30000) with stringified tags
  const result = await db.execute(
    "SELECT id, name, tags, serviceLines, yearsExperience FROM personnel WHERE id >= 30000"
  ) as any;
  const rows = result[0] as any[];

  console.log(`Found ${rows.length} real staff records to fix`);

  for (const r of rows) {
    let tags: string[] = [];

    // Parse tags — could be a JSON string, already an array, or null
    if (typeof r.tags === "string") {
      try {
        tags = JSON.parse(r.tags);
      } catch {
        tags = r.tags.split(",").map((t: string) => t.trim());
      }
    } else if (Array.isArray(r.tags)) {
      tags = r.tags;
    }

    // Clean tags — remove duplicates, trim whitespace
    tags = [...new Set(tags.map((t: string) => t.trim()).filter(Boolean))];

    // Infer service lines from tags
    const serviceLines = inferServiceLines(tags);

    console.log(`\n${r.name}:`);
    console.log("  tags (parsed):", tags.slice(0, 5).join(", "));
    console.log("  serviceLines:", serviceLines.join(", ") || "(none matched)");

    // Update the record using Drizzle ORM
    await db.update(personnel)
      .set({ tags, serviceLines })
      .where(eq(personnel.id, r.id));
    console.log("  ✓ updated");
  }

  console.log("\nAll records fixed.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
