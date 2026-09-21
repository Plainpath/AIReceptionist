import { Router } from "express";
import { prisma } from "../lib/db";
import { AuthedRequest, requireAuth } from "../lib/auth";

export const accountingRouter = Router();
accountingRouter.use(requireAuth);

const GST_RATE = 0.1;

async function paidInvoicesInRange(businessId: string, from?: string, to?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      businessId,
      status: "Paid",
      ...(from || to
        ? {
            payments: {
              some: {
                paidAt: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              },
            },
          }
        : {}),
    },
    include: { client: true, lines: true, payments: true },
    orderBy: { createdAt: "asc" },
  });

  return invoices.map((inv) => {
    const total = inv.payments.reduce((s, p) => s + p.amount, 0);
    const exGst = total / (1 + GST_RATE);
    const gst = total - exGst;
    const paidAt = inv.payments.reduce(
      (latest, p) => (p.paidAt > latest ? p.paidAt : latest),
      inv.payments[0]?.paidAt || inv.createdAt
    );
    return { id: inv.id, ref: inv.ref, client: inv.client, paidAt, exGst, gst, total };
  });
}

accountingRouter.get("/summary", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const rows = await paidInvoicesInRange(req.auth!.businessId, from, to);
  const totals = rows.reduce(
    (t, r) => ({ exGst: t.exGst + r.exGst, gst: t.gst + r.gst, total: t.total + r.total }),
    { exGst: 0, gst: 0, total: 0 }
  );
  res.json({ from: from || null, to: to || null, count: rows.length, totals, invoices: rows });
});

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

accountingRouter.get("/export.csv", async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const business = await prisma.business.findUniqueOrThrow({ where: { id: req.auth!.businessId } });
  const rows = await paidInvoicesInRange(req.auth!.businessId, from, to);

  const header = ["Date paid", "Invoice", "Client", "ABN", "Ex GST", "GST", "Total"];
  const lines = rows.map((r) =>
    [
      r.paidAt.toISOString().slice(0, 10),
      r.ref,
      r.client.name,
      business.abn,
      r.exGst.toFixed(2),
      r.gst.toFixed(2),
      r.total.toFixed(2),
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="paid-invoices-${from || "all"}-${to || "all"}.csv"`);
  res.send(csv);
});
