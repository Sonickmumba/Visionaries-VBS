import { describe, expect, it, vi } from "vitest";
import { validateProductionEnv } from "../src/config/env.js";
import { csrfProtection, ensureCsrfToken } from "../src/middleware/csrf.js";
import { createMemoryRateLimiter } from "../src/middleware/rateLimit.js";
import { sanitizeValue } from "../src/middleware/sanitizeInput.js";
import { validatePasswordPolicy } from "../src/services/passwordPolicy.js";

describe("security hardening", () => {
  it("enforces the password policy", () => {
    expect(validatePasswordPolicy("StrongPass1!")).toBe(true);
    expect(() => validatePasswordPolicy("password")).toThrow("Password must include");
    expect(() => validatePasswordPolicy("Longbutnonumber!")).toThrow("one number");
  });

  it("rate limits repeated requests", () => {
    const limiter = createMemoryRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyGenerator: () => "same-client",
    });
    const res = () => ({ setHeader: vi.fn() });
    const next = vi.fn();

    limiter({ ip: "127.0.0.1", headers: {} }, res(), next);
    limiter({ ip: "127.0.0.1", headers: {} }, res(), next);
    limiter({ ip: "127.0.0.1", headers: {} }, res(), next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(next.mock.calls[2][0].status).toBe(429);
  });

  it("sanitizes strings and rejects unsafe object keys", () => {
    expect(sanitizeValue({ name: "  Mary\0  ", nested: [" A "] })).toEqual({
      name: "Mary",
      nested: ["A"],
    });

    expect(() => sanitizeValue(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow("Request contains unsafe object keys");
  });

  it("validates production-only environment requirements", () => {
    expect(() => validateProductionEnv({
      nodeEnv: "production",
      frontendOrigin: "http://localhost:5173",
      sessionSecret: "short",
      emailDevFallback: true,
      resendApiKey: "",
      emailFrom: "Visionaries <onboarding@resend.dev>",
      cloudinaryCloudName: "",
      cloudinaryApiKey: "",
      cloudinaryApiSecret: "",
      notificationsQueueEnabled: true,
      notificationsRedisFanoutEnabled: false,
      redisUrl: "",
    }, {})).toThrow(/Invalid production configuration/);

    expect(() => validateProductionEnv({
      nodeEnv: "production",
      frontendOrigin: "https://app.example.com",
      sessionSecret: "a".repeat(40),
      emailDevFallback: false,
      resendApiKey: "re_123",
      emailFrom: "Visionaries <no-reply@example.com>",
      cloudinaryCloudName: "cloud",
      cloudinaryApiKey: "key",
      cloudinaryApiSecret: "secret",
      notificationsQueueEnabled: true,
      notificationsRedisFanoutEnabled: true,
      redisUrl: "redis://redis:6379",
    }, {
      DATABASE_URL: "postgres://db",
      FRONTEND_ORIGIN: "https://app.example.com",
      SESSION_SECRET: "a".repeat(40),
    })).not.toThrow();
  });

  it("creates and validates session-bound CSRF tokens", () => {
    const req = {
      method: "POST",
      session: {},
      get: vi.fn(),
    };
    const token = ensureCsrfToken(req);
    expect(token).toHaveLength(43);
    req.get.mockReturnValue(token);

    const next = vi.fn();
    csrfProtection(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
