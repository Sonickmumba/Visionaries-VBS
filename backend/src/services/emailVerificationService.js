import crypto from "node:crypto";
import { env } from "../config/env.js";
import { badRequest, conflict, unauthorized } from "../utils/httpError.js";
import { sendInvitationEmail, sendVerificationEmail } from "./emailDeliveryService.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function expiry(hours) {
  return new Date(Date.now() + Number(hours || 24) * 60 * 60 * 1000);
}

export function isEmailVerified(user = {}) {
  return Boolean(user.email_verified_at);
}

export function assertCanLogin(user = {}) {
  if (!user?.is_active) throw unauthorized("Invalid email or password");
  if (!isEmailVerified(user)) throw unauthorized("Please verify your email before signing in.");
}

export async function createAuthEmailToken(client, {
  userId,
  tokenType,
  createdBy = null,
  req = null,
  ttlHours,
}) {
  const token = newToken();
  const tokenHash = hashToken(token);
  await client.query(
    `INSERT INTO auth_email_tokens
      (user_id, token_type, token_hash, expires_at, created_by, created_ip, created_user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      userId,
      tokenType,
      tokenHash,
      expiry(ttlHours),
      createdBy,
      req?.ip || null,
      req?.headers?.["user-agent"] || null,
    ]
  );
  return token;
}

export async function sendSignupVerification(client, { user, firstName = "", req = null }) {
  const token = await createAuthEmailToken(client, {
    userId: user.id,
    tokenType: "EMAIL_VERIFICATION",
    ttlHours: env.emailVerificationTtlHours,
    req,
  });
  const delivery = await sendVerificationEmail({ to: user.email, token, firstName });
  await client.query(
    "UPDATE users SET email_verification_sent_at = now(), updated_at = now() WHERE id = $1",
    [user.id]
  );
  return { token, delivery };
}

export async function sendAccountInvitation(client, { user, role, invitedBy = null, req = null }) {
  const token = await createAuthEmailToken(client, {
    userId: user.id,
    tokenType: "ACCOUNT_INVITATION",
    ttlHours: env.invitationTtlHours,
    createdBy: invitedBy,
    req,
  });
  const delivery = await sendInvitationEmail({ to: user.email, token, role });
  await client.query(
    "UPDATE users SET email_verification_sent_at = now(), invited_at = COALESCE(invited_at, now()), updated_at = now() WHERE id = $1",
    [user.id]
  );
  return { token, delivery };
}

async function consumeToken(client, { token, tokenType }) {
  if (!token) throw badRequest("Verification token is required");
  const tokenHash = hashToken(token);
  const result = await client.query(
    `SELECT aet.*, u.email, u.role, u.is_active, u.email_verified_at
     FROM auth_email_tokens aet
     JOIN users u ON u.id = aet.user_id
     WHERE aet.token_hash = $1 AND aet.token_type = $2
     FOR UPDATE OF aet, u`,
    [tokenHash, tokenType]
  );
  const record = result.rows[0];
  if (!record) throw badRequest("Verification link is invalid or expired");
  if (record.used_at) throw conflict("This verification link has already been used");
  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw badRequest("Verification link has expired");
  }
  await client.query("UPDATE auth_email_tokens SET used_at = now() WHERE id = $1", [record.id]);
  return record;
}

export async function verifyEmailToken(client, { token }) {
  const record = await consumeToken(client, { token, tokenType: "EMAIL_VERIFICATION" });
  const updated = await client.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now()),
         is_active = TRUE,
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, role, is_active, email_verified_at`,
    [record.user_id]
  );
  return updated.rows[0];
}

export async function acceptInvitationToken(client, { token, passwordHash }) {
  const record = await consumeToken(client, { token, tokenType: "ACCOUNT_INVITATION" });
  const updated = await client.query(
    `UPDATE users
     SET password_hash = $2,
         email_verified_at = COALESCE(email_verified_at, now()),
         invitation_accepted_at = now(),
         is_active = TRUE,
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, role, is_active, email_verified_at`,
    [record.user_id, passwordHash]
  );
  return updated.rows[0];
}
