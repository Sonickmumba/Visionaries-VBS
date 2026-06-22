import React from "react";
import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  assessPenalty,
  convertPenaltyToLoan,
  payPenalty,
  penaltyAssessmentPayload,
  PenaltyScreensPage,
  reversePenaltyById,
  validatePenaltyAssessment,
  validatePenaltyPayment,
  waivePenaltyById,
} from "../pages/admin/PenaltyScreensPage.jsx";

const member = {
  cycle_member_id: "cycle-member-1",
  first_name: "Mary",
  last_name: "Phiri",
  member_code: "M001",
};

const context = {
  cycle: { id: "cycle-1", name: "2026 Main Cycle" },
  cycleMonth: { id: "month-1", month_number: 1 },
  members: [member],
};

const penaltyType = {
  id: "type-1",
  code: "FAILURE_TO_DECLARE",
  name: "Failure to declare",
  amount: "100",
  is_convertible_to_loan: true,
  is_active: true,
};

const penalty = {
  id: "penalty-1",
  cycle_id: "cycle-1",
  cycle_month_id: "month-1",
  cycle_member_id: "cycle-member-1",
  first_name: "Mary",
  last_name: "Phiri",
  penalty_name: "Failure to declare",
  amount_assessed: "100",
  amount_paid: "0",
  status: "ASSESSED",
  assessed_at: "2026-01-05",
};

describe("penalty screens", () => {
  it("validates and normalizes penalty assessments", () => {
    expect(validatePenaltyAssessment({ cycleMemberId: "", penaltyTypeId: "", amount: "-1" }, context)).toMatchObject({
      cycleMemberId: "Choose a member.",
      penaltyTypeId: "Choose a penalty type.",
      amount: "Penalty amount must be greater than zero.",
    });

    expect(penaltyAssessmentPayload({
      form: { cycleMemberId: "cycle-member-1", penaltyTypeId: "type-1", amount: "100", notes: "late" },
      context,
    })).toMatchObject({
      cycleId: "cycle-1",
      cycleMonthId: "month-1",
      cycleMemberId: "cycle-member-1",
      penaltyTypeId: "type-1",
      amount: 100,
    });
  });

  it("assesses penalties and posts payments", async () => {
    const penaltiesApi = vi.fn().mockResolvedValue({ data: {} });

    await assessPenalty({
      form: { cycleMemberId: "cycle-member-1", penaltyTypeId: "type-1", amount: "100", notes: "" },
      context,
      penaltiesApi,
    });
    await payPenalty({ penalty, amount: "40", penaltiesApi });

    expect(penaltiesApi).toHaveBeenCalledWith("/penalties", {
      method: "POST",
      body: expect.objectContaining({ amount: 100 }),
    });
    expect(penaltiesApi).toHaveBeenCalledWith("/penalties/penalty-1/pay", {
      method: "POST",
      body: { amount: 40 },
    });
  });

  it("validates penalty payments against outstanding balance", () => {
    expect(validatePenaltyPayment({ penalty, amount: "150" })).toMatchObject({
      paymentAmount: "Payment exceeds outstanding balance of K100.",
    });
  });

  it("converts, waives, and reverses penalties with reasons", async () => {
    const penaltiesApi = vi.fn().mockResolvedValue({ data: {} });

    await convertPenaltyToLoan({ penalty, reason: "Unpaid after deadline", penaltiesApi });
    await waivePenaltyById({ penalty, reason: "Admin waiver", penaltiesApi });
    await reversePenaltyById({ penalty, reason: "Wrong member", penaltiesApi });

    expect(penaltiesApi).toHaveBeenCalledWith("/penalties/penalty-1/convert-to-loan", {
      method: "POST",
      body: { reason: "Unpaid after deadline" },
    });
    expect(penaltiesApi).toHaveBeenCalledWith("/penalties/penalty-1/waive", {
      method: "POST",
      body: { reason: "Admin waiver" },
    });
    expect(penaltiesApi).toHaveBeenCalledWith("/penalties/penalty-1/reverse", {
      method: "POST",
      body: { reason: "Wrong member" },
    });
  });

  it("requires reasons for conversion, waiver, and reversal", async () => {
    await expect(convertPenaltyToLoan({ penalty, reason: "", penaltiesApi: vi.fn() })).rejects.toMatchObject({
      validationErrors: { conversionReason: "Conversion reason is required." },
    });
    await expect(waivePenaltyById({ penalty, reason: "", penaltiesApi: vi.fn() })).rejects.toMatchObject({
      validationErrors: { waiveReason: "Waive reason is required." },
    });
    await expect(reversePenaltyById({ penalty, reason: "", penaltiesApi: vi.fn() })).rejects.toMatchObject({
      validationErrors: { reverseReason: "Reverse reason is required." },
    });
  });

  it("renders penalty register, actions, metrics, and types tab", () => {
    const html = renderToStaticMarkup(
      <PenaltyScreensPage
        initialPenalties={[penalty]}
        initialContext={context}
        initialPenaltyTypes={[penaltyType]}
      />
    );

    expect(html).toContain("Penalties");
    expect(html).toContain("Penalty Desk");
    expect(html).toContain("Refresh");
    expect(html).toContain("Assess Penalty");
    expect(html).toContain("Penalty Register");
    expect(html).toContain("Penalty Types");
    expect(html).toContain("Mary Phiri");
    expect(html).toContain("Failure to declare");
    expect(html).toContain("K100");
    expect(html).toContain("View Details");
  });

  it("opens penalty detail in a modal instead of an inline register panel", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/admin/PenaltyScreensPage.jsx"), "utf8");

    expect(source).toContain('title="Penalty Details"');
    expect(source).toContain("penalty-detail-modal");
    expect(source).toContain("open={Boolean(selected)}");
  });

  it("keeps the penalty mobile responsive contract", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/penalties.css"), "utf8");

    expect(css).toContain(".penalty-hero");
    expect(css).toContain(".penalty-mobile-cards");
    expect(css).toContain(".penalty-card");
    expect(css).toContain(".penalty-detail-modal");
    expect(css).toContain("max-height: none");
    expect(css).toContain(".penalty-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
