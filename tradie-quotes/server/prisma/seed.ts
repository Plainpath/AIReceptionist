import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-16T09:00:00+10:00");
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * 60 * 60 * 1000);

async function main() {
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.activityEvent.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.quoteLine.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.priceBookItem.deleteMany(),
    prisma.connectedService.deleteMany(),
    prisma.client.deleteMany(),
    prisma.user.deleteMany(),
    prisma.business.deleteMany(),
  ]);

  const business = await prisma.business.create({
    data: {
      name: "Chalon Plumbing",
      accentColor: "#4A76B8",
      abn: "54 221 908 116",
      licence: "PL 48213 (VIC)",
      gstRegistered: true,
      bsb: "063-118",
      accountNumber: "1084 2210",
      address: "6 Foundry Lane, Brunswick VIC 3056",
      phone: "0412 884 210",
      depositPercent: 20,
      defaultShape: "Labour + materials",
      showLeadSources: true,
      nextQuoteSeq: 220,
      nextInvoiceSeq: 143,
    },
  });

  await prisma.user.create({
    data: {
      businessId: business.id,
      email: "owner@chalonplumbing.com.au",
      passwordHash: await bcrypt.hash("password123", 10),
      name: "Marco Chalon",
      role: "Owner",
    },
  });

  await prisma.connectedService.createMany({
    data: [
      { businessId: business.id, name: "Website chat bot", note: "Captures job details, address, urgency", state: "Live" },
      { businessId: business.id, name: "AI secretary", note: "Answers missed calls, transcribes, creates leads", state: "Live" },
      { businessId: business.id, name: "Pay by card on links", note: "1.7% + 30c, passed on or absorbed", state: "On" },
      { businessId: business.id, name: "Accounting export", note: "Xero / MYOB CSV", state: "Not set" },
    ],
  });

  await prisma.priceBookItem.createMany({
    data: [
      { businessId: business.id, label: "Labour — licensed plumber", rate: 110, unit: "hr", sortOrder: 0 },
      { businessId: business.id, label: "Apprentice labour", rate: 65, unit: "hr", sortOrder: 1 },
      { businessId: business.id, label: "Call-out fee (metro)", rate: 90, unit: "ea", sortOrder: 2 },
      { businessId: business.id, label: "Blocked drain clearing (electric eel)", rate: 180, unit: "ea", sortOrder: 3 },
      { businessId: business.id, label: "Hot water system install (continuous flow gas)", rate: 2200, unit: "ea", sortOrder: 4 },
      { businessId: business.id, label: "Tap/mixer replacement", rate: 165, unit: "ea", sortOrder: 5 },
      { businessId: business.id, label: "Toilet suite install (supply + fit)", rate: 480, unit: "ea", sortOrder: 6 },
      { businessId: business.id, label: "Gas compliance certificate", rate: 150, unit: "ea", sortOrder: 7 },
      { businessId: business.id, label: "CCTV drain camera inspection", rate: 220, unit: "ea", sortOrder: 8 },
      { businessId: business.id, label: "Pipe relining (per metre)", rate: 95, unit: "m", sortOrder: 9 },
    ],
  });

  const marcus = await prisma.client.create({
    data: { businessId: business.id, name: "Marcus Webb", address: "14 Ashgrove St, Brunswick VIC", origin: "From web chat" },
  });
  const priya = await prisma.client.create({
    data: { businessId: business.id, name: "Priya Nandan", address: "3/220 Nicholson St, Fitzroy VIC", origin: "From phone call" },
  });
  const bayside = await prisma.client.create({
    data: { businessId: business.id, name: "Bayside Cafe", address: "88 Beach Rd, Sandringham VIC", origin: "From web chat" },
  });
  const okafor = await prisma.client.create({
    data: { businessId: business.id, name: "D. Okafor", address: "22 Merri Pde, Northcote VIC", origin: "From web chat" },
  });
  const lindqvist = await prisma.client.create({
    data: { businessId: business.id, name: "K. Lindqvist", address: "9 Station St, Thornbury VIC", origin: "Manual" },
  });

  await prisma.lead.create({
    data: {
      businessId: business.id,
      clientId: marcus.id,
      source: "Web chat",
      snippet: "“Hot water system's died — no hot water, can you get here this week?”",
      receivedAt: ago(0, 0.2),
    },
  });
  await prisma.lead.create({
    data: {
      businessId: business.id,
      clientId: priya.id,
      source: "AI secretary · call",
      snippet: "Missed call, transcribed: kitchen tap won't stop dripping. Wants a quote before Friday. 0:48",
      receivedAt: ago(0, 1),
    },
  });
  await prisma.lead.create({
    data: {
      businessId: business.id,
      clientId: bayside.id,
      source: "Web chat",
      snippet: "“Three basins blocked out back, plus check the grease trap.”",
      receivedAt: ago(1),
    },
  });

  // QUO-0219 — Bayside Cafe, sent, viewed twice
  const q219 = await prisma.quote.create({
    data: {
      businessId: business.id,
      clientId: bayside.id,
      ref: "QUO-0219",
      shape: "Itemised",
      status: "Sent",
      viewedCount: 2,
      sentAt: ago(3),
      createdAt: ago(3),
      lines: {
        create: [
          { label: "Tap/mixer replacement", qty: 6, unit: "ea", rate: 165, sortOrder: 0 },
          { label: "Blocked drain clearing (electric eel)", qty: 2, unit: "ea", rate: 180, sortOrder: 1 },
          { label: "Labour — licensed plumber", qty: 24, unit: "hr", rate: 110, sortOrder: 2 },
        ],
      },
    },
  });

  // QUO-0216 — D. Okafor, declined
  await prisma.quote.create({
    data: {
      businessId: business.id,
      clientId: okafor.id,
      ref: "QUO-0216",
      shape: "Flat price",
      status: "Declined",
      createdAt: ago(9),
      lines: { create: [{ label: "Mainline pipe repair, supply and install", qty: 1, unit: "ea", rate: 891, sortOrder: 0 }] },
    },
  });

  // QUO-0211 — Marcus Webb, accepted then invoiced (history)
  const q211 = await prisma.quote.create({
    data: {
      businessId: business.id,
      clientId: marcus.id,
      ref: "QUO-0211",
      shape: "Labour + materials",
      status: "Invoiced",
      sentAt: ago(15),
      createdAt: ago(16),
      lines: {
        create: [
          { label: "Under-sink leak repair", qty: 1, unit: "ea", rate: 640, sortOrder: 0 },
          { label: "Isolation valve replacement", qty: 1, unit: "ea", rate: 86, sortOrder: 1 },
          { label: "Labour — licensed plumber", qty: 4, unit: "hr", rate: 110, sortOrder: 2 },
        ],
      },
    },
  });

  // INV-0139 — Marcus Webb, paid (from QUO-0211)
  const inv139 = await prisma.invoice.create({
    data: {
      businessId: business.id,
      clientId: marcus.id,
      quoteId: q211.id,
      ref: "INV-0139",
      status: "Paid",
      createdAt: ago(15),
      dueDate: ago(1),
      lines: {
        create: [
          { label: "Under-sink leak repair", qty: 1, unit: "ea", rate: 640, sortOrder: 0 },
          { label: "Isolation valve replacement", qty: 1, unit: "ea", rate: 86, sortOrder: 1 },
          { label: "Labour — licensed plumber", qty: 4, unit: "hr", rate: 110, sortOrder: 2 },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: { invoiceId: inv139.id, amount: 1120, method: "Bank transfer", paidAt: ago(15) },
  });

  // INV-0141 — K. Lindqvist, paid
  const inv141 = await prisma.invoice.create({
    data: {
      businessId: business.id,
      clientId: lindqvist.id,
      ref: "INV-0141",
      status: "Paid",
      createdAt: ago(10),
      dueDate: ago(3),
      lines: {
        create: [
          { label: "Hot water system replacement (storage, 250L)", qty: 1, unit: "ea", rate: 1240, sortOrder: 0 },
          { label: "Labour — licensed plumber", qty: 8, unit: "hr", rate: 110, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: { invoiceId: inv141.id, amount: 2640, method: "Card", note: "Card via hosted link", paidAt: ago(8) },
  });

  // INV-0142 — Bayside Cafe, overdue
  await prisma.invoice.create({
    data: {
      businessId: business.id,
      clientId: bayside.id,
      ref: "INV-0142",
      status: "Overdue",
      createdAt: ago(28),
      dueDate: ago(14),
      lines: { create: [{ label: "Sewer line replacement (partial)", qty: 1, unit: "ea", rate: 1800, sortOrder: 0 }] },
    },
  });

  await prisma.activityEvent.createMany({
    data: [
      {
        businessId: business.id,
        clientId: marcus.id,
        kind: "Web chat",
        text: "“Hot water system's died — no hot water, can you get here this week?” Bot captured address and preferred day.",
        occurredAt: ago(0, 0.2),
      },
      {
        businessId: business.id,
        clientId: marcus.id,
        kind: "Quote sent",
        text: "Quote for under-sink leak repair and isolation valve replacement — accepted same day.",
        occurredAt: ago(14),
        quoteId: q211.id,
        amount: 1120,
      },
      {
        businessId: business.id,
        clientId: marcus.id,
        kind: "Payment",
        text: "Bank transfer received, receipt sent automatically.",
        occurredAt: ago(15),
        invoiceId: inv139.id,
        amount: 1120,
      },
      {
        businessId: business.id,
        clientId: marcus.id,
        kind: "Call",
        text: "AI secretary answered, 1:12 — booked Tuesday morning, added to calendar.",
        occurredAt: ago(19),
      },
      {
        businessId: business.id,
        clientId: marcus.id,
        kind: "Job",
        text: "Full bathroom repipe, two days on site. 6 photos attached.",
        occurredAt: ago(66),
      },
    ],
  });

  console.log("Seeded Chalon Plumbing — login owner@chalonplumbing.com.au / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
