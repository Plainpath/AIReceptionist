import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { totals } from "../lib/money";
import { renderQuotePdf } from "../pdf/renderDocPdf";
import { uploadFilePath } from "../lib/uploadStorage";

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
    include: { client: true, lines: true, payments: true, photos: true },
  });
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.json(withTotals(invoice, business.depositPercent));
});

// Photos taken on jobs for this invoice's client, available to attach as
// completion photos — whether or not they're already attached elsewhere.
invoicesRouter.get("/:id/available-photos", async (req: AuthedRequest, res) => {
  const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const photos = await prisma.jobPhoto.findMany({
    where: { businessId: req.auth!.businessId, job: { clientId: invoice.clientId } },
    include: { job: true },
    orderBy: { takenAt: "desc" },
  });
  res.json(photos);
});

const attachPhotosSchema = z.object({ photoIds: z.array(z.string()).min(1) });

invoicesRouter.post("/:id/photos", async (req: AuthedRequest, res) => {
  const parsed = attachPhotosSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
  if (!invoice) return res.status(404).json({ error: "Not found" });

  const result = await prisma.jobPhoto.updateMany({
    where: { id: { in: parsed.data.photoIds }, businessId: req.auth!.businessId, job: { clientId: invoice.clientId } },
    data: { invoiceId: invoice.id },
  });

  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: invoice.clientId,
      kind: "Photos attached",
      text: `${result.count} completion photo${result.count === 1 ? "" : "s"} attached to ${invoice.ref}.`,
      invoiceId: invoice.id,
    },
  });

  res.status(201).json({ attached: result.count });
});

invoicesRouter.delete("/:id/photos/:photoId", async (req: AuthedRequest, res) => {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: req.params.photoId, invoiceId: req.params.id, businessId: req.auth!.businessId },
  });
  if (!photo) return res.status(404).json({ error: "Not found" });
  await prisma.jobPhoto.update({ where: { id: photo.id }, data: { invoiceId: null } });
  res.status(204).end();
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

const variationLineSchema = z.object({
  label: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  rate: z.number().nonnegative(),
});

invoicesRouter.post("/:id/lines/bulk", async (req: AuthedRequest, res) => {
  const parsed = z.array(variationLineSchema).safeParse(req.body.lines);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, businessId: req.auth!.businessId } });
  if (!invoice) return res.status(404).json({ error: "Not found" });

  const count = await prisma.invoiceLine.count({ where: { invoiceId: invoice.id } });
  const created = await prisma.$transaction(
    parsed.data.map((l, i) =>
      prisma.invoiceLine.create({ data: { ...l, invoiceId: invoice.id, sortOrder: count + i, isVariation: true } })
    )
  );

  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: invoice.clientId,
      kind: "Variation added",
      text: `${created.length} variation${created.length === 1 ? "" : "s"} added to ${invoice.ref}: ${parsed.data.map((l) => l.label).join(", ")}.`,
      invoiceId: invoice.id,
    },
  });

  res.status(201).json(created);
});

invoicesRouter.get("/:id/pdf", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true, lines: true, payments: true, photos: true },
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
    photos: invoice.photos.map((p) => ({ path: uploadFilePath("job-photos", p.businessId, p.storedName), takenAt: p.takenAt })),
  });
});
