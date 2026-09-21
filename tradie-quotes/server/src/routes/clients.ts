import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { totals } from "../lib/money";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get("/", async (req: AuthedRequest, res) => {
  const clients = await prisma.client.findMany({
    where: { businessId: req.auth!.businessId },
    orderBy: { createdAt: "desc" },
  });
  res.json(clients);
});

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  email: z.string().email().optional(),
  origin: z.string().optional(),
});

const updateSchema = createSchema.partial();

clientsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await prisma.client.create({
    data: { ...parsed.data, businessId: req.auth!.businessId },
  });
  res.status(201).json(client);
});

clientsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const client = await prisma.client.updateMany({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    data: parsed.data,
  });
  if (!client.count) return res.status(404).json({ error: "Not found" });
  res.json(await prisma.client.findUnique({ where: { id: req.params.id } }));
});

clientsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
  });
  if (!client) return res.status(404).json({ error: "Not found" });

  const [activity, invoices, lifetimePayments] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { clientId: client.id },
      orderBy: { occurredAt: "desc" },
      include: { quote: true, invoice: true },
    }),
    prisma.invoice.findMany({
      where: { clientId: client.id },
      include: { lines: true, payments: true },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { invoice: { clientId: client.id } },
    }),
  ]);

  const outstanding = invoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((p, x) => p + x.amount, 0);
    const t = totals(inv.lines, business.depositPercent, paid);
    return sum + Math.max(0, t.balance);
  }, 0);

  res.json({
    ...client,
    outstanding,
    lifetime: lifetimePayments._sum.amount || 0,
    activity,
  });
});
