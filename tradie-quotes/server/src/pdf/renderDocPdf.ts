import PDFDocument from "pdfkit";
import { Response } from "express";
import fs from "fs";
import { totals } from "../lib/money";

type Line = { label: string; qty: number; unit: string; rate: number; isVariation?: boolean };
type Business = {
  name: string;
  abn: string;
  licence?: string | null;
  address?: string | null;
  phone?: string | null;
  bsb?: string | null;
  accountNumber?: string | null;
  depositPercent: number;
  accentColor: string;
};
type Client = { name: string; address?: string | null };
type Doc = {
  ref: string;
  shape?: string;
  createdAt: Date;
  dueDate?: Date | null;
};

export function renderQuotePdf(
  res: Response,
  opts: {
    business: Business;
    doc: Doc;
    lines: Line[];
    client: Client;
    kind: "quote" | "invoice";
    paid?: number;
    photos?: { path: string; takenAt: Date }[];
  }
) {
  const { business, doc, lines, client, kind, paid = 0, photos = [] } = opts;
  const isInvoice = kind === "invoice";
  const t = totals(lines, business.depositPercent, paid);
  const accent = business.accentColor || "#5980a6";

  const pdf = new PDFDocument({ size: "A4", margin: 40 });
  pdf.pipe(res);

  const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Header
  pdf.fillColor(accent).font("Helvetica-Bold").fontSize(20).text(business.name, 40, 40);
  pdf
    .fillColor("#555")
    .font("Helvetica")
    .fontSize(8.5)
    .text(
      [business.licence ? `Lic. ${business.licence}` : null, `ABN ${business.abn}`].filter(Boolean).join(" · "),
      40,
      66
    )
    .text(business.address || "", 40, 78)
    .text(business.phone || "", 40, 90);

  const docTitle = isInvoice ? "Tax Invoice" : "Quotation";
  pdf
    .fillColor("#777")
    .fontSize(8)
    .text(docTitle.toUpperCase(), 400, 40, { width: 155, align: "right" });
  pdf
    .fillColor("#111")
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(doc.ref, 400, 52, { width: 155, align: "right" });
  const dateStr = doc.createdAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const termsStr = isInvoice
    ? doc.dueDate
      ? `Due ${doc.dueDate.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
      : "Due on receipt"
    : "Valid 30 days";
  pdf
    .fillColor("#555")
    .font("Helvetica")
    .fontSize(8.5)
    .text(dateStr, 400, 70, { width: 155, align: "right" })
    .text(termsStr, 400, 81, { width: 155, align: "right" });

  pdf.moveTo(40, 108).lineTo(555, 108).lineWidth(2).strokeColor(accent).stroke();

  // Prepared for / scope
  pdf.fillColor("#777").fontSize(7.5).text("PREPARED FOR", 40, 122);
  pdf
    .fillColor("#111")
    .fontSize(10.5)
    .text(client.name, 40, 133)
    .text(client.address || "", 40, 146, { width: 250 });

  pdf.fillColor("#777").fontSize(7.5).text("SCOPE", 310, 122);
  const scope =
    doc.shape === "Flat price"
      ? "Supply and install as discussed — one fixed price."
      : "Supply and install, including labour, materials and testing.";
  pdf.fillColor("#111").fontSize(10.5).text(scope, 310, 133, { width: 205 });

  // Line items table
  let y = 190;
  pdf.fillColor("#777").fontSize(8).font("Helvetica-Bold");
  pdf.text("#", 40, y, { width: 20 });
  pdf.text("DESCRIPTION", 65, y);
  pdf.text("QTY", 340, y, { width: 50, align: "right" });
  pdf.text("RATE", 390, y, { width: 70, align: "right" });
  pdf.text("AMOUNT", 470, y, { width: 85, align: "right" });
  y += 14;
  pdf.moveTo(40, y).lineTo(555, y).strokeColor("#ddd").lineWidth(1).stroke();
  y += 8;

  pdf.font("Helvetica").fontSize(10).fillColor("#111");
  lines.forEach((l, i) => {
    const amount = l.qty * l.rate;
    pdf.fillColor("#999").text(String(i + 1), 40, y, { width: 20 });
    pdf.fillColor("#111").text(l.label, 65, y, { width: 265 });
    pdf.text(`${l.qty} ${l.unit}`, 340, y, { width: 50, align: "right" });
    pdf.text(money(l.rate), 390, y, { width: 70, align: "right" });
    pdf.text(money(amount), 470, y, { width: 85, align: "right" });
    if (l.isVariation) {
      pdf.fontSize(7.5).fillColor(accent).text("VARIATION", 65, y + 12);
      pdf.fontSize(10).fillColor("#111");
      y += 12;
    }
    y += 20;
  });

  y += 10;
  pdf.moveTo(340, y).lineTo(555, y).strokeColor("#ddd").stroke();
  y += 8;

  const totalRow = (label: string, value: string, bold = false) => {
    pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    pdf.fillColor("#555").text(label, 340, y, { width: 130 });
    pdf.fillColor("#111").text(value, 470, y, { width: 85, align: "right" });
    y += 16;
  };
  totalRow("Subtotal (ex GST)", money(t.sub));
  totalRow("GST 10%", money(t.gst));
  if (!isInvoice && business.depositPercent > 0) {
    totalRow(`Deposit on acceptance (${business.depositPercent}%)`, money(t.deposit));
  }
  if (paid > 0) totalRow("Payment received", `− ${money(paid)}`);

  y += 4;
  pdf.rect(340, y, 215, 24).fill(accent);
  pdf
    .fillColor("#fff")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("TOTAL INC GST", 348, y + 5);
  pdf.fontSize(13).text(money(isInvoice ? t.total - paid : t.total), 340, y + 3, { width: 207, align: "right" });
  y += 40;

  // Payment / terms
  pdf.fillColor("#777").fontSize(7.5).font("Helvetica-Bold").text("PAYMENT", 40, y);
  pdf.fillColor("#777").text("TERMS", 310, y);
  y += 11;
  const payBlurb = isInvoice
    ? `${business.name} · BSB ${business.bsb || "—"} · Acct ${business.accountNumber || "—"}. Or pay now via the invoice link (card or Apple Pay).`
    : `Deposit of ${money(t.deposit)} on acceptance. Balance on completion by transfer or card.`;
  pdf.fillColor("#333").font("Helvetica").fontSize(9).text(payBlurb, 40, y, { width: 250 });
  pdf
    .fillColor("#333")
    .fontSize(9)
    .text("Quote valid 30 days. Variations quoted separately. All work to AS/NZS 3500.", 310, y, { width: 205 });

  const existingPhotos = photos.filter((p) => fs.existsSync(p.path));
  if (existingPhotos.length > 0) {
    pdf.addPage();
    pdf.fillColor(accent).font("Helvetica-Bold").fontSize(16).text("Completion Photos", 40, 40);
    pdf.moveTo(40, 64).lineTo(555, 64).lineWidth(2).strokeColor(accent).stroke();

    const cols = 2;
    const cellW = 245;
    const cellH = 190;
    const gap = 25;
    let px = 40;
    let py = 84;
    existingPhotos.forEach((p, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) {
        py += cellH + 28;
      }
      if (py + cellH > 780) {
        pdf.addPage();
        py = 40;
      }
      px = 40 + col * (cellW + gap);
      try {
        pdf.image(p.path, px, py, { fit: [cellW, cellH], align: "center", valign: "center" });
      } catch {
        // Skip a photo pdfkit can't decode rather than failing the whole PDF.
      }
      pdf
        .fillColor("#777")
        .font("Helvetica")
        .fontSize(8)
        .text(p.takenAt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }), px, py + cellH + 4, {
          width: cellW,
        });
    });
  }

  pdf.end();
}
