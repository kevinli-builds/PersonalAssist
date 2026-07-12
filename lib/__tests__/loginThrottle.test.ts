import { describe, it, expect } from "vitest";
import { evaluateAttempts, getClientIp, PER_IP_MAX, WINDOW_MS } from "../loginThrottle";

const NOW = 1_700_000_000_000;
const minsAgo = (m: number) => NOW - m * 60_000;

describe("evaluateAttempts", () => {
  it("allows when there are no recent failures", () => {
    const v = evaluateAttempts([], NOW);
    expect(v.limited).toBe(false);
    expect(v.remaining).toBe(PER_IP_MAX);
  });

  it("counts down remaining as failures accrue (below the cap)", () => {
    const v = evaluateAttempts([minsAgo(1), minsAgo(2), minsAgo(3)], NOW);
    expect(v.limited).toBe(false);
    expect(v.remaining).toBe(PER_IP_MAX - 3);
  });

  it("locks out at the cap and reports a positive Retry-After", () => {
    const ts = Array.from({ length: PER_IP_MAX }, (_, i) => minsAgo(i)); // all within window
    const v = evaluateAttempts(ts, NOW);
    expect(v.limited).toBe(true);
    expect(v.remaining).toBe(0);
    expect(v.retryAfterSec).toBeGreaterThan(0);
    expect(v.retryAfterSec).toBeLessThanOrEqual(WINDOW_MS / 1000);
  });

  it("ignores failures older than the window (they age out)", () => {
    const old = Array.from({ length: PER_IP_MAX }, () => minsAgo(20)); // >15m ago
    const v = evaluateAttempts(old, NOW);
    expect(v.limited).toBe(false);
    expect(v.remaining).toBe(PER_IP_MAX);
  });

  it("Retry-After shrinks as the oldest in-window failure ages", () => {
    const ts = Array.from({ length: PER_IP_MAX }, (_, i) => minsAgo(i)); // oldest = 7m ago
    const near = evaluateAttempts(
      Array.from({ length: PER_IP_MAX }, () => minsAgo(14)),
      NOW,
    ); // oldest ~1m from expiry
    const far = evaluateAttempts(ts, NOW);
    expect(near.retryAfterSec).toBeLessThan(far.retryAfterSec);
  });
});

describe("getClientIp", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("https://x/api/auth/login", { headers });

  it("takes the left-most x-forwarded-for hop", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("falls back to a constant bucket when no IP header is present", () => {
    // A missing header still throttles (as one shared bucket) rather than
    // silently disabling the limiter.
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
