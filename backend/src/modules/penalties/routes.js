import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromParam, requireUnlockedMonthForPenaltyParam, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { runIdempotent } from "../../services/idempotencyService.js";
import { postLedger, reverseLedgerTransaction } from "../../services/ledgerService.js";
import { badRequest, conflict, notFound } from "../../utils/httpError.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";

export const penaltiesRouter = express.Router();
penaltiesRouter.use(requireAuth);

penaltiesRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.cycleId) {
      params.push(req.query.cycleId);
      where.push(`p.cycle_id = $${params.length}`);
    }
    if (req.query.cycleMonthId) {
      params.push(req.query.cycleMonthId);
      where.push(`p.cycle_month_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`p.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 500 });
    const total = await query(
      `SELECT COUNT(*)::int AS total
       FROM penalties p
       JOIN penalty_types pt ON pt.id = p.penalty_type_id
       JOIN cycle_members cm ON cm.id = p.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       ${whereSql}`,
      params
    );
    const listParams = [...params, pagination.limit, pagination.offset];
    const { rows } = await query(
      `SELECT p.*, pt.name AS penalty_name, m.first_name, m.last_name
       FROM penalties p
       JOIN penalty_types pt ON pt.id = p.penalty_type_id
       JOIN cycle_members cm ON cm.id = p.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       ${whereSql}
       ORDER BY p.assessed_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ data: rows, pagination: paginationMeta({ ...pagination, total: total.rows[0].total }) });
  } catch (error) {
    next(error);
  }
});

penaltiesRouter.get("/member/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 500 });
    const total = await query(
      `SELECT COUNT(*)::int AS total
       FROM penalties p
       WHERE p.cycle_member_id = $1`,
      [req.params.cycleMemberId]
    );
    const { rows } = await query(
      `SELECT p.*, pt.name AS penalty_name, pt.code AS penalty_code,
        cmn.month_number,
        (p.amount_assessed - p.amount_paid) AS outstanding_amount
       FROM penalties p
       JOIN penalty_types pt ON pt.id = p.penalty_type_id
       JOIN cycle_months cmn ON cmn.id = p.cycle_month_id
       WHERE p.cycle_member_id = $1
       ORDER BY p.assessed_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.cycleMemberId, pagination.limit, pagination.offset]
    );
    res.json({ data: rows, pagination: paginationMeta({ ...pagination, total: total.rows[0].total }) });
  } catch (error) {
    next(error);
  }
});

penaltiesRouter.post("/", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  penaltyTypeId: z.string().uuid(),
  amount: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, "POST /api/penalties", async () => {
        const penaltyType = (await client.query(
          "SELECT * FROM penalty_types WHERE id = $1 AND cycle_id = $2 AND is_active = TRUE",
          [req.body.penaltyTypeId, req.body.cycleId]
        )).rows[0];
        if (!penaltyType) throw notFound("Penalty type not found");
        const amount = req.body.amount ?? Number(penaltyType.amount);
        if (amount <= 0) throw badRequest("Penalty amount must be greater than zero");

        const existing = await client.query(
          `SELECT id FROM penalties
           WHERE cycle_month_id = $1
             AND cycle_member_id = $2
             AND penalty_type_id = $3
             AND status <> 'REVERSED'
           LIMIT 1`,
          [req.body.cycleMonthId, req.body.cycleMemberId, req.body.penaltyTypeId]
        );
        if (existing.rows[0]) {
          const error = new Error("This penalty has already been assessed for the member and month");
          error.status = 409;
          throw error;
        }

        const ledger = await postLedger(client, {
          cycleId: req.body.cycleId,
          cycleMonthId: req.body.cycleMonthId,
          cycleMemberId: req.body.cycleMemberId,
          transactionType: "PENALTY_ASSESSMENT",
          amount,
          description: "Penalty assessment",
          sourceTable: "penalties",
          postedBy: req.user.id,
          entries: [
            { accountType: "PENALTY", debit: amount },
            { accountType: "ADJUSTMENT", credit: amount },
          ],
        });
        const { rows } = await client.query(
          `INSERT INTO penalties
            (cycle_id, cycle_month_id, cycle_member_id, penalty_type_id, amount_assessed, assessed_by, assessment_ledger_transaction_id, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [req.body.cycleId, req.body.cycleMonthId, req.body.cycleMemberId, req.body.penaltyTypeId, amount, req.user.id, ledger.id, req.body.notes || null]
        );
        await client.query(
          "UPDATE ledger_transactions SET source_id = $2 WHERE id = $1",
          [ledger.id, rows[0].id]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "penalties",
          entityId: rows[0].id,
          afterData: rows[0],
          reason: req.body.notes || "Penalty assessed",
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

penaltiesRouter.post("/:id/pay", requireRole("ADMIN"), validate(z.object({
  amount: z.number().positive(),
})), requireUnlockedMonthForPenaltyParam(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, `POST /api/penalties/${req.params.id}/pay`, async () => {
        const penalty = (await client.query("SELECT * FROM penalties WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
        if (!penalty) throw notFound("Penalty not found");
        if (["PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"].includes(penalty.status)) {
          throw conflict("This penalty can no longer receive payments");
        }
        const outstanding = Number(penalty.amount_assessed) - Number(penalty.amount_paid);
        if (req.body.amount > outstanding) {
          throw badRequest(`Payment exceeds outstanding penalty balance of K${outstanding}`);
        }
        const ledger = await postLedger(client, {
          cycleId: penalty.cycle_id,
          cycleMonthId: penalty.cycle_month_id,
          cycleMemberId: penalty.cycle_member_id,
          transactionType: "PENALTY_PAYMENT",
          amount: req.body.amount,
          description: "Penalty payment",
          sourceTable: "penalties",
          sourceId: penalty.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: req.body.amount },
            { accountType: "PENALTY", credit: req.body.amount },
          ],
        });
        const paid = Number(penalty.amount_paid) + req.body.amount;
        const status = paid >= Number(penalty.amount_assessed) ? "PAID" : "PARTIALLY_PAID";
        const { rows } = await client.query(
          `UPDATE penalties SET amount_paid = $2, status = $3, payment_ledger_transaction_id = $4, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [req.params.id, paid, status, ledger.id]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "penalties",
          entityId: rows[0].id,
          beforeData: penalty,
          afterData: rows[0],
          reason: "Penalty payment posted",
          req,
        });
        return { status: 200, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

penaltiesRouter.post("/:id/convert-to-loan", requireRole("ADMIN"), validate(z.object({
  reason: z.string().min(1),
})), requireUnlockedMonthForPenaltyParam(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, `POST /api/penalties/${req.params.id}/convert-to-loan`, async () => {
        const penalty = (await client.query(
          `SELECT p.*, pt.is_convertible_to_loan
           FROM penalties p
           JOIN penalty_types pt ON pt.id = p.penalty_type_id
           WHERE p.id = $1
           FOR UPDATE OF p`,
          [req.params.id]
        )).rows[0];
        if (!penalty) throw notFound("Penalty not found");
        if (!penalty.is_convertible_to_loan) throw conflict("This penalty type cannot be converted to a loan");
        if (["PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"].includes(penalty.status)) {
          throw conflict("This penalty cannot be converted to a loan");
        }
        const outstanding = Number(penalty.amount_assessed) - Number(penalty.amount_paid);
        if (outstanding <= 0) throw conflict("There is no outstanding penalty balance to convert");
        const ledger = await postLedger(client, {
          cycleId: penalty.cycle_id,
          cycleMonthId: penalty.cycle_month_id,
          cycleMemberId: penalty.cycle_member_id,
          transactionType: "CONVERTED_PENALTY_LOAN",
          amount: outstanding,
          description: `Converted penalty loan: ${req.body.reason}`,
          sourceTable: "penalties",
          sourceId: penalty.id,
          postedBy: req.user.id,
          entries: [
            { accountType: "LOAN_PRINCIPAL", debit: outstanding },
            { accountType: "PENALTY", credit: outstanding },
          ],
        });
        const disbursement = await client.query(
          `INSERT INTO loan_disbursements
            (cycle_id, cycle_month_id, cycle_member_id, source_penalty_id, origin_type, amount, disbursed_by, ledger_transaction_id, notes)
           VALUES ($1,$2,$3,$4,'CONVERTED_PENALTY',$5,$6,$7,$8) RETURNING *`,
          [penalty.cycle_id, penalty.cycle_month_id, penalty.cycle_member_id, penalty.id, outstanding, req.user.id, ledger.id, req.body.reason]
        );
        const { rows } = await client.query(
          `UPDATE penalties SET status = 'CONVERTED_TO_LOAN', converted_loan_disbursement_id = $2, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [penalty.id, disbursement.rows[0].id]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "loan_disbursements",
          entityId: disbursement.rows[0].id,
          afterData: disbursement.rows[0],
          reason: req.body.reason,
          req,
        });
        await audit(client, {
          actorUserId: req.user.id,
          action: "UPDATE",
          entityTable: "penalties",
          entityId: rows[0].id,
          beforeData: penalty,
          afterData: rows[0],
          reason: req.body.reason,
          req,
        });
        return { status: 200, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

penaltiesRouter.post("/:id/waive", requireRole("ADMIN"), validate(z.object({ reason: z.string().min(1) })), requireUnlockedMonthForPenaltyParam(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, `POST /api/penalties/${req.params.id}/waive`, async () => {
        const penalty = (await client.query("SELECT * FROM penalties WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
        if (!penalty) throw notFound("Penalty not found");
        if (["PAID", "CONVERTED_TO_LOAN", "WAIVED", "REVERSED"].includes(penalty.status)) {
          throw conflict("This penalty cannot be waived");
        }
        const outstanding = Number(penalty.amount_assessed) - Number(penalty.amount_paid);
        let waiverLedger = null;
        if (outstanding > 0) {
          waiverLedger = await postLedger(client, {
            cycleId: penalty.cycle_id,
            cycleMonthId: penalty.cycle_month_id,
            cycleMemberId: penalty.cycle_member_id,
            transactionType: "ADMIN_ADJUSTMENT",
            amount: outstanding,
            description: `Penalty waived: ${req.body.reason}`,
            sourceTable: "penalties",
            sourceId: penalty.id,
            postedBy: req.user.id,
            entries: [
              { accountType: "ADJUSTMENT", debit: outstanding },
              { accountType: "PENALTY", credit: outstanding },
            ],
          });
        }
        const { rows } = await client.query(
          "UPDATE penalties SET status = 'WAIVED', notes = $2, updated_at = now() WHERE id = $1 RETURNING *",
          [req.params.id, req.body.reason]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "UPDATE",
          entityTable: "penalties",
          entityId: rows[0].id,
          beforeData: penalty,
          afterData: { ...rows[0], waiverLedgerTransactionId: waiverLedger?.id || null },
          reason: req.body.reason,
          req,
        });
        return { status: 200, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

penaltiesRouter.post("/:id/reverse", requireRole("ADMIN"), validate(z.object({ reason: z.string().min(1) })), requireUnlockedMonthForPenaltyParam(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, `POST /api/penalties/${req.params.id}/reverse`, async () => {
        const penalty = (await client.query("SELECT * FROM penalties WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
        if (!penalty) throw notFound("Penalty not found");
        if (penalty.status !== "ASSESSED" || Number(penalty.amount_paid) > 0 || penalty.converted_loan_disbursement_id) {
          throw conflict("Only unpaid assessed penalties with no conversion can be reversed");
        }
        if (!penalty.assessment_ledger_transaction_id) throw conflict("Penalty has no assessment ledger transaction to reverse");

        const reversal = await reverseLedgerTransaction(client, {
          ledgerTransactionId: penalty.assessment_ledger_transaction_id,
          reason: req.body.reason,
          postedBy: req.user.id,
        });
        const { rows } = await client.query(
          "UPDATE penalties SET status = 'REVERSED', notes = $2, updated_at = now() WHERE id = $1 RETURNING *",
          [penalty.id, req.body.reason]
        );
        await audit(client, {
          actorUserId: req.user.id,
          action: "REVERSE",
          entityTable: "penalties",
          entityId: rows[0].id,
          beforeData: penalty,
          afterData: { ...rows[0], reversalLedgerTransactionId: reversal.reversal.id },
          reason: req.body.reason,
          req,
        });
        return { status: 200, body: { data: rows[0] } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});
