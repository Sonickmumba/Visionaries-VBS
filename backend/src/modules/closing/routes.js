import express from "express";
import { z } from "zod";
import { query, withTransaction } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireConsistentCycleReferences, requireUnlockedMonthFromBody } from "../../middleware/domainGuards.js";
import { validate } from "../../middleware/validate.js";
import { audit } from "../../services/auditService.js";
import { postCommonInterestRun } from "../../services/commonInterestService.js";
import { postLedger } from "../../services/ledgerService.js";
import { queueActivityNotification } from "../../services/notificationService.js";
import {
  calculateMemberMonthlyClosing,
  getClosingLedgerSums,
} from "../../services/monthlyClosingService.js";

export const closingRouter = express.Router();
closingRouter.use(requireAuth, requireRole("ADMIN"));

closingRouter.get("/preview", async (req, res, next) => {
  try {
    const cycleId = req.query.cycleId;
    let cycleMonthId = req.query.cycleMonthId;

    const cycleResult = await query(
      "SELECT * FROM cycles WHERE id = COALESCE($1::uuid, id) AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
      [cycleId || null]
    );
    const cycle = cycleResult.rows[0];
    if (!cycle) return res.json({ data: null });

    if (!cycleMonthId) {
      const monthResult = await query(
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
      cycleMonthId = monthResult.rows[0]?.id;
    }

    if (!cycleMonthId) return res.json({ data: { cycle, cycleMonth: null, members: [], totals: {} } });

    const cycleMonth = (await query("SELECT * FROM cycle_months WHERE id = $1", [cycleMonthId])).rows[0];
    const penaltyType = (await query("SELECT * FROM penalty_types WHERE cycle_id = $1 AND code = 'FAILURE_TO_DECLARE' LIMIT 1", [cycle.id])).rows[0];
    const activeMembers = await query(
      `SELECT cm.id AS cycle_member_id, m.first_name, m.last_name, m.member_code
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       WHERE cm.cycle_id = $1 AND cm.status = 'ACTIVE'
       ORDER BY m.first_name, m.last_name`,
      [cycle.id]
    );

    const members = [];
    for (const member of activeMembers.rows) {
      const declaration = (await query(
        "SELECT * FROM declarations WHERE cycle_month_id = $1 AND cycle_member_id = $2",
        [cycleMonthId, member.cycle_member_id]
      )).rows[0];
      const previous = await getClosingLedgerSums(query, {
        cycleId: cycle.id,
        cycleMemberId: member.cycle_member_id,
        cycleMonthId,
        scope: "previous",
      });
      const current = await getClosingLedgerSums(query, {
        cycleId: cycle.id,
        cycleMemberId: member.cycle_member_id,
        cycleMonthId,
        scope: "current",
      });
      const calculation = calculateMemberMonthlyClosing({
        cycle,
        declarationStatus: declaration ? declaration.status : "MISSED",
        previous,
        current,
      });

      members.push({
        ...member,
        declarationStatus: calculation.declarationStatus,
        savingsDeposit: calculation.savingsDeposit,
        savingsInterest: calculation.savingsInterest,
        loanBroughtForward: calculation.loanBroughtForward,
        newLoanAmount: calculation.newLoanAmount,
        topUpAmount: calculation.topUpAmount,
        convertedPenaltyLoanAmount: calculation.convertedPenaltyLoanAmount,
        loanInterest: calculation.loanInterestAssessed,
        principalRepaid: calculation.principalRepaid,
        interestRepaid: calculation.interestRepaid,
        loanCarriedForward: calculation.loanCarriedForward,
        cumulativeBorrowed: calculation.cumulativeBorrowedAmount,
        borrowingStatus: calculation.borrowingStatus,
        borrowingShortfall: calculation.borrowingShortfall,
        penaltyAmount: declaration ? current.penaltiesAssessed : Number(penaltyType?.amount || 0),
      });
    }

    const totals = members.reduce((acc, member) => ({
      declared: acc.declared + (member.declarationStatus === "MISSED" ? 0 : 1),
      missed: acc.missed + (member.declarationStatus === "MISSED" ? 1 : 0),
      savingsDeposit: acc.savingsDeposit + member.savingsDeposit,
      savingsInterest: acc.savingsInterest + member.savingsInterest,
      loanInterest: acc.loanInterest + member.loanInterest,
      penalties: acc.penalties + member.penaltyAmount,
    }), { declared: 0, missed: 0, savingsDeposit: 0, savingsInterest: 0, loanInterest: 0, penalties: 0 });

    res.json({ data: { cycle, cycleMonth, members, totals } });
  } catch (error) {
    next(error);
  }
});

closingRouter.post("/run", validate(z.object({
  cycleId: z.string().uuid(),
  cycleMonthId: z.string().uuid(),
  lock: z.boolean().default(false),
  allocationMethod: z.enum(["ONLY_NON_BORROWERS_EQUAL", "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL", "ALL_MEMBERS_EQUAL"])
    .default("NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL"),
})), requireConsistentCycleReferences({ cycleMemberField: null }), requireUnlockedMonthFromBody(), async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const cycle = (await client.query("SELECT * FROM cycles WHERE id = $1", [req.body.cycleId])).rows[0];
      const runNumberResult = await client.query("SELECT COALESCE(MAX(run_number),0) + 1 AS next FROM monthly_closing_runs WHERE cycle_month_id = $1", [req.body.cycleMonthId]);
      const run = (await client.query(
        `INSERT INTO monthly_closing_runs (cycle_id, cycle_month_id, run_number, started_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.body.cycleId, req.body.cycleMonthId, runNumberResult.rows[0].next, req.user.id]
      )).rows[0];
      await audit(client, {
        actorUserId: req.user.id,
        action: "CREATE",
        entityTable: "monthly_closing_runs",
        entityId: run.id,
        afterData: run,
        reason: "Monthly closing started",
        req,
      });

      const activeMembers = await client.query(
        `SELECT cm.id AS cycle_member_id
         FROM cycle_members cm
         WHERE cm.cycle_id = $1 AND cm.status = 'ACTIVE'`,
        [req.body.cycleId]
      );

      const penaltyType = (await client.query("SELECT * FROM penalty_types WHERE cycle_id = $1 AND code = 'FAILURE_TO_DECLARE' LIMIT 1", [req.body.cycleId])).rows[0];
      const snapshots = [];
      for (const member of activeMembers.rows) {
        const declaration = (await client.query(
          "SELECT * FROM declarations WHERE cycle_month_id = $1 AND cycle_member_id = $2",
          [req.body.cycleMonthId, member.cycle_member_id]
        )).rows[0];

        const missingOrMissedDeclaration = !declaration || declaration.status === "MISSED";
        const existingFailurePenalty = penaltyType ? (await client.query(
          `SELECT id FROM penalties
           WHERE cycle_month_id = $1 AND cycle_member_id = $2 AND penalty_type_id = $3
             AND status <> 'WAIVED'
           LIMIT 1`,
          [req.body.cycleMonthId, member.cycle_member_id, penaltyType.id]
        )).rows[0] : null;

        if (missingOrMissedDeclaration && penaltyType && !existingFailurePenalty) {
          const penaltyLedger = await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: member.cycle_member_id,
            transactionType: "PENALTY_ASSESSMENT",
            amount: penaltyType.amount,
            description: "Failure to declare penalty",
            sourceTable: "monthly_closing_runs",
            sourceId: run.id,
            postedBy: req.user.id,
            entries: [
              { accountType: "PENALTY", debit: penaltyType.amount },
              { accountType: "ADJUSTMENT", credit: penaltyType.amount },
            ],
          });
          await client.query(
            `INSERT INTO penalties
              (cycle_id, cycle_month_id, cycle_member_id, penalty_type_id, declaration_id,
               amount_assessed, assessed_by, assessment_ledger_transaction_id, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Auto-assessed during monthly closing')`,
            [
              req.body.cycleId,
              req.body.cycleMonthId,
              member.cycle_member_id,
              penaltyType.id,
              declaration?.id || null,
              penaltyType.amount,
              req.user.id,
              penaltyLedger.id,
            ]
          );
        }

        let previous = await getClosingLedgerSums(client, {
          cycleId: req.body.cycleId,
          cycleMemberId: member.cycle_member_id,
          cycleMonthId: req.body.cycleMonthId,
          scope: "previous",
        });
        let current = await getClosingLedgerSums(client, {
          cycleId: req.body.cycleId,
          cycleMemberId: member.cycle_member_id,
          cycleMonthId: req.body.cycleMonthId,
          scope: "current",
        });
        let calculation = calculateMemberMonthlyClosing({
          cycle,
          declarationStatus: declaration ? declaration.status : "MISSED",
          previous,
          current,
        });

        const existingSavingsInterest = (await client.query(
          `SELECT lt.id FROM ledger_transactions lt
           LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
           WHERE lt.cycle_month_id = $1 AND lt.cycle_member_id = $2
             AND lt.transaction_type = 'SAVINGS_INTEREST'
             AND lt.is_reversal = FALSE
             AND rev.id IS NULL
           LIMIT 1`,
          [req.body.cycleMonthId, member.cycle_member_id]
        )).rows[0];
        if (calculation.savingsInterest > 0 && !existingSavingsInterest) {
          await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: member.cycle_member_id,
            transactionType: "SAVINGS_INTEREST",
            amount: calculation.savingsInterest,
            description: "Monthly savings interest",
            sourceTable: "monthly_closing_runs",
            sourceId: run.id,
            postedBy: req.user.id,
            entries: [
              { accountType: "SAVINGS_INTEREST", debit: calculation.savingsInterest },
              { accountType: "ADJUSTMENT", credit: calculation.savingsInterest },
            ],
          });
        }

        const existingLoanInterest = (await client.query(
          `SELECT lt.id FROM ledger_transactions lt
           LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
           WHERE lt.cycle_month_id = $1 AND lt.cycle_member_id = $2
             AND lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT'
             AND lt.is_reversal = FALSE
             AND rev.id IS NULL
           LIMIT 1`,
          [req.body.cycleMonthId, member.cycle_member_id]
        )).rows[0];
        if (calculation.loanInterestAssessed > 0 && !existingLoanInterest) {
          await postLedger(client, {
            cycleId: req.body.cycleId,
            cycleMonthId: req.body.cycleMonthId,
            cycleMemberId: member.cycle_member_id,
            transactionType: "LOAN_INTEREST_ASSESSMENT",
            amount: calculation.loanInterestAssessed,
            description: "Monthly loan interest",
            sourceTable: "monthly_closing_runs",
            sourceId: run.id,
            postedBy: req.user.id,
            entries: [
              { accountType: "LOAN_INTEREST", debit: calculation.loanInterestAssessed },
              { accountType: "ADJUSTMENT", credit: calculation.loanInterestAssessed },
            ],
          });
        }
      }

      const commonInterest = await postCommonInterestRun(client, {
        cycleId: req.body.cycleId,
        cycleMonthId: req.body.cycleMonthId,
        allocationMethod: req.body.allocationMethod,
        userId: req.user.id,
        req,
        allowExisting: true,
      });

      for (const member of activeMembers.rows) {
        const declaration = (await client.query(
          "SELECT * FROM declarations WHERE cycle_month_id = $1 AND cycle_member_id = $2",
          [req.body.cycleMonthId, member.cycle_member_id]
        )).rows[0];
        const previous = await getClosingLedgerSums(client, {
          cycleId: req.body.cycleId,
          cycleMemberId: member.cycle_member_id,
          cycleMonthId: req.body.cycleMonthId,
          scope: "previous",
        });
        const current = await getClosingLedgerSums(client, {
          cycleId: req.body.cycleId,
          cycleMemberId: member.cycle_member_id,
          cycleMonthId: req.body.cycleMonthId,
          scope: "current",
        });
        const calculation = calculateMemberMonthlyClosing({
          cycle,
          declarationStatus: declaration ? declaration.status : "MISSED",
          previous,
          current,
        });
        const snapshot = (await client.query(
          `INSERT INTO member_monthly_snapshots
            (cycle_id, cycle_month_id, cycle_member_id, monthly_closing_run_id, declaration_status,
             borrowing_compliance_status, savings_brought_forward, savings_deposit, savings_interest,
             accumulated_savings_carried_forward, cumulative_savings_principal, loan_brought_forward,
             new_loan_amount, top_up_amount, converted_penalty_loan_amount, loan_interest_assessed,
             principal_repaid, interest_repaid, loan_carried_forward, cumulative_borrowed_amount,
             borrowing_shortfall, common_interest_charge, common_interest_paid, penalties_assessed,
             penalties_paid, penalties_converted_to_loan)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
           ON CONFLICT (cycle_month_id, cycle_member_id) DO UPDATE SET
             monthly_closing_run_id = EXCLUDED.monthly_closing_run_id,
             declaration_status = EXCLUDED.declaration_status,
             borrowing_compliance_status = EXCLUDED.borrowing_compliance_status,
             savings_brought_forward = EXCLUDED.savings_brought_forward,
             savings_deposit = EXCLUDED.savings_deposit,
             savings_interest = EXCLUDED.savings_interest,
             accumulated_savings_carried_forward = EXCLUDED.accumulated_savings_carried_forward,
             cumulative_savings_principal = EXCLUDED.cumulative_savings_principal,
             loan_brought_forward = EXCLUDED.loan_brought_forward,
             new_loan_amount = EXCLUDED.new_loan_amount,
             top_up_amount = EXCLUDED.top_up_amount,
             converted_penalty_loan_amount = EXCLUDED.converted_penalty_loan_amount,
             loan_interest_assessed = EXCLUDED.loan_interest_assessed,
             principal_repaid = EXCLUDED.principal_repaid,
             interest_repaid = EXCLUDED.interest_repaid,
             loan_carried_forward = EXCLUDED.loan_carried_forward,
             cumulative_borrowed_amount = EXCLUDED.cumulative_borrowed_amount,
             borrowing_shortfall = EXCLUDED.borrowing_shortfall,
             common_interest_charge = EXCLUDED.common_interest_charge,
             common_interest_paid = EXCLUDED.common_interest_paid,
             penalties_assessed = EXCLUDED.penalties_assessed,
             penalties_paid = EXCLUDED.penalties_paid,
             penalties_converted_to_loan = EXCLUDED.penalties_converted_to_loan
           RETURNING *`,
          [
            req.body.cycleId,
            req.body.cycleMonthId,
            member.cycle_member_id,
            run.id,
            calculation.declarationStatus,
            calculation.borrowingStatus,
            calculation.savingsBroughtForward,
            calculation.savingsDeposit,
            calculation.savingsInterest,
            calculation.accumulatedSavingsCarriedForward,
            calculation.cumulativeSavingsPrincipal,
            calculation.loanBroughtForward,
            calculation.newLoanAmount,
            calculation.topUpAmount,
            calculation.convertedPenaltyLoanAmount,
            calculation.loanInterestAssessed,
            calculation.principalRepaid,
            calculation.interestRepaid,
            calculation.loanCarriedForward,
            calculation.cumulativeBorrowedAmount,
            calculation.borrowingShortfall,
            calculation.commonInterestCharge,
            calculation.commonInterestPaid,
            calculation.penaltiesAssessed,
            calculation.penaltiesPaid,
            calculation.penaltiesConvertedToLoan,
          ]
        )).rows[0];
        snapshots.push(snapshot);
      }

      const monthLedgerTotals = (await client.query(
        `SELECT
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SOCIAL_FUND_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS social_fund,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'MEMBERSHIP_FEE_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS membership_fees
         FROM ledger_transactions lt
         LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
         WHERE lt.cycle_id = $1
           AND lt.cycle_month_id = $2
           AND lt.is_reversal = FALSE`,
        [req.body.cycleId, req.body.cycleMonthId]
      )).rows[0];

      const summary = (await client.query(
        `INSERT INTO cycle_month_summaries
          (cycle_id, cycle_month_id, monthly_closing_run_id, total_savings_deposits, total_savings_interest,
           total_accumulated_savings, total_social_fund, total_membership_fees,
           total_loans_issued, total_top_ups, total_converted_penalty_loans,
           total_principal_repaid, total_loan_interest_assessed, total_loan_interest_repaid,
           total_outstanding_loans, total_pool_contributions, unborrowed_money, common_interest_pool,
           total_common_interest_charged, total_common_interest_paid,
           total_penalties_assessed, total_penalties_paid, total_penalties_converted)
         SELECT $1,$2,$3,
           COALESCE(SUM(savings_deposit),0), COALESCE(SUM(savings_interest),0),
           COALESCE(SUM(accumulated_savings_carried_forward),0), $4, $5,
           COALESCE(SUM(new_loan_amount),0), COALESCE(SUM(top_up_amount),0),
           COALESCE(SUM(converted_penalty_loan_amount),0), COALESCE(SUM(principal_repaid),0),
           COALESCE(SUM(loan_interest_assessed),0), COALESCE(SUM(interest_repaid),0),
           COALESCE(SUM(loan_carried_forward),0), $6, $7, $8, COALESCE(SUM(common_interest_charge),0),
           COALESCE(SUM(common_interest_paid),0), COALESCE(SUM(penalties_assessed),0),
           COALESCE(SUM(penalties_paid),0), COALESCE(SUM(penalties_converted_to_loan),0)
         FROM member_monthly_snapshots WHERE cycle_month_id = $2
         ON CONFLICT (cycle_month_id) DO UPDATE SET
           monthly_closing_run_id = EXCLUDED.monthly_closing_run_id,
           total_savings_deposits = EXCLUDED.total_savings_deposits,
           total_savings_interest = EXCLUDED.total_savings_interest,
           total_accumulated_savings = EXCLUDED.total_accumulated_savings,
           total_social_fund = EXCLUDED.total_social_fund,
           total_membership_fees = EXCLUDED.total_membership_fees,
           total_loans_issued = EXCLUDED.total_loans_issued,
           total_top_ups = EXCLUDED.total_top_ups,
           total_converted_penalty_loans = EXCLUDED.total_converted_penalty_loans,
           total_principal_repaid = EXCLUDED.total_principal_repaid,
           total_loan_interest_assessed = EXCLUDED.total_loan_interest_assessed,
           total_loan_interest_repaid = EXCLUDED.total_loan_interest_repaid,
           total_outstanding_loans = EXCLUDED.total_outstanding_loans,
           total_pool_contributions = EXCLUDED.total_pool_contributions,
           unborrowed_money = EXCLUDED.unborrowed_money,
           common_interest_pool = EXCLUDED.common_interest_pool,
           total_common_interest_charged = EXCLUDED.total_common_interest_charged,
           total_common_interest_paid = EXCLUDED.total_common_interest_paid,
           total_penalties_assessed = EXCLUDED.total_penalties_assessed,
           total_penalties_paid = EXCLUDED.total_penalties_paid,
           total_penalties_converted = EXCLUDED.total_penalties_converted
         RETURNING *`,
        [
          req.body.cycleId,
          req.body.cycleMonthId,
          run.id,
          Number(monthLedgerTotals.social_fund || 0),
          Number(monthLedgerTotals.membership_fees || 0),
          Number(commonInterest.run.total_pool_contributions || 0),
          Number(commonInterest.run.unborrowed_money || 0),
          Number(commonInterest.run.common_interest_pool || 0),
        ]
      )).rows[0];

      const approvedRun = (await client.query(
        "UPDATE monthly_closing_runs SET status = 'APPROVED', completed_at = now(), approved_by = $2, approved_at = now() WHERE id = $1 RETURNING *",
        [run.id, req.user.id]
      )).rows[0];
      if (req.body.lock) {
        await client.query("UPDATE cycle_months SET status = 'LOCKED', locked_at = now(), locked_by = $2 WHERE id = $1", [req.body.cycleMonthId, req.user.id]);
      }
      await audit(client, {
        actorUserId: req.user.id,
        action: "APPROVE",
        entityTable: "monthly_closing_runs",
        entityId: run.id,
        afterData: { ...approvedRun, summaryId: summary.id, snapshots: snapshots.length, locked: req.body.lock },
        reason: req.body.lock ? "Monthly closing approved and month locked" : "Monthly closing approved",
        req,
      });
      return { run: approvedRun, summary, snapshots, commonInterest };
    });
    queueActivityNotification(query, {
      type: "MONTHLY_CLOSING_COMPLETED",
      title: "Monthly closing completed",
      message: req.body.lock ? "Monthly closing was completed and the month was locked." : "Monthly closing was completed.",
      cycleId: result.run?.cycle_id,
      cycleMonthId: result.run?.cycle_month_id,
      sourceTable: "monthly_closing_runs",
      sourceId: result.run?.id,
      actionUrl: "reports:cycle-closing",
      metadata: {
        locked: Boolean(req.body.lock),
        snapshots: result.snapshots?.length || 0,
        totalSavingsDeposits: result.summary?.total_savings_deposits,
        totalLoansIssued: result.summary?.total_loans_issued,
        totalCommonInterestCharged: result.summary?.total_common_interest_charged,
        totalPenaltiesAssessed: result.summary?.total_penalties_assessed,
      },
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
