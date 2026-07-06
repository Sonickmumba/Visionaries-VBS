import React, { useEffect, useState } from "react";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button, Field } from "../../components/ui/index.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { DevEmailLink } from "./DevEmailLink.jsx";
import {
  authActionsClass,
  authCardClass,
  authEyebrowClass,
  authFormHeadClass,
  authIconClass,
} from "./authTailwind.js";
import "../../styles/auth.css";

export async function verifyEmailToken({ token, authApi = api }) {
  return authApi("/auth/verify-email", { method: "POST", body: { token } });
}

export async function resendVerificationEmail({ email, authApi = api }) {
  return authApi("/auth/resend-verification", { method: "POST", body: { email: String(email || "").trim().toLowerCase() } });
}

export function EmailVerificationPage({ token = "", email = "", onBackToLogin, authApi = api }) {
  const [status, setStatus] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState(email);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEmailToken({ token, authApi })
      .then((response) => {
        if (!active) return;
        setStatus("success");
        setMessage(response.message || "Email verified. You can now log in.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error.message || "Verification failed.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function resend(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setDelivery(null);
    try {
      const response = await resendVerificationEmail({ email: resendEmail, authApi });
      setStatus("sent");
      setMessage(response.message || "If the account needs verification, a new email has been sent.");
      setDelivery(response.delivery || null);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Could not resend verification email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <section className={authCardClass}>
        <div className={authFormHeadClass}>
          <span className={authIconClass}><MailCheck size={20} aria-hidden="true" /></span>
          <div>
            <span className={authEyebrowClass}>Email verification</span>
            <h2 className="mt-1 text-2xl font-extrabold text-charcoal">{status === "success" ? "Email verified" : "Verify your email"}</h2>
            <p className="mt-2 text-sm leading-6 text-charcoal/70">{token ? "We are checking your verification link." : "Enter your email to request a fresh verification link."}</p>
          </div>
        </div>

        {status === "verifying" ? <Alert title="Checking link">Please wait while we verify your email.</Alert> : null}
        {message ? <Alert tone={status === "success" || status === "sent" ? "success" : "danger"} title={status === "error" ? "Verification failed" : "Verification update"}>{message}</Alert> : null}
        <DevEmailLink delivery={delivery} />

        {status !== "success" ? (
          <form onSubmit={resend} className="auth-inline-form grid gap-3">
            <Field label="Email" type="email" value={resendEmail} onChange={setResendEmail} placeholder="name@example.com" />
            <Button icon={Send} loading={loading} disabled={loading || !resendEmail}>Resend Email</Button>
          </form>
        ) : null}

        <div className={authActionsClass}>
          <Button type="button" variant={status === "success" ? "primary" : "secondary"} icon={ArrowLeft} onClick={onBackToLogin}>Back to Login</Button>
        </div>
      </section>
    </AuthLayout>
  );
}
