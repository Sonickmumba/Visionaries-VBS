import { badRequest } from "../utils/httpError.js";

export const ROUNDING_MODES = new Set(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]);

export function normalizeRoundingPolicy({ roundingScale, roundingMode }) {
  const scale = Number(roundingScale);
  const mode = String(roundingMode || "").trim().toUpperCase();
  if (!Number.isInteger(scale) || scale < 0 || scale > 4) {
    throw badRequest("Rounding scale must be an integer between 0 and 4");
  }
  if (!ROUNDING_MODES.has(mode)) {
    throw badRequest("Rounding mode is not supported");
  }
  return { roundingScale: scale, roundingMode: mode };
}

export function normalizeNotificationPreferences(input = {}) {
  const declarationReminderDays = normalizeReminderDays(input.declarationReminderDays, "declarationReminderDays");
  const payoutReminderDays = normalizeReminderDays(input.payoutReminderDays, "payoutReminderDays");
  return {
    emailEnabled: Boolean(input.emailEnabled),
    smsEnabled: Boolean(input.smsEnabled),
    declarationReminderDays,
    payoutReminderDays,
  };
}

function normalizeReminderDays(value, field) {
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be an array`);
  }
  const days = [...new Set(value.map(Number))].sort((a, b) => a - b);
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw badRequest(`${field} must contain days between 1 and 31`);
  }
  return days;
}
