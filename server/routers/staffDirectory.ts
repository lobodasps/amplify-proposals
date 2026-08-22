import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assets, certificationTypes, damDocuments, personnel, profiles, userCertifications } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export const staffDirectoryRouter = router({
  /**
   * v0 profiles are the staff system of record. Legacy personnel fields are
  * included only as proposal-specific compatibility information until review.
  */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const [profileRows, rawCertifications, legacyPeople] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.isActive, true)).orderBy(profiles.lastName),
      db.select({
        userId: userCertifications.userId,
        certificationId: userCertifications.certificationId,
        certificationName: certificationTypes.name,
        issueDate: userCertifications.issueDate,
        expirationDate: userCertifications.expirationDate,
        issuingAuthority: userCertifications.issuingAuthority,
        certificateFilePath: userCertifications.certificateFilePath,
        notes: userCertifications.notes,
      })
        .from(userCertifications)
        .innerJoin(certificationTypes, eq(userCertifications.certificationId, certificationTypes.id))
        .where(or(isNull(userCertifications.expirationDate), gte(userCertifications.expirationDate, new Date().toISOString().slice(0, 10)))),
      db.select().from(personnel).orderBy(personnel.name).limit(500),
    ]);
    const legacyByProfileId = new Map(
      legacyPeople.filter((item) => item.userId).map((item) => [item.userId!, item]),
    );
    const certificationsByProfileId = new Map<string, typeof rawCertifications>();
    rawCertifications.forEach((certification) => {
      const list = certificationsByProfileId.get(certification.userId) ?? [];
      list.push(certification);
      certificationsByProfileId.set(certification.userId, list);
    });

    return profileRows.map((profile) => {
      const legacy = legacyByProfileId.get(profile.id);
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email || "Unnamed staff member";
      return {
        id: profile.id,
        name: fullName,
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        email: profile.email,
        phone: profile.phoneNumber,
        title: legacy?.title ?? profile.laborCategory ?? null,
        summary: legacy?.summary ?? null,
        yearsExperience: legacy?.yearsExperience ?? null,
        education: legacy?.education ?? null,
        serviceLines: parseJsonArray(legacy?.serviceLines),
        proposalTags: parseJsonArray(legacy?.tags),
        legacyPersonnelId: legacy?.id ?? null,
        employeeId: profile.employeeId,
        certifications: (certificationsByProfileId.get(profile.id) ?? []).map((certification) => ({
          id: certification.certificationId,
          name: certification.certificationName,
          issueDate: certification.issueDate,
          expirationDate: certification.expirationDate,
          issuingAuthority: certification.issuingAuthority,
          certificateFilePath: certification.certificateFilePath,
          notes: certification.notes,
        })),
      };
    });
  }),

  /** Lists evidence linked to the canonical profile ID plus any approved legacy personnel record. */
  listEvidence: protectedProcedure
    .input(z.object({ staffId: z.string().uuid(), legacyPersonnelId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { assets: [], documents: [] };
      const ids = [input.staffId, input.legacyPersonnelId].filter((id): id is string => Boolean(id));
      const [assetRows, documentRows] = await Promise.all([
        db.select().from(assets).where(inArray(assets.staffId, ids)).orderBy(desc(assets.createdAt)),
        db.select().from(damDocuments).where(inArray(damDocuments.staffId, ids)).orderBy(desc(damDocuments.createdAt)),
      ]);
      return { assets: assetRows, documents: documentRows };
    }),

  /** Legacy resumes/certifications with free-text names stay visible for human review. */
  listUnlinkedDocuments: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: damDocuments.id,
      title: damDocuments.title,
      docType: damDocuments.docType,
      staffName: damDocuments.staffName,
      createdAt: damDocuments.createdAt,
    })
      .from(damDocuments)
      .where(and(
        inArray(damDocuments.docType, ["resume", "certification"]),
        isNull(damDocuments.staffId),
      ))
      .orderBy(desc(damDocuments.createdAt))
      .limit(50);
  }),

  /** Legacy proposal staff entries are retained for review rather than inferred against v0 profiles. */
  listLegacyPersonnelNeedingReview: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const [profileRows, legacyPeople] = await Promise.all([
      db.select({ id: profiles.id }).from(profiles),
      db.select({
      id: personnel.id,
      userId: personnel.userId,
      name: personnel.name,
      title: personnel.title,
      email: personnel.email,
      }).from(personnel).orderBy(personnel.name).limit(500),
    ]);
    const profileIds = new Set(profileRows.map((profile) => profile.id));
    return legacyPeople.filter((person) => !person.userId || !profileIds.has(person.userId));
  }),
});
