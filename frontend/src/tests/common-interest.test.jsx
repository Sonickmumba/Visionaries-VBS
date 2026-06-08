import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  commonInterestPostPayload,
  CommonInterestPage,
  postCommonInterestAllocation,
  previewQuery,
  validateCommonInterestPost,
} from "../pages/admin/CommonInterestPage.jsx";

const cycle = { id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" };
const month = { id: "month-1", month_number: 1, status: "OPEN" };
const preview = {
  cycle,
  cycleMonth: month,
  allocationMethod: "NON_BORROWERS_AND_BELOW_MINIMUM_PROPORTIONAL",
  totalPoolContributions: 30000,
  totalLoansIssued: 10000,
  unborrowedMoney: 20000,
  commonInterestRate: 0.15,
  commonInterestPool: 3000,
  existingRun: null,
  members: [
    { cycle_member_id: "cm-1", first_name: "Mary", last_name: "Phiri", member_code: "M001", cumulativeBorrowed: 0, status: "NEVER_BORROWED", shortfall: 20000 },
  ],
  allocations: [
    { cycle_member_id: "cm-1", first_name: "Mary", last_name: "Phiri", cumulativeBorrowed: 0, status: "NEVER_BORROWED", shortfall: 20000, weight: 1, assignedBase: 20000, charge: 3000 },
  ],
};

describe("common-interest screens", () => {
  it("builds preview query strings with cycle, month, and method", () => {
    expect(previewQuery({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      allocationMethod: "ALL_MEMBERS_EQUAL",
    })).toBe("/common-interest/preview?cycleId=cycle-1&cycleMonthId=month-1&allocationMethod=ALL_MEMBERS_EQUAL");
  });

  it("validates posting requirements and blocks existing runs", () => {
    expect(validateCommonInterestPost({ preview: null, allocationMethod: "" })).toMatchObject({
      cycleId: "Choose a cycle.",
      cycleMonthId: "Choose a month.",
      allocationMethod: "Choose an allocation method.",
    });

    expect(validateCommonInterestPost({ preview: { ...preview, existingRun: { id: "run-1" } }, allocationMethod: preview.allocationMethod })).toMatchObject({
      existingRun: "An allocation has already been posted for this month.",
    });
  });

  it("normalizes and posts common-interest calculation payloads", async () => {
    const commonInterestApi = vi.fn().mockResolvedValue({ data: { run: { id: "run-1" }, allocations: [] } });

    expect(commonInterestPostPayload({ preview, allocationMethod: "ALL_MEMBERS_EQUAL" })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      allocationMethod: "ALL_MEMBERS_EQUAL",
    });

    await postCommonInterestAllocation({ preview, allocationMethod: "ALL_MEMBERS_EQUAL", commonInterestApi });

    expect(commonInterestApi).toHaveBeenCalledWith("/common-interest/calculate", {
      method: "POST",
      body: { cycleId: "cycle-1", cycleMonthId: "month-1", allocationMethod: "ALL_MEMBERS_EQUAL" },
    });
  });

  it("renders preview metrics, allocation tabs, and allocation rows", () => {
    const html = renderToStaticMarkup(
      <CommonInterestPage
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month] }}
        initialPreview={preview}
      />
    );

    expect(html).toContain("Common Interest");
    expect(html).toContain("Calculate Preview");
    expect(html).toContain("Post Allocation");
    expect(html).toContain("Pool Contributions");
    expect(html).toContain("Unborrowed Money");
    expect(html).toContain("Allocation Preview");
    expect(html).toContain("Borrowing Compliance");
    expect(html).toContain("Posted Run");
    expect(html).toContain("Mary Phiri");
    expect(html).toContain("K3,000");
  });

  it("renders posted run details when available", () => {
    const html = renderToStaticMarkup(
      <CommonInterestPage
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month] }}
        initialPreview={preview}
        initialRun={{
          data: {
            id: "run-1",
            allocation_method: "ALL_MEMBERS_EQUAL",
            total_pool_contributions: "30000",
            total_loans_issued: "10000",
            unborrowed_money: "20000",
            common_interest_pool: "3000",
            created_at: "2026-01-31",
          },
          allocations: [{ first_name: "Mary", last_name: "Phiri", compliance_status: "NEVER_BORROWED", cumulative_borrowed_amount: "0", borrowing_shortfall: "20000", assigned_base: "20000", final_charge: "3000" }],
        }}
      />
    );

    expect(html).toContain("Posted Run");
  });
});
