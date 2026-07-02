import { prisma } from "@/lib/prisma";
import { requireSession, unauthorized } from "@/lib/auth";
import { askQuestion } from "@/lib/claude";

export async function POST(req: Request) {
  if (!(await requireSession(req))) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ error: "Question is required" }, { status: 400 });
  if (question.length > 1000) return Response.json({ error: "Question too long" }, { status: 400 });

  const now = typeof body.now === "string" ? body.now : new Date().toISOString();
  const entries = await prisma.entry.findMany({ orderBy: { createdAt: "asc" } });

  try {
    const answer = await askQuestion(question, entries, now);
    return Response.json({ answer });
  } catch (err) {
    console.error("ask failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't answer right now — try again." }, { status: 502 });
  }
}
