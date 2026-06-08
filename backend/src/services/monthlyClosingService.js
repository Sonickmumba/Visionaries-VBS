import { calculateLoanInterest, calculateSavingsInterest, classifyBorrowing, money, roundingPolicyFromCycle } from "./finance.js";

export function emptyClosingSums() {
  return {
    savingsDeposit: 0,
    savingsInterest: 0,
    newLoan: 0,
    originalLoan: 0,
    topUp: 0,
    convertedPenaltyLoan: 0,
    principalRepaid: 0,
    loanInterestAssessed: 0,
    interestRepaid: 0,
    commonInterestAssessed: 0,
    commonInterestPaid: 0,
    penaltiesAssessed: 0,
    penaltiesPaid: 0,
    penaltiesConverted: 0,
  };
}

function normalizeSums(row = {}) {
  return {
    savingsDeposit: money(row.savings_deposit),
    savingsInterest: money(row.savings_interest),
    newLoan: money(row.new_loan),
    originalLoan: money(row.original_loan),
    topUp: money(row.top_up),
    convertedPenaltyLoan: money(row.converted_penalty_loan),
    principalRepaid: money(row.principal_repaid),
    loanInterestAssessed: money(row.loan_interest_assessed),
    interestRepaid: money(row.interest_repaid),
    commonInterestAssessed: money(row.common_interest_assessed),
    commonInterestPaid: money(row.common_interest_paid),
    penaltiesAssessed: money(row.penalties_assessed),
    penaltiesPaid: money(row.penalties_paid),
    penaltiesConverted: money(row.penalties_converted),
  };
}

export async function getClosingLedgerSums(client, { cycleId, cycleMemberId, cycleMonthId, scope }) {
  const monthOperator = scope === "previous" ? "<" : "=";
  const runQuery = typeof client === "function" ? client : client.query.bind(client);
  const result = await runQuery(
    `WITH selected_month AS (
       SELECT month_number FROM cycle_months WHERE id = $3
     )
     SELECT
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_DEPOSIT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_deposit,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS savings_interest,
       COALESCE(SUM(CASE WHEN lt.transaction_type IN ('LOAN_DISBURSEMENT','LOAN_TOP_UP','CONVERTED_PENALTY_LOAN') AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS new_loan,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_DISBURSEMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS original_loan,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_TOP_UP' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS top_up,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'CONVERTED_PENALTY_LOAN' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS converted_penalty_loan,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'PRINCIPAL_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS principal_repaid,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS loan_interest_assessed,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'LOAN_INTEREST_REPAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS interest_repaid,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest_assessed,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'COMMON_INTEREST_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS common_interest_paid,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_ASSESSMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_assessed,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'PENALTY_PAYMENT' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_paid,
       COALESCE(SUM(CASE WHEN lt.transaction_type = 'CONVERTED_PENALTY_LOAN' AND rev.id IS NULL THEN lt.amount ELSE 0 END),0) AS penalties_converted
     FROM ledger_transactions lt
     JOIN cycle_months cm ON cm.id = lt.cycle_month_id
     LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id
     WHERE lt.cycle_id = $1
       AND lt.cycle_member_id = $2
       AND lt.is_reversal = FALSE
       AND cm.month_number ${monthOperator} (SELECT month_number FROM selected_month)`,
    [cycleId, cycleMemberId, cycleMonthId]
  );
  return normalizeSums(result.rows[0]);
}

export function calculateMemberMonthlyClosing({
  cycle,
  declarationStatus,
  previous = emptyClosingSums(),
  current = emptyClosingSums(),
}) {
  const roundingPolicy = roundingPolicyFromCycle(cycle);
  const savingsBroughtForward = money(previous.savingsDeposit + previous.savingsInterest, roundingPolicy);
  const savings = calculateSavingsInterest({
    broughtForward: savingsBroughtForward,
    deposit: current.savingsDeposit,
    rate: cycle.savings_interest_rate,
    roundingPolicy,
  });

  const loanBroughtForward = money(
    previous.newLoan + previous.loanInterestAssessed - previous.principalRepaid - previous.interestRepaid,
    roundingPolicy
  );
  const loan = calculateLoanInterest({
    broughtForward: loanBroughtForward,
    newLoan: current.newLoan,
    principalRepaid: current.principalRepaid,
    interestRepaid: current.interestRepaid,
    rate: cycle.loan_interest_rate,
    roundingPolicy,
  });

  const cumulativeBorrowed = money(previous.newLoan + current.newLoan, roundingPolicy);
  const compliance = classifyBorrowing(cumulativeBorrowed, cycle.minimum_borrowing_amount);

  return {
    declarationStatus,
    borrowingStatus: compliance.status,
    borrowingShortfall: compliance.shortfall,
    savingsBroughtForward,
    savingsDeposit: current.savingsDeposit,
    savingsInterest: savings.interest,
    accumulatedSavingsCarriedForward: savings.carriedForward,
    cumulativeSavingsPrincipal: money(previous.savingsDeposit + current.savingsDeposit, roundingPolicy),
    loanBroughtForward,
    newLoanAmount: current.originalLoan,
    topUpAmount: current.topUp,
    convertedPenaltyLoanAmount: current.convertedPenaltyLoan,
    loanInterestAssessed: loan.interest,
    principalRepaid: current.principalRepaid,
    interestRepaid: current.interestRepaid,
    loanCarriedForward: loan.carriedForward,
    cumulativeBorrowedAmount: cumulativeBorrowed,
    commonInterestCharge: current.commonInterestAssessed,
    commonInterestPaid: current.commonInterestPaid,
    penaltiesAssessed: current.penaltiesAssessed,
    penaltiesPaid: current.penaltiesPaid,
    penaltiesConvertedToLoan: current.penaltiesConverted,
  };
}
