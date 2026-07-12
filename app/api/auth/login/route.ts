import { createSession, safeEqual } from "@/lib/auth";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  getClientIp,
  sleep,
  FAILURE_DELAY_MS,
} from "@/lib/loginThrottle";

export async function POST(req: Request) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return Response.json({ error: "APP_PASSWORD is not configured on the server" }, { status: 500 });
  }

  const ip = getClientIp(req);

  // Reject early if this IP has exhausted its attempts in the current window.
  const verdict = await checkLoginRateLimit(ip);
  if (verdict.limited) {
    return Response.json(
      { error: `Too many attempts. Try again in about ${Math.ceil(verdict.retryAfterSec / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!password || !safeEqual(password, appPassword)) {
    await recordLoginFailure(ip);
    // Small tarpit so scripted guessing is slow even before lockout trips.
    await sleep(FAILURE_DELAY_MS);
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  // Success — clear this IP's failure history so a later typo isn't pre-penalized.
  await clearLoginFailures(ip);
  const token = await createSession();
  return Response.json({ token });
}
