import "server-only";
import { serverEnv } from "@/lib/env";

// Simple sliding-window limiter, per user, per server instance.
// Good enough for a personal app; swap for Upstash/Redis if you ever run many instances.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = serverEnv.rateLimitPerMin, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}
