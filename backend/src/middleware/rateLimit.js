export function createMemoryRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
} = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req));
    const bucket = hits.get(key);
    const current = bucket && bucket.resetAt > now
      ? bucket
      : { count: 0, resetAt: now + windowMs };

    current.count += 1;
    hits.set(key, current);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - current.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      const error = new Error("Too many requests. Please try again later.");
      error.status = 429;
      return next(error);
    }

    return next();
  };
}
