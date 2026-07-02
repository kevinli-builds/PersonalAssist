import { requireSession, unauthorized } from "@/lib/auth";
import { parseMessage } from "@/lib/claude";

export async function POST(req: Request) {
  if (!(await requireSession(req))) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });
  if (message.length > 2000) return Response.json({ error: "Message too long" }, { status: 400 });

  const now = typeof body.now === "string" ? body.now : new Date().toISOString();
  const timezone = typeof body.timezone === "string" ? body.timezone : "UTC";

  try {
    const parsed = await parseMessage(message, now, timezone);
    return Response.json({ parsed, raw: message });
  } catch (err) {
    console.error("parse failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't understand that message — try rephrasing." }, { status: 502 });
  }
}
