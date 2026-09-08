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

const sendPasswordResetEmail = async (to, resetUrl) => {
  await sendEmail({
    to,
    subject: "Reset your FaceCheck-in password",
    htmlContent: `
      <p>You requested a password reset for your FaceCheck-in account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    `,
  });
};

export { sendEmail, sendPasswordResetEmail };