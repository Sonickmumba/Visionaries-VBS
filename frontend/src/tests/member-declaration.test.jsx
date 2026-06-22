import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  loadMemberDeclarationData,
  memberDeclarationPayload,
  MemberDeclarationPage,
  submitMemberDeclaration,
  validateMemberDeclarationForm,
} from "../pages/member/MemberDeclarationPage.jsx";

const activeMembership = {
  id: "cm-1",
  cycle_id: "cycle-1",
  cycle_name: "2026 Main Cycle",
  cycle_status: "ACTIVE",
  minimum_borrowing_amount: "20000",
  savings_cap: "30000",
};

const selectedMonth = {
  id: "month-1",
  month_number: 1,
  status: "DECLARATION_PERIOD",
  declaration_window_start: "2026-01-28",
  declaration_window_end: "2026-02-03",
};

const form = {
  savingsAmount: "15000",
  loanRequestAmount: "5000",
  loanTopUpAmount: "",
  principalRepaymentAmount: "1000",
  loanInterestRepaymentAmount: "150",
  commonInterestPaymentAmount: "75",
  otherObligationAmount: "",
  notes: "Monthly plan",
};

const declaration = {
  id: "dec-1",
  cycle_month_id: "month-1",
  month_number: 1,
  submitted_at: "2026-01-29T08:00:00.000Z",
  savings_amount: "15000",
  loan_request_amount: "5000",
  loan_top_up_amount: "0",
  principal_repayment_amount: "1000",
  loan_interest_repayment_amount: "150",
  common_interest_payment_amount: "75",
  other_obligation_amount: "0",
  notes: "Monthly plan",
  status: "SUBMITTED",
};

const initialData = {
  me: { member: { first_name: "Mary", last_name: "Phiri" }, cycleMemberships: [activeMembership] },
  activeMembership,
  cycleDetail: { data: { id: "cycle-1" }, months: [selectedMonth] },
  months: [selectedMonth],
  declarations: [declaration],
  selectedMonth,
};

describe("member declaration screen", () => {
  it("validates active context, selected month, non-negative amounts, and submit activity", () => {
    const errors = validateMemberDeclarationForm(
      { ...form, savingsAmount: "-1", loanRequestAmount: "bad", notes: "", principalRepaymentAmount: "", loanInterestRepaymentAmount: "", commonInterestPaymentAmount: "" },
      { activeMembership: null, selectedMonth: null },
    );

    expect(errors.activeMembership).toBe("You are not enrolled in an active cycle.");
    expect(errors.selectedMonth).toBe("Choose a cycle month.");
    expect(errors.savingsAmount).toBe("Savings amount cannot be negative.");
    expect(errors.loanRequestAmount).toBe("Loan request must be a valid number.");

    const emptySubmit = validateMemberDeclarationForm(
      {
        savingsAmount: "",
        loanRequestAmount: "",
        loanTopUpAmount: "",
        principalRepaymentAmount: "",
        loanInterestRepaymentAmount: "",
        commonInterestPaymentAmount: "",
        otherObligationAmount: "",
        notes: "",
      },
      { activeMembership, selectedMonth },
    );
    expect(emptySubmit.activity).toContain("Enter at least one amount");
    expect(validateMemberDeclarationForm({
      savingsAmount: "",
      loanRequestAmount: "",
      loanTopUpAmount: "",
      principalRepaymentAmount: "",
      loanInterestRepaymentAmount: "",
      commonInterestPaymentAmount: "",
      otherObligationAmount: "",
      notes: "",
    }, { saveAsDraft: true, activeMembership, selectedMonth }).activity).toBeUndefined();
  });

  it("normalizes member declaration payloads for the backend", () => {
    expect(memberDeclarationPayload({ form, activeMembership, selectedMonth, saveAsDraft: true })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cm-1",
      savingsAmount: 15000,
      loanRequestAmount: 5000,
      loanTopUpAmount: 0,
      principalRepaymentAmount: 1000,
      loanInterestRepaymentAmount: 150,
      commonInterestPaymentAmount: 75,
      otherObligationAmount: 0,
      notes: "Monthly plan",
      saveAsDraft: true,
    });
  });

  it("submits and saves drafts through the declarations API", async () => {
    const memberApi = vi.fn().mockResolvedValue({ data: declaration });

    await submitMemberDeclaration({ form, activeMembership, selectedMonth, memberApi });
    await submitMemberDeclaration({ form, activeMembership, selectedMonth, saveAsDraft: true, memberApi });

    expect(memberApi).toHaveBeenCalledWith("/declarations", {
      method: "POST",
      body: expect.objectContaining({ savingsAmount: 15000, saveAsDraft: false }),
    });
    expect(memberApi).toHaveBeenCalledWith("/declarations", {
      method: "POST",
      body: expect.objectContaining({ loanRequestAmount: 5000, saveAsDraft: true }),
    });
  });

  it("loads active member declaration context and declarations", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return initialData.me;
      if (path === "/cycles/cycle-1") return { data: { id: "cycle-1" }, months: [selectedMonth] };
      if (path === "/declarations") return { data: [declaration] };
      throw new Error(`Unexpected path ${path}`);
    });

    const data = await loadMemberDeclarationData({ memberApi });

    expect(data.activeMembership).toBe(activeMembership);
    expect(data.selectedMonth).toBe(selectedMonth);
    expect(data.declarations).toEqual([declaration]);
  });

  it("renders the member declaration form, actions, context, and history", () => {
    const html = renderToStaticMarkup(<MemberDeclarationPage initialData={initialData} setPage={() => {}} />);

    expect(html).toContain("My Declaration");
    expect(html).toContain("Submit Declaration");
    expect(html).toContain("Save Draft");
    expect(html).toContain("member-declaration-mobile");
    expect(html).toContain("Monthly Declaration");
    expect(html).toContain("Declaration status summary");
    expect(html).toContain("Declaration amount summary");
    expect(html).toContain("Declaration progress");
    expect(html).toContain("mobile-sticky-actions");
    expect(html).toContain("aria-label=\"Primary mobile navigation\"");
    expect(html).toContain("Declaration Window");
    expect(html).toContain("Loan requests are always open");
    expect(html).toContain("Savings, repayments, loan-interest payments");
    expect(html).toContain("Savings amount");
    expect(html).toContain("Loan top-up");
    expect(html).toContain("Common-interest payment");
    expect(html).toContain("My Declaration History");
    expect(html).toContain("K15,000");
  });

  it("keeps the member declaration mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/member-declaration.css"), "utf8");

    expect(css).toContain(".member-declaration-hero");
    expect(css).toContain(".member-declaration-hero-values");
    expect(css).toContain(".member-declaration-mobile-summary");
    expect(css).toContain(".member-declaration-mobile");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
