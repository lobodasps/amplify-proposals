import { Express } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (matches Supabase dam bucket limit)
});

const ALLOWED_FOLDERS = [
  "contract-analyzer",
  "staff",
  "projects",
  "assets",
  "rfp",
  "proposals",
] as const;

export function registerUploadRoute(app: Express) {
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      // Allow callers to specify a storage folder; default to contract-analyzer for backwards compat
      const requestedFolder = (req.body?.folder as string) ?? "contract-analyzer";
      const folder = ALLOWED_FOLDERS.includes(requestedFolder as any)
        ? requestedFolder
        : "contract-analyzer";

      const timestamp = Date.now();
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${folder}/${timestamp}-${safeFileName}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      res.json({ url, key, fileName: file.originalname, size: file.size });
    } catch (err: any) {
      console.error("[Upload] Error:", err.message);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });
}
