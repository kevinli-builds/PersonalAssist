import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";
import { sanitizeEntryPatch } from "@/lib/entryPatch";

// PATCH /api/entries/[id]  { title?, note?, date? } — inline edit of the
// human-fixable fields. Reminders/type/tags stay owned by the parse flow.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSession(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const result = sanitizeEntryPatch(body);
  if (!result.data) return Response.json({ error: result.error }, { status: 400 });
  try {
    const entry = await prisma.entry.update({
      where: { id },
      data: result.data,
      include: { reminders: true },
    });
    return Response.json({ entry });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireSession(req))) return unauthorized();
  const { id } = await ctx.params;
  try {
    await prisma.entry.delete({ where: { id } });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
