import { describe, expect, it, vi } from "vitest";
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
});
