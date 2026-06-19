import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboardPage, dashboardViewModel } from "../pages/admin/AdminDashboardPage.jsx";

const dashboardData = {
  cycle: { id: "cycle-1", name: "2026 Main Cycle" },
  cycleMonth: { id: "month-1", month_number: 3, status: "DECLARATION_PERIOD" },
  totals: {
    savings: "15000",
    loans: "4000",
    common_interest: "500",
    penalties: "100",
  },
  financialPosition: {
    month_number: 2,
    pool_contributions: "25000",
    loans_issued: "10000",
    unborrowed_money: "15000",
    common_interest_pool: "2250",
    total_accumulated_savings: "17250",
  },
  pendingLoans: 2,
  declarationStats: {
    approved: 8,
    awaiting_review: 3,
    current_month_missed: 1,
    current_month_approved: 4,
  },
};

describe("admin dashboard", () => {
  it("builds card and priority view models from API data", () => {
    const view = dashboardViewModel(dashboardData);

    expect(view.cycleName).toBe("2026 Main Cycle");
    expect(view.monthLabel).toBe("Month 3");
    expect(view.cards.map((card) => card.title)).toContain("Loans Outstanding");
    expect(view.financialPositionScope).toBe("up to Month 2");
    expect(view.poolCards.map((card) => card.title)).toContain("Pool Contributions");
    expect(view.poolCards.find((card) => card.title === "Loans Issued").value).toBe("K10,000");
    expect(view.poolCards.find((card) => card.title === "CI Pool").value).toBe("K2,250");
    expect(view.priorities.find((item) => item.label === "Approve Loans")).toMatchObject({
      detail: "2 pending loan requests",
      urgent: true,
      page: "loans",
    });
  });

  it("renders dashboard summary, quick actions, and widgets", () => {
    const html = renderToStaticMarkup(<AdminDashboardPage initialData={dashboardData} setPage={() => {}} />);

    expect(html).toContain("Admin Dashboard");
    expect(html).toContain("Review Declarations");
    expect(html).toContain("Approve Loans");
    expect(html).toContain("Run Monthly Closing");
    expect(html).toContain("View Reports");
    expect(html).toContain("2026 Main Cycle");
    expect(html).toContain("Priority Queue");
    expect(html).toContain("Monthly Closing Progress");
    expect(html).toContain("Cycle Financial Position up to Month 2");
    expect(html).toContain("Pool Contributions");
    expect(html).toContain("Unborrowed Money");
    expect(html).toContain("Total Accumulated Savings");
    expect(html).toContain("Calculated up to Month 2");
  });

  it("renders empty state when no active cycle exists", () => {
    const html = renderToStaticMarkup(<AdminDashboardPage initialData={null} setPage={() => {}} />);

    expect(html).toContain("No active cycle");
    expect(html).toContain("Open Cycles");
  });

  it("renders loading skeleton when dashboard is loading", () => {
    const html = renderToStaticMarkup(<AdminDashboardPage setPage={() => {}} />);

    expect(html).toContain("aria-busy=\"true\"");
  });
});
