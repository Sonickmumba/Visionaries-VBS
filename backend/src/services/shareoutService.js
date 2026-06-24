import { money, roundingPolicyFromCycle } from "./finance.js";
import { postLedger } from "./ledgerService.js";
import { badRequest, conflict, notFound } from "../utils/httpError.js";

function runQuery(db) {
  return typeof db === "function" ? db : db.query.bind(db);
}

function toNumber(value) {
  return Number(value || 0);
}

function memberName(row) {
  return `${row?.first_name || ""} ${row?.last_name || ""}`.trim() || "Member";
}

export function calculateSurplusMonth({ openingBalance, socialFundCollected, membershipCollected, penaltiesCollected, interestRate, roundingPolicy }) {
  const base = money(
    toNumber(openingBalance) + toNumber(socialFundCollected) + toNumber(membershipCollected) + toNumber(penaltiesCollected),
    roundingPolicy
  );
  const interestEarned = money(base * toNumber(interestRate), roundingPolicy);
  return {
    openingBalance: money(openingBalance, roundingPolicy),
    socialFundCollected: money(socialFundCollected, roundingPolicy),
    membershipCollected: money(membershipCollected, roundingPolicy),
    penaltiesCollected: money(penaltiesCollected, roundingPolicy),
    interestEarned,
    closingBalance: money(base + interestEarned, roundingPolicy),
  };
}

async function getCycle(db, cycleId) {
  const query = runQuery(db);
  const result = await query("SELECT * FROM cycles WHERE id = $1", [cycleId]);
  if (!result.rows[0]) throw notFound("Cycle not found");
  return result.rows[0];
}

async function getCycleMonths(db, cycleId) {
  const query = runQuery(db);
  const result = await query(
    `SELECT cm.*, mcr.id AS monthly_closing_run_id
     FROM cycle_months cm
     LEFT JOIN cycle_month_summaries cms ON cms.cycle_month_id = cm.id
     LEFT JOIN monthly_closing_runs mcr ON mcr.id = cms.monthly_closing_run_id
     WHERE cm.cycle_id = $1
     ORDER BY cm.month_number`,
    [cycleId]
  );
  return result.rows;
}

async function getSurplusCollections(db, cycleId) {
  const query = runQuery(db);
  const result = await query(
    `SELECT lt.cycle_month_id,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'SOCIAL_FUND_PAYMENT' THEN lt.amount ELSE 0 END),0) AS social_fund_collected,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'MEMBERSHIP_FEE_PAYMENT' THEN lt.amount ELSE 0 END),0) AS membership_collected,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' THEN lt.amount ELSE 0 END),0) AS penalties_collected
     FROM ledger_transactions lt
     LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
     WHERE lt.cycle_id = $1
       AND lt.transaction_type IN ('SOCIAL_FUND_PAYMENT','MEMBERSHIP_FEE_PAYMENT','PENALTY_ASSESSMENT')
       AND lt.is_reversal = FALSE
       AND rev.id IS NULL
     GROUP BY lt.cycle_month_id`,
    [cycleId]
  );
  return new Map(result.rows.map((row) => [row.cycle_month_id, row]));
}

export async function calculateGroupSurplusSchedule(db, { cycleId, calculatedBy = null, persist = false }) {
  const query = runQuery(db);
  const cycle = await getCycle(db, cycleId);
  const months = await getCycleMonths(db, cycleId);
  const collections = await getSurplusCollections(db, cycleId);
  const roundingPolicy = roundingPolicyFromCycle(cycle);

  let openingBalance = 0;
  const rows = [];
  for (const month of months) {
    const collected = collections.get(month.id) || {};
    const calculated = calculateSurplusMonth({
      openingBalance,
      socialFundCollected: collected.social_fund_collected,
      membershipCollected: collected.membership_collected,
      penaltiesCollected: collected.penalties_collected,
      interestRate: cycle.common_interest_rate,
      roundingPolicy,
    });
    const row = {
      cycle_id: cycle.id,
      cycle_month_id: month.id,
      monthly_closing_run_id: month.monthly_closing_run_id || null,
      month_number: month.month_number,
      interest_rate: cycle.common_interest_rate,
      ...calculated,
    };
    rows.push(row);
    openingBalance = calculated.closingBalance;

    if (persist) {
      await query(
        `INSERT INTO group_surplus_months
          (cycle_id, cycle_month_id, monthly_closing_run_id, month_number, interest_rate,
           opening_balance, social_fund_collected, membership_collected, penalties_collected,
           interest_earned, closing_balance, calculated_by, calculated_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
         ON CONFLICT (cycle_month_id) DO UPDATE SET
           monthly_closing_run_id = EXCLUDED.monthly_closing_run_id,
           month_number = EXCLUDED.month_number,
           interest_rate = EXCLUDED.interest_rate,
           opening_balance = EXCLUDED.opening_balance,
           social_fund_collected = EXCLUDED.social_fund_collected,
           membership_collected = EXCLUDED.membership_collected,
           penalties_collected = EXCLUDED.penalties_collected,
           interest_earned = EXCLUDED.interest_earned,
           closing_balance = EXCLUDED.closing_balance,
           calculated_by = EXCLUDED.calculated_by,
           calculated_at = now(),
           updated_at = now()
         RETURNING *`,
        [
          row.cycle_id,
          row.cycle_month_id,
          row.monthly_closing_run_id,
          row.month_number,
          row.interest_rate,
          row.openingBalance,
          row.socialFundCollected,
          row.membershipCollected,
          row.penaltiesCollected,
          row.interestEarned,
          row.closingBalance,
          calculatedBy,
        ]
      );
    }
  }

  return {
    cycle,
    rows,
    totals: rows.reduce((acc, row) => ({
      socialFundCollected: money(acc.socialFundCollected + row.socialFundCollected, roundingPolicy),
      membershipCollected: money(acc.membershipCollected + row.membershipCollected, roundingPolicy),
      penaltiesCollected: money(acc.penaltiesCollected + row.penaltiesCollected, roundingPolicy),
      interestEarned: money(acc.interestEarned + row.interestEarned, roundingPolicy),
      closingBalance: row.closingBalance,
    }), {
      socialFundCollected: 0,
      membershipCollected: 0,
      penaltiesCollected: 0,
      interestEarned: 0,
      closingBalance: 0,
    }),
  };
}

async function getShareoutReadiness(db, cycleId) {
  const query = runQuery(db);
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'LOCKED')::int AS unlocked_months,
       COUNT(*)::int AS total_months
     FROM cycle_months
     WHERE cycle_id = $1`,
    [cycleId]
  );
  const pendingDeclarations = await query(
    "SELECT COUNT(*)::int AS count FROM declarations WHERE cycle_id = $1 AND status IN ('SUBMITTED','LATE','DRAFT')",
    [cycleId]
  );
  const pendingLoans = await query(
    "SELECT COUNT(*)::int AS count FROM loan_requests WHERE cycle_id = $1 AND status = 'PENDING'",
    [cycleId]
  );
  const warnings = [];
  if (result.rows[0]?.total_months === 0) warnings.push("No cycle months have been generated.");
  if (result.rows[0]?.unlocked_months > 0) warnings.push(`${result.rows[0].unlocked_months} cycle month(s) are not locked.`);
  if (pendingDeclarations.rows[0]?.count > 0) warnings.push(`${pendingDeclarations.rows[0].count} declaration(s) are still awaiting review.`);
  if (pendingLoans.rows[0]?.count > 0) warnings.push(`${pendingLoans.rows[0].count} loan request(s) are still pending.`);
  return {
    unlockedMonths: result.rows[0]?.unlocked_months || 0,
    totalMonths: result.rows[0]?.total_months || 0,
    pendingDeclarations: pendingDeclarations.rows[0]?.count || 0,
    pendingLoans: pendingLoans.rows[0]?.count || 0,
    warnings,
  };
}

async function getMemberShareoutInputs(db, cycleId) {
  const query = runQuery(db);
  const result = await query(
    `WITH latest_snapshots AS (
       SELECT DISTINCT ON (mms.cycle_member_id) mms.*
       FROM member_monthly_snapshots mms
       JOIN cycle_months cmn ON cmn.id = mms.cycle_month_id
       WHERE mms.cycle_id = $1
       ORDER BY mms.cycle_member_id, cmn.month_number DESC
     ),
     ledger_totals AS (
       SELECT cm.id AS cycle_member_id,
         COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_principal,
         COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
         COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN','LOAN_INTEREST_ASSESSMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)
           - COALESCE(SUM(CASE WHEN lt.transaction_type IN ('PRINCIPAL_REPAYMENT','LOAN_INTEREST_REPAYMENT') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS outstanding_loan_balance,
         COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0)
           - COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS unpaid_common_interest
       FROM cycle_members cm
       LEFT JOIN ledger_transactions lt ON lt.cycle_member_id = cm.id AND lt.cycle_id = $1 AND lt.is_reversal = FALSE
       LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
       WHERE cm.cycle_id = $1
       GROUP BY cm.id
     ),
     penalty_totals AS (
       SELECT p.cycle_member_id,
         COALESCE(SUM(CASE
           WHEN p.status IN ('ASSESSED','PARTIALLY_PAID') THEN p.amount_assessed - p.amount_paid
           ELSE 0
         END),0) AS unpaid_penalties
       FROM penalties p
       WHERE p.cycle_id = $1
       GROUP BY p.cycle_member_id
     )
     SELECT cm.id AS cycle_member_id, cm.member_id, cm.status AS cycle_member_status,
       m.member_code, m.first_name, m.last_name,
       COALESCE(ls.accumulated_savings_carried_forward, lt.savings_principal + lt.savings_interest, 0) AS accumulated_savings,
       COALESCE(lt.savings_principal,0) AS savings_principal,
       COALESCE(lt.savings_interest,0) AS savings_interest,
       GREATEST(COALESCE(ls.loan_carried_forward, lt.outstanding_loan_balance, 0), 0) AS outstanding_loan_balance,
       GREATEST(COALESCE(pt.unpaid_penalties,0), 0) AS unpaid_penalties,
       GREATEST(COALESCE(lt.unpaid_common_interest,0), 0) AS unpaid_common_interest
     FROM cycle_members cm
     JOIN members m ON m.id = cm.member_id
     LEFT JOIN latest_snapshots ls ON ls.cycle_member_id = cm.id
     LEFT JOIN ledger_totals lt ON lt.cycle_member_id = cm.id
     LEFT JOIN penalty_totals pt ON pt.cycle_member_id = cm.id
     WHERE cm.cycle_id = $1 AND cm.status = 'ACTIVE'
     ORDER BY m.first_name, m.last_name`,
    [cycleId]
  );
  return result.rows;
}

export async function buildShareoutPreview(db, { cycleId, generatedBy = null, persist = true }) {
  const cycle = await getCycle(db, cycleId);
  const roundingPolicy = roundingPolicyFromCycle(cycle);
  const surplus = await calculateGroupSurplusSchedule(db, { cycleId, calculatedBy: generatedBy, persist });
  const readiness = await getShareoutReadiness(db, cycleId);
  const members = await getMemberShareoutInputs(db, cycleId);
  const eligibleMemberCount = members.length;
  const equalSurplusShare = eligibleMemberCount
    ? money(surplus.totals.closingBalance / eligibleMemberCount, roundingPolicy)
    : 0;

  let allocatedSoFar = 0;
  const memberRows = members.map((member, index) => {
    const groupSurplusShare = index === members.length - 1
      ? money(surplus.totals.closingBalance - allocatedSoFar, roundingPolicy)
      : equalSurplusShare;
    allocatedSoFar = money(allocatedSoFar + groupSurplusShare, roundingPolicy);
    const accumulatedSavings = money(member.accumulated_savings, roundingPolicy);
    const grossShareout = money(accumulatedSavings + groupSurplusShare, roundingPolicy);
    const outstandingLoanBalance = money(member.outstanding_loan_balance, roundingPolicy);
    const unpaidPenalties = money(member.unpaid_penalties, roundingPolicy);
    const unpaidCommonInterest = money(member.unpaid_common_interest, roundingPolicy);
    const totalDeductions = money(outstandingLoanBalance + unpaidPenalties + unpaidCommonInterest, roundingPolicy);
    const netShareout = money(grossShareout - totalDeductions, roundingPolicy);
    return {
      ...member,
      accumulatedSavings,
      savingsPrincipal: money(member.savings_principal, roundingPolicy),
      savingsInterest: money(member.savings_interest, roundingPolicy),
      groupSurplusShare,
      outstandingLoanBalance,
      unpaidPenalties,
      unpaidCommonInterest,
      otherAdjustments: 0,
      grossShareout,
      totalDeductions,
      netShareout,
      lineItems: [
        { type: "ACCUMULATED_SAVINGS", label: "Accumulated savings", amount: accumulatedSavings, sortOrder: 10 },
        { type: "GROUP_SURPLUS_SHARE", label: "Equal share of group surplus fund", amount: groupSurplusShare, sortOrder: 20 },
        { type: "OUTSTANDING_LOAN", label: "Less outstanding loan balance", amount: -outstandingLoanBalance, sortOrder: 30 },
        { type: "UNPAID_PENALTY", label: "Less unpaid penalties", amount: -unpaidPenalties, sortOrder: 40 },
        { type: "UNPAID_COMMON_INTEREST", label: "Less unpaid common interest", amount: -unpaidCommonInterest, sortOrder: 50 },
        { type: "NET_SHAREOUT", label: "Net shareout", amount: netShareout, sortOrder: 90 },
      ],
    };
  });

  const totals = memberRows.reduce((acc, row) => ({
    totalAccumulatedSavings: money(acc.totalAccumulatedSavings + row.accumulatedSavings, roundingPolicy),
    totalGroupSurplus: surplus.totals.closingBalance,
    totalSurplusAllocated: money(acc.totalSurplusAllocated + row.groupSurplusShare, roundingPolicy),
    totalOutstandingLoans: money(acc.totalOutstandingLoans + row.outstandingLoanBalance, roundingPolicy),
    totalUnpaidPenalties: money(acc.totalUnpaidPenalties + row.unpaidPenalties, roundingPolicy),
    totalUnpaidCommonInterest: money(acc.totalUnpaidCommonInterest + row.unpaidCommonInterest, roundingPolicy),
    totalDeductions: money(acc.totalDeductions + row.totalDeductions, roundingPolicy),
    totalNetShareout: money(acc.totalNetShareout + row.netShareout, roundingPolicy),
  }), {
    totalAccumulatedSavings: 0,
    totalGroupSurplus: surplus.totals.closingBalance,
    totalSurplusAllocated: 0,
    totalOutstandingLoans: 0,
    totalUnpaidPenalties: 0,
    totalUnpaidCommonInterest: 0,
    totalDeductions: 0,
    totalNetShareout: 0,
  });

  let shareout = null;
  if (persist) {
    const query = runQuery(db);
    const existingPosted = await query("SELECT id FROM cycle_shareouts WHERE cycle_id = $1 AND status = 'POSTED' LIMIT 1", [cycleId]);
    if (existingPosted.rows[0]) throw conflict("This cycle already has a posted shareout");
    const existingDraft = await query("SELECT * FROM cycle_shareouts WHERE cycle_id = $1 AND status = 'DRAFT' LIMIT 1", [cycleId]);
    if (existingDraft.rows[0]) {
      shareout = (await query(
        `UPDATE cycle_shareouts SET
           total_accumulated_savings = $2,
           total_group_surplus = $3,
           total_surplus_allocated = $4,
           total_outstanding_loans = $5,
           total_unpaid_penalties = $6,
           total_unpaid_common_interest = $7,
           total_deductions = $8,
           total_net_shareout = $9,
           eligible_member_count = $10,
           warnings = $11::jsonb,
           generated_by = $12,
           generated_at = now(),
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          existingDraft.rows[0].id,
          totals.totalAccumulatedSavings,
          totals.totalGroupSurplus,
          totals.totalSurplusAllocated,
          totals.totalOutstandingLoans,
          totals.totalUnpaidPenalties,
          totals.totalUnpaidCommonInterest,
          totals.totalDeductions,
          totals.totalNetShareout,
          eligibleMemberCount,
          JSON.stringify(readiness.warnings),
          generatedBy,
        ]
      )).rows[0];
      await query("DELETE FROM member_shareouts WHERE shareout_id = $1", [shareout.id]);
    } else {
      shareout = (await query(
        `INSERT INTO cycle_shareouts
          (cycle_id, total_accumulated_savings, total_group_surplus, total_surplus_allocated,
           total_outstanding_loans, total_unpaid_penalties, total_unpaid_common_interest,
           total_deductions, total_net_shareout, eligible_member_count, warnings, generated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
         RETURNING *`,
        [
          cycleId,
          totals.totalAccumulatedSavings,
          totals.totalGroupSurplus,
          totals.totalSurplusAllocated,
          totals.totalOutstandingLoans,
          totals.totalUnpaidPenalties,
          totals.totalUnpaidCommonInterest,
          totals.totalDeductions,
          totals.totalNetShareout,
          eligibleMemberCount,
          JSON.stringify(readiness.warnings),
          generatedBy,
        ]
      )).rows[0];
    }

    for (const row of memberRows) {
      const saved = (await query(
        `INSERT INTO member_shareouts
          (shareout_id, cycle_id, cycle_member_id, member_id, accumulated_savings, savings_principal,
           savings_interest, group_surplus_share, outstanding_loan_balance, unpaid_penalties,
           unpaid_common_interest, other_adjustments, gross_shareout, total_deductions, net_shareout)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          shareout.id,
          cycleId,
          row.cycle_member_id,
          row.member_id,
          row.accumulatedSavings,
          row.savingsPrincipal,
          row.savingsInterest,
          row.groupSurplusShare,
          row.outstandingLoanBalance,
          row.unpaidPenalties,
          row.unpaidCommonInterest,
          row.otherAdjustments,
          row.grossShareout,
          row.totalDeductions,
          row.netShareout,
        ]
      )).rows[0];
      row.memberShareoutId = saved.id;
      for (const item of row.lineItems) {
        await query(
          `INSERT INTO shareout_line_items
            (member_shareout_id, shareout_id, cycle_id, cycle_member_id, line_item_type, label, amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [saved.id, shareout.id, cycleId, row.cycle_member_id, item.type, item.label, item.amount, item.sortOrder]
        );
      }
    }
  }

  return { cycle, shareout, surplusRows: surplus.rows, surplusTotals: surplus.totals, readiness, members: memberRows, totals };
}

export async function getShareout(db, { cycleId, shareoutId = null, cycleMemberId = null }) {
  const query = runQuery(db);
  const shareoutResult = shareoutId
    ? await query("SELECT * FROM cycle_shareouts WHERE id = $1", [shareoutId])
    : await query("SELECT * FROM cycle_shareouts WHERE cycle_id = $1 ORDER BY CASE status WHEN 'POSTED' THEN 1 ELSE 2 END, generated_at DESC LIMIT 1", [cycleId]);
  const shareout = shareoutResult.rows[0] || null;
  if (!shareout) return null;

  const memberParams = [shareout.id];
  let memberWhere = "WHERE ms.shareout_id = $1";
  if (cycleMemberId) {
    memberParams.push(cycleMemberId);
    memberWhere += ` AND ms.cycle_member_id = $${memberParams.length}`;
  }
  const members = await query(
    `SELECT ms.*, m.member_code, m.first_name, m.last_name
     FROM member_shareouts ms
     JOIN members m ON m.id = ms.member_id
     ${memberWhere}
     ORDER BY m.first_name, m.last_name`,
    memberParams
  );
  const lines = await query(
    `SELECT sli.*
     FROM shareout_line_items sli
     JOIN member_shareouts ms ON ms.id = sli.member_shareout_id
     ${memberWhere.replaceAll("ms.shareout_id", "sli.shareout_id")}
     ORDER BY sli.sort_order, sli.created_at`,
    memberParams
  );
  const linesByMember = new Map();
  for (const line of lines.rows) {
    const list = linesByMember.get(line.member_shareout_id) || [];
    list.push(line);
    linesByMember.set(line.member_shareout_id, list);
  }
  return {
    shareout,
    members: members.rows.map((member) => ({ ...member, lineItems: linesByMember.get(member.id) || [] })),
  };
}

export async function postShareout(db, { cycleId, postedBy = null, notes = null, req = null, auditFn = null }) {
  const query = runQuery(db);
  const preview = await buildShareoutPreview(db, { cycleId, generatedBy: postedBy, persist: true });
  if (!preview.shareout) throw badRequest("Generate a shareout preview before posting");
  if (preview.readiness.warnings.length) {
    throw conflict(`Shareout cannot be posted until readiness issues are resolved: ${preview.readiness.warnings.join(" ")}`);
  }

  const lockedCycle = (await query("SELECT * FROM cycles WHERE id = $1 FOR UPDATE", [cycleId])).rows[0];
  if (!lockedCycle) throw notFound("Cycle not found");
  const postedExisting = await query("SELECT id FROM cycle_shareouts WHERE cycle_id = $1 AND status = 'POSTED' AND id <> $2 LIMIT 1", [cycleId, preview.shareout.id]);
  if (postedExisting.rows[0]) throw conflict("This cycle already has a posted shareout");

  const members = await query(
    `SELECT ms.*, m.first_name, m.last_name
     FROM member_shareouts ms
     JOIN members m ON m.id = ms.member_id
     WHERE ms.shareout_id = $1
     ORDER BY m.first_name, m.last_name`,
    [preview.shareout.id]
  );

  for (const member of members.rows) {
    const amount = Math.max(0, money(member.net_shareout, roundingPolicyFromCycle(lockedCycle)));
    let ledger = null;
    if (amount > 0) {
      ledger = await postLedger(db, {
        cycleId,
        cycleMemberId: member.cycle_member_id,
        transactionType: "SHAREOUT_POSTING",
        amount,
        description: `Cycle shareout posted for ${memberName(member)}`,
        sourceTable: "member_shareouts",
        sourceId: member.id,
        postedBy,
        entries: [
          { accountType: "SHAREOUT_PAYABLE", debit: amount, memo: "Member shareout payable" },
          { accountType: "CASH_POOL", credit: amount, memo: "Shareout payable from pool" },
        ],
      });
    }
    await query(
      "UPDATE member_shareouts SET status = 'POSTED', posted_ledger_transaction_id = $2, updated_at = now() WHERE id = $1",
      [member.id, ledger?.id || null]
    );
  }

  const shareout = (await query(
    `UPDATE cycle_shareouts
     SET status = 'POSTED', posted_by = $2, posted_at = now(), locked_at = now(), notes = $3, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [preview.shareout.id, postedBy, notes]
  )).rows[0];

  await query("UPDATE cycles SET status = 'CLOSED', updated_at = now() WHERE id = $1 AND status <> 'ARCHIVED'", [cycleId]);

  if (auditFn) {
    await auditFn(db, {
      actorUserId: postedBy,
      action: "POST",
      entityTable: "cycle_shareouts",
      entityId: shareout.id,
      afterData: shareout,
      reason: notes || "Cycle shareout posted",
      req,
    });
  }

  return { ...preview, shareout, members: (await getShareout(db, { shareoutId: shareout.id })).members };
}
