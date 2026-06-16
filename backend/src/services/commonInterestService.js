import { allocateCommonInterest, classifyBorrowing, roundingPolicyFromCycle } from "./finance.js";
import { postLedger } from "./ledgerService.js";
import { audit } from "./auditService.js";
import { conflict } from "../utils/httpError.js";

export async function buildCommonInterestPreview(clientOrPool, { cycleId, cycleMonthId, allocationMethod }) {
  const cycle = (await clientOrPool.query("SELECT * FROM cycles WHERE id = $1", [cycleId])).rows[0];
  const cycleMonth = (await clientOrPool.query("SELECT * FROM cycle_months WHERE id = $1", [cycleMonthId])).rows[0];
  const pool = await clientOrPool.query(
    `WITH selected_month AS (
       SELECT month_number FROM cycle_months WHERE id = $2
     )
     SELECT
      COALESCE(SUM(CASE
        WHEN lt.transaction_type IN (
          'SAVINGS_DEPOSIT','SOCIAL_FUND_PAYMENT','MEMBERSHIP_FEE_PAYMENT',
          'PENALTY_PAYMENT','PRINCIPAL_REPAYMENT','LOAN_INTEREST_REPAYMENT',
          'COMMON_INTEREST_PAYMENT'
        ) AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS contributions,
      COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loans
     FROM ledger_transactions lt
     JOIN cycle_months cmn ON cmn.id = lt.cycle_month_id
     LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
     WHERE lt.cycle_id = $1
       AND lt.is_reversal = FALSE
       AND cmn.month_number <= (SELECT month_number FROM selected_month)`,
    [cycleId, cycleMonthId]
  );
  const totalPoolContributions = Number(pool.rows[0].contributions);
  const totalLoansIssued = Number(pool.rows[0].loans);
  const unborrowedMoney = Math.max(0, totalPoolContributions - totalLoansIssued);
  const memberRows = await clientOrPool.query(
    `WITH selected_month AS (
       SELECT month_number FROM cycle_months WHERE id = $2
     )
     SELECT cm.id AS cycle_member_id, m.first_name, m.last_name, m.member_code,
      COALESCE(SUM(CASE
        WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN')
          AND rev.id IS NULL
          AND cmn.month_number <= (SELECT month_number FROM selected_month)
        THEN lt.amount ELSE 0 END),0) AS borrowed
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
     LEFT JOIN cycle_months cmn ON cmn.id = lt.cycle_month_id
     LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
     WHERE cm.cycle_id = $1
       AND cm.status = 'ACTIVE'
     GROUP BY cm.id, m.first_name, m.last_name, m.member_code
     ORDER BY m.first_name, m.last_name`,
    [cycleId, cycleMonthId]
  );
  const classified = memberRows.rows.map((member) => {
    const c = classifyBorrowing(member.borrowed, cycle.minimum_borrowing_amount);
    return { ...member, cumulativeBorrowed: Number(member.borrowed), status: c.status, shortfall: c.shortfall };
  });
  const allocation = allocateCommonInterest({
    members: classified,
    unborrowedMoney,
    rate: cycle.common_interest_rate,
    method: allocationMethod,
    roundingPolicy: roundingPolicyFromCycle(cycle),
  });
  return {
    cycle,
    cycleMonth,
    allocationMethod,
    totalPoolContributions,
    totalLoansIssued,
    unborrowedMoney,
    commonInterestRate: Number(cycle.common_interest_rate),
    commonInterestPool: allocation.commonInterestPool,
    members: classified,
    allocations: allocation.allocations,
  };
}

async function getRunAllocations(client, runId) {
  const { rows } = await client.query(
    "SELECT * FROM common_interest_allocations WHERE common_interest_run_id = $1 ORDER BY created_at, id",
    [runId]
  );
  return rows;
}

export async function postCommonInterestRun(client, {
  cycleId,
  cycleMonthId,
  allocationMethod,
  userId,
  req,
  allowExisting = false,
}) {
  const existingRun = (await client.query("SELECT * FROM common_interest_runs WHERE cycle_month_id = $1 FOR UPDATE", [cycleMonthId])).rows[0];
  if (existingRun) {
    const activePostings = await client.query(
      `SELECT cia.id
       FROM common_interest_allocations cia
       JOIN ledger_transactions lt ON lt.id = cia.ledger_transaction_id
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE cia.common_interest_run_id = $1
         AND lt.is_reversal = FALSE
         AND rev.id IS NULL
       LIMIT 1`,
      [existingRun.id]
    );
    if (activePostings.rows[0]) {
      if (allowExisting) {
        return { run: existingRun, allocations: await getRunAllocations(client, existingRun.id), reused: true };
      }
      throw conflict("Common-interest assessments already exist for this month. Reverse or override them before recalculating.");
    }
    await client.query("DELETE FROM common_interest_runs WHERE id = $1", [existingRun.id]);
  }

  const preview = await buildCommonInterestPreview(client, { cycleId, cycleMonthId, allocationMethod });
  const run = await client.query(
    `INSERT INTO common_interest_runs
      (cycle_id, cycle_month_id, allocation_method, total_pool_contributions, total_loans_issued, unborrowed_money, common_interest_rate, common_interest_pool, calculated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [cycleId, cycleMonthId, allocationMethod, preview.totalPoolContributions, preview.totalLoansIssued, preview.unborrowedMoney, preview.commonInterestRate, preview.commonInterestPool, userId]
  );
  const runRow = run.rows[0];
  await audit(client, {
    actorUserId: userId,
    action: "CREATE",
    entityTable: "common_interest_runs",
    entityId: runRow.id,
    afterData: runRow,
    reason: "Common interest calculated",
    req,
  });

  const allocations = [];
  for (const item of preview.allocations) {
    const ledger = await postLedger(client, {
      cycleId,
      cycleMonthId,
      cycleMemberId: item.cycle_member_id,
      transactionType: "COMMON_INTEREST_ASSESSMENT",
      amount: item.charge,
      description: "Common interest assessment",
      sourceTable: "common_interest_runs",
      sourceId: runRow.id,
      postedBy: userId,
      entries: [
        { accountType: "COMMON_INTEREST", debit: item.charge },
        { accountType: "ADJUSTMENT", credit: item.charge },
      ],
    });
    const saved = await client.query(
      `INSERT INTO common_interest_allocations
        (common_interest_run_id, cycle_id, cycle_month_id, cycle_member_id, compliance_status,
         cumulative_borrowed_amount, borrowing_shortfall, allocation_weight, assigned_base,
         calculated_charge, final_charge, ledger_transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [runRow.id, cycleId, cycleMonthId, item.cycle_member_id, item.status, item.cumulativeBorrowed, item.shortfall, item.weight, item.assignedBase, item.charge, item.charge, ledger.id]
    );
    allocations.push(saved.rows[0]);
  }
  if (allocations.length) {
    await audit(client, {
      actorUserId: userId,
      action: "POST",
      entityTable: "common_interest_allocations",
      entityId: runRow.id,
      afterData: { commonInterestRunId: runRow.id, allocationsPosted: allocations.length },
      reason: "Common interest allocations posted",
      req,
    });
  }

  return { run: runRow, allocations, reused: false };
}
