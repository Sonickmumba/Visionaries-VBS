import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { reverseLedgerTransaction } from "../../services/ledgerService.js";
import { notFound } from "../../utils/httpError.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";

export const ledgerRouter = express.Router();
ledgerRouter.use(requireAuth, requireRole("ADMIN", "AUDITOR"));

ledgerRouter.get("/", async (req, res, next) => {
  try {
    const params = [];
    const where = [];
    if (req.query.cycleId) {
      params.push(req.query.cycleId);
      where.push(`lt.cycle_id = $${params.length}`);
    }
    if (req.query.cycleMonthId) {
      params.push(req.query.cycleMonthId);
      where.push(`lt.cycle_month_id = $${params.length}`);
    }
    if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      where.push(`lt.cycle_member_id = $${params.length}`);
    }
    if (req.query.transactionType) {
      params.push(req.query.transactionType);
      where.push(`lt.transaction_type = $${params.length}`);
    }
    if (req.query.dateFrom) {
      params.push(req.query.dateFrom);
      where.push(`lt.transaction_date >= $${params.length}`);
    }
    if (req.query.dateTo) {
      params.push(req.query.dateTo);
      where.push(`lt.transaction_date <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 500 });
    const total = await query(
      `SELECT COUNT(*)::int AS total FROM ledger_transactions lt ${whereSql}`,
      params
    );
    params.push(pagination.limit, pagination.offset);
    const { rows } = await query(
      `SELECT lt.*, m.first_name, m.last_name, m.member_code,
        c.name AS cycle_name,
        cmn.month_number,
        cmn.status AS cycle_month_status
       FROM ledger_transactions lt
       JOIN cycles c ON c.id = lt.cycle_id
       LEFT JOIN cycle_months cmn ON cmn.id = lt.cycle_month_id
       LEFT JOIN cycle_members cm ON cm.id = lt.cycle_member_id
       LEFT JOIN members m ON m.id = cm.member_id
       ${whereSql}
       ORDER BY lt.posted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: rows, pagination: paginationMeta({ ...pagination, total: total.rows[0].total }) });
  } catch (error) {
    next(error);
  }
});

ledgerRouter.get("/:id", async (req, res, next) => {
  try {
    const transaction = await query(
      `SELECT lt.*, m.first_name, m.last_name, m.member_code,
        c.name AS cycle_name,
        cmn.month_number,
        cmn.status AS cycle_month_status
       FROM ledger_transactions lt
       JOIN cycles c ON c.id = lt.cycle_id
       LEFT JOIN cycle_months cmn ON cmn.id = lt.cycle_month_id
       LEFT JOIN cycle_members cm ON cm.id = lt.cycle_member_id
       LEFT JOIN members m ON m.id = cm.member_id
       WHERE lt.id = $1`,
      [req.params.id]
    );
    const entries = await query("SELECT * FROM ledger_entries WHERE ledger_transaction_id = $1 ORDER BY created_at", [req.params.id]);
    if (!transaction.rows[0]) throw notFound("Ledger transaction not found");
    const reversal = await query(
      `SELECT id, transaction_type, amount, description, reversal_reason, posted_at, posted_by
       FROM ledger_transactions
       WHERE reversed_transaction_id = $1
       ORDER BY posted_at DESC LIMIT 1`,
      [req.params.id]
    );
    res.json({ data: transaction.rows[0], entries: entries.rows, reversal: reversal.rows[0] || null });
  } catch (error) {
    next(error);
  }
});

ledgerRouter.post("/:id/reverse", requireRole("ADMIN"), validate(z.object({
  reason: z.string().min(3),
})), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const { original, reversal } = await reverseLedgerTransaction(client, {
        ledgerTransactionId: req.params.id,
        reason: req.body.reason,
        postedBy: req.user.id,
      });
      await audit(client, {
        actorUserId: req.user.id,
        action: "REVERSE",
        entityTable: "ledger_transactions",
        entityId: original.id,
        beforeData: original,
        afterData: reversal,
        reason: req.body.reason,
        req,
      });
      return { original, reversal };
    });
    res.status(201).json({ data: result.reversal, original: result.original });
  } catch (error) {
    next(error);
  }
});
