import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

leadsRouter.get("/", async (req: AuthedRequest, res) => {
  const status = (req.query.status as string) || "New";
  const leads = await prisma.lead.findMany({
    where: { businessId: req.auth!.businessId, status },
    include: { client: true },
    orderBy: { receivedAt: "desc" },
  });
  res.json(leads);
});

const createSchema = z.object({
  clientId: z.string().min(1),
  source: z.string().min(1),
  snippet: z.string().min(1),
});

leadsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const lead = await prisma.lead.create({
    data: { ...parsed.data, businessId: req.auth!.businessId },
  });
  res.status(201).json(lead);
});

leadsRouter.post("/:id/dismiss", async (req: AuthedRequest, res) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { status: "Dismissed" },
  });
  res.json(lead);
});
