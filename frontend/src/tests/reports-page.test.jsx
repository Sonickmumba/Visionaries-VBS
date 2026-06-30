import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildReportRows,
  formatReportValue,
  ReportsPage,
  reportsQuery,
  reportTotals,
} from "../pages/admin/ReportsPage.jsx";

const cycle = { id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" };
const month = { id: "month-1", month_number: 1, status: "OPEN" };
const member = { cycle_member_id: "cm-1", first_name: "Mary", last_name: "Phiri", member_code: "M001" };

const cycleSummaryData = {
  report: "cycle-summary",
  cycle,
  cycleMonth: month,
  members: [member],
  totals: { savings_principal: "15000", loans_issued: "10000", common_interest: "3000", penalties: "100" },
  rows: [
    {
      month_number: 1,
      status: "OPEN",
      total_savings_deposits: "15000",
      total_loans_issued: "10000",
      common_interest_pool: "3000",
      total_penalties_assessed: "100",
    },
  ],
};

const statementRow = {
  ...member,
  savings_principal: "15000",
  savings_interest: "2250",
  borrowed: "10000",
  loan_interest_assessed: "1500",
  common_interest: "3000",
  penalties: "100",
  penalties_paid: "0",
};

describe("reports screens", () => {
  it("builds center and endpoint report query strings", () => {
    expect(reportsQuery({
      report: "member-statements",
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cm-1",
    })).toBe("/reports/center?report=member-statements&cycleId=cycle-1&cycleMemberId=cm-1");

    expect(reportsQuery({
      report: "converted-penalties",
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      format: "csv",
    })).toBe("/reports/converted-penalties?cycleId=cycle-1&cycleMonthId=month-1&format=csv");
  });

  it("summarizes report totals from totals or rows", () => {
    expect(reportTotals({ rows: cycleSummaryData.rows, totals: cycleSummaryData.totals })).toMatchObject({
      savings: 15000,
      loans: 10000,
      charges: 3100,
    });

    expect(reportTotals({ rows: cycleSummaryData.rows, totals: {} })).toMatchObject({
      savings: 15000,
      loans: 10000,
      charges: 3100,
    });
  });

  it("formats monetary and date report values", () => {
    expect(formatReportValue("amount_assessed", "100")).toBe("K100");
    expect(formatReportValue("submitted_at", "2026-01-31T10:00:00Z")).toBe("2026-01-31");
    expect(formatReportValue("status", "BORROWED_BELOW_MINIMUM")).toBe("Borrowed Below Minimum");
  });

  it("builds member statement rows with detail actions", () => {
    const rows = buildReportRows([statementRow], "member-statements", () => {});
    const html = renderToStaticMarkup(<>{rows[0].map((cell, index) => <span key={index}>{cell}</span>)}</>);

    expect(html).toContain("Mary Phiri");
    expect(html).toContain("K15,000");
    expect(html).toContain("View Details");
  });

  it("renders report tabs, filters, metrics, exports, and report table", () => {
    const html = renderToStaticMarkup(
      <ReportsPage
        initialData={cycleSummaryData}
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month] }}
      />
    );

    expect(html).toContain("Reports Center");
    expect(html).toContain("Report guidance");
    expect(html).toContain("Cycle health");
    expect(html).toContain("Month 1");
    expect(html).toContain("Run Report");
    expect(html).toContain("Download PDF");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Cycle Summary");
    expect(html).toContain("Member Statements");
    expect(html).toContain("Converted Penalties");
    expect(html).toContain("Cycle Closing");
    expect(html).toContain("Group Surplus");
    expect(html).toContain("Shareout");
    expect(html).toContain("Report Rows");
    expect(html).toContain("K15,000");
  });

  it("opens report row detail in a modal instead of an inline report panel", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/ReportsPage.jsx"), "utf8");

    expect(source).toContain('title="Report Details"');
    expect(source).toContain("reports-detail-modal");
    expect(source).toContain("open={Boolean(selectedRow)}");
  });

  it("accepts a requested report tab from notification navigation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/ReportsPage.jsx"), "utf8");

    expect(source).toContain("requestedReport");
    expect(source).toContain("REPORT_DEFINITIONS[requestedReport]");
    expect(source).toContain("loadReport(requestedReport)");
  });

  it("keeps the reports mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/reports.css"), "utf8");

    expect(css).toContain(".reports-hero");
    expect(css).toContain(".reports-mobile-cards");
    expect(css).toContain(".reports-card");
    expect(css).toContain(".reports-detail-modal");
    expect(css).toContain("max-height: none");
    expect(css).toContain(".reports-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
