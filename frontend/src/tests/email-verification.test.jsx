import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmailVerificationPage, resendVerificationEmail, verifyEmailToken } from "../pages/auth/EmailVerificationPage.jsx";
import { AcceptInvitationPage, acceptInvitation, validateAcceptInviteForm } from "../pages/auth/AcceptInvitationPage.jsx";

describe("email verification and invitation screens", () => {
  it("calls verification and resend endpoints", async () => {
    const authApi = vi.fn().mockResolvedValue({ message: "ok" });

    await verifyEmailToken({ token: "verification-token-1234567890", authApi });
    await resendVerificationEmail({ email: "USER@Example.COM", authApi });

    expect(authApi).toHaveBeenNthCalledWith(1, "/auth/verify-email", {
      method: "POST",
      body: { token: "verification-token-1234567890" },
    });
    expect(authApi).toHaveBeenNthCalledWith(2, "/auth/resend-verification", {
      method: "POST",
      body: { email: "user@example.com" },
    });
  });

  it("renders verification screen states", () => {
    const html = renderToStaticMarkup(<EmailVerificationPage email="member@example.com" onBackToLogin={() => {}} />);

    expect(html).toContain("Verify your email");
    expect(html).toContain("Resend Email");
    expect(html).toContain("member@example.com");
  });

  it("validates and accepts invitations", async () => {
    expect(validateAcceptInviteForm({ password: "short", confirmPassword: "short" })).toMatchObject({
      password: "Password must be at least 10 characters.",
    });
    expect(validateAcceptInviteForm({ password: "Password123!", confirmPassword: "Different123!" })).toMatchObject({
      confirmPassword: "Passwords do not match.",
    });

    const authApi = vi.fn().mockResolvedValue({ user: { role: "MEMBER" } });
    await acceptInvitation({ token: "invite-token-1234567890", password: "Password123!", authApi });
    expect(authApi).toHaveBeenCalledWith("/auth/accept-invite", {
      method: "POST",
      body: { token: "invite-token-1234567890", password: "Password123!" },
    });
  });

  it("renders invitation password setup", () => {
    const html = renderToStaticMarkup(<AcceptInvitationPage token="invite-token-1234567890" onAccepted={() => {}} onBackToLogin={() => {}} />);

    expect(html).toContain("Set your password");
    expect(html).toContain("Accept Invitation");
    expect(html).toContain("Confirm password");
  });
});
