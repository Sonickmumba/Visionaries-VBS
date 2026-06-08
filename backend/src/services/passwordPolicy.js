import { badRequest } from "../utils/httpError.js";

export function validatePasswordPolicy(password) {
  const value = String(password || "");
  const failures = [];
  if (value.length < 10) failures.push("at least 10 characters");
  if (!/[a-z]/.test(value)) failures.push("one lowercase letter");
  if (!/[A-Z]/.test(value)) failures.push("one uppercase letter");
  if (!/[0-9]/.test(value)) failures.push("one number");
  if (!/[^A-Za-z0-9]/.test(value)) failures.push("one symbol");

  if (failures.length) {
    throw badRequest(`Password must include ${failures.join(", ")}`);
  }
  return true;
}
