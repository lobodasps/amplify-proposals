import { Express } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB
});

export function registerUploadRoute(app: Express) {
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const ext = file.originalname.split(".").pop() ?? "bin";
      const timestamp = Date.now();
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `contract-analyzer/${timestamp}-${safeFileName}`;
      const { url } = await storagePut(key, file.buffer, file.mimetype);
      res.json({ url, key, fileName: file.originalname, size: file.size });
    } catch (err: any) {
      console.error("[Upload] Error:", err.message);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });
}
