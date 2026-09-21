import { prisma } from "./db";
import { notifyClient } from "./notify";

/** Minutes after a job is marked Completed before its follow-up email goes
 * out. Defaults to 3 days for real use; override with FOLLOWUP_DELAY_MINUTES
 * (e.g. "3") to see the whole loop fire quickly while testing. */
export function followUpDelayMinutes() {
  const raw = Number(process.env.FOLLOWUP_DELAY_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 3 * 24 * 60;
}

const CHECK_INTERVAL_MS = 60 * 1000;

export async function runFollowUps() {
  const due = await prisma.job.findMany({
    where: { followUpAt: { lte: new Date() }, followUpSentAt: null },
    include: { client: true },
  });

  for (const job of due) {
    await notifyClient({
      client: job.client,
      subject: `How did we go?`,
      body: `Hi ${job.client.name},\n\nJust checking in after "${job.title}" — everything working the way it should? Reply here if anything needs a follow-up visit.`,
    });
    await prisma.job.update({ where: { id: job.id }, data: { followUpSentAt: new Date() } });
    await prisma.activityEvent.create({
      data: {
        businessId: job.businessId,
        clientId: job.clientId,
        kind: "Follow-up sent",
        text: `Follow-up sent for "${job.title}".`,
      },
    });
  }
}

export function startFollowUpScheduler() {
  console.log(`[follow-ups] scheduler running — checking every ${CHECK_INTERVAL_MS / 1000}s, delay ${followUpDelayMinutes()}min after job completion`);
  setInterval(() => {
    runFollowUps().catch((err) => console.error("[follow-ups] run failed", err));
  }, CHECK_INTERVAL_MS);
}
