import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberReportsPage } from "../pages/member/MemberReportsPage.jsx";

const cycle = { id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" };
const month = { id: "month-1", month_number: 1, status: "OPEN" };
const member = { cycle_member_id: "cm-1", first_name: "Mary", last_name: "Phiri", member_code: "M001" };

const data = {
  report: "cycle-summary",
  cycle,
  cycleMonth: month,
  members: [member],
  totals: { savings_principal: "15000", loans_issued: "10000", common_interest: "3000", penalties: "100" },
  rows: [{
    month_number: 1,
    status: "OPEN",
    total_savings_deposits: "15000",
    total_loans_issued: "10000",
    common_interest_pool: "3000",
    total_penalties_assessed: "100",
  }],
};

describe("member reports", () => {
  it("renders the shared reports center as a read-only member transparency page", () => {
    const html = renderToStaticMarkup(
      <MemberReportsPage
        setPage={() => {}}
        initialData={data}
        initialCycles={[cycle]}
        initialCycleDetail={{ months: [month] }}
        requestedReport="declarations"
      />
    );

    expect(html).toContain("Member Reports");
    expect(html).toContain("Transparency Reports");
    expect(html).toContain("Read-only group reports");
    expect(html).toContain("Cycle Summary");
    expect(html).toContain("Member Statements");
    expect(html).toContain("Monthly Pool");
    expect(html).toContain("Converted Penalties");
    expect(html).toContain("Cycle Closing");
    expect(html).toContain("Reports");
    expect(html).not.toContain("Approve");
    expect(html).not.toContain("Disburse");
  });

  it("keeps member reports wired into lazy app routing", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/member/MemberReportsPage.jsx"), "utf8");
    const appSource = fs.readFileSync(path.join(process.cwd(), "src/PortalApp.jsx"), "utf8");
    const layoutSource = fs.readFileSync(path.join(process.cwd(), "src/layouts/AppLayouts.jsx"), "utf8");

    expect(source).toContain('setPage?.("member-more")');
    expect(appSource).toContain("MemberReportsPage");
    expect(appSource).toContain('case "my-reports"');
    expect(layoutSource).toContain('["my-reports", "Reports", FileBarChart]');
  });
});
