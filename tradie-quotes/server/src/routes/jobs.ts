import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { notifyClient } from "../lib/notify";
import { followUpDelayMinutes } from "../lib/followUps";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

jobsRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const jobs = await prisma.job.findMany({
    where: {
      businessId: req.auth!.businessId,
      ...(from || to
        ? {
            scheduledStart: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { client: true, quote: true },
    orderBy: { scheduledStart: "asc" },
  });
  res.json(jobs);
});

const createSchema = z.object({
  clientId: z.string().min(1),
  quoteId: z.string().optional(),
  title: z.string().min(1),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
});

jobsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const job = await prisma.job.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: parsed.data.clientId,
      quoteId: parsed.data.quoteId || null,
      title: parsed.data.title,
      assignedTo: parsed.data.assignedTo,
      notes: parsed.data.notes,
      scheduledStart: new Date(parsed.data.scheduledStart),
      scheduledEnd: new Date(parsed.data.scheduledEnd),
    },
    include: { client: true, quote: true },
  });
  res.status(201).json(job);
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["Scheduled", "In progress", "Completed", "Cancelled"]).optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
});

jobsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.job.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const isReschedule = !!(parsed.data.scheduledStart || parsed.data.scheduledEnd);
  const isCompleting = parsed.data.status === "Completed" && existing.status !== "Completed";

  const job = await prisma.job.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      scheduledStart: parsed.data.scheduledStart ? new Date(parsed.data.scheduledStart) : undefined,
      scheduledEnd: parsed.data.scheduledEnd ? new Date(parsed.data.scheduledEnd) : undefined,
      rescheduledAt: isReschedule ? new Date() : undefined,
      completedAt: isCompleting ? new Date() : undefined,
      followUpAt: isCompleting ? new Date(Date.now() + followUpDelayMinutes() * 60 * 1000) : undefined,
    },
    include: { client: true, quote: true },
  });

  if (isCompleting) {
    await prisma.activityEvent.create({
      data: {
        businessId: req.auth!.businessId,
        clientId: job.clientId,
        kind: "Job completed",
        text: `${job.title} marked completed. Follow-up scheduled.`,
      },
    });
  }

  if (isReschedule) {
    const when = job.scheduledStart.toLocaleString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    await prisma.activityEvent.create({
      data: {
        businessId: req.auth!.businessId,
        clientId: job.clientId,
        kind: "Job rescheduled",
        text: `${job.title} moved to ${when}.`,
      },
    });
    await notifyClient({
      client: existing.client,
      subject: `Your appointment has been rescheduled`,
      body: `Hi ${existing.client.name},\n\nYour appointment "${job.title}" has been rescheduled to ${when}.\n\nIf this doesn't work for you, just reply to let us know.`,
    });
  }

  res.json(job);
});

jobsRouter.post("/:id/notify-arrival", async (req: AuthedRequest, res) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true },
  });
  if (!job) return res.status(404).json({ error: "Not found" });

  const windowStart = new Date(Date.now() + 15 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

  const result = await notifyClient({
    client: job.client,
    subject: "We're on our way",
    body: `Hi ${job.client.name},\n\nWe're heading your way for "${job.title}" — expect us between ${fmt(windowStart)} and ${fmt(windowEnd)}.`,
  });

  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: job.clientId,
      kind: "Arrival window sent",
      text: `Arrival window (${fmt(windowStart)}–${fmt(windowEnd)}) sent for ${job.title}.`,
    },
  });

  res.json({ sent: result.sent, windowStart, windowEnd });
});

jobsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.job.deleteMany({ where: { id: req.params.id, businessId: req.auth!.businessId } });
  res.status(204).end();
});
