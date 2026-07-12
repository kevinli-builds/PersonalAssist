import { prisma } from "./prisma";

// Per-IP sliding-window lockout for POST /api/auth/login. The login endpoint is
// an unauthenticated password oracle in front of the user's personal data, so we
// bound guess throughput. Serverless-safe: state lives in the DB (LoginAttempt),
// not in memory.
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const PER_IP_MAX = 8;             // failures per IP per window before lockout
export const FAILURE_DELAY_MS = 500;     // small tarpit on each failure

export interface RateVerdict {
  limited: boolean;
  retryAfterSec: number; // seconds until the window frees up (0 when not limited)
  remaining: number;     // attempts left before lockout (0 when limited)
}

/**
 * Pure decision: given the timestamps (ms) of this IP's failures within the
 * window and the current time, decide whether the IP is locked out. Kept free of
 * I/O so it can be unit-tested exhaustively.
 */
export function evaluateAttempts(timestamps: number[], now: number): RateVerdict {
  const inWindow = timestamps.filter((t) => t > now - WINDOW_MS).sort((a, b) => a - b);
  if (inWindow.length >= PER_IP_MAX) {
    // Locked until the OLDEST in-window failure ages out of the window.
    const retryAfterSec = Math.max(1, Math.ceil((inWindow[0] + WINDOW_MS - now) / 1000));
    return { limited: true, retryAfterSec, remaining: 0 };
  }
  return { limited: false, retryAfterSec: 0, remaining: PER_IP_MAX - inWindow.length };
}

/**
 * Best-effort client IP. On Vercel the platform sets `x-forwarded-for` with the
 * real client as the left-most entry; we take the first hop. `x-real-ip` is a
 * fallback. Falls back to a constant bucket so a missing header still throttles
 * (globally) rather than disabling the limiter.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Look up the IP's recent failures and decide whether it's locked out. */
export async function checkLoginRateLimit(ip: string): Promise<RateVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await prisma.loginAttempt.findMany({
    where: { ip, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  return evaluateAttempts(rows.map((r) => r.createdAt.getTime()), Date.now());
}

/** Record a failed attempt and opportunistically sweep expired rows. */
export async function recordLoginFailure(ip: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { ip } });
  // Opportunistic cleanup so the table stays bounded (best-effort).
  prisma.loginAttempt
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } } })
    .catch(() => {});
}

/** Clear an IP's failures after a successful login. */
export async function clearLoginFailures(ip: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ip } }).catch(() => {});
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
