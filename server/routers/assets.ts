import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assets } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const assetsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      assetType: z.string().optional(),
    }).optional())
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(assets).orderBy(desc(assets.createdAt)).limit(200);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
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
      tags: z.array(z.string()).optional(),
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
        tags: input.tags ? JSON.stringify(input.tags) : null,
        serviceLines: input.serviceLines ? JSON.stringify(input.serviceLines) : null,
        folder: input.folder ?? "root",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  generateAltText: protectedProcedure
    .input(z.object({ assetName: z.string(), assetDescription: z.string().optional() }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You generate concise, professional alt text and search tags for AEC digital assets." },
          { role: "user", content: `Generate alt text and 5-8 search tags for this AEC asset: "${input.assetName}". ${input.assetDescription ?? ""}. Return JSON with altText and tags array.` },
        ],
        response_format: {
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
      const content = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try { return JSON.parse(content); } catch { return { altText: "", tags: [] }; }
    }),
});
