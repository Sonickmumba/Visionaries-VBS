import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  enrollMemberInCycle,
  MemberManagementPage,
  memberPayload,
  saveMemberForm,
  toggleMemberStatus,
  validateMemberForm,
} from "../pages/admin/MemberManagementPage.jsx";

const validForm = {
  firstName: "Mary",
  lastName: "Phiri",
  phone: "0977000000",
  email: "MARY@example.com",
  memberCode: "M001",
  nationalId: "NRC123",
  address: "Lusaka",
  temporaryPassword: "Password123!",
};

const member = {
  id: "member-1",
  first_name: "Mary",
  last_name: "Phiri",
  phone: "0977000000",
  email: "mary@example.com",
  member_code: "M001",
  national_id: "NRC123",
  address: "Lusaka",
  is_active: true,
  savings_principal: "15000",
  cumulative_borrowed: "20000",
  approved_declarations: 3,
  current_declaration_status: "APPROVED",
  created_at: "2026-01-01",
};

describe("member management", () => {
  it("validates required names, email format, and temporary password length", () => {
    const errors = validateMemberForm({
      ...validForm,
      firstName: "",
      lastName: "",
      email: "bad-email",
      temporaryPassword: "short",
    });

    expect(errors.firstName).toBe("First name is required.");
    expect(errors.lastName).toBe("Last name is required.");
    expect(errors.email).toBe("Enter a valid email address.");
    expect(errors.temporaryPassword).toBe("Temporary password must be at least 10 characters.");
  });

  it("normalizes member payloads for backend create and edit", () => {
    const createPayload = memberPayload({ ...validForm, firstName: " Mary ", phone: "" });
    const editPayload = memberPayload({ ...validForm }, { editing: true });

    expect(createPayload).toMatchObject({
      firstName: "Mary",
      email: "mary@example.com",
      phone: null,
      temporaryPassword: "Password123!",
    });
    expect(editPayload.temporaryPassword).toBeUndefined();
  });

  it("posts create requests and patches edit requests", async () => {
    const memberApi = vi.fn().mockResolvedValue({ data: member });

    await saveMemberForm({ form: validForm, memberApi });
    await saveMemberForm({ form: validForm, selectedMember: member, memberApi });

    expect(memberApi).toHaveBeenCalledWith("/members", {
      method: "POST",
      body: expect.objectContaining({ firstName: "Mary", temporaryPassword: "Password123!" }),
    });
    expect(memberApi).toHaveBeenCalledWith("/members/member-1", {
      method: "PATCH",
      body: expect.objectContaining({ firstName: "Mary" }),
    });
  });

  it("toggles active member status through the correct endpoint", async () => {
    const memberApi = vi.fn().mockResolvedValue({ data: member });

    await toggleMemberStatus({ member, memberApi });
    await toggleMemberStatus({ member: { ...member, is_active: false }, memberApi });

    expect(memberApi).toHaveBeenCalledWith("/members/member-1/deactivate", { method: "POST" });
    expect(memberApi).toHaveBeenCalledWith("/members/member-1/activate", { method: "POST" });
  });

  it("enrolls a member into a cycle and validates choices", async () => {
    const memberApi = vi.fn().mockResolvedValue({ data: { id: "cycle-member-1" } });

    await expect(enrollMemberInCycle({ memberApi })).rejects.toMatchObject({
      validationErrors: { memberId: "Choose a member.", cycleId: "Choose a cycle." },
    });

    await enrollMemberInCycle({ memberId: "member-1", cycleId: "cycle-1", memberApi });

    expect(memberApi).toHaveBeenCalledWith("/members/enroll", {
      method: "POST",
      body: { memberId: "member-1", cycleId: "cycle-1" },
    });
  });

  it("renders the member list, filters, actions, and metrics", () => {
    const html = renderToStaticMarkup(
      <MemberManagementPage
        initialMembers={[member]}
        initialCycles={[{ id: "cycle-1", name: "2026 Main Cycle", status: "ACTIVE" }]}
      />
    );

    expect(html).toContain("Members");
    expect(html).toContain("Member cards");
    expect(html).toContain("New Member");
    expect(html).toContain("Enroll Member");
    expect(html).toContain("Search members");
    expect(html).toContain("Mary Phiri");
    expect(html).toContain("Details");
    expect(html).toContain("Deactivate");
    expect(html).toContain("K15,000");
  });

  it("renders member detail tabs and statement data", () => {
    const html = renderToStaticMarkup(
      <MemberManagementPage
        initialMembers={[member]}
        initialCycles={[]}
        initialDetail={{
          data: member,
          cycleMemberships: [{ id: "cm-1", cycle_name: "2026 Main Cycle", status: "ACTIVE", joined_at: "2026-01-01", minimum_borrowing_amount: "20000" }],
          declarations: [{ id: "d-1", cycle_name: "2026 Main Cycle", month_number: 1, savings_amount: "15000", status: "APPROVED" }],
          transactions: [{ id: "tx-1", posted_at: "2026-01-04", transaction_type: "SAVINGS_DEPOSIT", amount: "15000", description: "Approved declaration" }],
          declarationStats: { approved: 1, awaitingReview: 0 },
        }}
      />
    );

    expect(html).toContain("Mary Phiri");
    expect(html).toContain("Member Profile");
    expect(html).toContain("Member profile summary");
    expect(html).toContain("Overview");
    expect(html).toContain("Cycles");
    expect(html).toContain("Declarations");
    expect(html).toContain("Statement");
    expect(html).toContain("Audit");
    expect(html).toContain("Savings Principal");
  });

  it("keeps member management mobile card styles responsive", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/members.css"), "utf8");

    expect(css).toContain(".member-mobile-cards");
    expect(css).toContain(".member-card");
    expect(css).toContain(".member-detail-hero");
    expect(css).toContain(".member-desktop-table");
    expect(css).toContain("@media (max-width: 767px)");
  });
});
