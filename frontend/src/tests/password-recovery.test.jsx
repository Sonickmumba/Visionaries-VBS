import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  isInvalidResetTokenError,
  PasswordRecoveryPage,
  requestPasswordReset,
  resetPassword,
  validateForgotPasswordForm,
  validateResetPasswordForm,
} from "../pages/auth/PasswordRecoveryPage.jsx";

describe("password recovery screens", () => {
  it("validates forgot password email", () => {
    expect(validateForgotPasswordForm({ email: "" })).toEqual({ email: "Email is required." });
    expect(validateForgotPasswordForm({ email: "wrong" })).toEqual({ email: "Enter a valid email address." });
    expect(validateForgotPasswordForm({ email: "mary@example.com" })).toEqual({});
  });

  it("submits forgot password requests with normalized email", async () => {
    const authApi = vi.fn().mockResolvedValue({ message: "If the email exists, a reset link will be sent." });

    const response = await requestPasswordReset({ email: " MARY@example.COM ", authApi });

    expect(response.message).toContain("reset link");
    expect(authApi).toHaveBeenCalledWith("/auth/forgot-password", {
      method: "POST",
      body: { email: "mary@example.com" },
    });
  });

  it("validates reset password token and password confirmation", () => {
    expect(validateResetPasswordForm({ token: "", password: "", confirmPassword: "" })).toMatchObject({
      token: "Reset token is required.",
      password: "New password is required.",
      confirmPassword: "Confirm your new password.",
    });
    expect(validateResetPasswordForm({ token: "abc", password: "Password123!", confirmPassword: "Different123!" })).toEqual({
      confirmPassword: "Passwords do not match.",
    });
  });

  it("submits reset password requests", async () => {
    const authApi = vi.fn().mockResolvedValue({ message: "Password reset endpoint is scaffolded for email provider integration." });

    await resetPassword({ token: " token-1 ", password: "Password123!", confirmPassword: "Password123!", authApi });

    expect(authApi).toHaveBeenCalledWith("/auth/reset-password", {
      method: "POST",
      body: { token: "token-1", password: "Password123!" },
    });
  });

  it("detects invalid or expired token errors", () => {
    expect(isInvalidResetTokenError(new Error("Token expired"))).toBe(true);
    expect(isInvalidResetTokenError(new Error("Server unavailable"))).toBe(false);
  });

  it("renders forgot and reset states", () => {
    const forgot = renderToStaticMarkup(<PasswordRecoveryPage onBackToLogin={() => {}} />);
    const reset = renderToStaticMarkup(<PasswordRecoveryPage onBackToLogin={() => {}} initialMode="reset" />);

    expect(forgot).toContain("Reset access");
    expect(forgot).toContain("Account recovery");
    expect(forgot).toContain("We only send reset instructions to registered account emails.");
    expect(forgot).toContain("auth-mobile-summary");
    expect(forgot).toContain("Send Reset Link");
    expect(reset).toContain("Set new password");
    expect(reset).toContain("Reset token");
    expect(reset).toContain("Confirm new password");
  });
});
