import { describe, expect, it } from "vitest";
import { canPostToMonthStatus } from "../src/services/monthGuard.js";

describe("month guard", () => {
  it("allows ordinary posting to non-locked month statuses", () => {
    expect(canPostToMonthStatus("OPEN")).toBe(true);
    expect(canPostToMonthStatus("DECLARATION_PERIOD")).toBe(true);
    expect(canPostToMonthStatus("PAYOUT_PERIOD")).toBe(true);
    expect(canPostToMonthStatus("PROCESSING")).toBe(true);
    expect(canPostToMonthStatus("REVIEW")).toBe(true);
    expect(canPostToMonthStatus("REOPENED")).toBe(true);
  });

  it("blocks ordinary posting to locked months", () => {
    expect(canPostToMonthStatus("LOCKED")).toBe(false);
  });
});
