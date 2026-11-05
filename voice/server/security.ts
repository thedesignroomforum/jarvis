/** Shared request guards for the serverless endpoints. */

const hits = new Map<string, number[]>();

/** Optional shared secret so strangers can't spend your API credits. */
export function checkAccess(req: Request, allowQuery = false): Response | null {
  const code = process.env.JARVIS_ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get("x-jarvis-access") === code) return null;
  if (allowQuery && new URL(req.url).searchParams.get("code") === code) return null;
  return json({ error: "ACCESS_CODE_REQUIRED" }, 401);
}

/** Small per-IP sliding window (per server instance). */
export function rateLimit(req: Request, bucket: string, limit = Number(process.env.JARVIS_RATE_LIMIT_PER_MIN || 30)) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= limit) return json({ error: "RATE_LIMITED" }, 429);
  recent.push(now);
  hits.set(key, recent);
  return null;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
