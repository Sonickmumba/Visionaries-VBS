import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberMorePage } from "../pages/member/MemberMorePage.jsx";

const activeMembership = {
  id: "cm-1",
  cycle_id: "cycle-1",
  cycle_name: "2026 Main Cycle",
  cycle_status: "ACTIVE",
  minimum_borrowing_amount: "20000",
  savings_cap: "30000",
};

const initialData = {
  me: {
    member: { first_name: "Mary", last_name: "Phiri", member_code: "M001" },
    cycleMemberships: [activeMembership],
  },
  activeMembership,
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
  },
};

describe("member more screen", () => {
  it("renders menu rows with chevrons instead of visible Open actions", () => {
    const html = renderToStaticMarkup(<MemberMorePage initialData={initialData} setPage={() => {}} onLogout={() => {}} />);

    expect(html).toContain("member-cycle-position-icon");
    expect(html).toContain("Accumulated Savings");
    expect(html).toContain("Loan Balance");
    expect(html).toContain("Estimated Shareout");
    expect(html).toContain("member-more-menu-row");
    expect(html).toContain("Notifications");
    expect(html).toContain("Declarations");
    expect(html).toContain("Statements");
    expect(html).toContain("Payment Proofs");
    expect(html).toContain("Reports");
    expect(html).toContain("Log out");
    expect(html).toContain("Sign out from this device");
    expect(html).toContain("lucide-chevron-right");
    expect(html).not.toContain("aria-label=\"Logout\"");
    expect(html).not.toContain("Member profile quick actions");
    expect(html).not.toContain("member-more-command-strip");
    expect(html).not.toContain(">Open</button>");
    expect(html).not.toContain("Use header");
    expect(html).not.toContain(">Soon<");
  });

  it("keeps the member more menu aligned to the high fidelity row contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/member-more.css"), "utf8");

    expect(css).toContain(".member-more-menu-row");
    expect(css).toContain("grid-template-columns: 34px minmax(0, 1fr) 22px");
    expect(css).toContain(".member-more-menu-row > svg");
    expect(css).toContain(".member-more-menu-icon");
    expect(css).toContain(".member-more-menu-row.danger");
    expect(css).toContain(".member-cycle-position-icon");
    expect(css).toContain("grid-template-columns: 34px minmax(0, 1fr) auto");
    expect(css).not.toContain(".member-more-command-strip");
  });
});
