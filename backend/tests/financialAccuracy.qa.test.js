import { describe, expect, it } from "vitest";
import {
  allocateCommonInterest,
  calculateLoanInterest,
  calculateSavingsInterest,
  classifyBorrowing,
} from "../src/services/finance.js";
import {
  calculateMemberMonthlyClosing,
  emptyClosingSums,
  getClosingLedgerSums,
} from "../src/services/monthlyClosingService.js";
import { reverseLedgerTransaction } from "../src/services/ledgerService.js";

const cycle = {
  savings_interest_rate: 0.15,
  loan_interest_rate: 0.15,
  minimum_borrowing_amount: 20000,
  rounding_scale: 2,
  rounding_mode: "HALF_UP",
};

const expectMoney = (actual, expected) => {
  expect(actual).toBeCloseTo(expected, 2);
};

describe("QA-003 financial accuracy test pack", () => {
  it("documents the savings interest scenario", () => {
    const direct = calculateSavingsInterest({
      broughtForward: 11500,
      deposit: 5000,
      rate: 0.15,
    });

    expect(direct).toEqual({
      base: 16500,
      interest: 2475,
      carriedForward: 18975,
    });

    const closing = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        savingsDeposit: 10000,
        savingsInterest: 1500,
      },
      current: {
        ...emptyClosingSums(),
        savingsDeposit: 5000,
      },
    });

    expect(closing.savingsBroughtForward).toBe(11500);
    expect(closing.savingsDeposit).toBe(5000);
    expect(closing.savingsInterest).toBe(2475);
    expect(closing.accumulatedSavingsCarriedForward).toBe(18975);
    expect(closing.cumulativeSavingsPrincipal).toBe(15000);
  });

  it("documents the loan interest scenario", () => {
    const direct = calculateLoanInterest({
      broughtForward: 10000,
      newLoan: 3000,
      principalRepaid: 2000,
      interestRepaid: 500,
      rate: 0.15,
    });

    expect(direct).toEqual({
      interestBase: 10500,
      interest: 1575,
      beforeNewLoan: 10500,
      carriedForward: 12075,
    });

    const closing = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 10000,
        originalLoan: 10000,
      },
      current: {
        ...emptyClosingSums(),
        principalRepaid: 2000,
        interestRepaid: 500,
        newLoan: 3000,
        topUp: 3000,
      },
    });

    expect(closing.loanBroughtForward).toBe(10000);
    expect(closing.loanInterestAssessed).toBe(1575);
    expect(closing.loanCarriedForward).toBe(12075);
    expect(closing.cumulativeBorrowedAmount).toBe(13000);
    expect(closing.borrowingStatus).toBe("BORROWED_BELOW_MINIMUM");
    expect(closing.borrowingShortfall).toBe(7000);
  });

  it("documents the loan repayment scenario", () => {
    const closing = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 20000,
        loanInterestAssessed: 3000,
        principalRepaid: 5000,
        interestRepaid: 1000,
      },
      current: {
        ...emptyClosingSums(),
        principalRepaid: 2000,
        interestRepaid: 550,
      },
    });

    expect(closing.loanBroughtForward).toBe(17000);
    expect(closing.loanInterestAssessed).toBe(2167.5);
    expect(closing.principalRepaid).toBe(2000);
    expect(closing.interestRepaid).toBe(550);
    expect(closing.loanCarriedForward).toBe(16617.5);
    expect(closing.cumulativeBorrowedAmount).toBe(20000);
    expect(closing.borrowingStatus).toBe("AT_OR_ABOVE_MINIMUM");
  });

  it("documents full loan clearance before monthly closing", () => {
    const closing = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 15000,
        loanInterestAssessed: 2250,
      },
      current: {
        ...emptyClosingSums(),
        principalRepaid: 15000,
        interestRepaid: 2250,
      },
    });

    expect(closing.loanBroughtForward).toBe(17250);
    expect(closing.loanInterestAssessed).toBe(0);
    expect(closing.loanCarriedForward).toBe(0);
  });

  it("documents the converted penalty loan scenario", () => {
    const conversionMonth = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "MISSED",
      previous: emptyClosingSums(),
      current: {
        ...emptyClosingSums(),
        newLoan: 100,
        convertedPenaltyLoan: 100,
        penaltiesConverted: 100,
      },
    });

    expect(conversionMonth.loanBroughtForward).toBe(0);
    expect(conversionMonth.loanInterestAssessed).toBe(15);
    expect(conversionMonth.convertedPenaltyLoanAmount).toBe(100);
    expect(conversionMonth.penaltiesConvertedToLoan).toBe(100);
    expect(conversionMonth.loanCarriedForward).toBe(115);

    const followingMonth = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 100,
        loanInterestAssessed: 15,
        convertedPenaltyLoan: 100,
        penaltiesConverted: 100,
      },
      current: emptyClosingSums(),
    });

    expect(followingMonth.loanBroughtForward).toBe(115);
    expect(followingMonth.loanInterestAssessed).toBe(17.25);
    expect(followingMonth.loanCarriedForward).toBe(132.25);
  });

  it("documents common-interest allocation for only non-borrowers", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 40000,
      rate: 0.15,
      method: "ONLY_NON_BORROWERS_EQUAL",
      members: [
        { cycle_member_id: "mary", ...classifyBorrowing(0, 20000) },
        { cycle_member_id: "john", ...classifyBorrowing(10000, 20000) },
        { cycle_member_id: "agnes", ...classifyBorrowing(0, 20000) },
      ],
    });

    expect(result.commonInterestPool).toBe(6000);
    expect(result.allocations.map((item) => item.cycle_member_id)).toEqual(["mary", "agnes"]);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([20000, 20000]);
    expect(result.allocations.map((item) => item.charge)).toEqual([3000, 3000]);
  });

  it("documents proportional common-interest allocation", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 30000,
      rate: 0.15,
      method: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL",
      members: [
        { cycle_member_id: "mary", ...classifyBorrowing(0, 20000) },
        { cycle_member_id: "john", ...classifyBorrowing(15000, 20000) },
        { cycle_member_id: "agnes", ...classifyBorrowing(20000, 20000) },
      ],
    });

    expect(result.commonInterestPool).toBe(4500);
    expect(result.allocations.map((item) => item.cycle_member_id)).toEqual(["mary", "john"]);
    expect(result.allocations.map((item) => item.weight)).toEqual([0.8, 0.2]);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([24000, 6000]);
    expect(result.allocations.map((item) => item.charge)).toEqual([3600, 900]);
  });

  it("documents all-members common-interest allocation", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 45000,
      rate: 0.15,
      method: "ALL_MEMBERS_EQUAL",
      members: [
        { cycle_member_id: "mary", ...classifyBorrowing(20000, 20000) },
        { cycle_member_id: "john", ...classifyBorrowing(25000, 20000) },
        { cycle_member_id: "agnes", ...classifyBorrowing(30000, 20000) },
      ],
    });

    expect(result.commonInterestPool).toBe(6750);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([15000, 15000, 15000]);
    expect(result.allocations.map((item) => item.charge)).toEqual([2250, 2250, 2250]);
  });

  it("documents locked month reversal handling for future closing calculations", async () => {
    const original = {
      id: "locked-savings-interest",
      cycle_id: "cycle-1",
      cycle_month_id: "locked-month-1",
      cycle_member_id: "member-1",
      transaction_type: "SAVINGS_INTEREST",
      amount: 1500,
      description: "Monthly savings interest",
      source_table: "monthly_closing_runs",
      source_id: "run-1",
      is_reversal: false,
    };
    const entries = [
      {
        id: "entry-1",
        cycle_id: "cycle-1",
        cycle_member_id: "member-1",
        account_type: "SAVINGS_INTEREST",
        debit: 1500,
        credit: 0,
      },
      {
        id: "entry-2",
        cycle_id: "cycle-1",
        cycle_member_id: "member-1",
        account_type: "ADJUSTMENT",
        debit: 0,
        credit: 1500,
      },
    ];
    const insertedEntries = [];
    const reversalClient = {
      async query(sql, params = []) {
        if (sql.includes("SELECT * FROM ledger_transactions WHERE id = $1")) {
          return { rows: [original] };
        }
        if (sql.includes("SELECT id FROM ledger_transactions WHERE reversed_transaction_id = $1")) {
          return { rows: [] };
        }
        if (sql.includes("SELECT * FROM ledger_entries WHERE ledger_transaction_id = $1")) {
          return { rows: entries };
        }
        if (sql.includes("INSERT INTO ledger_transactions")) {
          return {
            rows: [{
              id: "reversal-1",
              transaction_type: "REVERSAL",
              amount: params[3],
              reversed_transaction_id: params[7],
              reversal_reason: params[8],
              is_reversal: true,
            }],
          };
        }
        if (sql.includes("INSERT INTO ledger_entries")) {
          insertedEntries.push({
            account_type: params[3],
            debit: params[4],
            credit: params[5],
          });
          return { rows: [] };
        }
        throw new Error(`Unexpected reversal SQL: ${sql}`);
      },
    };

    const reversal = await reverseLedgerTransaction(reversalClient, {
      ledgerTransactionId: "locked-savings-interest",
      reason: "Locked month correction approved by committee",
      postedBy: "admin-1",
    });

    expect(reversal.reversal).toMatchObject({
      id: "reversal-1",
      transaction_type: "REVERSAL",
      amount: 1500,
      reversed_transaction_id: "locked-savings-interest",
      reversal_reason: "Locked month correction approved by committee",
      is_reversal: true,
    });
    expect(insertedEntries).toEqual([
      { account_type: "SAVINGS_INTEREST", debit: 0, credit: 1500 },
      { account_type: "ADJUSTMENT", debit: 1500, credit: 0 },
    ]);

    let closingSql = "";
    const sums = await getClosingLedgerSums(async (sql) => {
      closingSql = sql;
      return {
        rows: [{
          savings_deposit: "10000",
          savings_interest: "0",
          new_loan: "0",
          original_loan: "0",
          top_up: "0",
          converted_penalty_loan: "0",
          principal_repaid: "0",
          loan_interest_assessed: "0",
          interest_repaid: "0",
          common_interest_assessed: "0",
          common_interest_paid: "0",
          penalties_assessed: "0",
          penalties_paid: "0",
          penalties_converted: "0",
        }],
      };
    }, {
      cycleId: "cycle-1",
      cycleMemberId: "member-1",
      cycleMonthId: "next-month-2",
      scope: "previous",
    });

    expect(closingSql).toContain("LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id");
    expect(closingSql).toContain("lt.is_reversal = FALSE");
    expect(closingSql).toContain("rev.id IS NULL");
    expectMoney(sums.savingsDeposit, 10000);
    expectMoney(sums.savingsInterest, 0);
  });
});
