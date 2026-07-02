import crypto from "node:crypto";
import { env } from "../config/env.js";
import { sendAdminMfaEmail } from "./emailDeliveryService.js";
import { unauthorized } from "../utils/httpError.js";

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function shouldRequireAdminMfa(user) {
  return env.adminMfaRequired && user?.role === "ADMIN";
}

export async function beginAdminMfa(req, user) {
  const code = String(crypto.randomInt(100000, 999999));
  req.session.pendingAdminMfa = {
    userId: user.id,
    codeHash: hashCode(code),
    expiresAt: Date.now() + env.adminMfaTtlMinutes * 60 * 1000,
  };
  await sendAdminMfaEmail({ to: user.email, code });
}

export function assertAdminMfaCode(req, code) {
  const challenge = req.session?.pendingAdminMfa;
  if (!challenge || Date.now() > challenge.expiresAt) {
    throw unauthorized("Admin verification code has expired. Please sign in again.");
  }
  if (hashCode(String(code || "")) !== challenge.codeHash) {
    throw unauthorized("Invalid admin verification code.");
  }
  return challenge.userId;
}

export function clearAdminMfa(req) {
  if (req.session) delete req.session.pendingAdminMfa;
}
