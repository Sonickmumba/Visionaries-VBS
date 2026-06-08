import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  contributionPayload,
  postOneTimeContribution,
  postSavingsDeposit,
  SavingsContributionPage,
  savingsDepositPayload,
  validateSavingsDeposit,
} from "../pages/admin/SavingsContributionPage.jsx";

const member = {
  cycle_member_id: "cycle-member-1",
  cycle_id: "cycle-1",
  member_id: "member-1",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
  savings_principal: "15000",
  savings_cap_remaining: "15000",
  social_fund_paid: false,
  membership_fee_paid: false,
};

const context = {
  cycle: {
    id: "cycle-1",
    name: "2026 Main Cycle",
    savings_cap: "30000",
    social_fund_amount: "240",
    membership_fee_amount: "80",
  },
  cycleMonth: { id: "month-1", month_number: 1, status: "OPEN" },
  members: [member],
};

describe("savings and contribution screens", () => {
  it("validates savings amount and remaining principal cap", () => {
    expect(validateSavingsDeposit({ amount: "", selectedMember: null })).toMatchObject({
      member: "Choose a member.",
      amount: "Enter a savings amount greater than zero.",
    });

    expect(validateSavingsDeposit({ amount: "16000", selectedMember: member })).toMatchObject({
      amount: "Savings cap exceeded. Remaining cap is K15,000.",
    });
  });

  it("normalizes savings and contribution payloads", () => {
    expect(savingsDepositPayload({ context, selectedMember: member, amount: "5000", notes: "cash received" })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cycle-member-1",
      amount: 5000,
      notes: "cash received",
    });

    expect(contributionPayload({ context, selectedMember: member, contributionType: "SOCIAL_FUND" })).toMatchObject({
      contributionType: "SOCIAL_FUND",
      amount: 240,
    });
    expect(contributionPayload({ context, selectedMember: member, contributionType: "MEMBERSHIP_FEE" })).toMatchObject({
      contributionType: "MEMBERSHIP_FEE",
      amount: 80,
    });
  });

  it("posts savings deposits to the backend endpoint", async () => {
    const savingsApi = vi.fn().mockResolvedValue({ data: { id: "ledger-1" } });

    await postSavingsDeposit({ context, selectedMember: member, amount: "5000", notes: "deposit", savingsApi });

    expect(savingsApi).toHaveBeenCalledWith("/savings/deposits", {
      method: "POST",
      body: expect.objectContaining({ amount: 5000, cycleMemberId: "cycle-member-1" }),
    });
  });

  it("posts one-time contributions and blocks duplicates locally", async () => {
    const savingsApi = vi.fn().mockResolvedValue({ data: { id: "contribution-1" } });

    await postOneTimeContribution({ context, selectedMember: member, contributionType: "MEMBERSHIP_FEE", savingsApi });
    await expect(postOneTimeContribution({
      context,
      selectedMember: { ...member, social_fund_paid: true },
      contributionType: "SOCIAL_FUND",
      savingsApi,
    })).rejects.toMatchObject({
      validationErrors: { contribution: "Social fund is already paid." },
    });

    expect(savingsApi).toHaveBeenCalledWith("/savings/contributions", {
      method: "POST",
      body: expect.objectContaining({ contributionType: "MEMBERSHIP_FEE", amount: 80 }),
    });
  });

  it("renders posting, member status, metrics, and actions", () => {
    const html = renderToStaticMarkup(<SavingsContributionPage initialContext={context} />);

    expect(html).toContain("Savings");
    expect(html).toContain("Refresh");
    expect(html).toContain("View Ledger");
    expect(html).toContain("Posting");
    expect(html).toContain("Member Status");
    expect(html).toContain("Post Savings");
    expect(html).toContain("Post Social Fund");
    expect(html).toContain("Post Membership Fee");
    expect(html).toContain("K15,000");
  });

  it("renders member savings ledger detail", () => {
    const html = renderToStaticMarkup(
      <SavingsContributionPage
        initialContext={context}
        initialDetail={{
          member,
          totals: {
            savings_principal: "15000",
            savings_interest: "2250",
            social_fund_paid: "240",
            membership_fee_paid: "80",
            savings_cap_remaining: "15000",
          },
          data: [{ id: "tx-1", posted_at: "2026-01-05", transaction_type: "SAVINGS_DEPOSIT", amount: "15000", description: "Savings deposit" }],
        }}
      />
    );

    expect(html).toContain("Ledger");
    expect(html).toContain("Savings Principal");
  });
});
