import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { badRequest, conflict, notFound } from "../../utils/httpError.js";

export const cyclesRouter = express.Router();
cyclesRouter.use(requireAuth);

const cycleBaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  savingsCap: z.number().nonnegative(),
  minimumBorrowingAmount: z.number().nonnegative(),
  savingsInterestRate: z.number().nonnegative().max(1),
  loanInterestRate: z.number().nonnegative().max(1),
  commonInterestRate: z.number().nonnegative().max(1),
  socialFundAmount: z.number().nonnegative(),
  membershipFeeAmount: z.number().nonnegative(),
  declarationStartDay: z.number().int().min(1).max(31),
  declarationEndDay: z.number().int().min(1).max(31),
  payoutStartDay: z.number().int().min(1).max(31),
  payoutEndDay: z.number().int().min(1).max(31),
});

const cycleSchema = cycleBaseSchema.refine((value) => new Date(value.endDate) >= new Date(value.startDate), {
  message: "Cycle end date must be on or after the start date",
  path: ["endDate"],
});

const criticalCycleFields = [
  "savingsCap",
  "minimumBorrowingAmount",
  "savingsInterestRate",
  "loanInterestRate",
  "commonInterestRate",
  "socialFundAmount",
  "membershipFeeAmount",
  "declarationStartDay",
  "declarationEndDay",
  "payoutStartDay",
  "payoutEndDay",
];

function hasCriticalCycleChange(body = {}, before = {}) {
  return criticalCycleFields.some((field) => {
    if (body[field] === undefined) return false;
    const snake = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    return Number.isFinite(Number(body[field]))
      ? Number(body[field]) !== Number(before[snake])
      : String(body[field]) !== String(before[snake]);
  });
}

cyclesRouter.get("/", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM cycles ORDER BY created_at DESC");
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.post("/", requireRole("ADMIN"), validate(cycleSchema), async (req, res, next) => {
  try {
    const cycle = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO cycles
          (name, description, start_date, end_date, status, savings_cap, minimum_borrowing_amount,
           savings_interest_rate, loan_interest_rate, common_interest_rate, social_fund_amount,
           membership_fee_amount, declaration_start_day, declaration_end_day, payout_start_day, payout_end_day, created_by)
         VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          req.body.name,
          req.body.description || null,
          req.body.startDate,
          req.body.endDate,
          req.body.savingsCap,
          req.body.minimumBorrowingAmount,
          req.body.savingsInterestRate,
          req.body.loanInterestRate,
          req.body.commonInterestRate,
          req.body.socialFundAmount,
          req.body.membershipFeeAmount,
          req.body.declarationStartDay,
          req.body.declarationEndDay,
          req.body.payoutStartDay,
          req.body.payoutEndDay,
          req.user.id,
        ]
      );
      await audit(client, { actorUserId: req.user.id, action: "CREATE", entityTable: "cycles", entityId: rows[0].id, afterData: rows[0], req });
      return rows[0];
    });
    res.status(201).json({ data: cycle });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.get("/:cycleId", async (req, res, next) => {
  try {
    const cycle = await query("SELECT * FROM cycles WHERE id = $1", [req.params.cycleId]);
    if (!cycle.rows[0]) throw notFound("Cycle not found");
    const months = await query("SELECT * FROM cycle_months WHERE cycle_id = $1 ORDER BY month_number", [req.params.cycleId]);
    const members = await query(
      `SELECT cm.*, m.first_name, m.last_name, m.member_code
       FROM cycle_members cm JOIN members m ON m.id = cm.member_id
       WHERE cm.cycle_id = $1 ORDER BY m.first_name`,
      [req.params.cycleId]
    );
    res.json({ data: cycle.rows[0], months: months.rows, members: members.rows });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.patch("/:cycleId", requireRole("ADMIN"), validate(cycleBaseSchema.partial().extend({
  reason: z.string().optional().nullable(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM cycles WHERE id = $1 FOR UPDATE", [req.params.cycleId])).rows[0];
      if (!before) throw notFound("Cycle not found");
      if (new Date(req.body.endDate || before.end_date) < new Date(req.body.startDate || before.start_date)) {
        throw badRequest("Cycle end date must be on or after the start date");
      }
      if (before.status !== "DRAFT" && hasCriticalCycleChange(req.body, before) && !req.body.reason) {
        throw conflict("Changing critical rules on a non-draft cycle requires an audit reason");
      }
      const { rows } = await client.query(
        `UPDATE cycles SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          savings_cap = COALESCE($6, savings_cap),
          minimum_borrowing_amount = COALESCE($7, minimum_borrowing_amount),
          savings_interest_rate = COALESCE($8, savings_interest_rate),
          loan_interest_rate = COALESCE($9, loan_interest_rate),
          common_interest_rate = COALESCE($10, common_interest_rate),
          social_fund_amount = COALESCE($11, social_fund_amount),
          membership_fee_amount = COALESCE($12, membership_fee_amount),
          declaration_start_day = COALESCE($13, declaration_start_day),
          declaration_end_day = COALESCE($14, declaration_end_day),
          payout_start_day = COALESCE($15, payout_start_day),
          payout_end_day = COALESCE($16, payout_end_day),
          updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.cycleId,
          req.body.name,
          req.body.description,
          req.body.startDate,
          req.body.endDate,
          req.body.savingsCap,
          req.body.minimumBorrowingAmount,
          req.body.savingsInterestRate,
          req.body.loanInterestRate,
          req.body.commonInterestRate,
          req.body.socialFundAmount,
          req.body.membershipFeeAmount,
          req.body.declarationStartDay,
          req.body.declarationEndDay,
          req.body.payoutStartDay,
          req.body.payoutEndDay,
        ]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "cycles",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason || "Cycle configuration updated",
        req,
      });
      return rows[0];
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.post("/:cycleId/activate", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM cycles WHERE id = $1 FOR UPDATE", [req.params.cycleId])).rows[0];
      if (!before) throw notFound("Cycle not found");
      const months = await client.query("SELECT COUNT(*)::int AS count FROM cycle_months WHERE cycle_id = $1", [req.params.cycleId]);
      if (months.rows[0].count === 0) throw conflict("Generate cycle months before activating the cycle");
      const { rows } = await client.query("UPDATE cycles SET status = 'ACTIVE', updated_at = now() WHERE id = $1 RETURNING *", [req.params.cycleId]);
      await audit(client, {
        actorUserId: req.user.id,
        action: "APPROVE",
        entityTable: "cycles",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: "Cycle activated",
        req,
      });
      return rows[0];
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.patch("/:cycleId/status", requireRole("ADMIN"), validate(z.object({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]),
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const before = (await client.query("SELECT * FROM cycles WHERE id = $1 FOR UPDATE", [req.params.cycleId])).rows[0];
      if (!before) throw notFound("Cycle not found");
      if (req.body.status === "ACTIVE") {
        const months = await client.query("SELECT COUNT(*)::int AS count FROM cycle_months WHERE cycle_id = $1", [req.params.cycleId]);
        if (months.rows[0].count === 0) throw conflict("Generate cycle months before activating the cycle");
      }
      const { rows } = await client.query("UPDATE cycles SET status = $2, updated_at = now() WHERE id = $1 RETURNING *", [req.params.cycleId, req.body.status]);
      await audit(client, {
        actorUserId: req.user.id,
        action: req.body.status === "ACTIVE" ? "APPROVE" : "UPDATE",
        entityTable: "cycles",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason,
        req,
      });
      return rows[0];
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.get("/:cycleId/months", async (req, res, next) => {
  try {
    const cycle = await query("SELECT id FROM cycles WHERE id = $1", [req.params.cycleId]);
    if (!cycle.rows[0]) throw notFound("Cycle not found");
    const { rows } = await query("SELECT * FROM cycle_months WHERE cycle_id = $1 ORDER BY month_number", [req.params.cycleId]);
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.post("/:cycleId/months/generate", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const cycleResult = await client.query("SELECT * FROM cycles WHERE id = $1", [req.params.cycleId]);
      const cycle = cycleResult.rows[0];
      if (!cycle) throw notFound("Cycle not found");
      const start = new Date(cycle.start_date);
      const end = new Date(cycle.end_date);
      const months = [];
      let monthNumber = 1;
      for (let cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const periodStart = new Date(year, month, 1);
        const periodEnd = new Date(year, month + 1, 0);
        const declarationStart = new Date(year, month, cycle.declaration_start_day);
        const declarationEnd = new Date(year, month + (cycle.declaration_end_day < cycle.declaration_start_day ? 1 : 0), cycle.declaration_end_day);
        const payoutStart = new Date(year, month, cycle.payout_start_day);
        const payoutEnd = new Date(year, month, cycle.payout_end_day);
        const { rows } = await client.query(
          `INSERT INTO cycle_months
            (cycle_id, month_number, period_start, period_end, declaration_window_start, declaration_window_end, payout_window_start, payout_window_end)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (cycle_id, month_number) DO UPDATE SET
             period_start = EXCLUDED.period_start,
             period_end = EXCLUDED.period_end,
             declaration_window_start = EXCLUDED.declaration_window_start,
             declaration_window_end = EXCLUDED.declaration_window_end,
             payout_window_start = EXCLUDED.payout_window_start,
             payout_window_end = EXCLUDED.payout_window_end,
             updated_at = now()
           RETURNING *`,
          [cycle.id, monthNumber, periodStart, periodEnd, declarationStart, declarationEnd, payoutStart, payoutEnd]
        );
        months.push(rows[0]);
        monthNumber += 1;
      }
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "cycle_months",
        entityId: cycle.id,
        afterData: { cycleId: cycle.id, monthsGenerated: months.length },
        reason: "Cycle months generated",
        req,
      });
      return months;
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.post("/:cycleId/penalty-types", requireRole("ADMIN"), validate(z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().nonnegative(),
  description: z.string().optional().nullable(),
  isConvertibleToLoan: z.boolean().default(true),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const cycle = await client.query("SELECT id FROM cycles WHERE id = $1", [req.params.cycleId]);
      if (!cycle.rows[0]) throw notFound("Cycle not found");
      const code = req.body.code.trim().toUpperCase().replaceAll(" ", "_");
      const { rows } = await client.query(
        `INSERT INTO penalty_types (cycle_id, code, name, description, amount, is_convertible_to_loan)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [req.params.cycleId, code, req.body.name, req.body.description || null, req.body.amount, req.body.isConvertibleToLoan]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "penalty_types",
        entityId: rows[0].id,
        afterData: rows[0],
        reason: "Cycle penalty type configured",
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.post("/:cycleId/members", requireRole("ADMIN"), validate(z.object({
  memberId: z.string().uuid(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const cycle = (await client.query("SELECT id FROM cycles WHERE id = $1", [req.params.cycleId])).rows[0];
      if (!cycle) throw notFound("Cycle not found");
      const member = (await client.query("SELECT id FROM members WHERE id = $1", [req.body.memberId])).rows[0];
      if (!member) throw notFound("Member not found");
      const before = (await client.query(
        "SELECT * FROM cycle_members WHERE cycle_id = $1 AND member_id = $2",
        [req.params.cycleId, req.body.memberId]
      )).rows[0] || null;
      const { rows } = await client.query(
        `INSERT INTO cycle_members (cycle_id, member_id, status)
         VALUES ($1,$2,'ACTIVE')
         ON CONFLICT (cycle_id, member_id) DO UPDATE SET status = 'ACTIVE', left_at = NULL, updated_at = now()
         RETURNING *`,
        [req.params.cycleId, req.body.memberId]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: before ? "UPDATE" : "CREATE",
        entityTable: "cycle_members",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: before ? "Cycle member reactivated" : "Member enrolled into cycle",
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

cyclesRouter.patch("/:cycleId/members/:cycleMemberId", requireRole("ADMIN"), validate(z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "REMOVED"]),
  reason: z.string().optional().nullable(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const before = (await client.query(
        "SELECT * FROM cycle_members WHERE id = $1 AND cycle_id = $2",
        [req.params.cycleMemberId, req.params.cycleId]
      )).rows[0];
      if (!before) throw notFound("Cycle member participation not found");
      if (before.status === "REMOVED" && req.body.status === "ACTIVE") {
        throw badRequest("Removed participation cannot be reactivated from this endpoint; enroll the member again.");
      }
      const leftAt = req.body.status === "ACTIVE" ? null : new Date().toISOString().slice(0, 10);
      const { rows } = await client.query(
        `UPDATE cycle_members
         SET status = $3, left_at = $4, updated_at = now()
         WHERE id = $1 AND cycle_id = $2
         RETURNING *`,
        [req.params.cycleMemberId, req.params.cycleId, req.body.status, leftAt]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "UPDATE",
        entityTable: "cycle_members",
        entityId: rows[0].id,
        beforeData: before,
        afterData: rows[0],
        reason: req.body.reason || "Cycle participation status updated",
        req,
      });
      return rows[0];
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
