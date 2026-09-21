import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";

export const timesheetsRouter = Router();
timesheetsRouter.use(requireAuth);

timesheetsRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to, userId } = req.query as { from?: string; to?: string; userId?: string };
  const isOwner = req.auth!.role === "Owner";

  const entries = await prisma.timesheetEntry.findMany({
    where: {
      businessId: req.auth!.businessId,
      userId: isOwner ? userId || undefined : req.auth!.userId,
      ...(from || to
        ? { clockIn: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { user: true, job: true },
    orderBy: { clockIn: "desc" },
  });
  res.json(entries.map((e) => ({ ...e, user: { id: e.user.id, name: e.user.name } })));
});

timesheetsRouter.get("/open", async (req: AuthedRequest, res) => {
  const entry = await prisma.timesheetEntry.findFirst({
    where: { userId: req.auth!.userId, clockOut: null },
    include: { job: true },
  });
  res.json(entry);
});

const clockInSchema = z.object({ jobId: z.string().optional(), note: z.string().optional() });

timesheetsRouter.post("/clock-in", async (req: AuthedRequest, res) => {
  const parsed = clockInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const open = await prisma.timesheetEntry.findFirst({ where: { userId: req.auth!.userId, clockOut: null } });
  if (open) return res.status(409).json({ error: "Already clocked in — clock out first" });

  const entry = await prisma.timesheetEntry.create({
    data: {
      businessId: req.auth!.businessId,
      userId: req.auth!.userId,
      jobId: parsed.data.jobId || null,
      note: parsed.data.note,
    },
    include: { job: true },
  });
  res.status(201).json(entry);
});

timesheetsRouter.post("/:id/clock-out", async (req: AuthedRequest, res) => {
  const entry = await prisma.timesheetEntry.findFirst({
    where: { id: req.params.id, userId: req.auth!.userId, businessId: req.auth!.businessId },
  });
  if (!entry) return res.status(404).json({ error: "Not found" });
  if (entry.clockOut) return res.status(409).json({ error: "Already clocked out" });

  const updated = await prisma.timesheetEntry.update({
    where: { id: entry.id },
    data: { clockOut: new Date() },
    include: { job: true },
  });
  res.json(updated);
});

timesheetsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const entry = await prisma.timesheetEntry.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
  if (!entry) return res.status(404).json({ error: "Not found" });
  if (req.auth!.role !== "Owner" && entry.userId !== req.auth!.userId) {
    return res.status(403).json({ error: "Not your entry" });
  }
  await prisma.timesheetEntry.delete({ where: { id: entry.id } });
  res.status(204).end();
});
