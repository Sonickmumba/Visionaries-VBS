import crypto from "node:crypto";
import { env } from "../config/env.js";
import { recordSecurityEvent } from "../services/securityEventService.js";
import { forbidden } from "../utils/httpError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("base64url");
  }
  return req.session.csrfToken;
}

export function csrfProtection(req, res, next) {
  if (env.nodeEnv === "test" || SAFE_METHODS.has(req.method)) return next();
  if (!req.session) return next(forbidden("CSRF protection requires an active session."));

  const expected = req.session.csrfToken;
  const supplied = req.get("x-csrf-token");
  if (!expected || !supplied || supplied !== expected) {
    recordSecurityEvent({
      req,
      action: "SECURITY_CSRF_REJECTED",
      reason: "Invalid or missing CSRF token",
      metadata: { hasExpectedToken: Boolean(expected), hasSuppliedToken: Boolean(supplied) },
    });
    return next(forbidden("Invalid or missing CSRF token."));
  }
  return next();
}
