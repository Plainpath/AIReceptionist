import { Router } from "express";
import { prisma } from "../lib/db";
import { totals, aud } from "../lib/money";

export const publicRouter = Router();

// Hosted link a client opens from the send sheet: view quote, tap Accept.
publicRouter.get("/quotes/:token", async (req, res) => {
  const quote = await prisma.quote.findUnique({
    where: { shareToken: req.params.token },
    include: { client: true, lines: true, business: true },
  });
  if (!quote) return res.status(404).send("Quote not found");
  await prisma.quote.update({ where: { id: quote.id }, data: { viewedCount: { increment: 1 } } });
  const t = totals(quote.lines, quote.business.depositPercent, 0);
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${quote.ref} · ${quote.business.name}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:32px auto;padding:0 16px;color:#1d1f20}
  h1{font-size:22px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
  .total{font-weight:700;font-size:18px;background:${quote.business.accentColor};color:#fff;padding:10px;margin-top:8px}
  button{width:100%;padding:14px;font-size:16px;font-weight:700;background:${quote.business.accentColor};color:#fff;border:0;border-radius:6px;margin-top:20px}
  .status{color:#2f6b52;font-weight:600}</style></head><body>
  <div style="color:${quote.business.accentColor};font-size:12px;letter-spacing:.1em;text-transform:uppercase">${quote.business.name}</div>
  <h1>Quotation ${quote.ref}</h1>
  <p>Prepared for ${quote.client.name}</p>
  ${quote.lines.map((l) => `<div class="row"><span>${l.label}</span><span>${aud(l.qty * l.rate, true)}</span></div>`).join("")}
  <div class="total">Total inc GST: ${aud(t.total, true)}</div>
  ${
    quote.status === "Accepted" || quote.status === "Invoiced"
      ? '<p class="status">You’ve accepted this quote. We’ll be in touch to schedule the work.</p>'
      : `<form method="post" action="/public/quotes/${quote.shareToken}/accept"><button type="submit">Accept quote</button></form>`
  }
  </body></html>`);
});

publicRouter.post("/quotes/:token/accept", async (req, res) => {
  const quote = await prisma.quote.update({
    where: { shareToken: req.params.token },
    data: { status: "Accepted" },
  });
  res.redirect(`/public/quotes/${quote.shareToken}`);
});

// Hosted invoice link: view + pay now (marks paid; no real card processor wired up).
publicRouter.get("/invoices/:token", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { shareToken: req.params.token },
    include: { client: true, lines: true, payments: true, business: true },
  });
  if (!invoice) return res.status(404).send("Invoice not found");
  await prisma.invoice.update({ where: { id: invoice.id }, data: { viewedCount: { increment: 1 } } });
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const t = totals(invoice.lines, invoice.business.depositPercent, paid);
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${invoice.ref} · ${invoice.business.name}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:32px auto;padding:0 16px;color:#1d1f20}
  h1{font-size:22px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
  .total{font-weight:700;font-size:18px;background:${invoice.business.accentColor};color:#fff;padding:10px;margin-top:8px}
  button{width:100%;padding:14px;font-size:16px;font-weight:700;background:${invoice.business.accentColor};color:#fff;border:0;border-radius:6px;margin-top:20px}
  .status{color:#2f6b52;font-weight:600}</style></head><body>
  <div style="color:${invoice.business.accentColor};font-size:12px;letter-spacing:.1em;text-transform:uppercase">${invoice.business.name}</div>
  <h1>Tax Invoice ${invoice.ref}</h1>
  <p>Billed to ${invoice.client.name}</p>
  ${invoice.lines.map((l) => `<div class="row"><span>${l.label}</span><span>${aud(l.qty * l.rate, true)}</span></div>`).join("")}
  <div class="total">Balance due: ${aud(Math.max(0, t.balance), true)}</div>
  ${
    t.balance <= 0.01
      ? '<p class="status">Paid in full — thank you.</p>'
      : `<form method="post" action="/public/invoices/${invoice.shareToken}/pay"><button type="submit">Pay now · ${aud(Math.max(0, t.balance), true)}</button></form>`
  }
  </body></html>`);
});

publicRouter.post("/invoices/:token/pay", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { shareToken: req.params.token },
    include: { lines: true, payments: true, business: true },
  });
  if (!invoice) return res.status(404).send("Invoice not found");
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const t = totals(invoice.lines, invoice.business.depositPercent, paid);
  const amount = Math.max(0, t.balance);
  if (amount > 0) {
    await prisma.payment.create({
      data: { invoiceId: invoice.id, amount, method: "Card", note: "Paid via hosted link" },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "Paid" } });
    await prisma.activityEvent.create({
      data: {
        businessId: invoice.businessId,
        clientId: invoice.clientId,
        kind: "Payment",
        text: "Paid via link · card. Receipt sent automatically.",
        invoiceId: invoice.id,
        amount,
      },
    });
  }
  res.redirect(`/public/invoices/${invoice.shareToken}`);
});
