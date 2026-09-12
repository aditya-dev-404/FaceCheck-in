import { BrevoClient } from "@getbrevo/brevo";

import { env } from "../config/env.js";

const brevo = new BrevoClient({ apiKey: env.BREVO_API_KEY });

/**
 * Sends a transactional email via Brevo. Throws if Brevo rejects the
 * request (bad API key, unverified sender, etc.) — callers should decide
 * whether that should fail the whole request or just be logged.
 */
const sendEmail = async ({ to, subject, htmlContent }) => {
  await brevo.transactionalEmails.sendTransacEmail({
    sender: { email: env.SENDER_MAIL, name: "FaceCheck-in" },
    to: [{ email: to }],
    subject,
    htmlContent,
  });
};

const emailWrapper = (bodyContent) => `
  <div style="background-color:#EAF0E9; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:480px; margin:0 auto; background-color:#F3FBF5; border-radius:24px; padding:32px; box-shadow:0 4px 14px rgba(30,43,34,0.08);">
      <h2 style="color:#1E2B22; margin-top:0; font-size:20px;">FaceCheck-in</h2>
      ${bodyContent}
      <p style="color:#5B6C60; font-size:12px; margin-top:32px; margin-bottom:0;">
        This is an automated message from FaceCheck-in.
      </p>
    </div>
  </div>
`;

const emailButton = (href, label) => `
  <a href="${href}" style="display:inline-block; background-color:#3F7A52; color:#F3FBF5; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:bold; margin:16px 0;">
    ${label}
  </a>
`;

const sendPasswordResetEmail = async (to, resetUrl) => {
  await sendEmail({
    to,
    subject: "Reset your FaceCheck-in password",
    htmlContent: emailWrapper(`
      <p style="color:#1E2B22; font-size:15px;">You requested a password reset for your FaceCheck-in account.</p>
      ${emailButton(resetUrl, "Reset Password")}
      <p style="color:#5B6C60; font-size:13px;">This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    `),
  });
};

/**
 * Sent when an admin adds an EXISTING person (already has a FaceCheck-in
 * account elsewhere) to their organization. No password is included since
 * the person already has one — they just need to log in with their
 * existing credentials and accept the pending invite to activate it.
 */
const sendMemberInviteEmail = async (to, name, organizationName, loginUrl) => {
  await sendEmail({
    to,
    subject: `You've been invited to join ${organizationName} on FaceCheck-in`,
    htmlContent: emailWrapper(`
      <p style="color:#1E2B22; font-size:15px;">Hi ${name},</p>
      <p style="color:#1E2B22; font-size:15px;">An admin has added you as a member of <strong>${organizationName}</strong> on FaceCheck-in.</p>
      <p style="color:#1E2B22; font-size:15px;">Log in with your existing FaceCheck-in account and accept the invite to start marking attendance there — no need to enroll your face again.</p>
      ${emailButton(loginUrl, "Log In")}
      <p style="color:#5B6C60; font-size:13px;">If you weren't expecting this, you can safely ignore this email — the invite won't take effect until you accept it.</p>
    `),
  });
};

/**
 * Sent when an admin adds a brand-new person to their organization. No
 * password is created up front — this email lets them set their own on
 * first login, via a one-time token link (see setInitialPassword in
 * auth.service.js).
 */
const sendSetPasswordEmail = async (to, name, setPasswordUrl) => {
  await sendEmail({
    to,
    subject: "Set up your FaceCheck-in account",
    htmlContent: emailWrapper(`
      <p style="color:#1E2B22; font-size:15px;">Hi ${name},</p>
      <p style="color:#1E2B22; font-size:15px;">An admin has created a FaceCheck-in account for you at <strong>${to}</strong>.</p>
      <p style="color:#1E2B22; font-size:15px;">Set your password to get started:</p>
      ${emailButton(setPasswordUrl, "Set Password")}
      <p style="color:#5B6C60; font-size:13px;">This link expires in 24 hours. After setting your password and logging in, please enroll your face to start marking attendance.</p>
    `),
  });
};
export { sendEmail, sendPasswordResetEmail, sendSetPasswordEmail, sendMemberInviteEmail };