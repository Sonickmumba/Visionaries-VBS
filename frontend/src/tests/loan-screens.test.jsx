import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  approveLoanRequest,
  createLoanRequest,
  disburseLoanRequest,
  LoanScreensPage,
  loanRequestPayload,
  postLoanRepayment,
  rejectLoanRequest,
  repaymentPayload,
  validateLoanRequestForm,
  validateRepaymentForm,
} from "../pages/admin/LoanScreensPage.jsx";

const member = {
  cycle_member_id: "cycle-member-1",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
};

const context = {
  cycle: { id: "cycle-1", name: "2026 Main Cycle" },
  cycleMonth: { id: "month-1", month_number: 1 },
  members: [member],
};

const request = {
  id: "request-1",
  cycle_id: "cycle-1",
  cycle_month_id: "month-1",
  cycle_member_id: "cycle-member-1",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
  requested_amount: "10000",
  approved_amount: "10000",
  origin_type: "ORIGINAL_LOAN",
  status: "APPROVED",
  cumulative_borrowed: "10000",
  requested_at: "2026-01-04",
  is_disbursed: false,
};

describe("loan screens", () => {
  it("validates and normalizes new loan requests", () => {
    expect(validateLoanRequestForm({ cycleMemberId: "", requestedAmount: "0", originType: "ORIGINAL_LOAN" }, context)).toMatchObject({
      cycleMemberId: "Choose a member.",
      requestedAmount: "Requested amount must be greater than zero.",
    });

    expect(loanRequestPayload({
      form: { cycleMemberId: "cycle-member-1", requestedAmount: "10000", originType: "TOP_UP", notes: "top up" },
      context,
    })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cycle-member-1",
      requestedAmount: 10000,
      originType: "TOP_UP",
    });
  });

  it("creates, approves, rejects, and disburses loan requests", async () => {
    const loansApi = vi.fn().mockResolvedValue({ data: {} });

    await createLoanRequest({
      form: { cycleMemberId: "cycle-member-1", requestedAmount: "10000", originType: "ORIGINAL_LOAN", notes: "" },
      context,
      loansApi,
    });
    await approveLoanRequest({ requestId: "request-1", approvedAmount: "9000", loansApi });
    await rejectLoanRequest({ requestId: "request-2", reason: "Insufficient pool", loansApi });
    await disburseLoanRequest({ request, loansApi });

    expect(loansApi).toHaveBeenCalledWith("/loans/requests", {
      method: "POST",
      body: expect.objectContaining({ requestedAmount: 10000 }),
    });
    expect(loansApi).toHaveBeenCalledWith("/loans/requests/request-1/approve", {
      method: "POST",
      body: { approvedAmount: 9000 },
    });
    expect(loansApi).toHaveBeenCalledWith("/loans/requests/request-2/reject", {
      method: "POST",
      body: { reason: "Insufficient pool" },
    });
    expect(loansApi).toHaveBeenCalledWith("/loans/disbursements", {
      method: "POST",
      body: expect.objectContaining({ loanRequestId: "request-1", amount: 10000 }),
    });
  });

  it("validates and posts loan repayments", async () => {
    const loansApi = vi.fn().mockResolvedValue({ data: {} });

    expect(validateRepaymentForm({ cycleMemberId: "", principalAmount: "", interestAmount: "" }, context)).toMatchObject({
      cycleMemberId: "Choose a member.",
      amount: "Enter a principal or interest repayment amount.",
    });

    const form = { cycleMemberId: "cycle-member-1", principalAmount: "1500", interestAmount: "225", notes: "cash" };
    expect(repaymentPayload({ form, context })).toMatchObject({ principalAmount: 1500, interestAmount: 225 });

    await postLoanRepayment({ form, context, loansApi });

    expect(loansApi).toHaveBeenCalledWith("/loans/repayments", {
      method: "POST",
      body: expect.objectContaining({ principalAmount: 1500, interestAmount: 225 }),
    });
  });

  it("requires a rejection reason", async () => {
    await expect(rejectLoanRequest({ requestId: "request-1", reason: "", loansApi: vi.fn() })).rejects.toMatchObject({
      validationErrors: { rejectionReason: "Rejection reason is required." },
    });
  });

  it("renders queue, metrics, actions, and tabs", () => {
    const html = renderToStaticMarkup(<LoanScreensPage initialRequests={[request]} initialContext={context} />);

    expect(html).toContain("Loans");
    expect(html).toContain("Loan Desk");
    expect(html).toContain("Refresh Queue");
    expect(html).toContain("New Loan Request");
    expect(html).toContain("Record Repayment");
    expect(html).toContain("Approval Queue");
    expect(html).toContain("Member Ledger");
    expect(html).toContain("Mary Phiri");
    expect(html).toContain("Review");
    expect(html).toContain("K10,000");
  });

  it("renders member loan ledger details", () => {
    const html = renderToStaticMarkup(
      <LoanScreensPage
        initialRequests={[request]}
        initialContext={context}
        initialLedger={{
          summary: {
            cumulative_borrowed: "10000",
            original_loans: "10000",
            top_ups: "0",
            converted_penalty_loans: "0",
            interest_assessed: "1500",
            principal_repaid: "2000",
            interest_repaid: "500",
            outstanding_balance: "9000",
          },
          data: [{ id: "tx-1", posted_at: "2026-01-05", transaction_type: "LOAN_DISBURSEMENT", amount: "10000", description: "Loan disbursement" }],
        }}
      />
    );

    expect(html).toContain("Member Ledger");
    expect(html).toContain("Ledger Detail");
    expect(html).toContain("Outstanding");
  });

  it("keeps the loan mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/loans.css"), "utf8");

    expect(css).toContain(".loan-hero");
    expect(css).toContain(".loan-mobile-cards");
    expect(css).toContain(".loan-request-card");
    expect(css).toContain(".loan-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
