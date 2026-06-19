import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { performSignup, SignupPage, signupPayload, validateSignupForm } from "../pages/auth/SignupPage.jsx";

const validForm = {
  firstName: "Mary",
  lastName: "Phiri",
  phone: "0977000000",
  email: "MARY@example.COM",
  password: "Password123!",
  confirmPassword: "Password123!",
};

describe("signup screen", () => {
  it("validates required fields and password confirmation", () => {
    expect(validateSignupForm({})).toMatchObject({
      firstName: "First name is required.",
      lastName: "Last name is required.",
      email: "Email is required.",
      password: "Password is required.",
      confirmPassword: "Confirm your password.",
    });
    expect(validateSignupForm({ ...validForm, confirmPassword: "Different123!" })).toMatchObject({
      confirmPassword: "Passwords do not match.",
    });
  });

  it("normalizes signup payload", () => {
    expect(signupPayload(validForm)).toEqual({
      firstName: "Mary",
      lastName: "Phiri",
      phone: "0977000000",
      email: "mary@example.com",
      password: "Password123!",
    });
  });

  it("submits valid signup requests", async () => {
    const authApi = vi.fn().mockResolvedValue({ user: { role: "MEMBER" } });

    const session = await performSignup({ form: validForm, authApi });

    expect(session.user.role).toBe("MEMBER");
    expect(authApi).toHaveBeenCalledWith("/auth/signup", {
      method: "POST",
      body: signupPayload(validForm),
    });
  });

  it("blocks invalid signup requests before API calls", async () => {
    const authApi = vi.fn();

    await expect(performSignup({ form: { ...validForm, password: "short" }, authApi })).rejects.toMatchObject({
      validationErrors: {
        password: "Password must be at least 10 characters.",
      },
    });
    expect(authApi).not.toHaveBeenCalled();
  });

  it("renders signup and success states", () => {
    const form = renderToStaticMarkup(<SignupPage onBackToLogin={() => {}} />);

    expect(form).toContain("Create account");
    expect(form).toContain("Member access");
    expect(form).toContain("Use the same details your administrators have on record.");
    expect(form).toContain("auth-mobile-summary");
    expect(form).toContain("First name");
    expect(form).toContain("Confirm password");
    expect(form).toContain("Back to Login");
  });
});
