import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  loadMemberPenaltyData,
  memberPenaltySummary,
  MemberPenaltiesPage,
} from "../pages/member/MemberPenaltiesPage.jsx";

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
    penalties: "300",
    penalties_paid: "100",
  },
};

const penalties = [
  {
    id: "pen-1",
    penalty_name: "Failure to Declare",
    penalty_code: "FAILURE_TO_DECLARE",
    month_number: 1,
    amount_assessed: "100",
    amount_paid: "40",
    outstanding_amount: "60",
    assessed_at: "2026-01-31T09:00:00.000Z",
    status: "PARTIALLY_PAID",
  },
  {
    id: "pen-2",
    penalty_name: "Late Payment",
    penalty_code: "LATE_PAYMENT",
    month_number: 2,
    amount_assessed: "200",
    amount_paid: "60",
    outstanding_amount: "140",
    assessed_at: "2026-02-28T09:00:00.000Z",
    status: "ASSESSED",
  },
];

const initialData = {
  me: { member: { first_name: "Mary", last_name: "Phiri" }, cycleMemberships: [membership] },
  activeMembership: membership,
  statement,
  penalties,
};

describe("member penalties screen", () => {
  it("loads member penalties for the active membership", async () => {
    const memberApi = vi.fn(async (path) => {
      if (path === "/auth/me") return initialData.me;
      if (path === "/reports/member-statement/cm-1") return { data: statement };
      if (path === "/penalties/member/cm-1") return { data: penalties };
      throw new Error(`Unexpected path: ${path}`);
    });

    const data = await loadMemberPenaltyData({ memberApi });

    expect(data.activeMembership).toBe(membership);
    expect(data.penalties).toHaveLength(2);
    expect(memberApi).toHaveBeenCalledWith("/penalties/member/cm-1");
  });

  it("normalizes penalty summary from penalty records and statement totals", () => {
    expect(memberPenaltySummary(initialData)).toMatchObject({
      assessed: 300,
      paid: 100,
      outstanding: 200,
      totalDue: 200,
      count: 2,
    });
  });

  it("renders mobile and desktop member penalty views", () => {
    const html = renderToStaticMarkup(<MemberPenaltiesPage initialData={initialData} setPage={() => {}} />);

    expect(html).toContain("My Penalties");
    expect(html).toContain("Member Penalties");
    expect(html).toContain("Penalty Due");
    expect(html).toContain("Penalty account summary");
    expect(html).toContain("Member penalty summary");
    expect(html).toContain("Penalty Breakdown");
    expect(html).toContain("Penalty Register");
    expect(html).toContain("Failure to Declare");
    expect(html).toContain("K200");
    expect(html).toContain("aria-label=\"Primary mobile navigation\"");
  });

  it("routes my-penalties to the dedicated member penalties page", () => {
    const appSource = fs.readFileSync(path.join(process.cwd(), "src/PortalApp.jsx"), "utf8");

    expect(appSource).toContain("MemberPenaltiesPage");
    expect(appSource).toContain("case \"my-penalties\"");
    expect(appSource).toContain("return <MemberPenaltiesPage setPage={setPage} />");
  });

  it("keeps the member penalties mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/member-penalties.css"), "utf8");

    expect(css).toContain(".member-penalties-hero");
    expect(css).toContain(".member-penalties-hero-actions");
    expect(css).toContain(".member-penalties-hero-strip");
    expect(css).toContain(".member-penalties-mobile");
    expect(css).toContain("@media (max-width: 767px)");
  });

  it("renders an empty state without active membership", () => {
    const html = renderToStaticMarkup(
      <MemberPenaltiesPage initialData={{ me: { member: null, cycleMemberships: [] }, activeMembership: null, penalties: [] }} />,
    );

    expect(html).toContain("No active cycle membership");
  });
});
