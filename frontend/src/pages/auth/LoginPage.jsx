import React, { useState } from "react";
import { ArrowLeft, Lock, Mail, ShieldCheck } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Field } from "../../components/ui/index.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm({ email, password }) {
  const errors = {};
  if (!String(email || "").trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(String(email).trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!String(password || "").trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function landingPageForRole(role) {
  return role === "MEMBER" ? "member-dashboard" : "dashboard";
}

export function friendlyLoginError(error) {
  const message = String(error?.message || "");
  if (!message || message === "Request failed") return "Login failed. Check your email and password, then try again.";
  if (/invalid|unauthorized|password|credential/i.test(message)) {
    return "Invalid email or password.";
  }
  return message;
}

export async function performLogin({ email, password, authApi = api }) {
  const errors = validateLoginForm({ email, password });
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }

  return authApi("/auth/login", {
    method: "POST",
    body: {
      email: String(email).trim().toLowerCase(),
      password,
    },
  });
}

export function LoginPage({
  onLogin,
  onNavigateSignup,
  onNavigateForgot,
  onSignup,
  onForgotPassword,
  onBackToWelcome,
  authApi = api,
  initialEmail = "admin@example.com",
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigateSignup = onNavigateSignup || onSignup;
  const navigateForgot = onNavigateForgot || onForgotPassword;

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const session = await performLogin({ email, password, authApi });
      onLogin?.(session.user, landingPageForRole(session.user?.role), { rememberMe });
    } catch (err) {
      setError(err.validationErrors ? "Check the highlighted fields." : friendlyLoginError(err));
      if (err.validationErrors) setErrors(err.validationErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card login-card" onSubmit={submit} noValidate>
        {onBackToWelcome ? (
          <button type="button" className="auth-back-button" onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className="auth-form-head">
          <span className="auth-icon"><Lock size={20} aria-hidden="true" /></span>
          <div>
            <span className="auth-eyebrow">Welcome back</span>
            <h2>Log in</h2>
            <p>Use your account to access the correct portal.</p>
          </div>
        </div>

        <div className="auth-mobile-summary" aria-label="Secure portal">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Protected member and admin access</span>
        </div>

        <Field
          label="Email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (errors.email) setErrors((current) => ({ ...current, email: "" }));
          }}
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={errors.email}
          icon={Mail}
        />
        <Field
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (errors.password) setErrors((current) => ({ ...current, password: "" }));
          }}
          type="password"
          placeholder="Enter password"
          autoComplete="current-password"
          error={errors.password}
        />

        <div className="login-options">
          <label className="check-field">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me
          </label>
          <button type="button" className="link-button" onClick={navigateForgot}>Forgot password?</button>
        </div>

        {error ? <Alert tone="danger" title="Unable to log in">{error}</Alert> : null}

        <div className="button-row auth-actions">
          <Button loading={loading} disabled={loading}>Log In</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={navigateSignup}>Create Account</Button>
        </div>
      </form>
    </AuthLayout>
  );
}
