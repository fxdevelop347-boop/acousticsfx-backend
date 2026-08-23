import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== null) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

/**
 * Send password reset email. If SMTP is not configured, logs the link and returns without error (dev).
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const trans = getTransporter();
  const text = `Reset your AcousticsFX admin password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `<!DOCTYPE html><html><body><p>Reset your AcousticsFX admin password:</p><p><a href="${resetLink}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p></body></html>`;

  if (!trans) {
    console.log('[mailer] SMTP not configured. Password reset link (dev):', resetLink);
    return;
  }

  await trans.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your AcousticsFX admin password',
    text,
    html,
  });
}

/** One fully-rendered message bound for a single recipient. Never a BCC list. */
export interface OutgoingMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export interface BatchResult {
  sent: number;
  failed: string[];
}

const RESEND_BATCH_ENDPOINT = 'https://api.resend.com/emails/batch';
/** Resend accepts at most 100 messages per batch call. */
export const NEWSLETTER_BATCH_SIZE = 100;

async function sendViaResend(messages: OutgoingMessage[], apiKey: string): Promise<BatchResult> {
  const payload = messages.map((m) => ({
    from: env.NEWSLETTER_FROM,
    to: [m.to],
    reply_to: env.NEWSLETTER_REPLY_TO,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.headers,
  }));

  const res = await fetch(RESEND_BATCH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Resend rejects or accepts a batch as a whole, so a non-2xx fails every address in it.
    const detail = await res.text().catch(() => '');
    console.error(`[mailer] Resend batch failed (${res.status}):`, detail.slice(0, 500));
    return { sent: 0, failed: messages.map((m) => m.to) };
  }

  return { sent: messages.length, failed: [] };
}

async function sendViaSmtp(
  messages: OutgoingMessage[],
  trans: nodemailer.Transporter
): Promise<BatchResult> {
  const failed: string[] = [];
  let sent = 0;
  // Sequential rather than parallel: SMTP relays rate-limit per connection, and a
  // burst of concurrent sends is exactly the pattern that gets a sender throttled.
  for (const m of messages) {
    try {
      await trans.sendMail({
        from: env.NEWSLETTER_FROM,
        replyTo: env.NEWSLETTER_REPLY_TO,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: m.headers,
      });
      sent += 1;
    } catch (err) {
      console.error(`[mailer] SMTP send to ${m.to} failed:`, err);
      failed.push(m.to);
    }
  }
  return { sent, failed };
}

/**
 * Sends one batch of newsletter messages, preferring Resend and falling back to the
 * SMTP transport already configured for password resets. With neither configured the
 * batch is logged and reported as sent, matching how the reset flow behaves in dev.
 */
export async function sendNewsletterBatch(messages: OutgoingMessage[]): Promise<BatchResult> {
  if (messages.length === 0) return { sent: 0, failed: [] };

  if (env.RESEND_API_KEY) {
    return sendViaResend(messages, env.RESEND_API_KEY);
  }

  const trans = getTransporter();
  if (trans) {
    return sendViaSmtp(messages, trans);
  }

  console.log(
    `[mailer] No RESEND_API_KEY or SMTP configured. Would have sent "${messages[0]?.subject}" to ${messages.length} recipient(s):`,
    messages.map((m) => m.to).join(', ')
  );
  return { sent: messages.length, failed: [] };
}
