import { Router } from "express";
import fs from "fs";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { makeUpload, uploadFilePath } from "../lib/uploadStorage";

export const safetyDocsRouter = Router();

const SUBDIR = "safety-docs";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
]);

const upload = makeUpload(SUBDIR, ALLOWED_MIME, 20 * 1024 * 1024);

safetyDocsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const docs = await prisma.safetyDocument.findMany({
    where: { businessId: req.auth!.businessId },
    orderBy: { uploadedAt: "desc" },
  });
  res.json(docs);
});

const metaSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["JSA", "SWMS", "Other"]).default("Other"),
});

safetyDocsRouter.post("/", requireAuth, (req: AuthedRequest, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const parsed = metaSchema.safeParse({ title: req.body.title || req.file.originalname, category: req.body.category });
    if (!parsed.success) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const doc = await prisma.safetyDocument.create({
      data: {
        businessId: req.auth!.businessId,
        title: parsed.data.title,
        category: parsed.data.category,
        filename: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
    });
    res.status(201).json(doc);
  });
});

// Unauthenticated by design (same model as the quote/invoice share links): the
// id is an unguessable cuid, and this lets "Open" links work from a bare
// Linking.openURL() on mobile without attaching an auth header.
safetyDocsRouter.get("/:id/file", async (req, res) => {
  const doc = await prisma.safetyDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Not found" });
  const filePath = uploadFilePath(SUBDIR, doc.businessId, doc.storedName);
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
  res.sendFile(filePath);
});

safetyDocsRouter.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const doc = await prisma.safetyDocument.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
  });
  if (!doc) return res.status(404).json({ error: "Not found" });
  const filePath = uploadFilePath(SUBDIR, req.auth!.businessId, doc.storedName);
  fs.unlink(filePath, () => {});
  await prisma.safetyDocument.delete({ where: { id: doc.id } });
  res.status(204).end();
});
