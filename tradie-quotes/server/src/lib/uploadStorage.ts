import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import type { AuthedRequest } from "./auth";

export function uploadRoot(subdir: string) {
  return path.join(process.cwd(), "uploads", subdir);
}

export function uploadFilePath(subdir: string, businessId: string, storedName: string) {
  return path.join(uploadRoot(subdir), businessId, storedName);
}

export function makeUpload(subdir: string, allowedMime: Set<string>, maxBytes: number) {
  const storage = multer.diskStorage({
    destination: (req: AuthedRequest, _file, cb) => {
      const dir = path.join(uploadRoot(subdir), req.auth!.businessId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
      cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!allowedMime.has(file.mimetype)) return cb(new Error("Unsupported file type"));
      cb(null, true);
    },
  });
}
