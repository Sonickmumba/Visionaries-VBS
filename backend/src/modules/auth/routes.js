import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { createMemoryRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
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

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

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
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !user.is_active) {
      await auditLoginAttempt({ req, user, success: false, reason: "Invalid login attempt" });
      throw unauthorized("Invalid email or password");
    }
    const ok = await bcrypt.compare(req.body.password, user.password_hash);
    if (!ok) {
      await auditLoginAttempt({ req, user, success: false, reason: "Invalid login attempt" });
      throw unauthorized("Invalid email or password");
    }
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    await auditLoginAttempt({ req, user, success: true, reason: "Successful login" });
    res.json({
      token: tokenFor(user),
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signup", authRateLimit, validate(signupSchema), async (req, res, next) => {
  try {
    validatePasswordPolicy(req.body.password);
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const existing = await query("SELECT id FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
    if (existing.rows.length) throw badRequest("Email is already registered");
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1,$2,'MEMBER')
       RETURNING id, email, role`,
      [req.body.email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0];
    await query(
      `INSERT INTO members (user_id, first_name, last_name, phone)
       VALUES ($1,$2,$3,$4)`,
      [user.id, req.body.firstName, req.body.lastName, req.body.phone || null]
    );
    res.status(201).json({ token: tokenFor(user), user });
  } catch (error) {
    next(error);
  }
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
