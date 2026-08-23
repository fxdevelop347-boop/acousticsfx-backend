import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getNewsletterSubscriptionCollection } from '../models/NewsletterSubscription.js';
import { getNewsletterCampaignCollection } from '../models/NewsletterCampaign.js';
import { sanitizeNewsletterHtml } from '../lib/sanitizeHtml.js';
import { buildNewsletterMessage } from '../lib/newsletterEmail.js';
import { buildUnsubscribeUrl, verifyUnsubscribeToken } from '../lib/unsubscribeToken.js';
import { sendNewsletterBatch, NEWSLETTER_BATCH_SIZE, type OutgoingMessage } from '../lib/mailer.js';
import { env } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Guard against an accidental send to a list far larger than this app is built to handle in one request. */
const MAX_RECIPIENTS = 5000;
/** Breather between batches. Providers treat an unbroken burst as a reputation signal. */
const BATCH_PAUSE_MS = 500;
/** Only unsubscribed addresses are excluded; rows predating the status field have none. */
const ACTIVE_FILTER = { status: { $ne: 'unsubscribed' } } as const;

/** POST /api/newsletter – public; store newsletter email */
export async function submit(req: Request, res: Response): Promise<void> {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }

    // Upsert rather than insert: a repeat signup previously created a duplicate row,
    // and duplicate rows mean the same person gets the same campaign twice — the
    // fastest way to earn a spam complaint. Re-subscribing also clears an opt-out.
    const coll = getNewsletterSubscriptionCollection();
    await coll.updateOne(
      { email },
      {
        $setOnInsert: { email, createdAt: new Date() },
        $set: { status: 'active' as const },
        $unset: { unsubscribedAt: '' },
      },
      { upsert: true }
    );
    res.status(201).json({ ok: true, message: 'Thanks for subscribing.' });
  } catch (err) {
    console.error('Newsletter submit error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
}

/** GET /api/admin/newsletter-subscriptions – paginated list (admin only). Requires CONTENT_READ. */
export async function list(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const coll = getNewsletterSubscriptionCollection();
    const [items, total, activeTotal] = await Promise.all([
      coll
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project<{
          _id: import('mongodb').ObjectId;
          email: string;
          createdAt: Date;
          status?: string;
        }>({ _id: 1, email: 1, createdAt: 1, status: 1 })
        .toArray(),
      coll.countDocuments(),
      coll.countDocuments(ACTIVE_FILTER),
    ]);

    res.json({
      items: items.map((d) => ({
        _id: String(d._id),
        email: d.email,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        // Absent status means the row predates opt-out tracking, which is an active subscriber.
        status: d.status ?? 'active',
      })),
      total,
      activeTotal,
      limit,
      skip,
    });
  } catch (err) {
    console.error('Newsletter list error:', err);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
}

/** DELETE /api/admin/newsletter-subscriptions/:id */
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await getNewsletterSubscriptionCollection().deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Newsletter delete error:', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
}

/**
 * POST /api/admin/newsletter-subscriptions/bulk-delete
 * Body: { ids: string[] }. Used by the "Delete selected" action.
 */
export async function removeMany(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req.body as { ids?: unknown })?.ids;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' });
      return;
    }
    const ids = raw
      .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (ids.length === 0) {
      res.status(400).json({ error: 'No valid ids provided' });
      return;
    }
    const result = await getNewsletterSubscriptionCollection().deleteMany({
      _id: { $in: ids },
    });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Newsletter bulk delete error:', err);
    res.status(500).json({ error: 'Failed to delete subscriptions' });
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Minimal styled page for the unsubscribe link, which is opened in a browser rather than fetched. */
function unsubscribePage(heading: string, detail: string): string {
  const site = env.PUBLIC_SITE_URL.replace(/\/+$/, '');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${heading}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;color:#111827;">
<div style="max-width:480px;margin:80px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
<h1 style="margin:0 0 12px;font-size:20px;">${heading}</h1>
<p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">${detail}</p>
<a href="${site}" style="color:#2563eb;text-decoration:none;">Return to acousticsfx.com</a>
</div></body></html>`;
}

/**
 * Marks a subscriber as opted out. Shared by the browser link and the one-click POST
 * that Gmail and Yahoo fire from their own unsubscribe button.
 *
 * An unknown or badly signed token is treated as a no-op success rather than an error:
 * the alternative is a recipient who tried to leave, saw a failure page, and reported
 * the mail as spam instead. Nothing is leaked either way, since the response is identical.
 */
async function applyUnsubscribe(req: Request): Promise<boolean> {
  const id = typeof req.query['id'] === 'string' ? req.query['id'] : '';
  const token = typeof req.query['t'] === 'string' ? req.query['t'] : '';
  if (!id || !token || !ObjectId.isValid(id) || !verifyUnsubscribeToken(id, token)) {
    return false;
  }
  await getNewsletterSubscriptionCollection().updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: 'unsubscribed' as const, unsubscribedAt: new Date() } }
  );
  return true;
}

/** GET /api/newsletter/unsubscribe?id=&t= – public; opened from the footer link in an email. */
export async function unsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const ok = await applyUnsubscribe(req);
    res.status(200).type('html').send(
      ok
        ? unsubscribePage(
            'You have been unsubscribed',
            'You will no longer receive the AcousticsFX newsletter. You can subscribe again any time from our website.'
          )
        : unsubscribePage(
            'This link is no longer valid',
            'We could not match this unsubscribe link to a subscription. If you keep receiving our newsletter, reply to any message and we will remove you.'
          )
    );
  } catch (err) {
    console.error('Newsletter unsubscribe error:', err);
    res
      .status(500)
      .type('html')
      .send(unsubscribePage('Something went wrong', 'Please try again, or reply to any of our emails to be removed.'));
  }
}

/**
 * POST /api/newsletter/unsubscribe?id=&t= – public; RFC 8058 one-click.
 * Mail providers expect a 200 and ignore the body, so nothing is rendered here.
 */
export async function unsubscribeOneClick(req: Request, res: Response): Promise<void> {
  try {
    await applyUnsubscribe(req);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Newsletter one-click unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
}

/**
 * POST /api/admin/newsletter/send – requires CONTENT_WRITE.
 *
 * Body: { subject, html, sendToAll?, recipientIds?, testEmail? }
 *
 * Sending is synchronous and batched. That holds comfortably for a list in the low
 * thousands; past MAX_RECIPIENTS the request would outlive an ordinary proxy timeout,
 * so it is refused rather than silently truncated. Moving to a queue is the fix if
 * the list ever grows that far.
 */
export async function sendCampaign(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as {
      subject?: unknown;
      html?: unknown;
      sendToAll?: unknown;
      recipientIds?: unknown;
      testEmail?: unknown;
    };

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!subject) {
      res.status(400).json({ error: 'Subject is required' });
      return;
    }

    const bodyHtml = sanitizeNewsletterHtml(body.html);
    if (!bodyHtml) {
      res.status(400).json({ error: 'Message body is required' });
      return;
    }

    const coll = getNewsletterSubscriptionCollection();

    // A test send goes to one address and is deliberately not recorded as a campaign.
    if (typeof body.testEmail === 'string' && body.testEmail.trim()) {
      const testEmail = body.testEmail.trim().toLowerCase();
      if (!EMAIL_REGEX.test(testEmail)) {
        res.status(400).json({ error: 'Test email is not a valid address' });
        return;
      }
      // Reuse the real subscription id when the tester is on the list, so the
      // unsubscribe link in the preview is the genuine article and can be clicked.
      const existing = await coll.findOne({ email: testEmail }, { projection: { _id: 1 } });
      const unsubscribeUrl = buildUnsubscribeUrl(String(existing?._id ?? new ObjectId()));
      const parts = buildNewsletterMessage(`[TEST] ${subject}`, bodyHtml, unsubscribeUrl);
      const result = await sendNewsletterBatch([
        { to: testEmail, subject: `[TEST] ${subject}`, ...parts },
      ]);
      res.json({
        ok: result.failed.length === 0,
        test: true,
        total: 1,
        sent: result.sent,
        failed: result.failed.length,
      });
      return;
    }

    const sendToAll = body.sendToAll === true;
    let filter: Record<string, unknown> = { ...ACTIVE_FILTER };

    if (!sendToAll) {
      const raw = Array.isArray(body.recipientIds) ? body.recipientIds : [];
      const ids = raw
        .filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      if (ids.length === 0) {
        res.status(400).json({ error: 'Select at least one subscriber, or choose send to all' });
        return;
      }
      filter = { ...filter, _id: { $in: ids } };
    }

    const recipients = await coll
      .find(filter)
      .project<{ _id: ObjectId; email: string }>({ _id: 1, email: 1 })
      .toArray();

    // Two subscribers can share an address if one was added manually before the
    // upsert existed; sending twice to the same inbox is worse than dropping one.
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const key = r.email.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      res.status(400).json({ error: 'No active subscribers match this selection' });
      return;
    }
    if (unique.length > MAX_RECIPIENTS) {
      res.status(413).json({
        error: `This send targets ${unique.length} recipients, above the ${MAX_RECIPIENTS} limit for a single request.`,
      });
      return;
    }

    const messages: OutgoingMessage[] = unique.map((r) => {
      const parts = buildNewsletterMessage(subject, bodyHtml, buildUnsubscribeUrl(String(r._id)));
      return { to: r.email, subject, ...parts };
    });

    let sent = 0;
    const failedRecipients: string[] = [];
    for (let i = 0; i < messages.length; i += NEWSLETTER_BATCH_SIZE) {
      const batch = messages.slice(i, i + NEWSLETTER_BATCH_SIZE);
      const result = await sendNewsletterBatch(batch);
      sent += result.sent;
      failedRecipients.push(...result.failed);
      if (i + NEWSLETTER_BATCH_SIZE < messages.length) await sleep(BATCH_PAUSE_MS);
    }

    await coll.updateMany(
      { _id: { $in: unique.map((r) => r._id) } },
      { $set: { lastSentAt: new Date() } }
    );

    const campaign = await getNewsletterCampaignCollection().insertOne({
      subject,
      bodyHtml,
      recipientCount: unique.length,
      sentCount: sent,
      failedCount: failedRecipients.length,
      // Capped so a provider outage cannot write a multi-megabyte document.
      failedRecipients: failedRecipients.slice(0, 100),
      sentBy: { id: req.admin?.id ?? '', email: req.admin?.email ?? '' },
      createdAt: new Date(),
    });

    res.json({
      ok: failedRecipients.length === 0,
      test: false,
      total: unique.length,
      sent,
      failed: failedRecipients.length,
      campaignId: String(campaign.insertedId),
    });
  } catch (err) {
    console.error('Newsletter send error:', err);
    res.status(500).json({ error: 'Failed to send newsletter' });
  }
}
