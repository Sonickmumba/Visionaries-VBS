import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromBody, requireCycleMemberAccessFromParam, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { runIdempotent } from "../../services/idempotencyService.js";
import { postLedger } from "../../services/ledgerService.js";
import { badRequest, conflict, notFound } from "../../utils/httpError.js";

export const loansRouter = express.Router();
loansRouter.use(requireAuth);

function dateKey(value) {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function isTodayInWindow(start, end) {
  const today = new Date().toISOString().slice(0, 10);
  return today >= dateKey(start) && today <= dateKey(end);
}

async function assertPayoutWindow(client, cycleMonthId) {
  const { rows } = await client.query(
    "SELECT id, status, payout_window_start, payout_window_end FROM cycle_months WHERE id = $1",
    [cycleMonthId]
  );
  const month = rows[0];
  if (!month) throw notFound("Cycle month not found");
  if (month.status !== "PAYOUT_PERIOD" && !isTodayInWindow(month.payout_window_start, month.payout_window_end)) {
    throw conflict("Loan disbursements are only allowed during the payout window");
  }
}

loansRouter.get("/requests", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT lr.*, m.first_name, m.last_name, m.member_code,
        cm.member_id,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS cumulative_borrowed,
        EXISTS (
          SELECT 1 FROM loan_disbursements ld
          WHERE ld.loan_request_id = lr.id
        ) AS is_disbursed
       FROM loan_requests lr
       JOIN cycle_members cm ON cm.id = lr.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       GROUP BY lr.id, m.first_name, m.last_name, m.member_code, cm.member_id
       ORDER BY lr.requested_at DESC`
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

loansRouter.post("/requests", validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  declarationId: z.string().uuid().optional().nullable(),
  requestedAmount: z.number().positive(),
  originType: z.enum(["ORIGINAL_LOAN", "TOP_UP"]).default("ORIGINAL_LOAN"),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireCycleMemberAccessFromBody(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO loan_requests
          (cycle_id, cycle_month_id, cycle_member_id, declaration_id, requested_amount, origin_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.body.cycleId, req.body.cycleMonthId, req.body.cycleMemberId, req.body.declarationId || null, req.body.requestedAmount, req.body.originType, req.body.notes || null]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "loan_requests",
        entityId: rows[0].id,
        afterData: rows[0],
        reason: req.body.notes || "Loan request created",
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

loansRouter.post("/requests/:id/approve", requireRole("ADMIN"), validate(z.object({
  approvedAmount: z.number().positive(),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const request = (await client.query("SELECT * FROM loan_requests WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!request) throw notFound("Loan request not found");
      if (!["PENDING", "APPROVED"].includes(request.status)) {
        throw conflict("Only pending or previously approved loan requests can be approved");
      }
      const { rows } = await client.query(
        `UPDATE loan_requests SET status = 'APPROVED', approved_amount = $2, approved_by = $3, approved_at = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.id, req.body.approvedAmount, req.user.id]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "APPROVE",
        entityTable: "loan_requests",
        entityId: rows[0].id,
        beforeData: request,
        afterData: rows[0],
        reason: "Loan request approved",
        req,
      });
      return rows[0];
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

loansRouter.post("/requests/:id/reject", requireRole("ADMIN"), validate(z.object({
  reason: z.string().min(1),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const request = (await client.query("SELECT * FROM loan_requests WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!request) throw notFound("Loan request not found");
      if (request.status !== "PENDING") throw conflict("Only pending loan requests can be rejected");
      const { rows } = await client.query(
        `UPDATE loan_requests SET status = 'REJECTED', rejection_reason = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [req.params.id, req.body.reason]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "REJECT",
        entityTable: "loan_requests",
        entityId: rows[0].id,
        beforeData: request,
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

loansRouter.post("/disbursements", requireRole("ADMIN"), validate(z.object({
  loanRequestId: z.string().uuid().optional().nullable(),
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  originType: z.enum(["ORIGINAL_LOAN", "TOP_UP", "CONVERTED_PENALTY", "ADMIN_CONVERSION"]),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, "POST /api/loans/disbursements", async () => {
        if (req.body.loanRequestId) {
          const loanRequest = (await client.query("SELECT * FROM loan_requests WHERE id = $1", [req.body.loanRequestId])).rows[0];
          if (!loanRequest) throw notFound("Loan request not found");
          if (loanRequest.status !== "APPROVED") throw conflict("Only approved loan requests can be disbursed");
          const alreadyDisbursed = await client.query("SELECT id FROM loan_disbursements WHERE loan_request_id = $1 LIMIT 1", [req.body.loanRequestId]);
          if (alreadyDisbursed.rows[0]) throw conflict("This loan request has already been disbursed");
          if (String(loanRequest.cycle_id) !== String(req.body.cycleId) || String(loanRequest.cycle_month_id) !== String(req.body.cycleMonthId) || String(loanRequest.cycle_member_id) !== String(req.body.cycleMemberId)) {
            throw badRequest("Disbursement does not match the approved loan request");
          }
          if (loanRequest.origin_type !== req.body.originType) {
            throw badRequest("Disbursement origin type must match the approved loan request");
          }
          if (Number(req.body.amount) !== Number(loanRequest.approved_amount)) {
            throw badRequest("Disbursement amount must match the approved amount");
          }
        } else {
          await assertPayoutWindow(client, req.body.cycleMonthId);
        }
        const txType = req.body.originType === "TOP_UP" ? "LOAN_TOP_UP" : req.body.originType === "CONVERTED_PENALTY" ? "CONVERTED_PENALTY_LOAN" : "LOAN_DISBURSEMENT";
        const ledger = await postLedger(client, {
          cycleId: req.body.cycleId,
          cycleMonthId: req.body.cycleMonthId,
          cycleMemberId: req.body.cycleMemberId,
          transactionType: txType,
          amount: req.body.amount,
          description: "Loan disbursement",
          postedBy: req.user.id,
          entries: [
            { accountType: "LOAN_PRINCIPAL", debit: req.body.amount },
            { accountType: "CASH_POOL", credit: req.body.amount },
          ],
        });
        const { rows } = await client.query(
          `INSERT INTO loan_disbursements
            (cycle_id, cycle_month_id, cycle_member_id, loan_request_id, origin_type, amount, disbursed_by, ledger_transaction_id, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [req.body.cycleId, req.body.cycleMonthId, req.body.cycleMemberId, req.body.loanRequestId || null, req.body.originType, req.body.amount, req.user.id, ledger.id, req.body.notes || null]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "loan_disbursements",
          entityId: rows[0].id,
          afterData: rows[0],
          reason: req.body.notes || "Loan disbursed",
          req,
        });
        return { status: 201, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

loansRouter.post("/repayments", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  principalAmount: z.number().nonnegative().default(0),
  interestAmount: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    if (req.body.principalAmount <= 0 && req.body.interestAmount <= 0) {
      throw badRequest("At least one repayment amount must be greater than zero");
    }
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, "POST /api/loans/repayments", async () => {
        let principalLedgerId = null;
        let interestLedgerId = null;
        if (req.body.principalAmount > 0) {
          const ledger = await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: req.body.cycleMemberId,
            transactionType: "PRINCIPAL_REPAYMENT",
            amount: req.body.principalAmount,
            description: "Loan principal repayment",
            postedBy: req.user.id,
            entries: [
              { accountType: "CASH_POOL", debit: req.body.principalAmount },
              { accountType: "LOAN_PRINCIPAL", credit: req.body.principalAmount },
            ],
          });
          principalLedgerId = ledger.id;
        }
        if (req.body.interestAmount > 0) {
          const ledger = await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: req.body.cycleMemberId,
            transactionType: "LOAN_INTEREST_REPAYMENT",
            amount: req.body.interestAmount,
            description: "Loan interest repayment",
            postedBy: req.user.id,
            entries: [
              { accountType: "CASH_POOL", debit: req.body.interestAmount },
              { accountType: "LOAN_INTEREST", credit: req.body.interestAmount },
            ],
          });
          interestLedgerId = ledger.id;
        }
        const { rows } = await client.query(
          `INSERT INTO loan_repayments
            (cycle_id, cycle_month_id, cycle_member_id, principal_amount, interest_amount, principal_ledger_transaction_id, interest_ledger_transaction_id, posted_by, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [req.body.cycleId, req.body.cycleMonthId, req.body.cycleMemberId, req.body.principalAmount, req.body.interestAmount, principalLedgerId, interestLedgerId, req.user.id, req.body.notes || null]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "loan_repayments",
          entityId: rows[0].id,
          afterData: rows[0],
          reason: req.body.notes || "Loan repayment posted",
          req,
        });
        return { status: 201, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

loansRouter.get("/member/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM ledger_transactions
       WHERE cycle_member_id = $1 AND transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN','PRINCIPAL_REPAYMENT','LOAN_INTEREST_ASSESSMENT','LOAN_INTEREST_REPAYMENT')
       ORDER BY posted_at DESC`,
      [req.params.cycleMemberId]
    );
    const summary = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS cumulative_borrowed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_DISBURSEMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS original_loans,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_TOP_UP' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS top_ups,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'CONVERTED_PENALTY_LOAN' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS converted_penalty_loans,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_assessed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN','LOAN_INTEREST_ASSESSMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)
          - COALESCE(SUM(CASE WHEN lt.transaction_type IN ('PRINCIPAL_REPAYMENT','LOAN_INTEREST_REPAYMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS outstanding_balance
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1`,
      [req.params.cycleMemberId]
    );
    res.json({ data: rows, summary: summary.rows[0] });
  } catch (error) {
    next(error);
  }
});
