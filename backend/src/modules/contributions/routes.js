import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireCycleMemberAccessFromParam, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { postLedger } from "../../services/ledgerService.js";
import { conflict } from "../../utils/httpError.js";

export const contributionsRouter = express.Router();
contributionsRouter.use(requireAuth);

const contributionSchema = z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid().optional().nullable(),
  cycleMemberId: z.string().uuid(),
  contributionType: z.enum(["SOCIAL_FUND", "MEMBERSHIP_FEE"]),
  amount: z.number().positive(),
  notes: z.string().optional().nullable(),
});

contributionsRouter.post("/", requireRole("ADMIN"), validate(contributionSchema), requireConsistentCycleReferences(), requireUnlockedMonthFromBody(), async (req, res, next) => {
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

contributionsRouter.get("/member/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
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
