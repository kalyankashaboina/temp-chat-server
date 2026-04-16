import nodemailer from 'nodemailer';

import { env } from '../../config/env';
import { logger } from '../logger';

// ── Transporter ───────────────────────────────────────────────────────

function createTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    // Dev fallback: log to console instead of sending
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transporter = createTransporter();

// ── HTML Email Templates ──────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relay Chat</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #1a1a2e; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; color: #e2e8f0; }
    .body p { line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #6366f1; color: #fff !important; text-decoration: none;
           padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .code { background: #0f0f1a; border: 1px solid #2d2d4a; border-radius: 8px; padding: 16px;
            font-family: monospace; font-size: 22px; letter-spacing: 4px; text-align: center;
            color: #6366f1; margin: 16px 0; }
    .footer { padding: 24px 32px; border-top: 1px solid #2d2d4a; font-size: 12px; color: #64748b; text-align: center; }
    .warning { background: #1e1b2e; border-left: 4px solid #f59e0b; padding: 12px 16px;
               border-radius: 4px; font-size: 13px; color: #fbbf24; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1> Relay Chat</h1>
      <p>Real-time messaging</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © ${new Date().getFullYear()} Relay Chat by Kalyan Kashaboina<br>
      If you didn't request this, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;
}

// ── Send Helpers ──────────────────────────────────────────────────────

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    // Dev mode: log to console
    logger.info('[EMAIL DEV] Would send email', { to, subject, html: html.slice(0, 200) });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Relay Chat" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
    logger.info('[EMAIL] Sent', { to, subject });
  } catch (err) {
    logger.error('[EMAIL] Failed to send', { to, subject, error: err });
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────

export const emailService = {
  /** Send password reset link */
  sendPasswordReset: async (to: string, token: string, username: string): Promise<void> => {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = baseTemplate(`
      <p>Hi <strong>${username}</strong>,</p>
      <p>You requested a password reset for your Relay Chat account.</p>
      <p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
      <a href="${resetUrl}" class="btn">Reset My Password</a>
      <div class="warning">WARNING - If you didn't request this, please ignore this email. Your password won't change.</div>
    `);
    await sendMail(to, 'Reset your Relay Chat password', html);
  },

  /** Send email verification */
  sendEmailVerification: async (to: string, token: string, username: string): Promise<void> => {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = baseTemplate(`
      <p>Hi <strong>${username}</strong>,</p>
      <p>Welcome to Relay Chat! Please verify your email address to get started.</p>
      <a href="${verifyUrl}" class="btn">Verify Email</a>
    `);
    await sendMail(to, 'Verify your Relay Chat email', html);
  },

  /** Send welcome email */
  sendWelcome: async (to: string, username: string): Promise<void> => {
    const html = baseTemplate(`
      <p>Hi <strong>${username}</strong>,</p>
      <p>Welcome to Relay Chat! Your account is ready.</p>
      <p>Start chatting with your friends and colleagues in real-time.</p>
      <a href="${env.FRONTEND_URL}" class="btn">Open Relay Chat</a>
    `);
    await sendMail(to, 'Welcome to Relay Chat!', html);
  },
};
