import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  approveDeclarationInputs,
  cancelDeclarationById,
  createDeclarationLoanRequest,
  declarationPayload,
  DeclarationScreensPage,
  markMissedDeclaration,
  saveDeclarationForm,
  validateDeclarationForm,
} from "../pages/admin/DeclarationScreensPage.jsx";

const form = {
  cycleMemberId: "cycle-member-1",
  savingsAmount: "15000",
  loanRequestAmount: "5000",
  loanTopUpAmount: "",
  principalRepaymentAmount: "1000",
  loanInterestRepaymentAmount: "150",
  commonInterestPaymentAmount: "75",
  otherObligationAmount: "",
  notes: "Monthly declaration",
};

const cycle = { id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" };
const month = { id: "month-1", cycle_name: "2026 Main Cycle", month_number: 1, status: "DECLARATION_PERIOD", start_date: "2026-01-01", end_date: "2026-01-31" };
const member = { id: "cycle-member-1", cycle_member_id: "cycle-member-1", cycle_id: "cycle-1", first_name: "Mary", last_name: "Phiri", member_code: "M001", status: "ACTIVE" };
const declaration = {
  id: "declaration-1",
  cycle_id: "cycle-1",
  cycle_month_id: "month-1",
  cycle_member_id: "cycle-member-1",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
  cycle_name: "2026 Main Cycle",
  month_number: 1,
  submitted_at: "2026-01-03T08:00:00.000Z",
  savings_amount: "15000",
  loan_request_amount: "5000",
  loan_top_up_amount: "0",
  principal_repayment_amount: "1000",
  loan_interest_repayment_amount: "150",
  common_interest_payment_amount: "75",
  other_obligation_amount: "0",
  status: "SUBMITTED",
  has_loan_intent: true,
  has_loan_request: false,
  is_within_window: true,
};

describe("declaration screens", () => {
  it("validates member selection and non-negative declaration amounts", () => {
    const errors = validateDeclarationForm({ ...form, cycleMemberId: "", savingsAmount: "-1", loanRequestAmount: "bad" });

    expect(errors.cycleMemberId).toBe("Choose a member.");
    expect(errors.savingsAmount).toBe("Savings amount cannot be negative.");
    expect(errors.loanRequestAmount).toBe("Loan request must be a valid number.");
  });

  it("normalizes declaration payload amounts for the backend", () => {
    const payload = declarationPayload({ form, cycleId: "cycle-1", cycleMonthId: "month-1" });

    expect(payload).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cycle-member-1",
      savingsAmount: 15000,
      loanRequestAmount: 5000,
      loanTopUpAmount: 0,
      principalRepaymentAmount: 1000,
      loanInterestRepaymentAmount: 150,
      commonInterestPaymentAmount: 75,
    });
  });

  it("submits new declarations and patches edited declarations", async () => {
    const declarationApi = vi.fn().mockResolvedValue({ data: declaration });

    await saveDeclarationForm({ form, cycleId: "cycle-1", cycleMonthId: "month-1", declarationApi });
    await saveDeclarationForm({ form, cycleId: "cycle-1", cycleMonthId: "month-1", detail: declaration, declarationApi });

    expect(declarationApi).toHaveBeenCalledWith("/declarations", {
      method: "POST",
      body: expect.objectContaining({ savingsAmount: 15000 }),
    });
    expect(declarationApi).toHaveBeenCalledWith("/declarations/declaration-1", {
      method: "PATCH",
      body: expect.objectContaining({ loanRequestAmount: 5000 }),
    });
  });

  it("calls financial declaration action endpoints", async () => {
    const declarationApi = vi.fn().mockResolvedValue({ data: {} });

    await approveDeclarationInputs({ declarationId: "declaration-1", declarationApi });
    await createDeclarationLoanRequest({ declarationId: "declaration-1", declarationApi });
    await cancelDeclarationById({ declarationId: "declaration-1", reason: "Duplicate", declarationApi });

    expect(declarationApi).toHaveBeenCalledWith("/declarations/declaration-1/approve-inputs", {
      method: "POST",
      body: { reason: "Reviewed and approved declaration inputs" },
    });
    expect(declarationApi).toHaveBeenCalledWith("/declarations/declaration-1/create-loan-request", { method: "POST" });
    expect(declarationApi).toHaveBeenCalledWith("/declarations/declaration-1/cancel", {
      method: "POST",
      body: { reason: "Duplicate" },
    });
  });

  it("marks missed declarations with the configured failure penalty", async () => {
    const declarationApi = vi.fn().mockResolvedValue({ data: {} });

    await markMissedDeclaration({
      member: { ...member, failure_penalty_type_id: "penalty-type-1", failure_penalty_amount: "100" },
      cycleMonthId: "month-1",
      declarationApi,
    });

    expect(declarationApi).toHaveBeenCalledWith("/declarations/missed", {
      method: "POST",
      body: expect.objectContaining({
        cycleId: "cycle-1",
        cycleMonthId: "month-1",
        cycleMemberId: "cycle-member-1",
        penaltyTypeId: "penalty-type-1",
        amount: 100,
      }),
    });
  });

  it("renders declaration filters, metrics, queue buttons, and tabs", () => {
    const html = renderToStaticMarkup(
      <DeclarationScreensPage
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month], members: [member] }}
        initialQueue={{
          cycleMonth: month,
          declarations: [declaration],
          missed: [{ ...member, failure_penalty_amount: "100", failure_penalty_type_id: "penalty-type-1", has_failure_penalty: false }],
        }}
      />
    );

    expect(html).toContain("Declarations");
    expect(html).toContain("Declaration Queue");
    expect(html).toContain("Submitted declaration cards");
    expect(html).toContain("Refresh Queue");
    expect(html).toContain("New Declaration");
    expect(html).toContain("Submitted");
    expect(html).toContain("Missed");
    expect(html).toContain("Summary");
    expect(html).toContain("Mary Phiri");
    expect(html).toContain("View Details");
    expect(html).toContain("K15,000");
  });

  it("keeps declaration workflow mobile card styles responsive", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/declarations.css"), "utf8");

    expect(css).toContain(".declaration-hero");
    expect(css).toContain(".declaration-mobile-cards");
    expect(css).toContain(".declaration-queue-card");
    expect(css).toContain(".declaration-proof-card");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
