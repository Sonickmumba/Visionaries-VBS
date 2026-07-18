import React from "react";
import fs from "node:fs";
import path from "node:path";
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
    const tailwindSource = fs.readFileSync(path.join(process.cwd(), "src/pages/auth/authTailwind.js"), "utf8");

    expect(form).toContain("Create Account");
    expect(form).toContain("Back to welcome");
    expect(form).toContain("Create member access");
    expect(form).toContain("desktop auth layout");
    expect(form).toContain("Join your community and start saving together.");
    expect(form).toContain("font-sans");
    expect(form).toContain("h-[100dvh]");
    expect(form).toContain("min-h-[100dvh]");
    expect(form).toContain("md:hidden");
    expect(form).toContain("max-[430px]:h-[100svh]");
    expect(form).toContain("max-[430px]:rounded-none");
    expect(form).toContain("max-[430px]:border-0");
    expect(form).toContain("max-h-[calc(100svh-220px)]");
    expect(form).toContain("overflow-y-auto");
    expect(form).toContain("focus-within:border-emerald");
    expect(form).toContain("font-extrabold leading-tight text-cream");
    expect(form).not.toContain("auth-phone");
    expect(form).not.toContain("auth-form-sheet");
    expect(form).toContain("First Name");
    expect(form).toContain("Last Name");
    expect(form).toContain("Phone Number");
    expect(form).not.toContain("Group Code (Optional)");
    expect(form).toContain("Confirm Password");
    expect(form).toContain("Terms &amp; Privacy Policy");
    expect(form).toContain("Log In");
    expect(form).not.toContain("Continue with Biometrics");

    expect(tailwindSource).toContain("signupPhoneClass");
    expect(tailwindSource).toContain("signupHeroClass");
    expect(tailwindSource).toContain("signupSheetClass");
    expect(tailwindSource).toContain("signupSuccessHeroClass");
    expect(tailwindSource).toContain("signupSuccessSheetClass");
    expect(tailwindSource).toContain("signupActionClass");
    expect(tailwindSource).toContain("md:hidden");
  });

  it("uses Tailwind utilities for signup frame, inputs, and actions", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/pages/auth/SignupPage.jsx"), "utf8");
    const tailwindSource = fs.readFileSync(path.join(process.cwd(), "src/pages/auth/authTailwind.js"), "utf8");

    expect(source).toContain("splashArtwork");
    expect(source).toContain("AuthDesktopShell");
    expect(source).toContain("signupDesktopFormClass");
    expect(source).toContain("signupDesktopFieldGridClass");
    expect(source).toContain("text-[clamp(21px,5.2vw,27px)]");
    expect(source).toContain("grid-cols-[34px_minmax(0,1fr)_auto]");
    expect(source).toContain("[@media(max-height:620px)]:min-h-8");
    expect(source).toContain("focus-within:border-emerald");

    expect(tailwindSource).toContain("after:absolute after:bottom-2.5");
    expect(tailwindSource).toContain("h-[100dvh]");
    expect(tailwindSource).toContain("sm:h-[min(900px,calc(100dvh-24px))]");
    expect(tailwindSource).toContain("max-[430px]:h-[100svh]");
    expect(tailwindSource).toContain("max-[430px]:rounded-none");
    expect(tailwindSource).toContain("overflow-y-auto");
    expect(tailwindSource).toContain("bg-gradient-to-br from-emerald to-forest");
  });
});
