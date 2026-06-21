import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  friendlyLoginError,
  landingPageForRole,
  LoginPage,
  performLogin,
  validateLoginForm,
} from "../pages/auth/LoginPage.jsx";

describe("login screen", () => {
  it("validates required and malformed fields", () => {
    expect(validateLoginForm({ email: "", password: "" })).toEqual({
      email: "Email is required.",
      password: "Password is required.",
    });
    expect(validateLoginForm({ email: "bad-email", password: "secret" })).toEqual({
      email: "Enter a valid email address.",
    });
  });

  it("normalizes login submit payload and returns the session", async () => {
    const authApi = vi.fn().mockResolvedValue({
      user: { role: "ADMIN" },
    });

    const session = await performLogin({
      email: " ADMIN@Example.COM ",
      password: "password123",
      authApi,
    });

    expect(session.user.role).toBe("ADMIN");
    expect(authApi).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { email: "admin@example.com", password: "password123" },
    });
  });

  it("blocks submit when validation fails", async () => {
    const authApi = vi.fn();

    await expect(performLogin({ email: "", password: "", authApi })).rejects.toMatchObject({
      validationErrors: {
        email: "Email is required.",
        password: "Password is required.",
      },
    });
    expect(authApi).not.toHaveBeenCalled();
  });

  it("maps roles to landing pages", () => {
    expect(landingPageForRole("ADMIN")).toBe("dashboard");
    expect(landingPageForRole("AUDITOR")).toBe("dashboard");
    expect(landingPageForRole("MEMBER")).toBe("member-dashboard");
  });

  it("formats friendly invalid-login errors", () => {
    expect(friendlyLoginError(new Error("Invalid credentials"))).toBe("Invalid email or password.");
    expect(friendlyLoginError(new Error("Request failed"))).toBe("Login failed. Check your email and password, then try again.");
  });

  it("renders the complete login form", () => {
    const html = renderToStaticMarkup(<LoginPage onLogin={() => {}} onBackToWelcome={() => {}} />);

    expect(html).toContain("Log in");
    expect(html).toContain("Back to welcome");
    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain("Remember me");
    expect(html).toContain("Forgot password?");
    expect(html).toContain("Create Account");
    expect(html).toContain("auth-shell");
    expect(html).toContain("Welcome back");
    expect(html).toContain("Protected member and admin access");
    expect(html).toContain("auth-mobile-summary");
    expect(html).toContain("Platform highlights");
  });

  it("supports current and legacy navigation callback names", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/auth/LoginPage.jsx"), "utf8");

    expect(source).toContain("const navigateSignup = onNavigateSignup || onSignup");
    expect(source).toContain("const navigateForgot = onNavigateForgot || onForgotPassword");
  });

  it("keeps phone auth screens compact enough for primary actions", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/auth.css"), "utf8");

    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".auth-brand-stats");
    expect(css).toContain("display: none");
    expect(css).toContain("margin-top: -48px");
    expect(css).toContain(".login-card");
  });
});
