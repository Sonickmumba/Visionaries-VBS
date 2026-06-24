import { describe, expect, it } from "vitest";
import {
  calculateMemberMonthlyClosing,
  emptyClosingSums,
  getClosingLedgerSums,
} from "../src/services/monthlyClosingService.js";

const cycle = {
  savings_interest_rate: 0.15,
  loan_interest_rate: 0.15,
  minimum_borrowing_amount: 20000,
  rounding_scale: 2,
  rounding_mode: "HALF_UP",
};

describe("monthly closing calculations", () => {
  it("uses approved ledger savings deposit once when calculating savings interest", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: emptyClosingSums(),
      current: {
        ...emptyClosingSums(),
        savingsDeposit: 15000,
      },
    });

    expect(result.savingsBroughtForward).toBe(0);
    expect(result.savingsDeposit).toBe(15000);
    expect(result.savingsInterest).toBe(2250);
    expect(result.accumulatedSavingsCarriedForward).toBe(17250);
    expect(result.cumulativeSavingsPrincipal).toBe(15000);
  });

  it("calculates loan interest from brought-forward plus current-month new loans after repayments", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 10000,
      },
      current: {
        ...emptyClosingSums(),
        principalRepaid: 1000,
        interestRepaid: 200,
        newLoan: 2500,
        originalLoan: 2500,
      },
    });

    expect(result.loanBroughtForward).toBe(10000);
    expect(result.loanInterestAssessed).toBe(1695);
    expect(result.loanCarriedForward).toBe(12995);
    expect(result.cumulativeBorrowedAmount).toBe(12500);
    expect(result.borrowingStatus).toBe("BORROWED_BELOW_MINIMUM");
  });

  it("assesses interest on current-month new loans during the same closing", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: emptyClosingSums(),
      current: {
        ...emptyClosingSums(),
        newLoan: 5000,
        originalLoan: 5000,
      },
    });

    expect(result.loanBroughtForward).toBe(0);
    expect(result.loanInterestAssessed).toBe(750);
    expect(result.loanCarriedForward).toBe(5750);
    expect(result.newLoanAmount).toBe(5000);
  });

  it("does not assess new monthly loan interest when current-month repayments clear the brought-forward balance", () => {
    const result = calculateMemberMonthlyClosing({
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

    expect(result.loanBroughtForward).toBe(17250);
    expect(result.loanInterestAssessed).toBe(0);
    expect(result.loanCarriedForward).toBe(0);
  });

  it("includes converted penalty loans in future standing loan balance", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "MISSED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 1060,
        originalLoan: 1000,
        convertedPenaltyLoan: 60,
      },
      current: emptyClosingSums(),
    });

    expect(result.loanBroughtForward).toBe(1060);
    expect(result.loanInterestAssessed).toBe(159);
    expect(result.loanCarriedForward).toBe(1219);
  });

  it("classifies borrowing from cumulative borrowing instead of outstanding balance", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 20000,
        principalRepaid: 20000,
      },
      current: emptyClosingSums(),
    });

    expect(result.loanBroughtForward).toBe(0);
    expect(result.loanCarriedForward).toBe(0);
    expect(result.cumulativeBorrowedAmount).toBe(20000);
    expect(result.borrowingStatus).toBe("AT_OR_ABOVE_MINIMUM");
    expect(result.borrowingShortfall).toBe(0);
  });

  it("counts top-ups and converted penalty loans toward cumulative borrowing compliance", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 19500,
        originalLoan: 19000,
        topUp: 400,
        convertedPenaltyLoan: 100,
      },
      current: {
        ...emptyClosingSums(),
        newLoan: 500,
        topUp: 500,
      },
    });

    expect(result.cumulativeBorrowedAmount).toBe(20000);
    expect(result.borrowingStatus).toBe("AT_OR_ABOVE_MINIMUM");
    expect(result.borrowingShortfall).toBe(0);
  });

  it("uses cycle rounding policy for loan interest snapshots", () => {
    const result = calculateMemberMonthlyClosing({
      cycle: {
        ...cycle,
        loan_interest_rate: 0.1555,
        rounding_mode: "DOWN",
      },
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        newLoan: 10,
      },
      current: emptyClosingSums(),
    });

    expect(result.loanInterestAssessed).toBe(1.55);
    expect(result.loanCarriedForward).toBe(11.55);
  });

  it("compounds savings interest using accumulated brought-forward savings", () => {
    const result = calculateMemberMonthlyClosing({
      cycle,
      declarationStatus: "APPROVED",
      previous: {
        ...emptyClosingSums(),
        savingsDeposit: 1000,
        savingsInterest: 150,
      },
      current: {
        ...emptyClosingSums(),
        savingsDeposit: 500,
      },
    });

    expect(result.savingsBroughtForward).toBe(1150);
    expect(result.savingsDeposit).toBe(500);
    expect(result.savingsInterest).toBe(247.5);
    expect(result.accumulatedSavingsCarriedForward).toBe(1897.5);
    expect(result.cumulativeSavingsPrincipal).toBe(1500);
  });

  it("uses cycle rounding policy for savings snapshots", () => {
    const result = calculateMemberMonthlyClosing({
      cycle: {
        ...cycle,
        savings_interest_rate: 0.1555,
        rounding_mode: "DOWN",
      },
      declarationStatus: "APPROVED",
      previous: emptyClosingSums(),
      current: {
        ...emptyClosingSums(),
        savingsDeposit: 10,
      },
    });

    expect(result.savingsInterest).toBe(1.55);
    expect(result.accumulatedSavingsCarriedForward).toBe(11.55);
  });

  it("queries closing sums with reversal-aware ledger filtering", async () => {
    let sql = "";
    const fakeQuery = async (queryText) => {
      sql = queryText;
      return {
        rows: [{
          savings_deposit: "1000",
          savings_interest: "150",
        }],
      };
    };

    const result = await getClosingLedgerSums(fakeQuery, {
      cycleId: "cycle-1",
      cycleMemberId: "member-1",
      cycleMonthId: "month-1",
      scope: "previous",
    });

    expect(result.savingsDeposit).toBe(1000);
    expect(result.savingsInterest).toBe(150);
    expect(sql).toContain("LEFT JOIN ledger_transactions rev ON rev.reversed_transaction_id = lt.id");
    expect(sql).toContain("lt.transaction_type = 'SAVINGS_INTEREST' AND rev.id IS NULL");
  });
});
