import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { sendAccountInvitation } from "../../services/emailVerificationService.js";
import {
  normalizeNotificationPreferences,
  normalizeRoundingPolicy,
  ROUNDING_MODES,
} from "../../services/settingsService.js";
import { badRequest, conflict } from "../../utils/httpError.js";

export const settingsRouter = express.Router();
settingsRouter.use(requireAuth, requireRole("ADMIN"));

function requireReason(reason, message = "A reason is required for settings changes") {
  if (!String(reason || "").trim()) throw badRequest(message);
}

async function assertAtLeastOneActiveAdminRemains(client, { targetUserId, nextRole, nextIsActive }) {
  const activeAdmins = await client.query(
    "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE"
  );
  const wouldRemoveTarget = activeAdmins.rows.some((row) => String(row.id) === String(targetUserId))
    && (nextRole !== "ADMIN" || nextIsActive === false);
  if (wouldRemoveTarget && activeAdmins.rows.length <= 1) {
    throw conflict("At least one active administrator must remain");
  }
}

settingsRouter.get("/users", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, role, is_active, email_verified_at, email_verification_sent_at,
        invited_by, invited_at, invitation_accepted_at, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/context", async (req, res, next) => {
  try {
    const users = await query(
      `SELECT id, email, role, is_active, email_verified_at, email_verification_sent_at,
        invited_by, invited_at, invitation_accepted_at, created_at
       FROM users ORDER BY created_at DESC`
    );
    const activeCycle = await query("SELECT * FROM cycles WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
    const cycles = await query(
      `SELECT id, name, status, savings_cap, minimum_borrowing_amount,
        savings_interest_rate, loan_interest_rate, common_interest_rate,
        social_fund_amount, membership_fee_amount, declaration_start_day, declaration_end_day,
        payout_start_day, payout_end_day, rounding_scale, rounding_mode, created_at
       FROM cycles ORDER BY created_at DESC`
    );
    const cycleId = req.query.cycleId || activeCycle.rows[0]?.id || cycles.rows[0]?.id || null;
    const penaltyTypes = cycleId
      ? await query("SELECT * FROM penalty_types WHERE cycle_id = $1 ORDER BY code", [cycleId])
      : { rows: [] };
    const appSettings = await query("SELECT key, value, description, updated_at FROM app_settings ORDER BY key");
    res.json({
      data: {
        users: users.rows,
        activeCycle: activeCycle.rows[0] || null,
        cycles: cycles.rows,
        selectedCycleId: cycleId,
        penaltyTypes: penaltyTypes.rows,
        appSettings: appSettings.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {}),
        roundingModes: [...ROUNDING_MODES],
      },
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/users", validate(z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "AUDITOR"]),
})), async (req, res, next) => {
  try {
    const user = await withTransaction(async (client) => {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
      if (existing.rows[0]) throw conflict("Email is already registered");
      const hash = await bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 10);
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active, invited_by, invited_at)
         VALUES ($1,$2,$3,FALSE,$4,now())
         RETURNING id, email, role, is_active, email_verified_at, email_verification_sent_at,
           invited_by, invited_at, invitation_accepted_at, created_at`,
        [req.body.email.toLowerCase(), hash, req.body.role, req.user.id]
      );
      const invitation = await sendAccountInvitation(client, {
        user: rows[0],
        role: req.body.role,
        invitedBy: req.user.id,
        req,
      });
      await audit(client, { actorUserId: req.user.id, action: "CREATE", entityTable: "users", entityId: rows[0].id, afterData: rows[0], req });
      return { ...rows[0], invitationDelivery: invitation.delivery };
    });
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/users/:id", validate(z.object({
  role: z.enum(["ADMIN", "MEMBER", "AUDITOR"]).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().optional().nullable(),
})), async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const before = (await client.query("SELECT id, email, role, is_active, created_at FROM users WHERE id = $1", [req.params.id])).rows[0];
      if (!before) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
      }
      requireReason(req.body.reason, "A reason is required when changing user settings");
      const role = req.body.role || before.role;
      const isActive = req.body.isActive === undefined ? before.is_active : req.body.isActive;
      if (String(before.id) === String(req.user.id) && isActive === false) {
        throw conflict("You cannot deactivate your own administrator account");
      }
      await assertAtLeastOneActiveAdminRemains(client, {
        targetUserId: req.params.id,
        nextRole: role,
        nextIsActive: isActive,
      });
      const { rows } = await client.query(
        "UPDATE users SET role = $2, is_active = $3, updated_at = now() WHERE id = $1 RETURNING id, email, role, is_active, created_at",
        [req.params.id, role, isActive]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "users",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason || null,
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

const penaltyTypeSchema = z.object({
  cycleId: z.string().uuid(),
  code: z.string().min(2).max(60),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().nonnegative(),
  isConvertibleToLoan: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

settingsRouter.post("/penalty-types", validate(penaltyTypeSchema), async (req, res, next) => {
  try {
    const penaltyType = await withTransaction(async (client) => {
      const code = req.body.code.trim().toUpperCase().replaceAll(" ", "_");
      const existing = await client.query(
        "SELECT id FROM penalty_types WHERE cycle_id = $1 AND code = $2",
        [req.body.cycleId, code]
      );
      if (existing.rows[0]) throw conflict("Penalty type code already exists for this cycle");
      const { rows } = await client.query(
        `INSERT INTO penalty_types (cycle_id, code, name, description, amount, is_convertible_to_loan, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          req.body.cycleId,
          code,
          req.body.name,
          req.body.description || null,
          req.body.amount,
          req.body.isConvertibleToLoan,
          req.body.isActive,
        ]
      );
      await audit(client, { actorUserId: req.user.id, action: "CREATE", entityTable: "penalty_types", entityId: rows[0].id, afterData: rows[0], req });
      return rows[0];
    });
    res.status(201).json({ data: penaltyType });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/penalty-types/:id", validate(z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional(),
  isConvertibleToLoan: z.boolean().optional(),
  isActive: z.boolean().optional(),
  reason: z.string().optional().nullable(),
})), async (req, res, next) => {
  try {
    const penaltyType = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM penalty_types WHERE id = $1", [req.params.id])).rows[0];
      if (!before) {
        const error = new Error("Penalty type not found");
        error.status = 404;
        throw error;
      }
      const { rows } = await client.query(
        `UPDATE penalty_types
         SET name = $2,
             description = $3,
             amount = $4,
             is_convertible_to_loan = $5,
             is_active = $6
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          req.body.name ?? before.name,
          req.body.description === undefined ? before.description : req.body.description,
          req.body.amount === undefined ? before.amount : req.body.amount,
          req.body.isConvertibleToLoan === undefined ? before.is_convertible_to_loan : req.body.isConvertibleToLoan,
          req.body.isActive === undefined ? before.is_active : req.body.isActive,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "penalty_types",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason || null,
        req,
      });
      return rows[0];
    });
    res.json({ data: penaltyType });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/cycles/:cycleId/defaults", validate(z.object({
  savingsCap: z.number().nonnegative().optional(),
  minimumBorrowingAmount: z.number().nonnegative().optional(),
  savingsInterestRate: z.number().nonnegative().optional(),
  loanInterestRate: z.number().nonnegative().optional(),
  commonInterestRate: z.number().nonnegative().optional(),
  socialFundAmount: z.number().nonnegative().optional(),
  membershipFeeAmount: z.number().nonnegative().optional(),
  declarationStartDay: z.number().int().min(1).max(31).optional(),
  declarationEndDay: z.number().int().min(1).max(31).optional(),
  payoutStartDay: z.number().int().min(1).max(31).optional(),
  payoutEndDay: z.number().int().min(1).max(31).optional(),
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM cycles WHERE id = $1", [req.params.cycleId])).rows[0];
      if (!before) {
        const error = new Error("Cycle not found");
        error.status = 404;
        throw error;
      }
      if (before.status !== "DRAFT") {
        throw conflict("Cycle defaults can only be edited while the cycle is in draft status");
      }
      const { rows } = await client.query(
        `UPDATE cycles SET
          savings_cap = $2,
          minimum_borrowing_amount = $3,
          savings_interest_rate = $4,
          loan_interest_rate = $5,
          common_interest_rate = $6,
          social_fund_amount = $7,
          membership_fee_amount = $8,
          declaration_start_day = $9,
          declaration_end_day = $10,
          payout_start_day = $11,
          payout_end_day = $12,
          updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.cycleId,
          req.body.savingsCap ?? before.savings_cap,
          req.body.minimumBorrowingAmount ?? before.minimum_borrowing_amount,
          req.body.savingsInterestRate ?? before.savings_interest_rate,
          req.body.loanInterestRate ?? before.loan_interest_rate,
          req.body.commonInterestRate ?? before.common_interest_rate,
          req.body.socialFundAmount ?? before.social_fund_amount,
          req.body.membershipFeeAmount ?? before.membership_fee_amount,
          req.body.declarationStartDay ?? before.declaration_start_day,
          req.body.declarationEndDay ?? before.declaration_end_day,
          req.body.payoutStartDay ?? before.payout_start_day,
          req.body.payoutEndDay ?? before.payout_end_day,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "cycles",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason,
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/cycles/:cycleId/rounding-policy", validate(z.object({
  roundingScale: z.number().int(),
  roundingMode: z.string(),
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const policy = normalizeRoundingPolicy(req.body);
    const updated = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM cycles WHERE id = $1", [req.params.cycleId])).rows[0];
      if (!before) {
        const error = new Error("Cycle not found");
        error.status = 404;
        throw error;
      }
      if (before.status !== "DRAFT") {
        throw conflict("Rounding policy can only be edited while the cycle is in draft status");
      }
      const { rows } = await client.query(
        `UPDATE cycles SET rounding_scale = $2, rounding_mode = $3, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.cycleId, policy.roundingScale, policy.roundingMode]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "cycles",
        entityId: rows[0].id,
        beforeData: { rounding_scale: before.rounding_scale, rounding_mode: before.rounding_mode },
        afterData: { rounding_scale: rows[0].rounding_scale, rounding_mode: rows[0].rounding_mode },
        reason: req.body.reason,
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/notification-preferences", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT key, value, description, updated_at FROM app_settings WHERE key = 'notification_preferences'");
    res.json({ data: rows[0] || null });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/notification-preferences", validate(z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  declarationReminderDays: z.array(z.number().int()),
  payoutReminderDays: z.array(z.number().int()),
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const value = normalizeNotificationPreferences(req.body);
    const updated = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM app_settings WHERE key = 'notification_preferences' FOR UPDATE")).rows[0];
      if (!before) throw badRequest("Notification preferences setting has not been initialized");
      const { rows } = await client.query(
        `UPDATE app_settings SET value = $1, updated_by = $2, updated_at = now()
         WHERE key = 'notification_preferences'
         RETURNING key, value, description, updated_at`,
        [JSON.stringify(value), req.user.id]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "app_settings",
        entityId: null,
        beforeData: { key: before.key, value: before.value },
        afterData: rows[0],
        reason: req.body.reason,
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/active-cycle-defaults", validate(z.object({
  autoSelectLatestActive: z.boolean(),
  defaultCycleId: z.string().uuid().nullable(),
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const value = {
      autoSelectLatestActive: req.body.autoSelectLatestActive,
      defaultCycleId: req.body.defaultCycleId,
    };
    const updated = await withTransaction(async (client) => {
      if (value.defaultCycleId) {
        const cycle = await client.query("SELECT id FROM cycles WHERE id = $1", [value.defaultCycleId]);
        if (!cycle.rows[0]) {
          const error = new Error("Default cycle not found");
          error.status = 404;
          throw error;
        }
      }
      const before = (await client.query("SELECT * FROM app_settings WHERE key = 'active_cycle_defaults' FOR UPDATE")).rows[0];
      if (!before) throw badRequest("Active cycle defaults setting has not been initialized");
      const { rows } = await client.query(
        `UPDATE app_settings SET value = $1, updated_by = $2, updated_at = now()
         WHERE key = 'active_cycle_defaults'
         RETURNING key, value, description, updated_at`,
        [JSON.stringify(value), req.user.id]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "app_settings",
        entityId: null,
        beforeData: { key: before.key, value: before.value },
        afterData: rows[0],
        reason: req.body.reason,
        req,
      });
      return rows[0];
    });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});
