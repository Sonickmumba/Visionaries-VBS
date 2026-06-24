import { describe, expect, it } from "vitest";
import { calculateSurplusMonth } from "../src/services/shareoutService.js";

describe("shareout service", () => {
  it("compounds social fund, membership, and penalties into the group surplus fund", () => {
    const monthOne = calculateSurplusMonth({
      openingBalance: 0,
      socialFundCollected: 4800,
      membershipCollected: 1600,
      penaltiesCollected: 300,
      interestRate: 0.15,
      roundingPolicy: { scale: 2, mode: "HALF_UP" },
    });
    expect(monthOne).toMatchObject({
      openingBalance: 0,
      socialFundCollected: 4800,
      membershipCollected: 1600,
      penaltiesCollected: 300,
      interestEarned: 1005,
      closingBalance: 7705,
    });

    const monthTwo = calculateSurplusMonth({
      openingBalance: monthOne.closingBalance,
      socialFundCollected: 0,
      membershipCollected: 0,
      penaltiesCollected: 200,
      interestRate: 0.15,
      roundingPolicy: { scale: 2, mode: "HALF_UP" },
    });
    expect(monthTwo).toMatchObject({
      openingBalance: 7705,
      penaltiesCollected: 200,
      interestEarned: 1185.75,
      closingBalance: 9090.75,
    });
  });
});
