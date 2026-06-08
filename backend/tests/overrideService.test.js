import { describe, expect, it } from "vitest";
import { normalizeOverrideInput } from "../src/services/overrideService.js";

describe("override validation", () => {
  it("requires a reason", () => {
    expect(() => normalizeOverrideInput({
      targetTable: "common_interest_allocations",
      fieldName: "final_charge",
      reason: " ",
    })).toThrow("Override reason is required");
  });

  it("allows whitelisted calculated financial fields", () => {
    expect(normalizeOverrideInput({
      targetTable: "Common_Interest_Allocations",
      fieldName: "Final_Charge",
      reason: "Committee approved corrected allocation",
    })).toEqual({
      targetTable: "common_interest_allocations",
      fieldName: "final_charge",
      reason: "Committee approved corrected allocation",
    });
  });

  it("rejects non-whitelisted tables and fields", () => {
    expect(() => normalizeOverrideInput({
      targetTable: "members",
      fieldName: "first_name",
      reason: "No",
    })).toThrow("Target table cannot be overridden");

    expect(() => normalizeOverrideInput({
      targetTable: "member_monthly_snapshots",
      fieldName: "declaration_status",
      reason: "No",
    })).toThrow("Target field cannot be overridden");
  });
});
