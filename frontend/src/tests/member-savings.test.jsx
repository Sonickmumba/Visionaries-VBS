import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  loadMemberSavingsData,
  memberSavingsSummary,
  MemberSavingsPage,
} from "../pages/member/MemberSavingsPage.jsx";

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
    savings_principal: "15000",
    savings_interest: "2250",
  },
};

const savings = {
  member: { first_name: "Mary", last_name: "Phiri", member_code: "M001", savings_cap: "30000" },
  totals: {
    savings_principal: "15000",
    savings_interest: "2250",
    social_fund_paid: "240",
    membership_fee_paid: "80",
    savings_cap: "30000",
    savings_cap_remaining: "15000",
  },
  data: [
    {
      id: "tx-1",
      posted_at: "2026-01-31T09:00:00.000Z",
      transaction_type: "SAVINGS_DEPOSIT",
      amount: "15000",
      description: "Approved declaration savings deposit",
      reference: "SV-1",
    },
    {
      id: "tx-2",
      posted_at: "2026-01-31T09:05:00.000Z",
      transaction_type: "SAVINGS_INTEREST",
      amount: "2250",
      description: "Monthly savings interest",
      reference: "INT-1",
    },
  ],
};

const contributions = [
  {
    id: "cp-1",
    contribution_type: "SOCIAL_FUND",
    amount: "240",
    paid_at: "2026-01-10T09:00:00.000Z",
    status: "PAID",
  },
];

const initialData = {
  me: { member: { first_name: "Mary", last_name: "Phiri" }, cycleMemberships: [membership] },
  activeMembership: membership,
  statement,
  savings,
  contributions,
};

describe("member savings screen", () => {
  it("loads member savings ledger and contributions for the active membership", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return initialData.me;
      if (path === "/reports/member-statement/cm-1") return { data: statement };
      if (path === "/savings/member/cm-1") return savings;
      if (path === "/savings/contributions/member/cm-1") return { data: contributions };
      throw new Error(`Unexpected path: ${path}`);
    });

    const data = await loadMemberSavingsData({ memberApi });

    expect(data.activeMembership).toBe(membership);
    expect(data.savings.data).toHaveLength(2);
    expect(data.contributions).toHaveLength(1);
    expect(memberApi).toHaveBeenCalledWith("/savings/member/cm-1");
  });

  it("normalizes savings summary from ledger totals", () => {
    expect(memberSavingsSummary(initialData)).toMatchObject({
      savingsPrincipal: 15000,
      savingsInterest: 2250,
      accumulatedSavings: 17250,
      savingsCap: 30000,
      savingsCapRemaining: 15000,
      socialFundPaid: 240,
      membershipFeePaid: 80,
    });
  });

  it("renders mobile and desktop member savings views", () => {
    const html = renderToStaticMarkup(<MemberSavingsPage initialData={initialData} setPage={() => {}} />);

    expect(html).toContain("My Savings");
    expect(html).toContain("Member Savings");
    expect(html).toContain("My Accumulated Savings");
    expect(html).toContain("Member savings summary");
    expect(html).toContain("Savings Breakdown");
    expect(html).toContain("Savings Ledger");
    expect(html).toContain("One-Time Contributions");
    expect(html).toContain("Approved declaration savings deposit");
    expect(html).toContain("K17,250");
    expect(html).toContain("aria-label=\"Primary mobile navigation\"");
  });

  it("routes my-savings to the dedicated member savings page", () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), "src/PortalApp.jsx"), "utf8");

    expect(appSource).toContain("MemberSavingsPage");
    expect(appSource).toContain("case \"my-savings\"");
    expect(appSource).toContain("return <MemberSavingsPage setPage={setPage} />");
  });

  it("renders an empty state without active membership", () => {
    const html = renderToStaticMarkup(
      <MemberSavingsPage initialData={{ me: { member: null, cycleMemberships: [] }, activeMembership: null, savings: { data: [], totals: {} }, contributions: [] }} />,
    );

    expect(html).toContain("No active cycle membership");
  });
});
