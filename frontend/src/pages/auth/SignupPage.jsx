import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone, UserRound, UsersRound, UserPlus } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button } from "../../components/ui/index.jsx";
import { BrandMark } from "../../components/BrandMark.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { DevEmailLink } from "./DevEmailLink.jsx";
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

function splitFullName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function AuthInput({ label, icon: Icon, error, action, ...props }) {
  return (
    <label className={`auth-input-shell ${error ? "has-error" : ""}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon size={23} aria-hidden="true" /> : null}
      <input aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
      {action}
      {error ? <small className="auth-input-error">{error}</small> : null}
    </label>
  );
}

export function SignupPage({ onSignup, onBackToLogin, onBackToWelcome, authApi = api }) {
  const [form, setForm] = useState({
    fullName: "",
    firstName: "",
    lastName: "",
    phone: "",
    groupCode: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    if (field === "fullName") {
      const names = splitFullName(value);
      setForm((current) => ({ ...current, fullName: value, ...names }));
      if (errors.firstName || errors.lastName) setErrors((current) => ({ ...current, firstName: "", lastName: "" }));
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateSignupForm(form);
    if (!acceptedTerms) nextErrors.terms = "Accept the terms and privacy policy.";
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
        <section className="auth-phone signup-phone auth-success-phone">
          <div className="auth-hero signup-hero compact">
            <BrandMark size="lg" className="auth-hero-mark text-cream" />
            <h1>Visionaries<br />Village Banking</h1>
          </div>
          <div className="auth-form-sheet auth-success-sheet">
            <div className="auth-form-head">
              <span className="auth-icon"><UserPlus size={20} aria-hidden="true" /></span>
              <div>
                <span className="auth-eyebrow">Check your email</span>
                <h2 className="mt-1 text-2xl font-extrabold text-charcoal">Account created</h2>
                <p className="mt-2 text-sm leading-6 text-charcoal/70">Verify your email before signing in.</p>
              </div>
            </div>
            <Alert tone="success" title="Verification email sent">
              We sent a verification link to {success.email || "your email"}. Open it to activate your account.
            </Alert>
            <DevEmailLink delivery={success.delivery} />
            <Button type="button" variant="secondary" onClick={onBackToLogin}>Back to Login</Button>
          </div>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-phone signup-phone" onSubmit={submit} noValidate>
        <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div>
        <div className="auth-orbit" aria-hidden="true" />
        {onBackToWelcome ? (
          <button type="button" className="auth-back-button" onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className="auth-hero signup-hero">
          <div className="signup-brand-row">
            <BrandMark size="lg" className="auth-hero-mark text-cream" />
            <div>
              <h1>Visionaries<br />Village Banking</h1>
              <p>Stronger Together. Saving Today, Building Tomorrow.</p>
            </div>
          </div>
          <div>
            <h2>Create Account</h2>
            <p>Join your community and start saving together.</p>
          </div>
        </div>

        <section className="auth-form-sheet signup-sheet" aria-label="Create account form">
          <AuthInput
            label="Full Name"
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
            placeholder="Full Name"
            error={errors.firstName || errors.lastName}
            icon={UserRound}
          />
          <AuthInput label="Phone Number" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" placeholder="Phone Number" icon={Smartphone} />
          <AuthInput label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="Email" error={errors.email} icon={Mail} />
          <AuthInput label="Group Code (Optional)" value={form.groupCode} onChange={(event) => update("groupCode", event.target.value)} placeholder="Group Code (Optional)" icon={UsersRound} />
          <AuthInput
            label="Password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password"
            error={errors.password}
            icon={Lock}
            action={(
              <button type="button" className="auth-input-action" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            )}
          />
          <AuthInput
            label="Confirm password"
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm Password"
            error={errors.confirmPassword}
            icon={Lock}
            action={(
              <button type="button" className="auth-input-action" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                {showConfirmPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            )}
          />

          <label className={`auth-terms ${errors.terms ? "has-error" : ""}`}>
            <input type="checkbox" checked={acceptedTerms} onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              if (errors.terms) setErrors((current) => ({ ...current, terms: "" }));
            }} />
            <span>I agree to the <strong>Terms &amp; Privacy Policy</strong></span>
          </label>
          {errors.terms ? <small className="auth-input-error standalone">{errors.terms}</small> : null}

          {error ? <Alert tone="danger" title="Unable to create account">{error}</Alert> : null}

          <button type="submit" className="auth-primary-action signup-action" disabled={loading} aria-busy={loading ? "true" : undefined}>
            <span className="auth-action-icon"><ArrowRight size={24} aria-hidden="true" /></span>
            <span>Create Account</span>
          </button>

          <p className="auth-switch-copy">Already have an account? <button type="button" disabled={loading} onClick={onBackToLogin}>Log In</button></p>
        </section>
        <div className="auth-village-scene signup-landscape" aria-hidden="true" />
      </form>
    </AuthLayout>
  );
}
