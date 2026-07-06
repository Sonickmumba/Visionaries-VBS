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
    const authApi = vi.fn().mockResolvedValue({ emailVerificationRequired: true, email: "mary@example.com" });

    const response = await performSignup({ form: validForm, authApi });

    expect(response.emailVerificationRequired).toBe(true);
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
    const form = renderToStaticMarkup(<SignupPage onBackToLogin={() => {}} onBackToWelcome={() => {}} />);

    expect(form).toContain("Create Account");
    expect(form).toContain("Back to welcome");
    expect(form).toContain("Join your community and start saving together.");
    expect(form).toContain("auth-phone");
    expect(form).toContain("auth-form-sheet");
    expect(form).toContain("Full Name");
    expect(form).toContain("Phone Number");
    expect(form).toContain("Group Code (Optional)");
    expect(form).toContain("Confirm Password");
    expect(form).toContain("Terms &amp; Privacy Policy");
    expect(form).toContain("Log In");
    expect(form).not.toContain("Continue with Biometrics");
  });
});
