const GST_RATE = 0.1;

export type Line = { qty: number; rate: number };

export function totals(lines: Line[], depositPercent: number, paid: number) {
  const sub = lines.reduce((t, l) => t + l.qty * l.rate, 0);
  const gst = sub * GST_RATE;
  const total = sub + gst;
  const deposit = Math.round(total * (depositPercent / 100));
  return { sub, gst, total, deposit, balance: total - paid };
}

export function aud(n: number, cents = false) {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}
