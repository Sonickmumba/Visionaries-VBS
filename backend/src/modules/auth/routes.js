import express from "express";
import bcrypt from "bcryptjs";
import { promisify } from "node:util";
import { passport } from "../../auth/passport.js";
import { z } from "zod";
import { env } from "../../config/env.js";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { createMemoryRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import {
  acceptInvitationToken,
  sendSignupVerification,
  verifyEmailToken,
} from "../../services/emailVerificationService.js";
import { validatePasswordPolicy } from "../../services/passwordPolicy.js";
import { badRequest, unauthorized } from "../../utils/httpError.js";

export const authRouter = express.Router();

const authRateLimit = createMemoryRateLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  keyGenerator: (req) => `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(req.body?.email || "").toLowerCase()}`,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(10),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10),
});

async function auditLoginAttempt({ req, user = null, success, reason }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_table, entity_id, after_data, reason, ip_address, user_agent)
       VALUES ($1,'LOGIN','users',$2,$3,$4,$5,$6)`,
      [
        success ? user?.id || null : null,
        user?.id || null,
        JSON.stringify({ email: req.body?.email?.toLowerCase?.() || null, success }),
        reason,
        req.ip || null,
        req.headers?.["user-agent"] || null,
      ]
    );
  } catch {
    // Login outcome must not reveal or depend on audit-log availability.
  }
}

authRouter.post("/login", authRateLimit, validate(loginSchema), async (req, res, next) => {
  try {
    const existing = await query("SELECT id, email, is_active, email_verified_at FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
    const user = existing.rows[0];
    if (user?.is_active && !user.email_verified_at) {
      await auditLoginAttempt({ req, user, success: false, reason: "Email not verified" });
      throw unauthorized("Please verify your email before signing in.");
    }
  } catch (error) {
    return next(error);
  }

  passport.authenticate("local", async (error, user) => {
    try {
      if (error) throw error;
      if (!user) {
        await auditLoginAttempt({ req, user: null, success: false, reason: "Invalid login attempt" });
        throw unauthorized("Invalid email or password");
      }

      await promisify(req.login.bind(req))(user);
      await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
      await auditLoginAttempt({ req, user, success: true, reason: "Successful login" });
      res.json({ user });
    } catch (innerError) {
      next(innerError);
    }
  })(req, res, next);
});

authRouter.post("/signup", authRateLimit, validate(signupSchema), async (req, res, next) => {
  try {
    validatePasswordPolicy(req.body.password);
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const result = await withTransaction(async (client) => {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
      if (existing.rows.length) throw badRequest("Email is already registered");
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1,$2,'MEMBER',FALSE)
         RETURNING id, email, role, is_active, email_verified_at`,
        [req.body.email.toLowerCase(), passwordHash]
      );
      const user = userResult.rows[0];
      await client.query(
        `INSERT INTO members (user_id, first_name, last_name, phone)
         VALUES ($1,$2,$3,$4)`,
        [user.id, req.body.firstName, req.body.lastName, req.body.phone || null]
      );
      const verification = await sendSignupVerification(client, { user, firstName: req.body.firstName, req });
      await audit(client, {
        actorUserId: user.id,
        action: "CREATE",
        entityTable: "users",
        entityId: user.id,
        afterData: user,
        reason: "Public signup pending email verification",
        req,
      });
      return { user, verification };
    });
    res.status(201).json({
      message: "Account created. Please verify your email before signing in.",
      emailVerificationRequired: true,
      email: result.user.email,
      delivery: result.verification.delivery,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/resend-verification", authRateLimit, validate(resendVerificationSchema), async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const user = (await client.query(
        "SELECT id, email, role, is_active, email_verified_at FROM users WHERE email = $1",
        [req.body.email.toLowerCase()]
      )).rows[0];
      if (user && !user.email_verified_at) {
        await sendSignupVerification(client, { user, req });
      }
    });
    res.json({ message: "If the account needs verification, a new email has been sent." });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-email", authRateLimit, validate(verifyEmailSchema), async (req, res, next) => {
  try {
    const user = await withTransaction(async (client) => {
      const verified = await verifyEmailToken(client, { token: req.body.token });
      await audit(client, {
        actorUserId: verified.id,
        action: "UPDATE",
        entityTable: "users",
        entityId: verified.id,
        afterData: verified,
        reason: "Email verified",
        req,
      });
      return verified;
    });
    res.json({ message: "Email verified. You can now log in.", user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/accept-invite", authRateLimit, validate(acceptInvitationSchema), async (req, res, next) => {
  try {
    validatePasswordPolicy(req.body.password);
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await withTransaction(async (client) => {
      const accepted = await acceptInvitationToken(client, { token: req.body.token, passwordHash });
      await audit(client, {
        actorUserId: accepted.id,
        action: "UPDATE",
        entityTable: "users",
        entityId: accepted.id,
        afterData: accepted,
        reason: "Account invitation accepted",
        req,
      });
      return accepted;
    });
    await promisify(req.login.bind(req))(user);
    res.json({ message: "Invitation accepted.", user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);
      res.clearCookie(env.sessionCookieName);
      return res.json({ message: "Logged out" });
    });
  });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const member = await query("SELECT * FROM members WHERE user_id = $1", [req.user.id]);
    const currentMember = member.rows[0] || null;
    const cycleMemberships = currentMember
      ? await query(
          `SELECT cm.*, c.name AS cycle_name, c.status AS cycle_status, c.minimum_borrowing_amount,
            c.savings_cap, c.savings_interest_rate, c.loan_interest_rate, c.common_interest_rate
           FROM cycle_members cm
           JOIN cycles c ON c.id = cm.cycle_id
           WHERE cm.member_id = $1
           ORDER BY c.created_at DESC`,
          [currentMember.id]
        )
      : { rows: [] };
    res.json({ user: req.user, member: currentMember, cycleMemberships: cycleMemberships.rows });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", authRateLimit, (req, res) => {
  res.json({ message: "If the email exists, a reset link will be sent." });
});

authRouter.post("/reset-password", authRateLimit, (req, res) => {
  res.json({ message: "Password reset endpoint is scaffolded for email provider integration." });
});
