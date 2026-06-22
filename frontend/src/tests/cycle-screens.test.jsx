import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CycleScreensPage,
  cyclePayload,
  enrollCycleMember,
  generateCycleMonths,
  saveCycleForm,
  validateCycleForm,
} from "../pages/admin/CycleScreensPage.jsx";

const validForm = {
  name: "2026 Main Cycle",
  description: "Main village banking cycle",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  savingsCap: "30000",
  minimumBorrowingAmount: "20000",
  savingsInterestRate: "0.15",
  loanInterestRate: "0.15",
  commonInterestRate: "0.15",
  socialFundAmount: "240",
  membershipFeeAmount: "80",
  declarationStartDay: "28",
  declarationEndDay: "3",
  payoutStartDay: "4",
  payoutEndDay: "5",
  reason: "",
};

const cycle = {
  id: "cycle-1",
  name: "2026 Main Cycle",
  description: "Main cycle",
  status: "DRAFT",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
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
  member_count: 2,
};

describe("cycle screens", () => {
  it("validates required fields, dates, rates, days, and edit reasons", () => {
    const errors = validateCycleForm({
      ...validForm,
      name: "",
      endDate: "2025-12-31",
      savingsInterestRate: "1.2",
      payoutEndDay: "40",
    }, { requiresReason: true });

    expect(errors.name).toBe("Cycle name is required.");
    expect(errors.endDate).toBe("End date must be after the start date.");
    expect(errors.savingsInterestRate).toBe("Savings interest rate cannot exceed 1.");
    expect(errors.payoutEndDay).toBe("Payout end day cannot exceed 31.");
    expect(errors.reason).toBe("A reason is required when changing rules after draft.");
  });

  it("normalizes cycle form values for the backend", () => {
    const payload = cyclePayload({ ...validForm, name: "  2026 Main Cycle  ", reason: "  updated rules  " });

    expect(payload.name).toBe("2026 Main Cycle");
    expect(payload.savingsCap).toBe(30000);
    expect(payload.loanInterestRate).toBe(0.15);
    expect(payload.reason).toBe("updated rules");
  });

  it("posts create requests for new cycles", async () => {
    const cycleApi = vi.fn().mockResolvedValue({ data: { id: "cycle-2" } });

    await saveCycleForm({ form: validForm, cycleApi });

    expect(cycleApi).toHaveBeenCalledWith("/cycles", {
      method: "POST",
      body: expect.objectContaining({ name: "2026 Main Cycle", savingsCap: 30000 }),
    });
  });

  it("patches edit requests and requires a reason for active cycle rule changes", async () => {
    const cycleApi = vi.fn().mockResolvedValue({ data: { id: "cycle-1" } });
    const selectedCycle = { id: "cycle-1", status: "ACTIVE" };

    await expect(saveCycleForm({ form: validForm, selectedCycle, cycleApi })).rejects.toMatchObject({
      validationErrors: { reason: "A reason is required when changing rules after draft." },
    });

    await saveCycleForm({ form: { ...validForm, reason: "Approved rule correction" }, selectedCycle, cycleApi });

    expect(cycleApi).toHaveBeenCalledWith("/cycles/cycle-1", {
      method: "PATCH",
      body: expect.objectContaining({ reason: "Approved rule correction" }),
    });
  });

  it("runs the month generation endpoint", async () => {
    const cycleApi = vi.fn().mockResolvedValue({ data: [] });

    await generateCycleMonths({ cycleId: "cycle-1", cycleApi });

    expect(cycleApi).toHaveBeenCalledWith("/cycles/cycle-1/months/generate", { method: "POST" });
  });

  it("enrolls selected members into a cycle", async () => {
    const cycleApi = vi.fn().mockResolvedValue({ data: { id: "cycle-member-1" } });

    await expect(enrollCycleMember({ cycleId: "cycle-1", memberId: "", cycleApi })).rejects.toMatchObject({
      validationErrors: { memberId: "Choose a member to enroll." },
    });

    await enrollCycleMember({ cycleId: "cycle-1", memberId: "member-1", cycleApi });

    expect(cycleApi).toHaveBeenCalledWith("/cycles/cycle-1/members", {
      method: "POST",
      body: { memberId: "member-1" },
    });
  });

  it("renders cycle list, buttons, and selected cycle detail tabs", () => {
    const html = renderToStaticMarkup(
      <CycleScreensPage
        initialCycles={[cycle]}
        initialDetail={{
          data: cycle,
          months: [{ id: "month-1", month_number: 1, status: "OPEN", start_date: "2026-01-01", end_date: "2026-01-31" }],
          members: [{ id: "cm-1", first_name: "Mary", last_name: "Phiri", member_code: "M001", status: "ACTIVE" }],
        }}
        initialPenaltyTypes={[{ code: "FAIL_DECLARE", name: "Failure to declare", amount: "100", is_convertible_to_loan: true, is_active: true }]}
        initialAuditRows={[{ action: "CREATE", entity_table: "cycles", reason: "Seeded", created_at: "2026-01-01" }]}
      />
    );

    expect(html).toContain("New Cycle");
    expect(html).toContain("Cycle list quick actions");
    expect(html).toContain("Activate Cycle");
    expect(html).toContain("Generate Months");
    expect(html).toContain("Enroll Members");
    expect(html).toContain("Edit Rules");
    expect(html).toContain("Close Cycle");
    expect(html).toContain("Archive");
    expect(html).toContain("Rules");
    expect(html).toContain("Months");
    expect(html).toContain("Members");
    expect(html).toContain("Penalty Types");
    expect(html).toContain("Audit");
    expect(html).toContain("K30,000");
  });

  it("keeps cycle mobile actions compact and removes duplicate mobile toolbars", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/cycles.css"), "utf8");
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/CycleScreensPage.jsx"), "utf8");

    expect(source).toContain('className="cycles-page"');
    expect(source).toContain("cycle-list-mobile-actions");
    expect(source).toContain("cycle-list-head-action");
    expect(source).toContain("cycle-detail-generate-action");
    expect(source).toContain("cycle-months-head-action");
    expect(css).toContain(".cycles-page > .page-head .button-row");
    expect(css).toContain(".cycle-list-mobile-actions");
    expect(css).toContain(".cycle-list-head-action");
    expect(css).toContain(".cycle-detail-generate-action");
    expect(css).toContain(".cycle-months-head-action");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
  });
});
