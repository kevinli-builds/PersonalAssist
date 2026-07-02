import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";
import type { ParsedEntry } from "@/lib/claude";

export const dynamic = "force-dynamic";

const TYPES = new Set(["event", "health", "birthday", "task", "note"]);

export async function GET(req: Request) {
  if (!(await requireSession(req))) return unauthorized();
  const entries = await prisma.entry.findMany({
    orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { reminders: { orderBy: { remindAt: "asc" } } },
  });
  return Response.json({ entries });
}

export async function POST(req: Request) {
  if (!(await requireSession(req))) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const parsed = body.parsed as ParsedEntry | undefined;
  const raw = typeof body.raw === "string" ? body.raw : "";

  if (!parsed || typeof parsed.title !== "string" || !parsed.title.trim() || !TYPES.has(parsed.type)) {
    return Response.json({ error: "Invalid entry" }, { status: 400 });
  }

  const date = parsed.date ? new Date(parsed.date) : null;
  if (date && isNaN(date.getTime())) return Response.json({ error: "Invalid date" }, { status: 400 });

  const reminders = (Array.isArray(parsed.reminders) ? parsed.reminders : [])
    .map((r) => ({ remindAt: new Date(r.remindAt), label: String(r.label ?? "").slice(0, 200) }))
    .filter((r) => !isNaN(r.remindAt.getTime()) && r.remindAt.getTime() > Date.now());

  const entry = await prisma.entry.create({
    data: {
      type: parsed.type,
      title: parsed.title.trim().slice(0, 200),
      date,
      recurrence: parsed.recurrence ? String(parsed.recurrence).slice(0, 50) : null,
      tags: (Array.isArray(parsed.tags) ? parsed.tags : []).map(String).join(",").slice(0, 200),
      note: String(parsed.note ?? "").slice(0, 2000),
      raw: raw.slice(0, 2000),
      reminders: { create: reminders },
    },
    include: { reminders: true },
  });

  return Response.json({ entry }, { status: 201 });
}
