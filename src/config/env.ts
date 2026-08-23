import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '8080', 10),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  /** Base URL of admin app for reset link (e.g. https://admin.acousticsfx.com). Required for forgot-password email. */
  ADMIN_RESET_BASE_URL: process.env.ADMIN_RESET_BASE_URL ?? 'http://localhost:5173',
  /** Optional SMTP; if unset, reset link is logged to console only (dev). */
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  /** From address for reset emails */
  SMTP_FROM: process.env.SMTP_FROM ?? 'AcousticsFX Admin <noreply@acousticsfx.com>',
  /** Public website URL, used for links and images inside newsletter emails. */
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? 'https://acousticsfx.com',
  /** Public URL of this API, used to build the unsubscribe link. Must be reachable from an inbox. */
  PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? '8080'}`,
  /** Resend API key. When set, newsletters go out through Resend's batch API. */
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  /** From address for newsletters. Should be on an authenticated (SPF/DKIM) sending domain. */
  NEWSLETTER_FROM: process.env.NEWSLETTER_FROM ?? 'AcousticsFX <newsletter@acousticsfx.com>',
  /** Monitored mailbox for replies. A no-reply Reply-To hurts deliverability. */
  NEWSLETTER_REPLY_TO: process.env.NEWSLETTER_REPLY_TO ?? 'info@acousticsfx.com',
  /** Mailbox for mailto: unsubscribes, advertised in the List-Unsubscribe header. */
  NEWSLETTER_UNSUBSCRIBE_MAILBOX:
    process.env.NEWSLETTER_UNSUBSCRIBE_MAILBOX ?? 'unsubscribe@acousticsfx.com',
  /** RFC 2919 List-Id, so mail clients can group and filter the list. */
  NEWSLETTER_LIST_ID: process.env.NEWSLETTER_LIST_ID ?? 'AcousticsFX Newsletter <newsletter.acousticsfx.com>',
  /** Physical postal address shown in the footer. Required by CAN-SPAM, and its absence is a spam signal. */
  NEWSLETTER_POSTAL_ADDRESS: process.env.NEWSLETTER_POSTAL_ADDRESS ?? '',
  /** Secret for signing unsubscribe links. Falls back to JWT_SECRET so links never silently break. */
  UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ?? requireEnv('JWT_SECRET'),
  /** ImageKit (optional). If set, admin image uploads go to ImageKit. Supports IMAGEKIT_* or imagekit_* env vars. */
  IMAGEKIT_PRIVATE_KEY:
    process.env.IMAGEKIT_PRIVATE_KEY ?? process.env.imagekit_private_key,
  IMAGEKIT_PUBLIC_KEY:
    process.env.IMAGEKIT_PUBLIC_KEY ?? process.env.imagekit_public_key,
  IMAGEKIT_URL_ENDPOINT:
    process.env.IMAGEKIT_URL_ENDPOINT ?? process.env.imagekit_url_endpoint,
} as const;
