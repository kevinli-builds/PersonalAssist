import crypto from "crypto";
import { prisma } from "./prisma";

const SESSION_TTL_DAYS = 180;

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Constant-time comparison that doesn't leak length via early return timing.
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function createSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash: sha256(token), expiresAt } });
  return token;
}

export async function requireSession(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return false;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }
  return true;
}

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
