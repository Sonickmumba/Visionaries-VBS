import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromParam, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { runIdempotent } from "../../services/idempotencyService.js";
import { postLedger } from "../../services/ledgerService.js";
import { badRequest, conflict } from "../../utils/httpError.js";

export const savingsRouter = express.Router();
savingsRouter.use(requireAuth);

savingsRouter.get("/posting-context", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const cycleResult = await query(
      "SELECT * FROM cycles WHERE id = COALESCE($1::uuid, id) AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
      [req.query.cycleId || null]
    );
    const cycle = cycleResult.rows[0];
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, members: [] } });

    const monthResult = await query(
      `SELECT * FROM cycle_months
       WHERE cycle_id = $1
       ORDER BY
         CASE status
           WHEN 'DECLARATION_PERIOD' THEN 1
           WHEN 'OPEN' THEN 2
           ELSE 3
         END,
         month_number
       LIMIT 1`,
      [cycle.id]
    );
    const cycleMonth = monthResult.rows[0] || null;

    const members = await query(
      `SELECT cm.id AS cycle_member_id, cm.cycle_id, m.id AS member_id, m.first_name, m.last_name, m.member_code,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
        ($2::numeric - COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)) AS savings_cap_remaining,
        EXISTS (
          SELECT 1 FROM contribution_payments cp
          WHERE cp.cycle_member_id = cm.id AND cp.contribution_type = 'SOCIAL_FUND'
        ) AS social_fund_paid,
        EXISTS (
          SELECT 1 FROM contribution_payments cp
          WHERE cp.cycle_member_id = cm.id AND cp.contribution_type = 'MEMBERSHIP_FEE'
        ) AS membership_fee_paid
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE cm.cycle_id = $1 AND cm.status = 'ACTIVE'
       GROUP BY cm.id, cm.cycle_id, m.id, m.first_name, m.last_name, m.member_code
       ORDER BY m.first_name, m.last_name`,
      [cycle.id, cycle.savings_cap]
    );

    res.json({ data: { cycle, cycleMonth, members: members.rows } });
  } catch (error) {
    next(error);
  }
});

savingsRouter.post("/deposits", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  cycleMemberId: z.string().uuid(),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const idem = await runIdempotent(client, req, "POST /api/savings/deposits", async () => {
        const cycle = (await client.query("SELECT * FROM cycles WHERE id = $1", [req.body.cycleId])).rows[0];
        const current = await client.query(
          `SELECT COALESCE(SUM(lt.amount),0) AS total
           FROM ledger_transactions lt
           LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
           WHERE lt.cycle_id = $1
             AND lt.cycle_member_id = $2
             AND lt.transaction_type = 'SAVINGS_DEPOSIT'
             AND rev.id IS NULL`,
          [req.body.cycleId, req.body.cycleMemberId]
        );
        if (Number(current.rows[0].total) + req.body.amount > Number(cycle.savings_cap)) {
          throw badRequest(`Savings cap exceeded. Remaining principal cap is K${Number(cycle.savings_cap) - Number(current.rows[0].total)}.`);
        }
        const ledger = await postLedger(client, {
          cycleId: req.body.cycleId,
          cycleMonthId: req.body.cycleMonthId,
          cycleMemberId: req.body.cycleMemberId,
          transactionType: "SAVINGS_DEPOSIT",
          amount: req.body.amount,
          description: "Savings deposit",
          postedBy: req.user.id,
          entries: [
            { accountType: "CASH_POOL", debit: req.body.amount },
            { accountType: "SAVINGS_PRINCIPAL", credit: req.body.amount },
          ],
        });
        await audit(client, {
          actorUserId: req.user.id,
          action: "POST",
          entityTable: "ledger_transactions",
          entityId: ledger.id,
          afterData: ledger,
          reason: req.body.notes || "Savings deposit posted",
          req,
        });
        return { status: 201, body: { data: ledger } };
      });
      return idem;
    });
    if (result.replayed) res.set("Idempotency-Replayed", "true");
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

savingsRouter.post("/contributions", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid().optional().nullable(),
  cycleMemberId: z.string().uuid(),
  contributionType: z.enum(["SOCIAL_FUND", "MEMBERSHIP_FEE"]),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
})), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM contribution_payments
         WHERE cycle_id = $1 AND cycle_member_id = $2 AND contribution_type = $3
         LIMIT 1`,
        [req.body.cycleId, req.body.cycleMemberId, req.body.contributionType]
      );
      if (existing.rows[0]) throw conflict("This one-time contribution has already been recorded for the member in this cycle");
      const ledger = await postLedger(client, {
        cycleId: req.body.cycleId,
        cycleMonthId: req.body.cycleMonthId || null,
        cycleMemberId: req.body.cycleMemberId,
        transactionType: req.body.contributionType === "SOCIAL_FUND" ? "SOCIAL_FUND_PAYMENT" : "MEMBERSHIP_FEE_PAYMENT",
        amount: req.body.amount,
        description: req.body.contributionType.replace("_", " ").toLowerCase(),
        postedBy: req.user.id,
        entries: [
          { accountType: "CASH_POOL", debit: req.body.amount },
          { accountType: req.body.contributionType, credit: req.body.amount },
        ],
      });
      const { rows } = await client.query(
        `INSERT INTO contribution_payments
          (cycle_id, cycle_member_id, contribution_type, amount, ledger_transaction_id, posted_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [req.body.cycleId, req.body.cycleMemberId, req.body.contributionType, req.body.amount, ledger.id, req.user.id, req.body.notes || null]
      );
      await audit(client, {
        actorUserId: req.user.id,
        action: "POST",
        entityTable: "contribution_payments",
        entityId: rows[0].id,
        afterData: rows[0],
        reason: req.body.notes || `${req.body.contributionType} contribution posted`,
        req,
      });
      return rows[0];
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

savingsRouter.get("/member/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
  try {
    const membership = await query(
      `SELECT cm.id AS cycle_member_id, c.id AS cycle_id, c.savings_cap,
        m.first_name, m.last_name, m.member_code
       FROM cycle_members cm
       JOIN cycles c ON c.id = cm.cycle_id
       JOIN members m ON m.id = cm.member_id
       WHERE cm.id = $1`,
      [req.params.cycleMemberId]
    );
    const { rows } = await query(
      `SELECT * FROM ledger_transactions
       WHERE cycle_member_id = $1 AND transaction_type IN ('SAVINGS_DEPOSIT','SAVINGS_INTEREST','SOCIAL_FUND_PAYMENT','MEMBERSHIP_FEE_PAYMENT')
       ORDER BY posted_at DESC`,
      [req.params.cycleMemberId]
    );
    const totals = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SOCIAL_FUND_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS social_fund_paid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'MEMBERSHIP_FEE_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS membership_fee_paid
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1`,
      [req.params.cycleMemberId]
    );
    const savingsCap = Number(membership.rows[0]?.savings_cap || 0);
    const savingsPrincipal = Number(totals.rows[0].savings_principal || 0);
    res.json({
      data: rows,
      member: membership.rows[0] || null,
      totals: {
        ...totals.rows[0],
        savings_cap: savingsCap,
        savings_cap_remaining: Math.max(0, savingsCap - savingsPrincipal),
      },
    });
  } catch (error) {
    next(error);
  }
});

savingsRouter.get("/contributions/member/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT cp.*, lt.transaction_type, lt.posted_at
       FROM contribution_payments cp
       LEFT JOIN ledger_transactions lt ON lt.id = cp.ledger_transaction_id
       WHERE cp.cycle_member_id = $1
       ORDER BY cp.paid_at DESC`,
      [req.params.cycleMemberId]
    );
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});
