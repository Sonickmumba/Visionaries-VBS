import React, { useState } from "react";
import { ArrowLeft, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Field } from "../../components/ui/index.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { DevEmailLink } from "./DevEmailLink.jsx";
import {
  authActionsClass,
  authBackButtonClass,
  authCardClass,
  authEyebrowClass,
  authFormHeadClass,
  authIconClass,
  authMobileSummaryClass,
} from "./authTailwind.js";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupForm({ firstName, lastName, email, password, confirmPassword }) {
  const errors = {};
  if (!String(firstName || "").trim()) errors.firstName = "First name is required.";
  if (!String(lastName || "").trim()) errors.lastName = "Last name is required.";
  if (!String(email || "").trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(String(email).trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!String(password || "")) {
    errors.password = "Password is required.";
  } else if (String(password).length < 10) {
    errors.password = "Password must be at least 10 characters.";
  }
  if (!String(confirmPassword || "")) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export function signupPayload(form) {
  return {
    firstName: String(form.firstName || "").trim(),
    lastName: String(form.lastName || "").trim(),
    phone: String(form.phone || "").trim() || null,
    email: String(form.email || "").trim().toLowerCase(),
    password: form.password,
  };
}

export async function performSignup({ form, authApi = api }) {
  const errors = validateSignupForm(form);
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }
  return authApi("/auth/signup", {
    method: "POST",
    body: signupPayload(form),
  });
}

export function SignupPage({ onSignup, onBackToLogin, onBackToWelcome, authApi = api }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateSignupForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const session = await performSignup({ form, authApi });
      setSuccess(session);
    } catch (err) {
      setError(err.validationErrors ? "Check the highlighted fields." : err.message || "Signup failed.");
      if (err.validationErrors) setErrors(err.validationErrors);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <section className={authCardClass}>
          <div className={authFormHeadClass}>
            <span className={authIconClass}><UserPlus size={20} aria-hidden="true" /></span>
            <div>
              <span className={authEyebrowClass}>Check your email</span>
              <h2 className="mt-1 text-2xl font-extrabold text-charcoal">Account created</h2>
              <p className="mt-2 text-sm leading-6 text-charcoal/70">Verify your email before signing in.</p>
            </div>
          </div>
          <Alert tone="success" title="Verification email sent">
            We sent a verification link to {success.email || "your email"}. Open it to activate your account.
          </Alert>
          <DevEmailLink delivery={success.delivery} />
          <div className={authActionsClass}>
            <Button type="button" variant="secondary" onClick={onBackToLogin}>Back to Login</Button>
          </div>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className={authCardClass} onSubmit={submit} noValidate>
        {onBackToWelcome ? (
          <button type="button" className={authBackButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={authFormHeadClass}>
          <span className={authIconClass}><UserPlus size={20} aria-hidden="true" /></span>
          <div>
            <span className={authEyebrowClass}>Member access</span>
            <h2 className="mt-1 text-2xl font-extrabold text-charcoal">Create account</h2>
            <p className="mt-2 text-sm leading-6 text-charcoal/70">Create a secure member account for declarations, reports, statements, and cycle transparency.</p>
          </div>
        </div>

        <div className={authMobileSummaryClass} aria-label="Signup note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Use the same details your administrators have on record. This keeps enrollment smooth.</span>
        </div>

        <div className="form-grid two grid gap-3 sm:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={(value) => update("firstName", value)} autoComplete="given-name" error={errors.firstName} />
          <Field label="Last name" value={form.lastName} onChange={(value) => update("lastName", value)} autoComplete="family-name" error={errors.lastName} />
        </div>
        <Field label="Phone" value={form.phone} onChange={(value) => update("phone", value)} autoComplete="tel" placeholder="+260..." />
        <Field label="Email" value={form.email} onChange={(value) => update("email", value)} type="email" autoComplete="email" error={errors.email} />
        <Field
          label="Password"
          value={form.password}
          onChange={(value) => update("password", value)}
          type="password"
          autoComplete="new-password"
          hint="Use at least 10 characters."
          error={errors.password}
        />
        <Field
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(value) => update("confirmPassword", value)}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        {error ? <Alert tone="danger" title="Unable to create account">{error}</Alert> : null}

        <div className={authActionsClass}>
          <Button loading={loading} disabled={loading}>Create Account</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={onBackToLogin}>Back to Login</Button>
        </div>
      </form>
    </AuthLayout>
  );
}
