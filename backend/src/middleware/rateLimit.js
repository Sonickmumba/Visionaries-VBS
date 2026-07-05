import { env } from "../config/env.js";
import { getRedisCommandConnection, redisEnabled } from "../services/redisService.js";
import { recordSecurityEvent } from "../services/securityEventService.js";

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
      recordSecurityEvent({
        req,
        action: "SECURITY_RATE_LIMITED",
        reason: "Rate limit exceeded",
        metadata: { limiter: "memory", key, count: current.count, max },
      });
      const error = new Error("Too many requests. Please try again later.");
      error.status = 429;
      return next(error);
    }

    return next();
  };
}

function cleanRateLimitKey(key) {
  return String(key).replace(/[^a-zA-Z0-9:._@-]/g, "_").slice(0, 180);
}

export function createRedisRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  prefix = "rate-limit",
} = {}) {
  const fallbackLimiter = createMemoryRateLimiter({ windowMs, max, keyGenerator });
  return async (req, res, next) => {
    const redis = getRedisCommandConnection();
    if (!redis) return fallbackLimiter(req, res, next);

    const key = `${prefix}:${cleanRateLimitKey(keyGenerator(req))}`;
    try {
      if (redis.status === "wait") await redis.connect();
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      const ttlMs = await redis.pttl(key);
      const resetAt = Date.now() + (ttlMs > 0 ? ttlMs : windowMs);

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

      if (count > max) {
        recordSecurityEvent({
          req,
          action: "SECURITY_RATE_LIMITED",
          reason: "Rate limit exceeded",
          metadata: { limiter: "redis", key, count, max },
        });
        const error = new Error("Too many requests. Please try again later.");
        error.status = 429;
        return next(error);
      }
      return next();
    } catch (error) {
      console.warn(`Redis rate limiter unavailable; falling back to in-memory limiter: ${error.code || error.message}`);
      return fallbackLimiter(req, res, next);
    }
  };
}

export function createRateLimiter(options = {}) {
  if (env.nodeEnv === "test") return createMemoryRateLimiter(options);
  if (env.redisUrl && redisEnabled()) return createRedisRateLimiter(options);
  return createMemoryRateLimiter(options);
}
