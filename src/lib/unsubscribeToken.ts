import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Unsubscribe links are signed rather than stored. A recipient who never opens the
 * email costs nothing, the link cannot be enumerated, and there is no token table
 * to expire or clean up. The signature covers the subscriber id alone, so a link
 * stays valid across campaigns — people unsubscribe from mail sent months ago.
 */
export function signUnsubscribeToken(subscriptionId: string): string {
  return createHmac('sha256', env.UNSUBSCRIBE_SECRET)
    .update(subscriptionId)
    .digest('base64url');
}

export function verifyUnsubscribeToken(subscriptionId: string, token: string): boolean {
  const expected = Buffer.from(signUnsubscribeToken(subscriptionId));
  const received = Buffer.from(token);
  // timingSafeEqual throws on a length mismatch, which is itself a safe early reject.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Absolute unsubscribe URL for a subscriber. Must be reachable from an inbox, not localhost, in production. */
export function buildUnsubscribeUrl(subscriptionId: string): string {
  const base = env.PUBLIC_API_URL.replace(/\/+$/, '');
  const token = signUnsubscribeToken(subscriptionId);
  return `${base}/api/newsletter/unsubscribe?id=${encodeURIComponent(subscriptionId)}&t=${token}`;
}
