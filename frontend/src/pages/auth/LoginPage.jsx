import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, ShieldCheck, UserRound } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert } from "../../components/ui/index.jsx";
import { BrandMark } from "../../components/BrandMark.jsx";
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

function AuthInput({ label, icon: Icon, error, action, ...props }) {
  return (
    <label className={`auth-input-shell ${error ? "has-error" : ""}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon size={24} aria-hidden="true" /> : null}
      <input aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
      {action}
      {error ? <small className="auth-input-error">{error}</small> : null}
    </label>
  );
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
  const rememberMe = true;
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigateSignup = onNavigateSignup || onSignup;
  const navigateForgot = onNavigateForgot || onForgotPassword;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (mfaRequired) {
      if (!/^\d{6}$/.test(mfaCode.trim())) {
        setError("Enter the 6-digit admin verification code.");
        return;
      }
      setLoading(true);
      try {
        const session = await authApi("/auth/mfa/verify", { method: "POST", body: { code: mfaCode.trim() } });
        onLogin?.(session.user, landingPageForRole(session.user?.role), { rememberMe });
      } catch (err) {
        setError(friendlyLoginError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const session = await performLogin({ email, password, authApi });
      if (session.mfaRequired) {
        setMfaRequired(true);
        setPassword("");
        setError("");
        return;
      }
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
      <form className="auth-phone login-phone" onSubmit={submit} noValidate>
        <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div>
        <div className="auth-orbit" aria-hidden="true" />
        {onBackToWelcome ? (
          <button type="button" className="auth-back-button" onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className="auth-hero login-hero">
          <BrandMark size="lg" className="auth-hero-mark text-cream" />
          <h1 className="login-title">Village Banking</h1>
          <span className="auth-gold-rule" aria-hidden="true" />
          <h2>Welcome Back</h2>
          <p>Sign in to continue saving and growing together.</p>
        </div>

        <section className="auth-form-sheet login-sheet" aria-label="Log in form">
        <AuthInput
          label="Email"
          value={email}
          onChange={(value) => {
            setEmail(value.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: "" }));
          }}
          type="email"
          placeholder="Phone Number or Email"
          autoComplete="email"
          error={errors.email}
          icon={UserRound}
        />

        {mfaRequired ? (
          <AuthInput
            label="Admin verification code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            type="text"
            placeholder="6-digit code"
            autoComplete="one-time-code"
            icon={ShieldCheck}
          />
        ) : (
          <AuthInput
            label="Password"
            value={password}
            onChange={(value) => {
              setPassword(value.target.value);
              if (errors.password) setErrors((current) => ({ ...current, password: "" }));
            }}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            error={errors.password}
            icon={Lock}
            action={(
              <button type="button" className="auth-input-action" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
              </button>
            )}
          />
        )}

        {!mfaRequired ? (
          <div className="login-options">
            <button type="button" className="link-button" onClick={navigateForgot}>Forgot password?</button>
          </div>
        ) : null}

        {error ? <Alert tone="danger" title="Unable to log in">{error}</Alert> : null}

          <button type="submit" className="auth-primary-action" disabled={loading} aria-busy={loading ? "true" : undefined}>
            <span>{mfaRequired ? "Verify Code" : "Log In"}</span>
            <ArrowRight size={26} aria-hidden="true" />
          </button>

          <p className="auth-switch-copy">Don't have an account? <button type="button" disabled={loading} onClick={navigateSignup}>Sign Up</button></p>
        </section>
      </form>
    </AuthLayout>
  );
}
