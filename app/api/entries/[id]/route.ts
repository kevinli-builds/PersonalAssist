import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";

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
