import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getNewsletterSubscriptionCollection } from '../models/NewsletterSubscription.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/newsletter – public; store newsletter email */
export async function submit(req: Request, res: Response): Promise<void> {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }

    const coll = getNewsletterSubscriptionCollection();
    await coll.insertOne({ email, createdAt: new Date() });
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
    const [items, total] = await Promise.all([
      coll
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project<{ _id: import('mongodb').ObjectId; email: string; createdAt: Date }>({ _id: 1, email: 1, createdAt: 1 })
        .toArray(),
      coll.countDocuments(),
    ]);

    res.json({
      items: items.map((d) => ({
        _id: String(d._id),
        email: d.email,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
      })),
      total,
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
