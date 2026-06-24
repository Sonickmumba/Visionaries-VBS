import { describe, expect, it } from "vitest";
import {
  allocateCommonInterest,
  calculateLoanInterest,
  calculateSavingsInterest,
  classifyBorrowing,
} from "../src/services/finance.js";

describe("finance calculations", () => {
  it("calculates monthly compound savings interest", () => {
    expect(calculateSavingsInterest({ broughtForward: 1000, deposit: 500, rate: 0.15 })).toEqual({
      base: 1500,
      interest: 225,
      carriedForward: 1725,
    });
  });

  it("applies configured rounding policy to savings interest", () => {
    expect(calculateSavingsInterest({
      broughtForward: 10,
      deposit: 0,
      rate: 0.1555,
      roundingPolicy: { scale: 2, mode: "DOWN" },
    })).toEqual({
      base: 10,
      interest: 1.55,
      carriedForward: 11.55,
    });

    expect(calculateSavingsInterest({
      broughtForward: 10,
      deposit: 0,
      rate: 0.1555,
      roundingPolicy: { scale: 2, mode: "UP" },
    })).toEqual({
      base: 10,
      interest: 1.56,
      carriedForward: 11.56,
    });
  });

  it("calculates monthly loan interest after current-month repayments reduce the interest base", () => {
    expect(calculateLoanInterest({
      broughtForward: 2000,
      newLoan: 500,
      principalRepaid: 300,
      interestRepaid: 50,
      rate: 0.15,
    })).toEqual({
      interestBase: 2150,
      interest: 322.5,
      beforeNewLoan: 2150,
      carriedForward: 2472.5,
    });
  });

  it("charges loan interest on current-month new loans", () => {
    expect(calculateLoanInterest({
      broughtForward: 0,
      newLoan: 5000,
      principalRepaid: 0,
      interestRepaid: 0,
      rate: 0.15,
    })).toEqual({
      interestBase: 5000,
      interest: 750,
      beforeNewLoan: 5000,
      carriedForward: 5750,
    });
  });

  it("does not charge new interest when current-month repayments clear the opening loan balance", () => {
    expect(calculateLoanInterest({
      broughtForward: 17250,
      newLoan: 0,
      principalRepaid: 15000,
      interestRepaid: 2250,
      rate: 0.15,
    })).toEqual({
      interestBase: 0,
      interest: 0,
      beforeNewLoan: 0,
      carriedForward: 0,
    });
  });

  it("applies configured rounding policy to loan interest", () => {
    expect(calculateLoanInterest({
      broughtForward: 10,
      newLoan: 0,
      principalRepaid: 0,
      interestRepaid: 0,
      rate: 0.1555,
      roundingPolicy: { scale: 2, mode: "DOWN" },
    })).toEqual({
      interestBase: 10,
      interest: 1.55,
      beforeNewLoan: 10,
      carriedForward: 11.55,
    });

    expect(calculateLoanInterest({
      broughtForward: 10,
      newLoan: 0,
      principalRepaid: 0,
      interestRepaid: 0,
      rate: 0.1555,
      roundingPolicy: { scale: 2, mode: "UP" },
    })).toEqual({
      interestBase: 10,
      interest: 1.56,
      beforeNewLoan: 10,
      carriedForward: 11.56,
    });
  });

  it("classifies borrowing compliance", () => {
    expect(classifyBorrowing(0, 20000)).toEqual({ status: "NEVER_BORROWED", shortfall: 20000 });
    expect(classifyBorrowing(10000, 20000)).toEqual({ status: "BORROWED_BELOW_MINIMUM", shortfall: 10000 });
    expect(classifyBorrowing(20000, 20000)).toEqual({ status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 });
  });

  it("classifies borrowing edge cases around the minimum", () => {
    expect(classifyBorrowing(0.01, 20000)).toEqual({ status: "BORROWED_BELOW_MINIMUM", shortfall: 19999.99 });
    expect(classifyBorrowing(19999.99, 20000)).toEqual({ status: "BORROWED_BELOW_MINIMUM", shortfall: 0.01 });
    expect(classifyBorrowing(20000.01, 20000)).toEqual({ status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 });
  });

  it("allocates common interest proportionally by shortfall", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 30000,
      rate: 0.15,
      method: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL",
      members: [
        { cycle_member_id: "a", status: "NEVER_BORROWED", shortfall: 20000 },
        { cycle_member_id: "b", status: "BORROWED_BELOW_MINIMUM", shortfall: 10000 },
      ],
    });
    expect(result.commonInterestPool).toBe(4500);
    expect(result.allocations.map((item) => item.charge)).toEqual([3000, 1500]);
  });

  it("allocates common interest equally to only non-borrowers", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 30000,
      rate: 0.15,
      method: "ONLY_NON_BORROWERS_EQUAL",
      members: [
        { cycle_member_id: "a", status: "NEVER_BORROWED", shortfall: 20000 },
        { cycle_member_id: "b", status: "BORROWED_BELOW_MINIMUM", shortfall: 10000 },
        { cycle_member_id: "c", status: "NEVER_BORROWED", shortfall: 20000 },
      ],
    });

    expect(result.commonInterestPool).toBe(4500);
    expect(result.allocations.map((item) => item.cycle_member_id)).toEqual(["a", "c"]);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([15000, 15000]);
    expect(result.allocations.map((item) => item.charge)).toEqual([2250, 2250]);
  });

  it("allocates common interest equally to all members", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 30000,
      rate: 0.15,
      method: "ALL_MEMBERS_EQUAL",
      members: [
        { cycle_member_id: "a", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
        { cycle_member_id: "b", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
        { cycle_member_id: "c", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
      ],
    });

    expect(result.commonInterestPool).toBe(4500);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([10000, 10000, 10000]);
    expect(result.allocations.map((item) => item.charge)).toEqual([1500, 1500, 1500]);
  });

  it("handles zero eligible common-interest members explicitly", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 30000,
      rate: 0.15,
      method: "ONLY_NON_BORROWERS_EQUAL",
      members: [
        { cycle_member_id: "a", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
      ],
    });

    expect(result.commonInterestPool).toBe(4500);
    expect(result.allocations).toEqual([]);
  });

  it("applies rounding policy when allocating common interest", () => {
    const result = allocateCommonInterest({
      unborrowedMoney: 100,
      rate: 0.1555,
      method: "ALL_MEMBERS_EQUAL",
      roundingPolicy: { scale: 2, mode: "DOWN" },
      members: [
        { cycle_member_id: "a", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
        { cycle_member_id: "b", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
        { cycle_member_id: "c", status: "AT_OR_ABOVE_MINIMUM", shortfall: 0 },
      ],
    });

    expect(result.commonInterestPool).toBe(15.55);
    expect(result.allocations.map((item) => item.assignedBase)).toEqual([33.33, 33.33, 33.34]);
    expect(result.allocations.map((item) => item.charge)).toEqual([5.18, 5.18, 5.19]);
    expect(result.allocations.reduce((sum, item) => sum + item.charge, 0)).toBeCloseTo(15.55, 2);
  });
});
