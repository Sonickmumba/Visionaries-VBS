import { Resend } from "resend";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

let resendClient = null;

function getClient() {
  if (!env.resendApiKey) return null;
  if (env.nodeEnv === "test" && process.env.RESEND_ENABLE_TEST_DELIVERY !== "true") return null;
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export function verificationLink(token) {
  return `${env.frontendOrigin}/?verifyToken=${encodeURIComponent(token)}`;
}

export function invitationLink(token) {
  return `${env.frontendOrigin}/?inviteToken=${encodeURIComponent(token)}`;
}

function devFallbackDelivery({ to, subject, link, reason }) {
  if (!env.emailDevFallback || env.nodeEnv === "production") return null;
  const delivery = {
    skipped: true,
    devFallback: true,
    provider: "resend",
    reason,
    to,
    subject,
    link,
  };
  console.warn(`[email:dev-fallback] ${subject} for ${to}: ${link}`);
  console.warn(`[email:dev-fallback] Reason: ${reason}`);
  return delivery;
}

function providerError(responseError) {
  const providerStatus = Number(responseError.statusCode || responseError.status || 502);
  const status = providerStatus >= 500 ? 502 : 400;
  const message = responseError.message || "The email provider rejected the message.";
  return new HttpError(status, `Email provider rejected the message: ${message}`, {
    provider: "resend",
    code: responseError.name || responseError.code || null,
    providerStatus,
  });
}

async function sendEmail({ to, subject, html, text, devLink = null }) {
  const client = getClient();
  if (!client) {
    return { skipped: true, reason: "RESEND_API_KEY is not configured" };
  }
  let response;
  try {
    response = await client.emails.send({
      from: env.emailFrom,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    const fallback = devFallbackDelivery({
      to,
      subject,
      link: devLink,
      reason: error.message || "Email provider request failed.",
    });
    if (fallback) return fallback;
    throw error;
  }
  if (response?.error) {
    const error = providerError(response.error);
    const fallback = devFallbackDelivery({
      to,
      subject,
      link: devLink,
      reason: error.message,
    });
    if (fallback) return fallback;
    throw error;
  }
  return { skipped: false, provider: "resend", response };
}

export async function sendVerificationEmail({ to, token, firstName = "" }) {
  const link = verificationLink(token);
  return sendEmail({
    to,
    subject: "Verify your Visionaries Village Banking email",
    text: `Hello${firstName ? ` ${firstName}` : ""}, verify your email here: ${link}`,
    devLink: link,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#172033">
        <h2>Verify your email</h2>
        <p>Hello${firstName ? ` ${firstName}` : ""}, confirm this email address to activate your Visionaries Village Banking account.</p>
        <p><a href="${link}" style="display:inline-block;background:#007a3d;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none">Verify Email</a></p>
        <p>This link expires soon. If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendInvitationEmail({ to, token, role }) {
  const link = invitationLink(token);
  return sendEmail({
    to,
    subject: "You are invited to Visionaries Village Banking",
    text: `You have been invited as ${role}. Accept the invitation and set your password here: ${link}`,
    devLink: link,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#172033">
        <h2>Account invitation</h2>
        <p>You have been invited to Visionaries Village Banking as <strong>${role}</strong>.</p>
        <p><a href="${link}" style="display:inline-block;background:#007a3d;color:#fff;padding:12px 16px;border-radius:6px;text-decoration:none">Accept Invitation</a></p>
        <p>This link verifies your email and lets you set your own password.</p>
      </div>
    `,
  });
}

export async function sendAdminMfaEmail({ to, code }) {
  return sendEmail({
    to,
    subject: "Visionaries Village Banking admin sign-in code",
    text: `Your admin sign-in code is ${code}. It expires soon. If you did not request it, contact the system owner immediately.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#172033">
        <h2>Admin sign-in code</h2>
        <p>Use this code to finish signing in to Visionaries Village Banking:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#007a3d">${code}</p>
        <p>This code expires soon. If you did not request it, contact the system owner immediately.</p>
      </div>
    `,
  });
}
