import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';
import { isValidWebhookSignature } from '../lib/webhookSignature.js';
import { getNewsletterBounceCollection } from '../models/NewsletterBounce.js';
import { getNewsletterSubscriptionCollection } from '../models/NewsletterSubscription.js';

interface ResendEmailEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string; subType?: string; message?: string };
    tags?: Record<string, string> | { name: string; value: string }[];
  };
}

const normalize = (email: string): string => email.trim().toLowerCase();

/** Resend's webhook docs show tags as an object while its API returns a list, so accept both. */
function readTags(tags: NonNullable<ResendEmailEvent['data']>['tags']): Record<string, string> {
  if (Array.isArray(tags)) return Object.fromEntries(tags.map((t) => [t.name, t.value]));
  return tags ?? {};
}

/**
 * POST /api/webhooks/resend – bounce and spam reports from Resend.
 *
 * A permanent bounce stops future sends to that address, and a spam complaint counts as
 * an unsubscribe. Temporary bounces are only recorded, since those addresses still work.
 */
export async function resendEvent(req: Request, res: Response): Promise<void> {
  if (!env.RESEND_WEBHOOK_SECRET) {
    console.error('[webhook] Refused a Resend event: RESEND_WEBHOOK_SECRET is not set');
    res.status(503).json({ error: 'Webhook is not configured' });
    return;
  }

  const rawBody = req.body as unknown;
  const signed =
    Buffer.isBuffer(rawBody) &&
    isValidWebhookSignature(env.RESEND_WEBHOOK_SECRET, rawBody, {
      id: String(req.headers['svix-id'] ?? ''),
      timestamp: String(req.headers['svix-timestamp'] ?? ''),
      signature: String(req.headers['svix-signature'] ?? ''),
    });
  if (!signed) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const event = JSON.parse(rawBody.toString('utf8')) as ResendEmailEvent;

  try {
    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      await recordProblem(event, event.type === 'email.bounced' ? 'bounced' : 'complained');
    }
    // Other event types are acknowledged, or the provider would keep redelivering them.
    res.json({ ok: true });
  } catch (err) {
    // A failure status makes the provider redeliver, and recording is safe to repeat.
    console.error('[webhook] Failed to record a Resend event:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
}

async function recordProblem(event: ResendEmailEvent, kind: 'bounced' | 'complained'): Promise<void> {
  const emailId = event.data?.email_id;
  const email = event.data?.to?.[0];
  if (!emailId || !email) return;

  const tags = readTags(event.data?.tags);
  const taggedId = tags['subscription_id'];
  const subscriptions = getNewsletterSubscriptionCollection();
  const subscriber = await subscriptions.findOne(
    taggedId && ObjectId.isValid(taggedId)
      ? { _id: new ObjectId(taggedId) }
      : { email: { $in: [email, normalize(email)] } }
  );

  const bounce = event.data?.bounce;
  const permanent = kind === 'complained' || bounce?.type === 'Permanent';
  const reason =
    kind === 'complained'
      ? 'Marked as spam by the recipient'
      : bounce?.message ?? bounce?.subType ?? 'The receiving server rejected this message';

  await getNewsletterBounceCollection().updateOne(
    { _id: `${emailId}:${kind}` },
    {
      $setOnInsert: {
        kind,
        email,
        permanent,
        reason,
        occurredAt: new Date(event.created_at ?? Date.now()),
        ...(tags['campaign_id'] ? { campaignId: tags['campaign_id'] } : {}),
        ...(subscriber ? { subscriptionId: String(subscriber._id) } : {}),
      },
    },
    { upsert: true }
  );

  // A late report about an address that has since been corrected says nothing about the new one.
  if (!subscriber?._id || normalize(subscriber.email) !== normalize(email)) return;

  if (kind === 'complained') {
    await subscriptions.updateOne(
      { _id: subscriber._id, status: { $ne: 'unsubscribed' } },
      { $set: { status: 'unsubscribed', unsubscribedAt: new Date() } }
    );
  } else if (permanent) {
    // Someone who opted out stays opted out, even if their mailbox later disappears.
    await subscriptions.updateOne(
      { _id: subscriber._id, status: { $ne: 'unsubscribed' } },
      { $set: { status: 'bounced', bouncedAt: new Date(), bounceReason: reason } }
    );
  }
}
