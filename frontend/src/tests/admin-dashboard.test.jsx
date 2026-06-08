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
