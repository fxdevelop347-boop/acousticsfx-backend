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
  /** The provider's reason for the first failure, so it can be shown to whoever pressed send. */
  error?: string;
}

const RESEND_BATCH_ENDPOINT = 'https://api.resend.com/emails/batch';
/** Resend accepts at most 100 messages per batch call. */
export const NEWSLETTER_BATCH_SIZE = 100;
/** Resend allows two requests per second. */
const RESEND_REQUEST_GAP_MS = 600;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  if (res.ok) return { sent: messages.length, failed: [] };

  const detail = await res.text().catch(() => '');

  // One malformed address makes Resend reject the entire batch with a 422, so split
  // until it is isolated and the valid addresses still go out. Resend's own permissive
  // batch mode is not an option: it also accepts mail from an unverified sender, which
  // then sits queued forever while reporting success.
  if (res.status === 422 && messages.length > 1) {
    const middle = Math.ceil(messages.length / 2);
    const first = await sendViaResend(messages.slice(0, middle), apiKey);
    await sleep(RESEND_REQUEST_GAP_MS);
    const second = await sendViaResend(messages.slice(middle), apiKey);
    return {
      sent: first.sent + second.sent,
      failed: [...first.failed, ...second.failed],
      error: first.error ?? second.error,
    };
  }

  // Anything else is about the whole send (bad key, unverified sender, quota).
  console.error(`[mailer] Resend batch failed (${res.status}):`, detail.slice(0, 500));
  return {
    sent: 0,
    failed: messages.map((m) => m.to),
    error: resendErrorMessage(detail) ?? `Resend returned status ${res.status}`,
  };
}

function resendErrorMessage(detail: string): string | undefined {
  try {
    return (JSON.parse(detail) as { message?: string }).message;
  } catch {
    return undefined;
  }
}

async function sendViaSmtp(
  messages: OutgoingMessage[],
  trans: nodemailer.Transporter
): Promise<BatchResult> {
  const failed: string[] = [];
  let sent = 0;
  let error: string | undefined;
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
      error ??= err instanceof Error ? err.message : 'SMTP send failed';
    }
  }
  return { sent, failed, error };
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
