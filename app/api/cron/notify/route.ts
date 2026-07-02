import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/auth";
import { sendToAllDevices } from "@/lib/push";

export const dynamic = "force-dynamic";

// Called on a schedule (Vercel cron or GitHub Action). Sends push notifications
// for due reminders; yearly entries get their next occurrence scheduled.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: new Date() } },
    include: { entry: true },
    orderBy: { remindAt: "asc" },
    take: 50,
  });

  let sent = 0;
  for (const reminder of due) {
    const delivered = await sendToAllDevices({
      title: reminder.entry.title,
      body: reminder.label,
    });
    await prisma.reminder.update({ where: { id: reminder.id }, data: { sent: true } });
    sent += delivered > 0 ? 1 : 0;

    if (reminder.entry.recurrence === "yearly") {
      const next = new Date(reminder.remindAt);
      next.setFullYear(next.getFullYear() + 1);
      await prisma.reminder.create({
        data: { entryId: reminder.entryId, remindAt: next, label: reminder.label },
      });
    }
  }

  return Response.json({ due: due.length, sent });
}
