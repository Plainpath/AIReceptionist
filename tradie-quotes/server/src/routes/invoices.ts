import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { totals } from "../lib/money";
import { renderQuotePdf } from "../pdf/renderDocPdf";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

function withTotals(invoice: any, depositPercent: number) {
  const paid = (invoice.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
  const t = totals(invoice.lines, depositPercent, paid);
  return { ...invoice, paid, totals: t };
}

invoicesRouter.get("/", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const invoices = await prisma.invoice.findMany({
    where: { businessId: req.auth!.businessId },
    include: { client: true, lines: true, payments: true, quote: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(invoices.map((i) => withTotals(i, business.depositPercent)));
});

invoicesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true, lines: true, payments: true },
  });
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.json(withTotals(invoice, business.depositPercent));
});

invoicesRouter.post("/:id/send", async (req: AuthedRequest, res) => {
  const shareToken = crypto.randomBytes(12).toString("hex");
  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { shareToken },
    include: { client: true },
  });
  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: invoice.clientId,
      kind: "Invoice sent",
      text: `Invoice ${invoice.ref} sent to ${invoice.client.name}.`,
      invoiceId: invoice.id,
    },
  });
  res.json(invoice);
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["Bank transfer", "Card", "Cash", "Other"]),
  note: z.string().optional(),
});

invoicesRouter.post("/:id/payments", async (req: AuthedRequest, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { lines: true, payments: true, client: true },
  });

  const payment = await prisma.payment.create({
    data: { invoiceId: invoice.id, ...parsed.data },
  });

  const paidTotal = [...invoice.payments, payment].reduce((s, p) => s + p.amount, 0);
  const t = totals(invoice.lines, business.depositPercent, paidTotal);
  const status = t.balance <= 0.01 ? "Paid" : "Part paid";
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status } });

  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: invoice.clientId,
      kind: "Payment",
      text:
        status === "Paid"
          ? `Paid in full, receipt sent automatically.`
          : `Part payment of $${parsed.data.amount.toFixed(2)} received.`,
      invoiceId: invoice.id,
      amount: parsed.data.amount,
    },
  });

  res.status(201).json({ payment, status, balance: Math.max(0, t.balance) });
});

invoicesRouter.get("/:id/pdf", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true, lines: true, payments: true },
  });
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.ref}.pdf"`);
  renderQuotePdf(res, {
    business,
    doc: invoice,
    lines: invoice.lines,
    client: invoice.client,
    kind: "invoice",
    paid: invoice.payments.reduce((s, p) => s + p.amount, 0),
  });
});
