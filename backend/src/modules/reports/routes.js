import express from "express";
import { query } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireCycleMemberAccessFromParam } from "../../middleware/domainGuards.js";
import { calculateGroupSurplusSchedule } from "../../services/shareoutService.js";

export const reportsRouter = express.Router();
reportsRouter.use(requireAuth);

function isPrivileged(user) {
  return ["ADMIN", "AUDITOR"].includes(user.role);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replaceAll("\"", "\"\"")}"`;
}

function sendReport(req, res, payload, { filename = "report", rows = payload.data?.rows || [], columns = null } = {}) {
  if (String(req.query.format || "").toLowerCase() !== "csv") {
    return res.json(payload);
  }
  const csvColumns = columns || Object.keys(rows[0] || {});
  const csv = [
    csvColumns.join(","),
    ...rows.map((row) => csvColumns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(csv);
}

async function resolveReportContext(req) {
  const cycleResult = req.query.cycleId
    ? await query("SELECT * FROM cycles WHERE id = $1", [req.query.cycleId])
    : await query("SELECT * FROM cycles WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
  const cycle = cycleResult.rows[0] || null;
  if (!cycle) return { cycle: null, cycleMonth: null };

  const monthResult = req.query.cycleMonthId
    ? await query("SELECT * FROM cycle_months WHERE id = $1 AND cycle_id = $2", [req.query.cycleMonthId, cycle.id])
    : await query(
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

  return { cycle, cycleMonth: monthResult.rows[0] || null };
}

async function ensureCycleMemberAccess(req, cycleMemberId) {
  if (!cycleMemberId || isPrivileged(req.user)) return;
  const access = await query(
    `SELECT cm.id
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.id = $1 AND m.user_id = $2`,
    [cycleMemberId, req.user.id]
  );
  if (!access.rows[0]) {
    const error = new Error("You can only access your own cycle records");
    error.status = 403;
    throw error;
  }
}

function memberScopeSql(req, alias = "m", paramIndex = 2) {
  if (isPrivileged(req.user)) return { sql: "", values: [] };
  return { sql: ` AND ${alias}.user_id = $${paramIndex}`, values: [req.user.id] };
}

async function getReportMembers(req, cycleId) {
  const scope = memberScopeSql(req, "m", 2);
  return query(
    `SELECT cm.id AS cycle_member_id, cm.status AS cycle_member_status,
      m.id AS member_id, m.member_code, m.first_name, m.last_name
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.cycle_id = $1${scope.sql}
     ORDER BY m.first_name, m.last_name`,
    [cycleId, ...scope.values]
  );
}

async function getCycleFinancialPosition(cycleId, cycleMonthId = null) {
  if (!cycleId) return null;
  const result = await query(
    `WITH selected_month AS (
       SELECT id, month_number
       FROM cycle_months
       WHERE cycle_id = $1 AND ($2::uuid IS NULL OR id = $2::uuid)
       ORDER BY
         CASE status
           WHEN 'DECLARATION_PERIOD' THEN 1
           WHEN 'OPEN' THEN 2
           WHEN 'PAYOUT_PERIOD' THEN 3
           ELSE 4
         END,
         month_number
       LIMIT 1
     ),
     ledger_savings AS (
       SELECT COALESCE(SUM(CASE
         WHEN lt.transaction_type IN ('SAVINGS_DEPOSIT','SAVINGS_INTEREST') AND rev.id IS NULL THEN lt.amount
         ELSE 0
       END),0) AS total_accumulated_savings
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_id = $1 AND lt.is_reversal = FALSE
     ),
     ledger_through_month AS (
       SELECT
         ranked_months.id AS cycle_month_id,
         COALESCE(SUM(CASE
           WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount
           ELSE 0
         END),0) AS loans_issued
       FROM cycle_months ranked_months
       LEFT JOIN cycle_months ledger_months
         ON ledger_months.cycle_id = ranked_months.cycle_id
        AND ledger_months.month_number <= ranked_months.month_number
       LEFT JOIN ledger_transactions lt
         ON lt.cycle_month_id = ledger_months.id
        AND lt.cycle_id = $1
        AND lt.is_reversal = FALSE
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE ranked_months.cycle_id = $1
       GROUP BY ranked_months.id
     ),
     position_sources AS (
       SELECT sm.id AS cycle_month_id, sm.month_number,
         cms.total_pool_contributions AS pool_contributions,
         cms.total_loans_issued AS loans_issued,
         cms.unborrowed_money,
         cms.common_interest_pool,
         cms.total_accumulated_savings,
         1 AS priority
       FROM selected_month sm
       JOIN cycle_month_summaries cms ON cms.cycle_month_id = sm.id
       UNION ALL
       SELECT sm.id AS cycle_month_id, sm.month_number,
         cir.total_pool_contributions AS pool_contributions,
         cir.total_loans_issued AS loans_issued,
         cir.unborrowed_money,
         cir.common_interest_pool,
         0 AS total_accumulated_savings,
         2 AS priority
       FROM selected_month sm
       JOIN common_interest_runs cir ON cir.cycle_month_id = sm.id
       UNION ALL
       SELECT cm.id AS cycle_month_id, cm.month_number,
         cms.total_pool_contributions AS pool_contributions,
         cms.total_loans_issued AS loans_issued,
         cms.unborrowed_money,
         cms.common_interest_pool,
         cms.total_accumulated_savings,
         3 AS priority
       FROM cycle_months cm
       JOIN cycle_month_summaries cms ON cms.cycle_month_id = cm.id
       WHERE cm.cycle_id = $1
       UNION ALL
       SELECT cm.id AS cycle_month_id, cm.month_number,
         cir.total_pool_contributions AS pool_contributions,
         cir.total_loans_issued AS loans_issued,
         cir.unborrowed_money,
         cir.common_interest_pool,
         0 AS total_accumulated_savings,
         4 AS priority
       FROM cycle_months cm
       JOIN common_interest_runs cir ON cir.cycle_month_id = cm.id
       WHERE cm.cycle_id = $1
       UNION ALL
       SELECT sm.id AS cycle_month_id, sm.month_number, 0, 0, 0, 0, 0, 5 AS priority
       FROM selected_month sm
     ),
     ranked AS (
       SELECT *,
         (COALESCE(pool_contributions,0) <> 0
          OR COALESCE(loans_issued,0) <> 0
          OR COALESCE(unborrowed_money,0) <> 0
          OR COALESCE(common_interest_pool,0) <> 0
          OR COALESCE(total_accumulated_savings,0) <> 0) AS has_values
       FROM position_sources
     )
     SELECT
       ranked.cycle_month_id,
       ranked.month_number,
       COALESCE(ranked.pool_contributions,0) AS pool_contributions,
       COALESCE(NULLIF(ranked.loans_issued,0), ledger_through_month.loans_issued, 0) AS loans_issued,
       COALESCE(ranked.unborrowed_money,0) AS unborrowed_money,
       COALESCE(ranked.common_interest_pool,0) AS common_interest_pool,
       COALESCE(NULLIF(ranked.total_accumulated_savings,0), ledger_savings.total_accumulated_savings, 0) AS total_accumulated_savings
     FROM ranked
     CROSS JOIN ledger_savings
     LEFT JOIN ledger_through_month ON ledger_through_month.cycle_month_id = ranked.cycle_month_id
     ORDER BY
       CASE WHEN ranked.has_values THEN ranked.priority ELSE 90 + ranked.priority END,
       ranked.month_number DESC
     LIMIT 1`,
    [cycleId, cycleMonthId]
  );
  return result.rows[0] || null;
}

reportsRouter.get("/dashboard", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const cycle = await query("SELECT * FROM cycles WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
    if (!cycle.rows[0]) return res.json({ data: null });
    const cycleId = cycle.rows[0].id;
    const cycleMonth = await query(
      `SELECT *
       FROM cycle_months
       WHERE cycle_id = $1
       ORDER BY
         CASE status
           WHEN 'DECLARATION_PERIOD' THEN 1
           WHEN 'OPEN' THEN 2
           ELSE 3
         END,
         month_number
       LIMIT 1`,
      [cycleId]
    );
    const totals = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('SAVINGS_DEPOSIT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN','LOAN_INTEREST_ASSESSMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)
          - COALESCE(SUM(CASE WHEN lt.transaction_type IN ('PRINCIPAL_REPAYMENT','LOAN_INTEREST_REPAYMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loans,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)
          - COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_id = $1 AND lt.is_reversal = FALSE`,
      [cycleId]
    );
    const pendingLoans = await query("SELECT COUNT(*)::int AS count FROM loan_requests WHERE cycle_id = $1 AND status = 'PENDING'", [cycleId]);
    const declarationStats = await query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status IN ('SUBMITTED','LATE'))::int AS awaiting_review,
        COUNT(*) FILTER (WHERE status = 'MISSED')::int AS missed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE cycle_month_id = $2 AND status = 'APPROVED')::int AS current_month_approved,
        COUNT(*) FILTER (WHERE cycle_month_id = $2 AND status = 'MISSED')::int AS current_month_missed
       FROM declarations
       WHERE cycle_id = $1`,
      [cycleId, cycleMonth.rows[0]?.id || null]
    );
    const financialPosition = await getCycleFinancialPosition(cycleId, cycleMonth.rows[0]?.id || null);
    return sendReport(req, res, {
      data: {
        cycle: cycle.rows[0],
        cycleMonth: cycleMonth.rows[0] || null,
        totals: totals.rows[0],
        financialPosition,
        pendingLoans: pendingLoans.rows[0].count,
        declarationStats: declarationStats.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/member-statement/:cycleMemberId", requireCycleMemberAccessFromParam(), async (req, res, next) => {
  try {
    const member = await query(
      `SELECT cm.id AS cycle_member_id, cm.status AS cycle_member_status,
        c.id AS cycle_id, c.name AS cycle_name, c.savings_cap, c.minimum_borrowing_amount,
        m.member_code, m.first_name, m.last_name
       FROM cycle_members cm
       JOIN cycles c ON c.id = cm.cycle_id
       JOIN members m ON m.id = cm.member_id
       WHERE cm.id = $1`,
      [req.params.cycleMemberId]
    );
    const cycleMonthFilter = req.query.cycleMonthId ? " AND lt.cycle_month_id = $2" : "";
    const transactionParams = req.query.cycleMonthId ? [req.params.cycleMemberId, req.query.cycleMonthId] : [req.params.cycleMemberId];
    const transactions = await query(
      `SELECT lt.*
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1${cycleMonthFilter}
         AND lt.is_reversal = FALSE
         AND rev.id IS NULL
       ORDER BY lt.posted_at DESC`,
      transactionParams
    );
    const snapshots = await query(
      `SELECT s.*
       FROM member_monthly_snapshots s
       WHERE s.cycle_member_id = $1${req.query.cycleMonthId ? " AND s.cycle_month_id = $2" : ""}
       ORDER BY s.created_at DESC`,
      transactionParams
    );
    const totalsMonthFilter = req.query.cycleMonthId ? " AND lt.cycle_month_id = $2" : "";
    const totals = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS borrowed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_assessed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest_paid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_paid
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1${totalsMonthFilter}
         AND lt.is_reversal = FALSE`,
      transactionParams
    );
    const financialPosition = await getCycleFinancialPosition(member.rows[0]?.cycle_id || null, req.query.cycleMonthId || null);
    const data = { member: member.rows[0] || null, totals: totals.rows[0], financialPosition, transactions: transactions.rows, snapshots: snapshots.rows };
    return sendReport(req, res, { data }, { filename: "member-statement", rows: transactions.rows });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/member-statement", async (req, res, next) => {
  try {
    let cycleMemberId = req.query.cycleMemberId || null;
    if (!cycleMemberId && !isPrivileged(req.user)) {
      const member = await query(
        `SELECT cm.id
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         JOIN cycles c ON c.id = cm.cycle_id
         WHERE m.user_id = $1
         ORDER BY CASE c.status WHEN 'ACTIVE' THEN 1 ELSE 2 END, c.created_at DESC
         LIMIT 1`,
        [req.user.id]
      );
      cycleMemberId = member.rows[0]?.id || null;
    }
    if (!cycleMemberId) {
      const error = new Error("cycleMemberId is required for member statement");
      error.status = 400;
      throw error;
    }
    await ensureCycleMemberAccess(req, cycleMemberId);

    const member = await query(
      `SELECT cm.id AS cycle_member_id, cm.status AS cycle_member_status,
        c.id AS cycle_id, c.name AS cycle_name, c.savings_cap, c.minimum_borrowing_amount,
        m.member_code, m.first_name, m.last_name
       FROM cycle_members cm
       JOIN cycles c ON c.id = cm.cycle_id
       JOIN members m ON m.id = cm.member_id
       WHERE cm.id = $1`,
      [cycleMemberId]
    );
    const cycleMonthFilter = req.query.cycleMonthId ? " AND lt.cycle_month_id = $2" : "";
    const transactionParams = req.query.cycleMonthId ? [cycleMemberId, req.query.cycleMonthId] : [cycleMemberId];
    const transactions = await query(
      `SELECT lt.*
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1${cycleMonthFilter}
         AND lt.is_reversal = FALSE
         AND rev.id IS NULL
       ORDER BY lt.posted_at DESC`,
      transactionParams
    );
    const snapshots = await query(
      `SELECT s.*, cm.month_number, cm.status AS month_status
       FROM member_monthly_snapshots s
       JOIN cycle_months cm ON cm.id = s.cycle_month_id
       WHERE s.cycle_member_id = $1${req.query.cycleMonthId ? " AND s.cycle_month_id = $2" : ""}
       ORDER BY cm.month_number DESC`,
      transactionParams
    );
    const totals = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS borrowed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_assessed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest_paid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_paid
       FROM ledger_transactions lt
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE lt.cycle_member_id = $1${cycleMonthFilter}
         AND lt.is_reversal = FALSE`,
      transactionParams
    );
    const financialPosition = await getCycleFinancialPosition(member.rows[0]?.cycle_id || null, req.query.cycleMonthId || null);
    const data = { member: member.rows[0] || null, totals: totals.rows[0], financialPosition, transactions: transactions.rows, snapshots: snapshots.rows };
    return sendReport(req, res, { data }, { filename: "member-statement", rows: transactions.rows });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/pool-summary", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const { cycle } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, rows: [], totals: {} } });
    const rows = await query(
      `SELECT cm.month_number, cm.status,
        COALESCE(cms.total_pool_contributions,0) AS total_pool_contributions,
        COALESCE(cms.total_loans_issued,0) AS total_loans_issued,
        COALESCE(cms.unborrowed_money,0) AS unborrowed_money,
        COALESCE(cms.common_interest_pool,0) AS common_interest_pool,
        COALESCE(cms.total_common_interest_charged,0) AS total_common_interest_charged,
        COALESCE(cms.total_penalties_assessed,0) AS total_penalties_assessed
       FROM cycle_months cm
       LEFT JOIN cycle_month_summaries cms ON cms.cycle_month_id = cm.id
       WHERE cm.cycle_id = $1
       ORDER BY cm.month_number`,
      [cycle.id]
    );
    const totals = rows.rows.reduce((acc, row) => ({
      totalPoolContributions: acc.totalPoolContributions + Number(row.total_pool_contributions || 0),
      totalLoansIssued: acc.totalLoansIssued + Number(row.total_loans_issued || 0),
      commonInterestPool: acc.commonInterestPool + Number(row.common_interest_pool || 0),
      penalties: acc.penalties + Number(row.total_penalties_assessed || 0),
    }), { totalPoolContributions: 0, totalLoansIssued: 0, commonInterestPool: 0, penalties: 0 });
    return sendReport(req, res, { data: { cycle, rows: rows.rows, totals } }, { filename: "pool-summary" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/savings", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    const scope = memberScopeSql(req, "m", req.query.cycleMemberId ? 3 : 2);
    const memberFilter = req.query.cycleMemberId ? " AND cm.id = $2" : "";
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const params = req.query.cycleMemberId ? [cycle.id, req.query.cycleMemberId, ...scope.values] : [cycle.id, ...scope.values];
    const rows = await query(
      `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_deposited,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_earned,
        ($${params.length + 1}::numeric - COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)) AS cap_remaining
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE cm.cycle_id = $1${memberFilter}${scope.sql}
       GROUP BY cm.id, m.member_code, m.first_name, m.last_name
       ORDER BY principal_deposited DESC, m.first_name`,
      [...params, cycle.savings_cap]
    );
    const totals = rows.rows.reduce((acc, row) => ({
      principalDeposited: acc.principalDeposited + Number(row.principal_deposited || 0),
      interestEarned: acc.interestEarned + Number(row.interest_earned || 0),
    }), { principalDeposited: 0, interestEarned: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "savings-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/loans", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const scope = memberScopeSql(req, "m", req.query.cycleMemberId ? 3 : 2);
    const memberFilter = req.query.cycleMemberId ? " AND cm.id = $2" : "";
    const params = req.query.cycleMemberId ? [cycle.id, req.query.cycleMemberId, ...scope.values] : [cycle.id, ...scope.values];
    const rows = await query(
      `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
        COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS cumulative_borrowed,
        CASE
          WHEN COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) <= 0 THEN 'NEVER_BORROWED'
          WHEN COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) < $${params.length + 1}::numeric THEN 'BORROWED_BELOW_MINIMUM'
          ELSE 'AT_OR_ABOVE_MINIMUM'
        END AS borrowing_status,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_assessed,
        COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_repaid,
        GREATEST(0, $${params.length + 1}::numeric - COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)) AS borrowing_shortfall
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE cm.cycle_id = $1${memberFilter}${scope.sql}
       GROUP BY cm.id, m.member_code, m.first_name, m.last_name
       ORDER BY cumulative_borrowed DESC, m.first_name`,
      [...params, cycle.minimum_borrowing_amount]
    );
    const totals = rows.rows.reduce((acc, row) => ({
      cumulativeBorrowed: acc.cumulativeBorrowed + Number(row.cumulative_borrowed || 0),
      principalRepaid: acc.principalRepaid + Number(row.principal_repaid || 0),
      interestAssessed: acc.interestAssessed + Number(row.interest_assessed || 0),
      interestRepaid: acc.interestRepaid + Number(row.interest_repaid || 0),
    }), { cumulativeBorrowed: 0, principalRepaid: 0, interestAssessed: 0, interestRepaid: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "loan-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/common-interest", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const params = [cycle.id];
    let where = "WHERE cia.cycle_id = $1";
    if (req.query.cycleMonthId || cycleMonth?.id) {
      params.push(req.query.cycleMonthId || cycleMonth.id);
      where += ` AND cia.cycle_month_id = $${params.length}`;
    }
    if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      where += ` AND cia.cycle_member_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT cia.*, m.member_code, m.first_name, m.last_name, cmn.month_number
       FROM common_interest_allocations cia
       JOIN cycle_members cm ON cm.id = cia.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       JOIN cycle_months cmn ON cmn.id = cia.cycle_month_id
       ${where}
       ORDER BY cmn.month_number DESC, m.first_name`,
      params
    );
    const totals = rows.rows.reduce((acc, row) => ({
      assignedBase: acc.assignedBase + Number(row.assigned_base || 0),
      calculatedCharge: acc.calculatedCharge + Number(row.calculated_charge || 0),
      finalCharge: acc.finalCharge + Number(row.final_charge || 0),
    }), { assignedBase: 0, calculatedCharge: 0, finalCharge: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "common-interest-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/declarations", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const params = [cycle.id];
    let declarationJoin = "";
    let where = "WHERE cm.cycle_id = $1";
    let statusFilter = "";
    if (req.query.cycleMonthId || cycleMonth?.id) {
      params.push(req.query.cycleMonthId || cycleMonth.id);
      declarationJoin = ` AND d.cycle_month_id = $${params.length}`;
    }
    if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      where += ` AND cm.id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      statusFilter = req.query.status === "MISSED"
        ? ` AND (d.status = $${params.length} OR d.id IS NULL)`
        : ` AND d.status = $${params.length}`;
    }
    if (!isPrivileged(req.user)) {
      params.push(req.user.id);
      where += ` AND m.user_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
        COALESCE(d.status, 'MISSED') AS status, d.is_within_window, d.submitted_at,
        d.savings_amount, d.loan_request_amount, d.loan_top_up_amount,
        d.principal_repayment_amount, d.loan_interest_repayment_amount, d.common_interest_payment_amount
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN declarations d ON d.cycle_member_id = cm.id${declarationJoin}
       ${where}${statusFilter}
       ORDER BY d.submitted_at DESC NULLS LAST, m.first_name`,
      params
    );
    const totals = {
      total: rows.rows.length,
      approved: rows.rows.filter((row) => row.status === "APPROVED").length,
      awaitingReview: rows.rows.filter((row) => ["SUBMITTED", "LATE"].includes(row.status)).length,
      missed: rows.rows.filter((row) => row.status === "MISSED").length,
    };
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "declaration-compliance-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/penalties", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const params = [cycle.id];
    let where = "WHERE p.cycle_id = $1";
    if (req.query.cycleMonthId || cycleMonth?.id) {
      params.push(req.query.cycleMonthId || cycleMonth.id);
      where += ` AND p.cycle_month_id = $${params.length}`;
    }
    if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      where += ` AND p.cycle_member_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND p.status = $${params.length}`;
    }
    if (!isPrivileged(req.user)) {
      params.push(req.user.id);
      where += ` AND m.user_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT p.*, pt.name AS penalty_type, m.member_code, m.first_name, m.last_name, cmn.month_number,
        (p.amount_assessed - p.amount_paid) AS outstanding_amount
       FROM penalties p
       JOIN penalty_types pt ON pt.id = p.penalty_type_id
       JOIN cycle_members cm ON cm.id = p.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       JOIN cycle_months cmn ON cmn.id = p.cycle_month_id
       ${where}
       ORDER BY p.assessed_at DESC`,
      params
    );
    const totals = rows.rows.reduce((acc, row) => ({
      assessed: acc.assessed + Number(row.amount_assessed || 0),
      paid: acc.paid + Number(row.amount_paid || 0),
      outstanding: acc.outstanding + Number(row.outstanding_amount || 0),
      converted: acc.converted + (row.status === "CONVERTED_TO_LOAN" ? Number(row.amount_assessed || 0) : 0),
    }), { assessed: 0, paid: 0, outstanding: 0, converted: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "penalty-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/converted-penalties", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    if (req.query.cycleMemberId) await ensureCycleMemberAccess(req, req.query.cycleMemberId);
    const params = [cycle.id];
    let where = "WHERE p.cycle_id = $1 AND p.status = 'CONVERTED_TO_LOAN'";
    if (req.query.cycleMonthId || cycleMonth?.id) {
      params.push(req.query.cycleMonthId || cycleMonth.id);
      where += ` AND p.cycle_month_id = $${params.length}`;
    }
    if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      where += ` AND p.cycle_member_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT p.*, pt.name AS penalty_type, m.member_code, m.first_name, m.last_name, cmn.month_number,
        ld.amount AS converted_loan_amount, ld.ledger_transaction_id AS converted_loan_ledger_transaction_id
       FROM penalties p
       JOIN penalty_types pt ON pt.id = p.penalty_type_id
       JOIN cycle_members cm ON cm.id = p.cycle_member_id
       JOIN members m ON m.id = cm.member_id
       JOIN cycle_months cmn ON cmn.id = p.cycle_month_id
       LEFT JOIN loan_disbursements ld ON ld.id = p.converted_loan_disbursement_id
       ${where}
       ORDER BY p.updated_at DESC`,
      params
    );
    const totals = rows.rows.reduce((acc, row) => ({
      converted: acc.converted + Number(row.amount_assessed || 0),
      convertedLoanAmount: acc.convertedLoanAmount + Number(row.converted_loan_amount || 0),
    }), { converted: 0, convertedLoanAmount: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "converted-penalty-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/cycle-closing", async (req, res, next) => {
  try {
    const { cycle, cycleMonth } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, cycleMonth: null, rows: [], totals: {} } });
    const params = [cycle.id];
    let where = "WHERE cmn.cycle_id = $1";
    if (req.query.cycleMonthId || cycleMonth?.id) {
      params.push(req.query.cycleMonthId || cycleMonth.id);
      where += ` AND cmn.id = $${params.length}`;
    }
    const rows = await query(
      `SELECT cmn.month_number, cmn.status AS month_status, mcr.status AS closing_status,
        mcr.run_number, mcr.completed_at,
        COALESCE(cms.total_savings_deposits,0) AS total_savings_deposits,
        COALESCE(cms.total_savings_interest,0) AS total_savings_interest,
        COALESCE(cms.total_accumulated_savings,0) AS total_accumulated_savings,
        COALESCE(cms.total_loans_issued,0) AS total_loans_issued,
        COALESCE(cms.total_loan_interest_assessed,0) AS total_loan_interest_assessed,
        COALESCE(cms.total_outstanding_loans,0) AS total_outstanding_loans,
        COALESCE(cms.total_common_interest_charged,0) AS total_common_interest_charged,
        COALESCE(cms.total_penalties_assessed,0) AS total_penalties_assessed
       FROM cycle_months cmn
       LEFT JOIN cycle_month_summaries cms ON cms.cycle_month_id = cmn.id
       LEFT JOIN monthly_closing_runs mcr ON mcr.id = cms.monthly_closing_run_id
       ${where}
       ORDER BY cmn.month_number`,
      params
    );
    const totals = rows.rows.reduce((acc, row) => ({
      savings: acc.savings + Number(row.total_savings_deposits || 0),
      savingsInterest: acc.savingsInterest + Number(row.total_savings_interest || 0),
      loansIssued: acc.loansIssued + Number(row.total_loans_issued || 0),
      loanInterest: acc.loanInterest + Number(row.total_loan_interest_assessed || 0),
      commonInterest: acc.commonInterest + Number(row.total_common_interest_charged || 0),
      penalties: acc.penalties + Number(row.total_penalties_assessed || 0),
    }), { savings: 0, savingsInterest: 0, loansIssued: 0, loanInterest: 0, commonInterest: 0, penalties: 0 });
    return sendReport(req, res, { data: { cycle, cycleMonth, rows: rows.rows, totals } }, { filename: "cycle-closing-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/group-surplus", async (req, res, next) => {
  try {
    const { cycle } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, rows: [], totals: {} } });
    const memberCycleId = await ensureCycleMemberAccessForReport(req, cycle.id);
    if (memberCycleId === false) return;
    const schedule = await calculateGroupSurplusSchedule(query, { cycleId: cycle.id, persist: false });
    const rows = schedule.rows.map((row) => ({
      cycle_id: row.cycle_id,
      cycle_month_id: row.cycle_month_id,
      monthly_closing_run_id: row.monthly_closing_run_id,
      month_number: row.month_number,
      interest_rate: row.interest_rate,
      opening_balance: row.openingBalance,
      social_fund_collected: row.socialFundCollected,
      membership_collected: row.membershipCollected,
      penalties_collected: row.penaltiesCollected,
      interest_earned: row.interestEarned,
      closing_balance: row.closingBalance,
    }));
    return sendReport(req, res, { data: { cycle, rows, totals: schedule.totals } }, { filename: "group-surplus-report" });
  } catch (error) {
    next(error);
  }
});

async function ensureCycleMemberAccessForReport(req, cycleId) {
  if (isPrivileged(req.user)) return null;
  const access = await query(
    `SELECT cm.id
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.cycle_id = $1 AND m.user_id = $2`,
    [cycleId, req.user.id]
  );
  if (!access.rows[0]) {
    const error = new Error("You can only access reports for cycles where you are enrolled");
    error.status = 403;
    throw error;
  }
  return access.rows[0].id;
}

reportsRouter.get("/shareout", async (req, res, next) => {
  try {
    const { cycle } = await resolveReportContext(req);
    if (!cycle) return res.json({ data: { cycle: null, shareout: null, rows: [], totals: {} } });
    const memberCycleId = await ensureCycleMemberAccessForReport(req, cycle.id);
    const params = [cycle.id];
    let memberFilter = "";
    if (!isPrivileged(req.user)) {
      params.push(memberCycleId);
      memberFilter = ` AND ms.cycle_member_id = $${params.length}`;
    } else if (req.query.cycleMemberId) {
      params.push(req.query.cycleMemberId);
      memberFilter = ` AND ms.cycle_member_id = $${params.length}`;
    }
    const shareout = await query(
      `SELECT *
       FROM cycle_shareouts
       WHERE cycle_id = $1
       ORDER BY CASE status WHEN 'POSTED' THEN 1 ELSE 2 END, generated_at DESC
       LIMIT 1`,
      [cycle.id]
    );
    if (!shareout.rows[0]) return res.json({ data: { cycle, shareout: null, rows: [], totals: {} } });
    const rows = await query(
      `SELECT ms.*, m.member_code, m.first_name, m.last_name
       FROM member_shareouts ms
       JOIN members m ON m.id = ms.member_id
       WHERE ms.shareout_id = $1${memberFilter.replace("$1", "$2")}
       ORDER BY m.first_name, m.last_name`,
      [shareout.rows[0].id, ...params.slice(1)]
    );
    const totals = rows.rows.reduce((acc, row) => ({
      accumulatedSavings: acc.accumulatedSavings + Number(row.accumulated_savings || 0),
      groupSurplusShare: acc.groupSurplusShare + Number(row.group_surplus_share || 0),
      deductions: acc.deductions + Number(row.total_deductions || 0),
      netShareout: acc.netShareout + Number(row.net_shareout || 0),
    }), { accumulatedSavings: 0, groupSurplusShare: 0, deductions: 0, netShareout: 0 });
    return sendReport(req, res, { data: { cycle, shareout: shareout.rows[0], rows: rows.rows, totals } }, { filename: "shareout-report" });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/center", async (req, res, next) => {
  try {
    const report = req.query.report || "cycle-summary";
    const cycleResult = req.query.cycleId
      ? await query("SELECT * FROM cycles WHERE id = $1", [req.query.cycleId])
      : await query("SELECT * FROM cycles WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
    const cycle = cycleResult.rows[0];
    if (!cycle) return res.json({ data: { report, cycle: null, cycleMonth: null, members: [], rows: [], totals: {} } });

    const monthResult = req.query.cycleMonthId
      ? await query("SELECT * FROM cycle_months WHERE id = $1 AND cycle_id = $2", [req.query.cycleMonthId, cycle.id])
      : await query(
          `SELECT * FROM cycle_months
           WHERE cycle_id = $1 AND status IN ('DECLARATION_PERIOD','PAYOUT_PERIOD','OPEN')
           ORDER BY month_number LIMIT 1`,
          [cycle.id]
        );
    const fallbackMonth = await query("SELECT * FROM cycle_months WHERE cycle_id = $1 ORDER BY month_number LIMIT 1", [cycle.id]);
    const cycleMonth = monthResult.rows[0] || fallbackMonth.rows[0] || null;

    const members = await query(
      `SELECT cm.id AS cycle_member_id, cm.status AS cycle_member_status,
        m.id AS member_id, m.member_code, m.first_name, m.last_name
       FROM cycle_members cm
       JOIN members m ON m.id = cm.member_id
       WHERE cm.cycle_id = $1
       ORDER BY m.first_name, m.last_name`,
      [cycle.id]
    );

    let rows = [];
    let totals = {};
    const monthId = cycleMonth?.id || null;
    const selectedMemberId = req.query.cycleMemberId || null;

    if (report === "member-statements") {
      const params = [cycle.id];
      const memberWhere = selectedMemberId ? "AND cm.id = $2" : "";
      if (selectedMemberId) params.push(selectedMemberId);
      rows = (await query(
        `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
          COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS borrowed,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_assessed,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_repaid,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_paid
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
         LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
         WHERE cm.cycle_id = $1 ${memberWhere}
         GROUP BY cm.id, m.member_code, m.first_name, m.last_name
         ORDER BY m.first_name, m.last_name`,
        params
      )).rows;
    } else if (report === "monthly-pool") {
      rows = (await query(
        `SELECT cm.month_number, cm.status,
          COALESCE(cms.total_pool_contributions,0) AS total_pool_contributions,
          COALESCE(cms.total_loans_issued,0) AS total_loans_issued,
          COALESCE(cms.unborrowed_money,0) AS unborrowed_money,
          COALESCE(cms.common_interest_pool,0) AS common_interest_pool,
          COALESCE(cms.total_common_interest_charged,0) AS total_common_interest_charged,
          COALESCE(cms.total_penalties_assessed,0) AS total_penalties_assessed
         FROM cycle_months cm
         LEFT JOIN cycle_month_summaries cms ON cms.cycle_month_id = cm.id
         WHERE cm.cycle_id = $1
         ORDER BY cm.month_number`,
        [cycle.id]
      )).rows;
    } else if (report === "savings") {
      rows = (await query(
        `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_deposited,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_earned,
          ($2::numeric - COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)) AS cap_remaining
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
         LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
         WHERE cm.cycle_id = $1
         GROUP BY cm.id, m.member_code, m.first_name, m.last_name
         ORDER BY principal_deposited DESC, m.first_name`,
        [cycle.id, cycle.savings_cap]
      )).rows;
    } else if (report === "loans") {
      rows = (await query(
        `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
          COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS cumulative_borrowed,
          CASE
            WHEN COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) <= 0 THEN 'NEVER_BORROWED'
            WHEN COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) < $2::numeric THEN 'BORROWED_BELOW_MINIMUM'
            ELSE 'AT_OR_ABOVE_MINIMUM'
          END AS borrowing_status,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_assessed,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_repaid,
          GREATEST(0, $2::numeric - COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)) AS borrowing_shortfall
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
         LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
         WHERE cm.cycle_id = $1
         GROUP BY cm.id, m.member_code, m.first_name, m.last_name
         ORDER BY cumulative_borrowed DESC, m.first_name`,
        [cycle.id, cycle.minimum_borrowing_amount]
      )).rows;
    } else if (report === "common-interest") {
      rows = (await query(
        `SELECT cia.*, m.member_code, m.first_name, m.last_name, cmn.month_number
         FROM common_interest_allocations cia
         JOIN cycle_members cm ON cm.id = cia.cycle_member_id
         JOIN members m ON m.id = cm.member_id
         JOIN cycle_months cmn ON cmn.id = cia.cycle_month_id
         WHERE cia.cycle_id = $1 ${monthId ? "AND cia.cycle_month_id = $2" : ""}
         ORDER BY cmn.month_number DESC, m.first_name`,
        monthId ? [cycle.id, monthId] : [cycle.id]
      )).rows;
    } else if (report === "declarations") {
      rows = (await query(
        `SELECT cm.id AS cycle_member_id, m.member_code, m.first_name, m.last_name,
          COALESCE(d.status, 'MISSED') AS status, d.is_within_window, d.submitted_at,
          d.savings_amount, d.loan_request_amount, d.loan_top_up_amount,
          d.principal_repayment_amount, d.loan_interest_repayment_amount, d.common_interest_payment_amount
         FROM cycle_members cm
         JOIN members m ON m.id = cm.member_id
         LEFT JOIN declarations d ON d.cycle_member_id = cm.id ${monthId ? "AND d.cycle_month_id = $2" : ""}
         WHERE cm.cycle_id = $1
         ORDER BY d.submitted_at DESC NULLS LAST, m.first_name`,
        monthId ? [cycle.id, monthId] : [cycle.id]
      )).rows;
    } else if (report === "penalties") {
      rows = (await query(
        `SELECT p.*, pt.name AS penalty_type, m.member_code, m.first_name, m.last_name, cmn.month_number,
          (p.amount_assessed - p.amount_paid) AS outstanding_amount
         FROM penalties p
         JOIN penalty_types pt ON pt.id = p.penalty_type_id
         JOIN cycle_members cm ON cm.id = p.cycle_member_id
         JOIN members m ON m.id = cm.member_id
         JOIN cycle_months cmn ON cmn.id = p.cycle_month_id
         WHERE p.cycle_id = $1 ${monthId ? "AND p.cycle_month_id = $2" : ""}
         ORDER BY p.assessed_at DESC`,
        monthId ? [cycle.id, monthId] : [cycle.id]
      )).rows;
    } else {
      const dashboardTotals = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
          COALESCE(SUM(CASE WHEN lt.transaction_type IN ('SOCIAL_FUND_PAYMENT','MEMBERSHIP_FEE_PAYMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS one_time_contributions,
          COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loans_issued,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest,
          COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties
         FROM ledger_transactions lt
         LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
         WHERE lt.cycle_id = $1 AND lt.is_reversal = FALSE`,
        [cycle.id]
      );
      totals = dashboardTotals.rows[0];
      rows = (await query(
        `SELECT cmn.month_number, cmn.status,
          COALESCE(cms.total_savings_deposits,0) AS total_savings_deposits,
          COALESCE(cms.total_loans_issued,0) AS total_loans_issued,
          COALESCE(cms.common_interest_pool,0) AS common_interest_pool,
          COALESCE(cms.total_penalties_assessed,0) AS total_penalties_assessed
         FROM cycle_months cmn
         LEFT JOIN cycle_month_summaries cms ON cms.cycle_month_id = cmn.id
         WHERE cmn.cycle_id = $1
         ORDER BY cmn.month_number`,
        [cycle.id]
      )).rows;
    }

    return sendReport(req, res, { data: { report, cycle, cycleMonth, members: members.rows, rows, totals } }, { filename: `${report}-report` });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get("/:name", async (req, res, next) => {
  try {
    const summaries = await query("SELECT * FROM cycle_month_summaries ORDER BY created_at DESC");
    res.json({ data: summaries.rows, report: req.params.name });
  } catch (error) {
    next(error);
  }
});
