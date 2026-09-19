import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";
import { totals } from "../lib/money";
import { parseVoiceTranscript } from "../lib/voiceParse";
import { renderQuotePdf } from "../pdf/renderDocPdf";

export const quotesRouter = Router();
quotesRouter.use(requireAuth);

async function nextQuoteRef(businessId: string) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { nextQuoteSeq: { increment: 1 } },
  });
  return `QUO-${String(business.nextQuoteSeq).padStart(4, "0")}`;
}

function withTotals(quote: any, depositPercent: number) {
  const paid = 0;
  const t = totals(quote.lines, depositPercent, paid);
  return { ...quote, totals: t };
}

quotesRouter.get("/", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const quotes = await prisma.quote.findMany({
    where: { businessId: req.auth!.businessId },
    include: { client: true, lines: true, invoice: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(quotes.map((q) => withTotals(q, business.depositPercent)));
});

quotesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } }, invoice: true, lead: true },
  });
  if (!quote) return res.status(404).json({ error: "Not found" });
  res.json(withTotals(quote, business.depositPercent));
});

const createSchema = z.object({
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  shape: z.enum(["Flat price", "Labour + materials", "Itemised"]).optional(),
  lines: z
    .array(z.object({ label: z.string(), qty: z.number(), unit: z.string(), rate: z.number() }))
    .optional(),
});

quotesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { clientId, leadId, shape, lines } = parsed.data;

  let resolvedClientId = clientId;
  if (!resolvedClientId && leadId) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    resolvedClientId = lead.clientId;
  }
  if (!resolvedClientId) return res.status(400).json({ error: "clientId or leadId required" });

  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const ref = await nextQuoteRef(req.auth!.businessId);

  const quote = await prisma.quote.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: resolvedClientId,
      leadId: leadId || null,
      ref,
      shape: shape || business.defaultShape,
      lines: { create: (lines || []).map((l, i) => ({ ...l, sortOrder: i })) },
    },
    include: { client: true, lines: true },
  });

  if (leadId) await prisma.lead.update({ where: { id: leadId }, data: { status: "Quoted" } });

  res.status(201).json(withTotals(quote, business.depositPercent));
});

const shapeSchema = z.object({ shape: z.enum(["Flat price", "Labour + materials", "Itemised"]) });

quotesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = shapeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const quote = await prisma.quote.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(quote);
});

const lineSchema = z.object({
  label: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  rate: z.number().nonnegative(),
});

quotesRouter.post("/:id/lines", async (req: AuthedRequest, res) => {
  const parsed = lineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const count = await prisma.quoteLine.count({ where: { quoteId: req.params.id } });
  const line = await prisma.quoteLine.create({
    data: { ...parsed.data, quoteId: req.params.id, sortOrder: count },
  });
  res.status(201).json(line);
});

quotesRouter.post("/:id/lines/bulk", async (req: AuthedRequest, res) => {
  const parsed = z.array(lineSchema).safeParse(req.body.lines);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const count = await prisma.quoteLine.count({ where: { quoteId: req.params.id } });
  const created = await prisma.$transaction(
    parsed.data.map((l, i) =>
      prisma.quoteLine.create({ data: { ...l, quoteId: req.params.id, sortOrder: count + i } })
    )
  );
  res.status(201).json(created);
});

quotesRouter.delete("/:id/lines/:lineId", async (req: AuthedRequest, res) => {
  await prisma.quoteLine.delete({ where: { id: req.params.lineId } });
  res.status(204).end();
});

quotesRouter.post("/:id/voice-parse", async (req: AuthedRequest, res) => {
  const transcript = String(req.body.transcript || "");
  const book = await prisma.priceBookItem.findMany({ where: { businessId: req.auth!.businessId } });
  const parsed = parseVoiceTranscript(transcript, book);
  res.json({ transcript, parsed });
});

quotesRouter.post("/:id/send", async (req: AuthedRequest, res) => {
  const shareToken = crypto.randomBytes(12).toString("hex");
  const quote = await prisma.quote.update({
    where: { id: req.params.id },
    data: { status: "Sent", sentAt: new Date(), shareToken },
    include: { client: true },
  });
  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: quote.clientId,
      kind: "Quote sent",
      text: `Quote ${quote.ref} sent to ${quote.client.name}.`,
      quoteId: quote.id,
    },
  });
  res.json(quote);
});

quotesRouter.post("/:id/accept", async (req: AuthedRequest, res) => {
  const quote = await prisma.quote.update({ where: { id: req.params.id }, data: { status: "Accepted" } });
  res.json(quote);
});

quotesRouter.post("/:id/convert-to-invoice", async (req: AuthedRequest, res) => {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { lines: true, client: true },
  });
  const business = await prisma.business.update({
    where: { id: req.auth!.businessId },
    data: { nextInvoiceSeq: { increment: 1 } },
  });
  const ref = `INV-${String(business.nextInvoiceSeq).padStart(4, "0")}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invoice = await prisma.invoice.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: quote.clientId,
      quoteId: quote.id,
      ref,
      dueDate,
      lines: {
        create: quote.lines.map((l, i) => ({
          label: l.label,
          qty: l.qty,
          unit: l.unit,
          rate: l.rate,
          sortOrder: i,
        })),
      },
    },
    include: { lines: true, client: true },
  });
  await prisma.quote.update({ where: { id: quote.id }, data: { status: "Invoiced" } });
  await prisma.activityEvent.create({
    data: {
      businessId: req.auth!.businessId,
      clientId: quote.clientId,
      kind: "Invoice created",
      text: `${invoice.ref} created from ${quote.ref}.`,
      invoiceId: invoice.id,
    },
  });
  res.status(201).json(invoice);
});

quotesRouter.get("/:id/pdf", async (req: AuthedRequest, res) => {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const quote = await prisma.quote.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId },
    include: { client: true, lines: true },
  });
  if (!quote) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${quote.ref}.pdf"`);
  renderQuotePdf(res, { business, doc: quote, lines: quote.lines, client: quote.client, kind: "quote" });
});
