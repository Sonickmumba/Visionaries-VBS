import { describe, expect, it } from "vitest";
import {
  normalizeNotificationPreferences,
  normalizeRoundingPolicy,
} from "../src/services/settingsService.js";

describe("settings validation", () => {
  it("normalizes supported rounding policy values", () => {
    expect(normalizeRoundingPolicy({ roundingScale: 2, roundingMode: "half_up" })).toEqual({
      roundingScale: 2,
      roundingMode: "HALF_UP",
    });
  });

  it("rejects invalid rounding policies", () => {
    expect(() => normalizeRoundingPolicy({ roundingScale: 5, roundingMode: "HALF_UP" }))
      .toThrow("Rounding scale must be an integer between 0 and 4");
    expect(() => normalizeRoundingPolicy({ roundingScale: 2, roundingMode: "BANKERS" }))
      .toThrow("Rounding mode is not supported");
  });

  it("normalizes notification day preferences", () => {
    expect(normalizeNotificationPreferences({
      emailEnabled: true,
      smsEnabled: false,
      declarationReminderDays: [3, 1, 3],
      payoutReminderDays: [5, 4],
    })).toEqual({
      emailEnabled: true,
      smsEnabled: false,
      declarationReminderDays: [1, 3],
      payoutReminderDays: [4, 5],
    });
  });

  it("rejects invalid notification days", () => {
    expect(() => normalizeNotificationPreferences({
      emailEnabled: true,
      smsEnabled: false,
      declarationReminderDays: [0],
      payoutReminderDays: [4],
    })).toThrow("declarationReminderDays must contain days between 1 and 31");
  });
});
