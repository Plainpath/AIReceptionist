import nodemailer from "nodemailer";

type NotifyInput = {
  client: { name: string; email?: string | null };
  subject: string;
  body: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

/** Client-facing notifications (reschedules, arrival windows, follow-ups).
 * Sends real email when SMTP_* env vars are set; otherwise logs so the
 * trigger logic can be built and tested before a provider is wired up.
 * SMS is the eventual channel for time-sensitive ones — swap in here later
 * without touching the callers. */
export async function notifyClient(input: NotifyInput) {
  if (!input.client.email) {
    console.log(`[notify] skipped — no email on file for ${input.client.name}: "${input.subject}"`);
    return { sent: false, reason: "no-email" as const };
  }

  const t = getTransporter();
  if (!t) {
    console.log(`[notify] SMTP not configured — would email ${input.client.email}: "${input.subject}"\n${input.body}`);
    return { sent: false, reason: "no-provider" as const };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.client.email,
    subject: input.subject,
    text: input.body,
  });
  return { sent: true as const };
}
