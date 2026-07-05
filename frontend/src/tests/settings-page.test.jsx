import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  cycleDefaultsPayload,
  inviteSettingsUser,
  inviteUserPayload,
  notificationPayload,
  penaltyTypePayload,
  roundingPayload,
  savePenaltyType,
  SettingsPage,
  userUpdatePayload,
  validateInviteUser,
  validatePenaltyType,
} from "../pages/admin/SettingsPage.jsx";

const cycle = {
  id: "cycle-1",
  name: "2026 Main Cycle",
  status: "DRAFT",
  savings_cap: "30000",
  minimum_borrowing_amount: "20000",
  savings_interest_rate: "0.15",
  loan_interest_rate: "0.15",
  common_interest_rate: "0.15",
  social_fund_amount: "240",
  membership_fee_amount: "80",
  declaration_start_day: 28,
  declaration_end_day: 3,
  payout_start_day: 4,
  payout_end_day: 5,
  rounding_scale: 2,
  rounding_mode: "HALF_UP",
};

const context = {
  users: [
    { id: "user-1", email: "admin@example.com", role: "ADMIN", is_active: true, created_at: "2026-01-01" },
  ],
  activeCycle: cycle,
  cycles: [cycle],
  selectedCycleId: "cycle-1",
  penaltyTypes: [
    { id: "penalty-1", code: "FAILURE_TO_DECLARE", name: "Failure to Declare", amount: "100", is_convertible_to_loan: true, is_active: true },
  ],
  appSettings: {
    notification_preferences: { emailEnabled: true, smsEnabled: false, declarationReminderDays: [28, 1, 3], payoutReminderDays: [4, 5] },
    active_cycle_defaults: { autoSelectLatestActive: true, defaultCycleId: "cycle-1" },
  },
  roundingModes: ["HALF_UP", "HALF_EVEN"],
};

describe("settings screens", () => {
  it("validates and normalizes user invites", async () => {
    expect(validateInviteUser({ email: "", role: "NOPE" })).toMatchObject({
      email: "Enter a valid email.",
      role: "Choose a valid role.",
    });

    expect(inviteUserPayload({ email: " Admin@Example.COM ", role: "ADMIN" })).toEqual({
      email: "admin@example.com",
      role: "ADMIN",
    });

    const settingsApi = vi.fn().mockResolvedValue({ data: { id: "user-2" } });
    await inviteSettingsUser({ form: { email: "new@example.com", role: "MEMBER" }, settingsApi });
    expect(settingsApi).toHaveBeenCalledWith("/settings/users", {
      method: "POST",
      body: { email: "new@example.com", role: "MEMBER" },
    });
  });

  it("builds auditable user update payloads", () => {
    expect(userUpdatePayload({ isActive: false }, "Committee decision")).toEqual({
      isActive: false,
      reason: "Committee decision",
    });
  });

  it("validates and posts penalty type payloads", async () => {
    expect(validatePenaltyType({ code: "", name: "", amount: "-1" }, "")).toMatchObject({
      cycleId: "Select a cycle.",
      code: "Penalty code is required.",
      name: "Penalty name is required.",
      amount: "Amount cannot be negative.",
    });

    const form = { code: "late payment", name: "Late payment", description: "", amount: "50", isConvertibleToLoan: false, isActive: true };
    expect(penaltyTypePayload(form, "cycle-1")).toMatchObject({
      cycleId: "cycle-1",
      code: "LATE_PAYMENT",
      amount: 50,
      isConvertibleToLoan: false,
    });

    const settingsApi = vi.fn().mockResolvedValue({ data: { id: "penalty-2" } });
    await savePenaltyType({ form, selectedCycleId: "cycle-1", settingsApi });
    expect(settingsApi).toHaveBeenCalledWith("/settings/penalty-types", {
      method: "POST",
      body: penaltyTypePayload(form, "cycle-1"),
    });
  });

  it("maps cycle, rounding, and notification settings payloads", () => {
    expect(cycleDefaultsPayload({
      savingsCap: "30000",
      minimumBorrowingAmount: "20000",
      savingsInterestRate: "15",
      loanInterestRate: "15",
      commonInterestRate: "15",
      socialFundAmount: "240",
      membershipFeeAmount: "80",
      declarationStartDay: "28",
      declarationEndDay: "3",
      payoutStartDay: "4",
      payoutEndDay: "5",
      reason: "Draft rules update",
    })).toMatchObject({
      savingsCap: 30000,
      savingsInterestRate: 0.15,
      loanInterestRate: 0.15,
      commonInterestRate: 0.15,
      reason: "Draft rules update",
    });

    expect(roundingPayload({ roundingScale: "2", roundingMode: "HALF_UP", reason: "Policy" })).toEqual({
      roundingScale: 2,
      roundingMode: "HALF_UP",
      reason: "Policy",
    });

    expect(notificationPayload({
      emailEnabled: true,
      smsEnabled: false,
      declarationReminderDays: "28, 1, 3",
      payoutReminderDays: "4, 5",
      reason: "Reminder policy",
    })).toEqual({
      emailEnabled: true,
      smsEnabled: false,
      declarationReminderDays: [28, 1, 3],
      payoutReminderDays: [4, 5],
      reason: "Reminder policy",
    });
  });

  it("renders settings metrics, tabs, user form, and user table", () => {
    const html = renderToStaticMarkup(<SettingsPage initialContext={context} onLogout={() => {}} />);

    expect(html).toContain("Settings");
    expect(html).toContain("Configuration Scope");
    expect(html).toContain("Account access");
    expect(html).toContain("Log Out");
    expect(html).toContain("Invite User");
    expect(html).toContain("Users");
    expect(html).toContain("Cycle Rules");
    expect(html).toContain("Penalty Types");
    expect(html).toContain("App Settings");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("User change reason");
  });

  it("keeps the settings mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/settings.css"), "utf8");

    expect(css).toContain(".settings-hero");
    expect(css).toContain(".settings-mobile-cards");
    expect(css).toContain(".settings-account-panel");
    expect(css).toContain("grid-template-columns: 1fr");
    expect(css).toContain(".settings-card");
    expect(css).toContain(".settings-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
