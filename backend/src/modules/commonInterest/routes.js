import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { buildCommonInterestPreview, postCommonInterestRun } from "../../services/commonInterestService.js";
import { publishNotification } from "../../services/notificationService.js";

export const commonInterestRouter = express.Router();
commonInterestRouter.use(requireAuth);

commonInterestRouter.get("/preview", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const cycleResult = await query(
      "SELECT * FROM cycles WHERE id = COALESCE($1::uuid, id) AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
      [req.query.cycleId || null]
    );
    const cycle = cycleResult.rows[0];
    if (!cycle) return res.json({ data: null });

    let cycleMonthId = req.query.cycleMonthId;
    if (!cycleMonthId) {
      const month = await query(
        `SELECT id FROM cycle_months
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
      cycleMonthId = month.rows[0]?.id;
    }

    if (!cycleMonthId) return res.json({ data: null });

    const allocationMethod = req.query.allocationMethod || "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL";
    const preview = await buildCommonInterestPreview({ query }, {
      cycleId: cycle.id,
      cycleMonthId,
      allocationMethod,
    });
    const existingRun = await query("SELECT * FROM common_interest_runs WHERE cycle_month_id = $1", [cycleMonthId]);
    res.json({ data: { ...preview, existingRun: existingRun.rows[0] || null } });
  } catch (error) {
    next(error);
  }
});

commonInterestRouter.post("/calculate", requireRole("ADMIN"), validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  allocationMethod: z.enum(["ONLY_NON_BORROWERS_EQUAL", "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL", "ALL_MEMBERS_EQUAL"]),
})), requireConsistentCycleReferences({ cycleMemberField: null }), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      return postCommonInterestRun(client, {
        ...req.body,
        userId: req.user.id,
        req,
      });
    });
    publishNotification({
      type: "COMMON_INTEREST_POSTED",
      title: "Common interest posted",
      message: "Common interest was calculated and allocated for a cycle month.",
      cycleId: result.run?.cycle_id,
      cycleMonthId: result.run?.cycle_month_id,
      sourceTable: "common_interest_runs",
      sourceId: result.run?.id,
      actionUrl: "reports:common-interest",
      metadata: {
        allocationMethod: result.run?.allocation_method,
        unborrowedMoney: result.run?.unborrowed_money,
        commonInterestPool: result.run?.common_interest_pool,
        allocations: result.allocations?.length || 0,
      },
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

commonInterestRouter.get("/runs/:cycleMonthId", async (req, res, next) => {
  try {
    const run = await query("SELECT * FROM common_interest_runs WHERE cycle_month_id = $1", [req.params.cycleMonthId]);
    const allocations = run.rows[0]
      ? await query(
          `SELECT cia.*, m.first_name, m.last_name
           FROM common_interest_allocations cia
           JOIN cycle_members cm ON cm.id = cia.cycle_member_id
           JOIN members m ON m.id = cm.member_id
           WHERE common_interest_run_id = $1`,
          [run.rows[0].id]
        )
      : { rows: [] };
    res.json({ data: run.rows[0] || null, allocations: allocations.rows });
  } catch (error) {
    next(error);
  }
});
