import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  chooseActiveMembership,
  loadMemberPortalData,
  memberDashboardTotals,
  MemberDashboardPage,
} from "../pages/member/MemberDashboardPage.jsx";

const membership = {
  id: "cm-1",
  cycle_id: "cycle-1",
  cycle_name: "2026 Main Cycle",
  cycle_status: "ACTIVE",
  minimum_borrowing_amount: "20000",
  savings_cap: "30000",
};

const portal = {
  me: {
    member: { first_name: "Mary", last_name: "Phiri" },
    cycleMemberships: [membership],
  },
  activeMembership: membership,
  statement: {
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
    financialPosition: {
      month_number: 2,
      pool_contributions: "25000",
      loans_issued: "10000",
      unborrowed_money: "15000",
      common_interest_pool: "2250",
      total_accumulated_savings: "45000",
    },
    transactions: [
      {
        transaction_date: "2026-01-31",
        transaction_type: "SAVINGS_DEPOSIT",
        amount: "15000",
        description: "Savings deposit",
      },
    ],
  },
  savings: [],
  loans: [],
  penalties: [
    {
      penalty_name: "Failure to Declare",
      amount_assessed: "100",
      amount_paid: "40",
      outstanding_amount: "60",
      status: "ASSESSED",
    },
  ],
};

describe("member dashboard", () => {
  it("chooses the active cycle membership before falling back", () => {
    expect(chooseActiveMembership([{ id: "old" }, membership])).toBe(membership);
    expect(chooseActiveMembership([{ id: "first" }])).toMatchObject({ id: "first" });
    expect(chooseActiveMembership([])).toBeNull();
  });

  it("calculates SRS member financial totals from statement data", () => {
    expect(memberDashboardTotals(portal)).toMatchObject({
      savingsPrincipal: 15000,
      savingsInterest: 2250,
      accumulatedSavings: 17250,
      savingsCapRemaining: 15000,
      borrowed: 10000,
      outstandingLoan: 9000,
      commonInterestDue: 2000,
      penaltyDue: 60,
      borrowingShortfall: 10000,
      borrowingStatus: "BORROWED_BELOW_MINIMUM",
      groupPoolScope: "up to Month 2",
      groupPool: {
        poolContributions: 25000,
        loansIssued: 10000,
        unborrowedMoney: 15000,
        commonInterestPool: 2250,
        totalAccumulatedSavings: 45000,
      },
    });
  });

  it("loads member portal data through the active cycle membership", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return portal.me;
      if (path === "/reports/member-statement/cm-1") return { data: portal.statement };
      if (path === "/savings/member/cm-1") return { data: portal.savings };
      if (path === "/loans/member/cm-1") return { data: portal.loans };
      if (path === "/penalties/member/cm-1") return { data: portal.penalties };
      throw new Error(`Unexpected path: ${path}`);
    });

    const data = await loadMemberPortalData({ memberApi });

    expect(data.activeMembership).toBe(membership);
    expect(memberApi).toHaveBeenCalledWith("/reports/member-statement/cm-1");
    expect(memberApi).toHaveBeenCalledWith("/savings/member/cm-1");
    expect(memberApi).toHaveBeenCalledWith("/loans/member/cm-1");
    expect(memberApi).toHaveBeenCalledWith("/penalties/member/cm-1");
  });

  it("renders member balances, cycle progress, actions, and snapshots", () => {
    const html = renderToStaticMarkup(<MemberDashboardPage initialPortal={portal} setPage={() => {}} />);

    expect(html).toContain("My Dashboard");
    expect(html).toContain("Submit Declaration");
    expect(html).toContain("View Statement");
    expect(html).toContain("My Accumulated Savings");
    expect(html).toContain("My Loan Balance");
    expect(html).toContain("K17,250");
    expect(html).toContain("K9,000");
    expect(html).toContain("Group Pool Snapshot up to Month 2");
    expect(html).toContain("Latest Calculated");
    expect(html).toContain("Group Accumulated Savings");
    expect(html).toContain("K45,000");
    expect(html).toContain("Cycle Position");
    expect(html).toContain("Recent Transactions");
    expect(html).toContain("Penalty Snapshot");
    expect(html).toContain("Mary Phiri");
  });

  it("renders an empty state when the member is not enrolled in a cycle", () => {
    const html = renderToStaticMarkup(
      <MemberDashboardPage initialPortal={{ me: { member: null, cycleMemberships: [] }, activeMembership: null }} setPage={() => {}} />,
    );

    expect(html).toContain("No active cycle membership");
  });
});
