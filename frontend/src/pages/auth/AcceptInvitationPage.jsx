import React, { useState } from "react";
import { KeyRound, UserCheck } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Field } from "../../components/ui/index.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { landingPageForRole } from "./LoginPage.jsx";
import "../../styles/auth.css";

export function validateAcceptInviteForm({ password, confirmPassword }) {
  const errors = {};
  if (!String(password || "")) errors.password = "Password is required.";
  else if (String(password).length < 10) errors.password = "Password must be at least 10 characters.";
  if (!String(confirmPassword || "")) errors.confirmPassword = "Confirm your password.";
  else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
  return errors;
}

export async function acceptInvitation({ token, password, authApi = api }) {
  return authApi("/auth/accept-invite", { method: "POST", body: { token, password } });
}

export function AcceptInvitationPage({ token = "", onAccepted, onBackToLogin, authApi = api }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateAcceptInviteForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      const response = await acceptInvitation({ token, password: form.password, authApi });
      onAccepted?.(response.user, landingPageForRole(response.user?.role));
    } catch (err) {
      setError(err.message || "Invitation could not be accepted.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card login-card" onSubmit={submit} noValidate>
        <div className="auth-form-head">
          <span className="auth-icon"><UserCheck size={20} aria-hidden="true" /></span>
          <div>
            <span className="auth-eyebrow">Account invitation</span>
            <h2>Set your password</h2>
            <p>Accept the invitation, verify your email, and create your own password.</p>
          </div>
        </div>

        {!token ? <Alert tone="danger" title="Missing invitation">This invitation link is missing a token.</Alert> : null}
        <Field label="Password" type="password" value={form.password} onChange={(value) => update("password", value)} error={errors.password} autoComplete="new-password" icon={KeyRound} />
        <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} error={errors.confirmPassword} autoComplete="new-password" />
        {error ? <Alert tone="danger" title="Unable to accept invitation">{error}</Alert> : null}

        <div className="button-row auth-actions">
          <Button loading={loading} disabled={loading || !token}>Accept Invitation</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={onBackToLogin}>Back to Login</Button>
        </div>
      </form>
    </AuthLayout>
  );
}
