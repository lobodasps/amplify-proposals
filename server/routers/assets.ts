import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assets, assetTags } from "../../drizzle/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { invokeLLMWithSkill } from "../_core/llmSkill";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTagIds(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function assetHasTags(asset: { tags: unknown }, filterIds: string[]): boolean {
  if (filterIds.length === 0) return true;
  const ids = parseTagIds(asset.tags);
  return filterIds.every((id) => ids.includes(id));
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const assetsRouter = router({
  // ── Tag definitions ──────────────────────────────────────────────────────

  listTags: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    // Return tags with usage count
    const tags = await db.select().from(assetTags).orderBy(assetTags.name);
    const allAssets = await db.select({ tags: assets.tags }).from(assets);
    const usageMap: Record<string, number> = {};
    for (const a of allAssets) {
      for (const id of parseTagIds(a.tags)) {
        usageMap[id] = (usageMap[id] ?? 0) + 1;
      }
    }
    return tags.map((t) => ({ ...t, usageCount: usageMap[t.id] ?? 0 }));
  }),

  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(assetTags).values({
        name: input.name.trim(),
        color: input.color ?? "#6366f1",
      });
      const rows = await db.select().from(assetTags).where(eq(assetTags.name, input.name.trim())).limit(1);
      return rows[0];
    }),

  updateTag: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(64).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name.trim();
      if (input.color) updates.color = input.color;
      if (Object.keys(updates).length) {
        await db.update(assetTags).set(updates).where(eq(assetTags.id, input.id));
      }
      return { success: true };
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Remove this tag id from all assets that reference it
      const allAssets = await db.select({ id: assets.id, tags: assets.tags }).from(assets);
      for (const a of allAssets) {
        const ids = parseTagIds(a.tags);
        if (ids.includes(input.id)) {
          const updated = ids.filter((id) => id !== input.id);
          await db.update(assets).set({ tags: JSON.stringify(updated) }).where(eq(assets.id, a.id));
        }
      }
      await db.delete(assetTags).where(eq(assetTags.id, input.id));
      return { success: true };
    }),

  // ── Asset tag assignment ──────────────────────────────────────────────────

  updateAssetTags: protectedProcedure
    .input(z.object({
      assetId: z.string().uuid(),
      tagIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(assets)
        .set({ tags: JSON.stringify(input.tagIds) })
        .where(eq(assets.id, input.assetId));
      return { success: true };
    }),

  // ── Asset list with full filtering ───────────────────────────────────────

  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      assetType: z.string().optional(),
      folder: z.string().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input?.assetType && input.assetType !== "all") {
        conditions.push(eq(assets.assetType, input.assetType as any));
      }
      if (input?.folder && input.folder !== "all") {
        conditions.push(eq(assets.folder, input.folder));
      }
      if (input?.search) {
        conditions.push(like(assets.name, `%${input.search}%`));
      }

      const query = db.select().from(assets).orderBy(desc(assets.createdAt)).limit(500);
      const rows = conditions.length ? await query.where(and(...conditions)) : await query;

      // Tag filtering is done in-memory because tags are stored as JSON array of IDs
      const filterTagIds = input?.tagIds ?? [];
      return filterTagIds.length > 0
        ? rows.filter((r) => assetHasTags(r, filterTagIds))
        : rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(assets).where(eq(assets.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      assetType: z.string(),
      fileKey: z.string(),
      fileUrl: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      serviceLines: z.array(z.string()).optional(),
      folder: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(assets).values({
        name: input.name,
        description: input.description,
        assetType: (input.assetType as any) ?? "document",
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        tags: input.tagIds ? JSON.stringify(input.tagIds) : null,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        folder: input.folder ?? "root",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      assetType: z.string().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      folder: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.assetType !== undefined) updates.assetType = input.assetType;
      if (input.tagIds !== undefined) updates.tags = JSON.stringify(input.tagIds);
      if (input.folder !== undefined) updates.folder = input.folder;
      if (Object.keys(updates).length) {
        await db.update(assets).set(updates).where(eq(assets.id, input.id));
      }
      return { success: true };
    }),

  generateAltText: protectedProcedure
    .input(z.object({ assetName: z.string(), assetDescription: z.string().optional() }))
    .mutation(async ({ input }) => {
      const result = await invokeLLMWithSkill({
        skillType: "asset_tagger",
        variables: { assetName: input.assetName, description: input.assetDescription ?? "" },
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "asset_meta",
            strict: true,
            schema: {
              type: "object",
              properties: {
                altText: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["altText", "tags"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = (result.choices[0]?.message?.content as string) ?? "{}";
      try {
        return { ...JSON.parse(content), _provider: result._provider, _model: result._model };
      } catch {
        return { altText: "", tags: [], _provider: result._provider, _model: result._model };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(assets).where(eq(assets.id, input.id));
      return { success: true };
    }),
});
