import { Request, Response } from 'express';
import { getContentCollection } from '../models/Content.js';
import type { ContentType } from '../types/index.js';

const KEY_REGEX = /^[a-zA-Z0-9._-]+$/;
const MAX_VALUE_LENGTH = 100_000;
const MAX_IMAGE_URL_LENGTH = 2048;

function validateKey(key: unknown): string | null {
  const s = Array.isArray(key) ? key[0] : key;
  if (!s || typeof s !== 'string') return null;
  const k = s.trim();
  return k.length > 0 && KEY_REGEX.test(k) ? k : null;
}

function validateBody(
  value: unknown,
  type?: string
): { value: string; type: ContentType } | { error: string } {
  if (value === undefined || value === null)
    return { error: 'value is required' };
  if (typeof value !== 'string') return { error: 'value must be a string' };
  const v = value.trim();
  const t = (
    type === 'image' ? 'image' : type === 'video' ? 'video' : 'text'
  ) as ContentType;
  if ((t === 'image' || t === 'video') && v.length > MAX_IMAGE_URL_LENGTH)
    return { error: `${t} URL must be at most ${MAX_IMAGE_URL_LENGTH} characters` };
  if (v.length > MAX_VALUE_LENGTH)
    return { error: `value must be at most ${MAX_VALUE_LENGTH} characters` };
  return { value: v, type: t };
}

/**
 * List all content entries. Optional query: limit, skip for pagination.
 * Requires content:read.
 */
export async function listContent(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(
      Math.max(0, parseInt(String(req.query.limit), 10) || 50),
      200
    );
    const skip = Math.max(0, parseInt(String(req.query.skip), 10) || 0);

    const coll = getContentCollection();
    const [items, total] = await Promise.all([
      coll.find({}).sort({ key: 1 }).skip(skip).limit(limit).toArray(),
      coll.countDocuments(),
    ]);

    res.json({
      items: items.map((d) => ({
        key: d.key,
        value: d.value,
        type: d.type,
        updatedAt: d.updatedAt,
        updatedBy: d.updatedBy,
      })),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error('Admin listContent error:', err);
    res.status(500).json({ error: 'Failed to list content' });
  }
}

/**
 * Get a single content entry by key. Requires content:read.
 */
export async function getContentByKey(req: Request, res: Response): Promise<void> {
  try {
    const key = validateKey(req.params['key']);
    if (!key) {
      res.status(400).json({ error: 'Invalid key' });
      return;
    }

    const coll = getContentCollection();
    const doc = await coll.findOne({ key });
    if (!doc) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    res.json({
      key: doc.key,
      value: doc.value,
      type: doc.type,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy,
    });
  } catch (err) {
    console.error('Admin getContentByKey error:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
}

/**
 * Upsert content by key. Body: { value: string, type?: 'text' | 'image' }.
 * Requires content:write.
 */
export async function upsertContent(req: Request, res: Response): Promise<void> {
  try {
    const key = validateKey(req.params['key']);
    if (!key) {
      res.status(400).json({ error: 'Invalid key' });
      return;
    }

    const { value: rawValue, type: rawType } = req.body as {
      value?: unknown;
      type?: string;
    };
    const parsed = validateBody(rawValue, rawType);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const coll = getContentCollection();
    const adminId = req.admin?.id ?? '';
    const now = new Date();

    const result = await coll.findOneAndUpdate(
      { key },
      {
        $set: {
          value: parsed.value,
          type: parsed.type,
          updatedAt: now,
          updatedBy: adminId,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const doc = result ?? (await coll.findOne({ key }));
    if (!doc) {
      res.status(500).json({ error: 'Failed to save content' });
      return;
    }

    res.json({
      key: doc.key,
      value: doc.value,
      type: doc.type,
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy,
    });
  } catch (err) {
    console.error('Admin upsertContent error:', err);
    res.status(500).json({ error: 'Failed to save content' });
  }
}

/**
 * Delete content by key. Requires content:write.
 */
export async function deleteContent(req: Request, res: Response): Promise<void> {
  try {
    const key = validateKey(req.params['key']);
    if (!key) {
      res.status(400).json({ error: 'Invalid key' });
      return;
    }

    const coll = getContentCollection();
    const result = await coll.deleteOne({ key });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Admin deleteContent error:', err);
    res.status(500).json({ error: 'Failed to delete content' });
  }
}
