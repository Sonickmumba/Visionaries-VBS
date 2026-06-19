import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  loadMemberLoanData,
  memberLoanSummary,
  MemberLoansPage,
} from "../pages/member/MemberLoansPage.jsx";

const membership = {
  id: "cm-1",
  cycle_id: "cycle-1",
  cycle_name: "2026 Main Cycle",
  cycle_status: "ACTIVE",
  minimum_borrowing_amount: "20000",
  savings_cap: "30000",
};

const statement = {
  totals: {
    borrowed: "10000",
    principal_repaid: "2000",
    loan_interest_assessed: "1500",
    loan_interest_repaid: "500",
  },
};

const ledger = {
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
  data: [
    {
      id: "tx-1",
      posted_at: "2026-01-05T09:00:00.000Z",
      transaction_type: "LOAN_DISBURSEMENT",
      amount: "10000",
      description: "Loan disbursement",
      reference: "LD-1",
    },
    {
      id: "tx-2",
      posted_at: "2026-01-31T09:00:00.000Z",
      transaction_type: "LOAN_INTEREST_ASSESSMENT",
      amount: "1500",
      description: "Monthly loan interest",
      reference: "INT-1",
    },
  ],
};

const initialData = {
  me: { member: { first_name: "Mary", last_name: "Phiri" }, cycleMemberships: [membership] },
  activeMembership: membership,
  statement,
  ledger,
};

describe("member loans screen", () => {
  it("loads member loan ledger for the active membership", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return initialData.me;
      if (path === "/reports/member-statement/cm-1") return { data: statement };
      if (path === "/loans/member/cm-1") return ledger;
      throw new Error(`Unexpected path: ${path}`);
    });

    const data = await loadMemberLoanData({ memberApi });

    expect(data.activeMembership).toBe(membership);
    expect(data.ledger.data).toHaveLength(2);
    expect(memberApi).toHaveBeenCalledWith("/loans/member/cm-1");
  });

  it("normalizes loan summary from ledger and statement totals", () => {
    expect(memberLoanSummary(initialData)).toMatchObject({
      cumulativeBorrowed: 10000,
      originalLoans: 10000,
      interestAssessed: 1500,
      principalRepaid: 2000,
      interestRepaid: 500,
      outstandingBalance: 9000,
      borrowingShortfall: 10000,
      borrowingStatus: "BORROWED_BELOW_MINIMUM",
    });
  });

  it("renders mobile and desktop member loan views", () => {
    const html = renderToStaticMarkup(<MemberLoansPage initialData={initialData} setPage={() => {}} />);

    expect(html).toContain("My Loans");
    expect(html).toContain("Member Loans");
    expect(html).toContain("My Loan Balance");
    expect(html).toContain("Member loan summary");
    expect(html).toContain("Loan Breakdown");
    expect(html).toContain("Loan Ledger");
    expect(html).toContain("Loan disbursement");
    expect(html).toContain("K9,000");
    expect(html).toContain("aria-label=\"Primary mobile navigation\"");
  });

  it("routes my-loans to the dedicated member loan page", () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), "src/PortalApp.jsx"), "utf8");

    expect(appSource).toContain("MemberLoansPage");
    expect(appSource).toContain("case \"my-loans\"");
    expect(appSource).toContain("return <MemberLoansPage setPage={setPage} />");
  });

  it("renders an empty state without active membership", () => {
    const html = renderToStaticMarkup(
      <MemberLoansPage initialData={{ me: { member: null, cycleMemberships: [] }, activeMembership: null, ledger: { data: [], summary: {} } }} />,
    );

    expect(html).toContain("No active cycle membership");
  });
});
