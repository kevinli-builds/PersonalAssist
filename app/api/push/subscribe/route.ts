import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await requireSession(req))) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || typeof p256dh !== "string" || typeof auth !== "string") {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth },
    create: { endpoint, p256dh, auth },
  });
  return Response.json({ ok: true });
}
