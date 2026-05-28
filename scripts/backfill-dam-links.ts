/**
 * Backfill script: link existing dam_documents to Staff/Project records
 * AND push tags, description, summary, serviceLines from extractedMeta.
 *
 * Run with:  npx tsx scripts/backfill-dam-links.ts
 */
import { getDb } from "../server/db";
import { damDocuments, personnel, projects } from "../drizzle/schema";
import { isNull, eq, like, or } from "drizzle-orm";

function parseTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw.split(",").map((s: string) => s.trim()).filter(Boolean); }
  }
  return [];
}

function extractMeta(doc: any) {
  let meta: any = {};
  if (doc.extractedMeta) {
    if (typeof doc.extractedMeta === "string") {
      try { meta = JSON.parse(doc.extractedMeta); } catch {}
    } else {
      meta = doc.extractedMeta;
    }
  }
  return meta;
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("No database connection."); process.exit(1); }

  // ── 1. Staff: find docs with staffName but no staffId ─────────────────────
  const staffOrphans = await db
    .select()
    .from(damDocuments)
    .where(isNull(damDocuments.staffId));

  const staffDocs = staffOrphans.filter(
    (d) => d.staffName && (d.docType === "resume" || d.docType === "certification")
  );

  console.log(`\nStaff docs to process: ${staffDocs.length}`);

  for (const doc of staffDocs) {
    const meta = extractMeta(doc);
    const tags = parseTags(doc.tags);
    const serviceLines = meta.serviceLines ?? meta.disciplines ?? meta.service_lines ?? null;
    const summary = meta.summary ?? meta.bio ?? doc.description ?? null;
    const title = meta.title ?? meta.position ?? meta.role ?? null;
    const yearsExp = meta.yearsExperience ?? meta.years_experience ?? null;
    const education = meta.education ?? null;

    // Try to find existing staff record by name
    const existing = await db
      .select()
      .from(personnel)
      .where(like(personnel.name, `%${doc.staffName!.trim()}%`))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record with enriched data
      await db.update(personnel).set({
        title: title ?? existing[0].title,
        summary: summary ?? existing[0].summary,
        tags: tags.length > 0 ? JSON.stringify(tags) : existing[0].tags,
        serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : existing[0].serviceLines,
        yearsExperience: yearsExp ?? existing[0].yearsExperience,
        education: education ?? existing[0].education,
        companyTag: doc.companyTag ?? (existing[0] as any).companyTag,
      }).where(eq(personnel.id, existing[0].id));

      await db.update(damDocuments).set({ staffId: existing[0].id }).where(eq(damDocuments.id, doc.id));
      console.log(`  Updated + linked staff "${existing[0].name}" (id ${existing[0].id}) ← "${doc.title}"`);
    } else {
      // Create new staff record with all available data
      const inserted = await db.insert(personnel).values({
        name: doc.staffName!.trim(),
        title: title ?? null,
        summary: summary ?? null,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : null,
        yearsExperience: yearsExp ?? null,
        education: education ?? null,
        companyTag: doc.companyTag ?? null,
      } as any).$returningId();

      const newId = (inserted as any)[0]?.id;
      if (newId) {
        await db.update(damDocuments).set({ staffId: newId }).where(eq(damDocuments.id, doc.id));
        console.log(`  Created staff "${doc.staffName}" (id ${newId}) ← "${doc.title}"`);
      }
    }
  }

  // ── 2. Also enrich already-linked staff records that may be missing data ───
  const linkedStaffDocs = await db
    .select()
    .from(damDocuments)
    .where(eq(damDocuments.docType, "resume"));

  console.log(`\nEnriching ${linkedStaffDocs.length} resume docs already linked...`);
  for (const doc of linkedStaffDocs) {
    if (!doc.staffId) continue;
    const meta = extractMeta(doc);
    const tags = parseTags(doc.tags);
    const serviceLines = meta.serviceLines ?? meta.disciplines ?? meta.service_lines ?? null;
    const summary = meta.summary ?? meta.bio ?? doc.description ?? null;
    const title = meta.title ?? meta.position ?? meta.role ?? null;
    const yearsExp = meta.yearsExperience ?? meta.years_experience ?? null;
    const education = meta.education ?? null;

    const current = await db.select().from(personnel).where(eq(personnel.id, doc.staffId)).limit(1);
    if (current.length === 0) continue;

    await db.update(personnel).set({
      title: title ?? current[0].title,
      summary: summary ?? current[0].summary,
      tags: tags.length > 0 ? JSON.stringify(tags) : current[0].tags,
      serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : current[0].serviceLines,
      yearsExperience: yearsExp ?? current[0].yearsExperience,
      education: education ?? current[0].education,
    }).where(eq(personnel.id, doc.staffId));

    console.log(`  Enriched staff id ${doc.staffId} from "${doc.title}"`);
  }

  // ── 3. Projects: find docs with projectName but no projectId ──────────────
  const projectOrphans = await db
    .select()
    .from(damDocuments)
    .where(isNull(damDocuments.projectId));

  const projectDocs = projectOrphans.filter(
    (d) => d.projectName && (d.docType === "project_sheet" || d.docType === "past_proposal")
  );

  console.log(`\nProject docs to process: ${projectDocs.length}`);

  for (const doc of projectDocs) {
    const meta = extractMeta(doc);
    const tags = parseTags(doc.tags);
    const serviceLines = meta.serviceLines ?? meta.disciplines ?? meta.service_lines ?? null;
    const description = doc.description ?? meta.description ?? meta.scope ?? null;
    const contractValue = doc.contractValue && !isNaN(parseFloat(String(doc.contractValue)))
      ? parseFloat(String(doc.contractValue)) : null;

    const existing = await db
      .select()
      .from(projects)
      .where(like(projects.name, `%${doc.projectName!.trim().substring(0, 40)}%`))
      .limit(1);

    if (existing.length > 0) {
      await db.update(projects).set({
        clientName: doc.clientName ?? existing[0].clientName,
        description: description ?? existing[0].description,
        contractValue: contractValue ?? existing[0].contractValue,
        tags: tags.length > 0 ? JSON.stringify(tags) : existing[0].tags,
        serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : existing[0].serviceLines,
      }).where(eq(projects.id, existing[0].id));

      await db.update(damDocuments).set({ projectId: existing[0].id }).where(eq(damDocuments.id, doc.id));
      console.log(`  Updated + linked project "${existing[0].name}" (id ${existing[0].id}) ← "${doc.title}"`);
    } else {
      const inserted = await db.insert(projects).values({
        name: doc.projectName!.trim(),
        clientName: doc.clientName ?? null,
        description: description ?? null,
        contractValue: contractValue ?? null,
        status: "completed",
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : null,
      } as any).$returningId();

      const newId = (inserted as any)[0]?.id;
      if (newId) {
        await db.update(damDocuments).set({ projectId: newId }).where(eq(damDocuments.id, doc.id));
        console.log(`  Created project "${doc.projectName}" (id ${newId}) ← "${doc.title}"`);
      }
    }
  }

  // ── 4. Also enrich already-linked project records ─────────────────────────
  const linkedProjectDocs = await db
    .select()
    .from(damDocuments)
    .where(eq(damDocuments.docType, "project_sheet"));

  console.log(`\nEnriching ${linkedProjectDocs.length} project sheet docs already linked...`);
  for (const doc of linkedProjectDocs) {
    if (!doc.projectId) continue;
    const meta = extractMeta(doc);
    const tags = parseTags(doc.tags);
    const serviceLines = meta.serviceLines ?? meta.disciplines ?? meta.service_lines ?? null;
    const description = doc.description ?? meta.description ?? meta.scope ?? null;
    const contractValue = doc.contractValue && !isNaN(parseFloat(String(doc.contractValue)))
      ? parseFloat(String(doc.contractValue)) : null;

    const current = await db.select().from(projects).where(eq(projects.id, doc.projectId)).limit(1);
    if (current.length === 0) continue;

    await db.update(projects).set({
      clientName: doc.clientName ?? current[0].clientName,
      description: description ?? current[0].description,
      contractValue: contractValue ?? current[0].contractValue,
      tags: tags.length > 0 ? JSON.stringify(tags) : current[0].tags,
      serviceLines: serviceLines ? JSON.stringify(Array.isArray(serviceLines) ? serviceLines : [serviceLines]) : current[0].serviceLines,
    }).where(eq(projects.id, doc.projectId));

    console.log(`  Enriched project id ${doc.projectId} from "${doc.title}"`);
  }

  console.log("\n── Backfill + enrichment complete ─────────────────────────");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
