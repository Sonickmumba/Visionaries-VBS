import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildStatementCsvRows,
  loadMemberStatementData,
  MemberStatementPage,
} from "../pages/member/MemberStatementPage.jsx";

const membership = {
  id: "cm-1",
  cycle_id: "cycle-1",
  cycle_name: "2026 Main Cycle",
  cycle_status: "ACTIVE",
  minimum_borrowing_amount: "20000",
  savings_cap: "30000",
};

const month = {
  id: "month-1",
  month_number: 1,
  status: "CLOSED",
};

const statement = {
  member: {
    cycle_member_id: "cm-1",
    cycle_name: "2026 Main Cycle",
    first_name: "Mary",
    last_name: "Phiri",
    member_code: "M001",
  },
  totals: {
    savings_principal: "15000",
    savings_interest: "2250",
    borrowed: "10000",
    principal_repaid: "2000",
    loan_interest_assessed: "1500",
    loan_interest_repaid: "500",
    common_interest: "3000",
    common_interest_paid: "1000",
    penalties: "100",
    penalties_paid: "40",
  },
  transactions: [
    {
      id: "tx-1",
      posted_at: "2026-01-31T09:00:00.000Z",
      transaction_type: "SAVINGS_DEPOSIT",
      amount: "15000",
      description: "Approved declaration savings deposit",
      source_table: "declarations",
      source_id: "dec-1",
    },
    {
      id: "tx-2",
      posted_at: "2026-01-31T10:00:00.000Z",
      transaction_type: "LOAN_DISBURSEMENT",
      amount: "10000",
      description: "Loan approved",
      source_table: "loan_requests",
      source_id: "loan-1",
    },
  ],
  snapshots: [
    {
      month_number: 1,
      accumulated_savings: "17250",
      closing_loan_balance: "9000",
      common_interest_due: "2000",
      penalty_due: "60",
      borrowing_compliance_status: "BORROWED_BELOW_MINIMUM",
    },
  ],
};

const initialData = {
  me: { member: { first_name: "Mary", last_name: "Phiri" }, cycleMemberships: [membership] },
  activeMembership: membership,
  cycleDetail: { data: { id: "cycle-1" }, months: [month] },
  statement,
  selectedStatement: null,
  months: [month],
};

describe("member statement screens", () => {
  it("loads full-cycle and selected-month statements for the active membership", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return initialData.me;
      if (path === "/cycles/cycle-1") return initialData.cycleDetail;
      if (path === "/reports/member-statement/cm-1") return { data: statement };
      if (path === "/reports/member-statement/cm-1?cycleMonthId=month-1") return { data: { ...statement, transactions: [statement.transactions[0]] } };
      throw new Error(`Unexpected path: ${path}`);
    });

    const data = await loadMemberStatementData({ memberApi, cycleMonthId: "month-1" });

    expect(data.activeMembership).toBe(membership);
    expect(data.statement.transactions).toHaveLength(2);
    expect(data.selectedStatement.transactions).toHaveLength(1);
    expect(memberApi).toHaveBeenCalledWith("/reports/member-statement/cm-1?cycleMonthId=month-1");
  });

  it("builds CSV-safe statement rows", () => {
    expect(buildStatementCsvRows(statement.transactions)).toEqual([
      ["2026-01-31 09:00:00", "Savings Deposit", "15000.00", "Approved declaration savings deposit", "declarations", "dec-1"],
      ["2026-01-31 10:00:00", "Loan Disbursement", "10000.00", "Loan approved", "loan_requests", "loan-1"],
    ]);
  });

  it("renders cycle totals, statement filters, transaction details, and snapshots", () => {
    const html = renderToStaticMarkup(<MemberStatementPage initialData={initialData} setPage={() => {}} />);

    expect(html).toContain("My Statement");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Accumulated Savings");
    expect(html).toContain("K17,250");
    expect(html).toContain("Statement Context");
    expect(html).toContain("Transaction Detail");
    expect(html).toContain("Monthly Snapshots");
    expect(html).toContain("Approved declaration savings deposit");
    expect(html).toContain("Mary Phiri");
  });

  it("renders an empty state without active membership", () => {
    const html = renderToStaticMarkup(
      <MemberStatementPage initialData={{ me: { member: null, cycleMemberships: [] }, activeMembership: null, statement: null, months: [] }} />,
    );

    expect(html).toContain("No active cycle membership");
  });
});
