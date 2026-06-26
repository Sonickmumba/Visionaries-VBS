import { Resend } from "resend";
import { env } from "../config/env.js";

let resendClient = null;

function getClient() {
  if (!env.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export function verificationLink(token) {
  return `${env.frontendOrigin}/?verifyToken=${encodeURIComponent(token)}`;
}

export function invitationLink(token) {
  return `${env.frontendOrigin}/?inviteToken=${encodeURIComponent(token)}`;
}

async function sendEmail({ to, subject, html, text }) {
  const client = getClient();
  if (!client) {
    return { skipped: true, reason: "RESEND_API_KEY is not configured" };
  }
  const response = await client.emails.send({
    from: env.emailFrom,
    to,
    subject,
    html,
    text,
  });
  return { skipped: false, provider: "resend", response };
}

export async function sendVerificationEmail({ to, token, firstName = "" }) {
  const link = verificationLink(token);
  return sendEmail({
    to,
    subject: "Verify your Visionaries Village Banking email",
    text: `Hello${firstName ? ` ${firstName}` : ""}, verify your email here: ${link}`,
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
