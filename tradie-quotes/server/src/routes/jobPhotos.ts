import { Router } from "express";
import fs from "fs";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { makeUpload, uploadFilePath } from "../lib/uploadStorage";

export const jobPhotosRouter = Router({ mergeParams: true });

const SUBDIR = "job-photos";
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);
const upload = makeUpload(SUBDIR, ALLOWED_MIME, 15 * 1024 * 1024);

jobPhotosRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const job = await prisma.job.findFirst({ where: { id: req.params.jobId, businessId: req.auth!.businessId } });
  if (!job) return res.status(404).json({ error: "Not found" });
  const photos = await prisma.jobPhoto.findMany({ where: { jobId: job.id }, orderBy: { takenAt: "desc" } });
  res.json(photos);
});

const geoSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

jobPhotosRouter.post("/", requireAuth, (req: AuthedRequest, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "file is required" });

    const job = await prisma.job.findFirst({ where: { id: req.params.jobId, businessId: req.auth!.businessId } });
    if (!job) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Not found" });
    }

    const parsed = geoSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: job.id,
        businessId: req.auth!.businessId,
        filename: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      },
    });
    res.status(201).json(photo);
  });
});

// Unauthenticated by design, same pattern as safety docs / share links.
jobPhotosRouter.get("/:photoId/file", async (req, res) => {
  const photo = await prisma.jobPhoto.findUnique({ where: { id: req.params.photoId } });
  if (!photo) return res.status(404).json({ error: "Not found" });
  const filePath = uploadFilePath(SUBDIR, photo.businessId, photo.storedName);
  res.setHeader("Content-Type", photo.mimeType);
  res.sendFile(filePath);
});

jobPhotosRouter.delete("/:photoId", requireAuth, async (req: AuthedRequest, res) => {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: req.params.photoId, businessId: req.auth!.businessId },
  });
  if (!photo) return res.status(404).json({ error: "Not found" });
  fs.unlink(uploadFilePath(SUBDIR, req.auth!.businessId, photo.storedName), () => {});
  await prisma.jobPhoto.delete({ where: { id: photo.id } });
  res.status(204).end();
});
