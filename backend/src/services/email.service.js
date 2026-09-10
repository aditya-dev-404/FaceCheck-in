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

const sendMemberWelcomeEmail = async (to, name, password, loginUrl) => {
  await sendEmail({
    to,
    subject: "Your FaceCheck-in account is ready",
    htmlContent: emailWrapper(`
      <p style="color:#1E2B22; font-size:15px;">Hi ${name},</p>
      <p style="color:#1E2B22; font-size:15px;">An admin has created a FaceCheck-in account for you. Here are your login details:</p>
      <div style="background-color:#E3ECE1; border-radius:12px; padding:16px; margin:16px 0; color:#1E2B22; font-size:14px;">
        <p style="margin:4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin:4px 0;"><strong>Password:</strong> ${password}</p>
      </div>
      ${emailButton(loginUrl, "Log In")}
      <p style="color:#5B6C60; font-size:13px;">After logging in, please enroll your face from your account to start marking attendance. We recommend changing your password after your first login.</p>
    `),
  });
};


export { sendEmail, sendPasswordResetEmail, sendMemberWelcomeEmail };