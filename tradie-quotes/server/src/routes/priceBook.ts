import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";

export const priceBookRouter = Router();
priceBookRouter.use(requireAuth);

priceBookRouter.get("/", async (req: AuthedRequest, res) => {
  const items = await prisma.priceBookItem.findMany({
    where: { businessId: req.auth!.businessId },
    orderBy: { sortOrder: "asc" },
  });
  res.json(items);
});

const itemSchema = z.object({
  label: z.string().min(1),
  rate: z.number().nonnegative(),
  unit: z.string().min(1),
  sortOrder: z.number().optional(),
});

priceBookRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.priceBookItem.create({
    data: { ...parsed.data, businessId: req.auth!.businessId },
  });
  res.status(201).json(item);
});

priceBookRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.priceBookItem.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(item);
});

priceBookRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await prisma.priceBookItem.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
