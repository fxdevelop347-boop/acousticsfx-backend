import { createHmac, timingSafeEqual } from 'node:crypto';

/** Older than this and a correctly signed request is treated as a replay. */
const MAX_AGE_SECONDS = 5 * 60;

export interface SignatureHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Checks a request signed the way Resend signs webhooks (the Svix scheme): an HMAC-SHA256
 * of `id.timestamp.body`, keyed with the secret after its `whsec_` prefix is base64-decoded.
 * The header can list several space-separated signatures while a secret is being rotated.
 */
export function isValidWebhookSignature(
  secret: string,
  rawBody: Buffer,
  { id, timestamp, signature }: SignatureHeaders
): boolean {
  const sentAt = Number(timestamp);
  if (!id || !Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > MAX_AGE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(rawBody).digest();

  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const received = Buffer.from(value, 'base64');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
