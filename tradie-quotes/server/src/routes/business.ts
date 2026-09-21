import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";

export const businessRouter = Router();
businessRouter.use(requireAuth);

businessRouter.get("/", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.auth!.businessId },
    include: { services: true },
  });
  res.json(business);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  accentColor: z.string().optional(),
  abn: z.string().optional(),
  licence: z.string().optional(),
  gstRegistered: z.boolean().optional(),
  bsb: z.string().optional(),
  accountNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  defaultShape: z.enum(["Flat price", "Labour + materials", "Itemised"]).optional(),
  showLeadSources: z.boolean().optional(),
  employeeSeats: z.number().int().min(0).max(100).optional(),
});

businessRouter.patch("/", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const business = await prisma.business.update({
    where: { id: req.auth!.businessId },
    data: parsed.data,
  });
  res.json(business);
});
