import { badRequest } from "../utils/httpError.js";

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function sanitizeInput(req, _res, next) {
  try {
    if (req.body && typeof req.body === "object") req.body = sanitizeValue(req.body);
    if (req.query && typeof req.query === "object") req.query = sanitizeValue(req.query);
    if (req.params && typeof req.params === "object") req.params = sanitizeValue(req.params);
    next();
  } catch (error) {
    next(error);
  }
}

export function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, nested] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) throw badRequest("Request contains unsafe object keys");
      clean[key] = sanitizeValue(nested);
    }
    return clean;
  }
  if (typeof value === "string") return value.replace(/\0/g, "").trim();
  return value;
}
