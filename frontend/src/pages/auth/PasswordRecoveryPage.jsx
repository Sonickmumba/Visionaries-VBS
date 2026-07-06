import React, { useState } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Field } from "../../components/ui/index.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
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

export function validateForgotPasswordForm({ email }) {
  const errors = {};
  if (!String(email || "").trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(String(email).trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

export function validateResetPasswordForm({ token, password, confirmPassword }) {
  const errors = {};
  if (!String(token || "").trim()) errors.token = "Reset token is required.";
  if (!String(password || "")) {
    errors.password = "New password is required.";
  } else if (String(password).length < 10) {
    errors.password = "Password must be at least 10 characters.";
  }
  if (!String(confirmPassword || "")) {
    errors.confirmPassword = "Confirm your new password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export function isInvalidResetTokenError(error) {
  return /token|expired|invalid/i.test(String(error?.message || ""));
}

export async function requestPasswordReset({ email, authApi = api }) {
  const errors = validateForgotPasswordForm({ email });
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }
  return authApi("/auth/forgot-password", {
    method: "POST",
    body: { email: String(email).trim().toLowerCase() },
  });
}

export async function resetPassword({ token, password, confirmPassword, authApi = api }) {
  const errors = validateResetPasswordForm({ token, password, confirmPassword });
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }
  return authApi("/auth/reset-password", {
    method: "POST",
    body: { token: String(token).trim(), password },
  });
}

export function PasswordRecoveryPage({
  onBackToLogin,
  onBackToWelcome,
  authApi = api,
  initialMode = "forgot",
  initialToken = "",
}) {
  const [mode, setMode] = useState(initialToken ? "reset" : initialMode);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitForgot(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = validateForgotPasswordForm({ email });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const response = await requestPasswordReset({ email, authApi });
      setSuccess(response.message || "If the email exists, a reset link will be sent.");
    } catch (err) {
      setError(err.validationErrors ? "Check the highlighted fields." : err.message || "Could not request a reset link.");
      if (err.validationErrors) setErrors(err.validationErrors);
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const nextErrors = validateResetPasswordForm({ token, password, confirmPassword });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const response = await resetPassword({ token, password, confirmPassword, authApi });
      setSuccess(response.message || "Your password has been reset.");
    } catch (err) {
      setError(isInvalidResetTokenError(err) ? "This reset link is invalid or expired. Request a new link." : err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className={authCardClass} onSubmit={mode === "forgot" ? submitForgot : submitReset} noValidate>
        {onBackToWelcome && !initialToken ? (
          <button type="button" className={authBackButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={authFormHeadClass}>
          <span className={authIconClass}><KeyRound size={20} aria-hidden="true" /></span>
          <div>
            <span className={authEyebrowClass}>Account recovery</span>
            <h2 className="mt-1 text-2xl font-extrabold text-charcoal">{mode === "forgot" ? "Reset access" : "Set new password"}</h2>
            <p className="mt-2 text-sm leading-6 text-charcoal/70">{mode === "forgot" ? "Request a reset link for your account email." : "Enter your reset token and new password."}</p>
          </div>
        </div>

        <div className={authMobileSummaryClass} aria-label="Recovery security note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{mode === "forgot" ? "We only send reset instructions to registered account emails." : "Choose a password with at least 10 characters."}</span>
        </div>

        {mode === "forgot" ? (
          <Field
            label="Email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              if (errors.email) setErrors((current) => ({ ...current, email: "" }));
            }}
            type="email"
            autoComplete="email"
            error={errors.email}
          />
        ) : (
          <>
            <Field label="Reset token" value={token} onChange={setToken} error={errors.token} />
            <Field label="New password" type="password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" />
            <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} autoComplete="new-password" />
          </>
        )}

        {success ? <Alert tone="success" title="Request complete">{success}</Alert> : null}
        {error ? <Alert tone="danger" title={mode === "reset" ? "Invalid reset" : "Unable to send reset"}>{error}</Alert> : null}

        <div className={authActionsClass}>
          <Button loading={loading} disabled={loading}>{mode === "forgot" ? "Send Reset Link" : "Reset Password"}</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={onBackToLogin}>Back to Login</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => { setMode(mode === "forgot" ? "reset" : "forgot"); setError(""); setSuccess(""); setErrors({}); }}>
            {mode === "forgot" ? "I Have a Token" : "Request New Link"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
