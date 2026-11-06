type RateLimitBucket = { attempts: number; resetAt: number };
type RateLimitStore = Map<string, RateLimitBucket>;

declare global {
  var __biodryRateLimits: RateLimitStore | undefined;
}

const store =
  globalThis.__biodryRateLimits ?? new Map<string, RateLimitBucket>();
globalThis.__biodryRateLimits = store;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function takeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now(),
): RateLimitResult {
  const current = store.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { attempts: 0, resetAt: now + options.windowMs }
      : current;
  bucket.attempts += 1;
  store.set(key, bucket);

  return {
    allowed: bucket.attempts <= options.limit,
    remaining: Math.max(0, options.limit - bucket.attempts),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function clearRateLimit(key: string) {
  store.delete(key);
}

export function clientAddress(headers: Pick<Headers, "get">) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin) return false;
  return !fetchSite || fetchSite === "same-origin";
}

export function resetRateLimitsForTests() {
  if (process.env.NODE_ENV === "test") store.clear();
}
