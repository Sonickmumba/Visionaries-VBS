import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  closingExceptions,
  closingPreviewQuery,
  closingRunPayload,
  closingStepIndex,
  MonthlyClosingPage,
  runMonthlyClosing,
  validateClosingRun,
} from "../pages/admin/MonthlyClosingPage.jsx";

const cycle = { id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" };
const month = { id: "month-1", month_number: 1, status: "OPEN" };
const members = [
  {
    cycle_member_id: "cm-1",
    first_name: "Mary",
    last_name: "Phiri",
    member_code: "M001",
    declarationStatus: "APPROVED",
    savingsDeposit: 15000,
    savingsInterest: 2250,
    loanInterest: 300,
    borrowingStatus: "BORROWED_BELOW_MINIMUM",
    borrowingShortfall: 10000,
    penaltyAmount: 0,
  },
  {
    cycle_member_id: "cm-2",
    first_name: "John",
    last_name: "Banda",
    member_code: "M002",
    declarationStatus: "MISSED",
    savingsDeposit: 0,
    savingsInterest: 0,
    loanInterest: 0,
    borrowingStatus: "NEVER_BORROWED",
    borrowingShortfall: 20000,
    penaltyAmount: 100,
  },
];

const preview = {
  cycle,
  cycleMonth: month,
  members,
  totals: {
    declared: 1,
    missed: 1,
    savingsDeposit: 15000,
    savingsInterest: 2250,
    loanInterest: 300,
    penalties: 100,
  },
};

const result = {
  run: { id: "run-1", run_number: 1, status: "APPROVED", approved_at: "2026-01-31" },
  summary: {
    total_savings_interest: "2250",
    total_loan_interest_assessed: "300",
    total_common_interest_charged: "3000",
    total_penalties_assessed: "100",
    total_outstanding_loans: "2300",
  },
  snapshots: [{ id: "snapshot-1" }, { id: "snapshot-2" }],
  commonInterest: { run: { common_interest_pool: "3000" } },
};

describe("monthly closing screens", () => {
  it("builds preview query strings with optional cycle and month", () => {
    expect(closingPreviewQuery({ cycleId: "cycle-1", cycleMonthId: "month-1" })).toBe("/monthly-closing/preview?cycleId=cycle-1&cycleMonthId=month-1");
    expect(closingPreviewQuery({})).toBe("/monthly-closing/preview");
  });

  it("validates closing run requirements and locked months", () => {
    expect(validateClosingRun({ preview: null, allocationMethod: "" })).toMatchObject({
      cycleId: "Choose a cycle.",
      cycleMonthId: "Choose a month.",
      allocationMethod: "Choose a common-interest allocation method.",
    });

    expect(validateClosingRun({
      preview: { ...preview, cycleMonth: { ...month, status: "LOCKED" } },
      allocationMethod: "ALL_MEMBERS_EQUAL",
    })).toMatchObject({ locked: "This month is already locked." });
  });

  it("normalizes and posts monthly closing payloads", async () => {
    const closingApi = vi.fn().mockResolvedValue({ data: result });

    expect(closingRunPayload({
      preview,
      allocationMethod: "ONLY_NON_BORROWERS_EQUAL",
      lockMonth: true,
    })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      lock: true,
      allocationMethod: "ONLY_NON_BORROWERS_EQUAL",
    });

    await runMonthlyClosing({
      preview,
      allocationMethod: "ONLY_NON_BORROWERS_EQUAL",
      lockMonth: true,
      closingApi,
    });

    expect(closingApi).toHaveBeenCalledWith("/monthly-closing/run", {
      method: "POST",
      body: {
        cycleId: "cycle-1",
        cycleMonthId: "month-1",
        lock: true,
        allocationMethod: "ONLY_NON_BORROWERS_EQUAL",
      },
    });
  });

  it("finds declaration, penalty, and borrowing exceptions", () => {
    const rows = closingExceptions(members);

    expect(rows).toHaveLength(2);
    expect(rows.map((member) => member.first_name)).toEqual(["Mary", "John"]);
  });

  it("tracks closing workflow progress from preview to approved run", () => {
    expect(closingStepIndex(null, null)).toBe(0);
    expect(closingStepIndex(preview, null)).toBe(1);
    expect(closingStepIndex(preview, result)).toBe(7);
  });

  it("renders closing controls, preview metrics, member snapshots, exceptions, and result tab", () => {
    const html = renderToStaticMarkup(
      <MonthlyClosingPage
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month] }}
        initialPreview={preview}
        initialResult={result}
      />
    );

    expect(html).toContain("Monthly Closing");
    expect(html).toContain("Month 1 closing preview");
    expect(html).toContain("Refresh Preview");
    expect(html).toContain("Run Closing");
    expect(html).toContain("Lock month after approval");
    expect(html).toContain("Closing Workflow");
    expect(html).toContain("Savings Interest");
    expect(html).toContain("Loan Interest");
    expect(html).toContain("Member Snapshots");
    expect(html).toContain("Exceptions");
    expect(html).toContain("Run Result");
    expect(html).toContain("K2,250");
    expect(html).toContain("K100");
  });

  it("keeps the monthly closing mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/monthly-closing.css"), "utf8");

    expect(css).toContain(".closing-hero");
    expect(css).toContain(".closing-mobile-cards");
    expect(css).toContain(".closing-card");
    expect(css).toContain(".closing-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
