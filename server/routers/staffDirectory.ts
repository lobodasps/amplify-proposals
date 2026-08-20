import { z } from "zod";
import { and, desc, inArray, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { supabase } from "../supabase";
import { getDb } from "../db";
import { assets, damDocuments, personnel } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

type V0Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  labor_category: string | null;
  is_active: boolean | null;
  employer_company_id: string | null;
  employee_id: string | null;
};

type V0Certification = {
  user_id: string;
  certification_id: string;
  issue_date: string | null;
  expiration_date: string | null;
  issuing_authority: string | null;
  certificate_file_path: string | null;
  notes: string | null;
};

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
    const [profilesResult, certificationsResult, legacyDb] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name, phone_number, labor_category, is_active, employer_company_id, employee_id")
        .eq("is_active", true)
        .order("last_name", { ascending: true }),
      supabase
        .from("user_certifications")
        .select("user_id, certification_id, issue_date, expiration_date, issuing_authority, certificate_file_path, notes"),
      getDb(),
    ]);

    if (profilesResult.error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: profilesResult.error.message });
    }
    if (certificationsResult.error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: certificationsResult.error.message });
    }

    const rawCertifications = (certificationsResult.data ?? []) as V0Certification[];
    const certificationIds = Array.from(new Set(rawCertifications.map((item) => item.certification_id).filter(Boolean)));
    const certificationNames = new Map<string, string>();
    if (certificationIds.length > 0) {
      const { data, error } = await supabase
        .from("certification_types")
        .select("id, name")
        .in("id", certificationIds);
      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
      (data ?? []).forEach((item: { id: string; name: string }) => certificationNames.set(item.id, item.name));
    }

    const legacyPeople = legacyDb
      ? await legacyDb.select().from(personnel).orderBy(personnel.name).limit(500)
      : [];
    const legacyByProfileId = new Map(
      legacyPeople.filter((item) => item.userId).map((item) => [item.userId!, item]),
    );
    const certificationsByProfileId = new Map<string, V0Certification[]>();
    rawCertifications.forEach((certification) => {
      const list = certificationsByProfileId.get(certification.user_id) ?? [];
      list.push(certification);
      certificationsByProfileId.set(certification.user_id, list);
    });

    return ((profilesResult.data ?? []) as V0Profile[]).map((profile) => {
      const legacy = legacyByProfileId.get(profile.id);
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Unnamed staff member";
      return {
        id: profile.id,
        name: fullName,
        firstName: profile.first_name ?? "",
        lastName: profile.last_name ?? "",
        email: profile.email,
        phone: profile.phone_number,
        title: legacy?.title ?? profile.labor_category ?? null,
        summary: legacy?.summary ?? null,
        yearsExperience: legacy?.yearsExperience ?? null,
        education: legacy?.education ?? null,
        serviceLines: parseJsonArray(legacy?.serviceLines),
        proposalTags: parseJsonArray(legacy?.tags),
        legacyPersonnelId: legacy?.id ?? null,
        employeeId: profile.employee_id,
        certifications: (certificationsByProfileId.get(profile.id) ?? []).map((certification) => ({
          id: certification.certification_id,
          name: certificationNames.get(certification.certification_id) ?? "Certification",
          issueDate: certification.issue_date,
          expirationDate: certification.expiration_date,
          issuingAuthority: certification.issuing_authority,
          certificateFilePath: certification.certificate_file_path,
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
    const [profilesResult, db] = await Promise.all([
      supabase.from("profiles").select("id"),
      getDb(),
    ]);
    if (profilesResult.error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: profilesResult.error.message });
    }
    if (!db) return [];
    const profileIds = new Set((profilesResult.data ?? []).map((profile: { id: string }) => profile.id));
    const legacyPeople = await db.select({
      id: personnel.id,
      userId: personnel.userId,
      name: personnel.name,
      title: personnel.title,
      email: personnel.email,
    }).from(personnel).orderBy(personnel.name).limit(500);
    return legacyPeople.filter((person) => !person.userId || !profileIds.has(person.userId));
  }),
});
