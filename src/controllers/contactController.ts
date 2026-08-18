import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getContactSubmissionCollection } from '../models/ContactSubmission.js';

const SUBJECTS = ['General Inquiry', 'Help & Support', 'Become Partner', 'Other'] as const;

function isValidSubject(s: string): s is (typeof SUBJECTS)[number] {
  return SUBJECTS.includes(s as (typeof SUBJECTS)[number]);
}

/**
 * Older submissions stored the company inline as a "[Company: X]" prefix on the
 * message, which pushed the real message out of view in the admin table. Split
 * it back out on read so historical rows display like new ones.
 */
const LEGACY_COMPANY_PREFIX = /^\s*\[Company:\s*([^\]]*)\]\s*/i;

function splitLegacyCompany(message: string, company?: string): {
  company?: string;
  message: string;
} {
  const match = LEGACY_COMPANY_PREFIX.exec(message);
  if (!match) return { company, message };
  const extracted = (match[1] ?? '').trim();
  return {
    company: company ?? (extracted || undefined),
    message: message.slice(match[0].length),
  };
}

/** POST /api/contact – public; store a contact form submission */
export async function submit(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, phone, company, subject, message } = req.body ?? {};
    const n = typeof name === 'string' ? name.trim() : '';
    const e = typeof email === 'string' ? email.trim() : '';
    const subj = typeof subject === 'string' && isValidSubject(subject.trim()) ? subject.trim() : 'General Inquiry';
    const rawMsg = typeof message === 'string' ? message.trim() : '';
    const rawCompany = typeof company === 'string' && company.trim() ? company.trim() : undefined;

    if (!n || !e) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    // Tolerate clients still sending the company inline in the message.
    const split = splitLegacyCompany(rawMsg, rawCompany);
    const msg = split.message.trim();

    const doc = {
      name: n,
      email: e,
      ...(typeof phone === 'string' && phone.trim() && { phone: phone.trim() }),
      ...(split.company && { company: split.company }),
      subject: subj,
      message: msg || '(no message)',
      createdAt: new Date(),
    };

    const coll = getContactSubmissionCollection();
    await coll.insertOne(doc);
    res.status(201).json({ ok: true, message: 'Thank you for your message.' });
  } catch (err) {
    console.error('Contact submit error:', err);
    res.status(500).json({ error: 'Failed to submit message' });
  }
}

/** GET /api/admin/contact-submissions – paginated list (admin only) */
export async function list(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const coll = getContactSubmissionCollection();
    const [items, total] = await Promise.all([
      coll.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      coll.countDocuments(),
    ]);

    res.json({
      items: items.map((d) => {
        const split = splitLegacyCompany(d.message ?? '', d.company);
        return {
          _id: String(d._id),
          name: d.name,
          email: d.email,
          phone: d.phone,
          company: split.company,
          subject: d.subject,
          message: split.message,
          createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        };
      }),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error('Contact list error:', err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
}

/** DELETE /api/admin/contact-submissions/:id */
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await getContactSubmissionCollection().deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('Contact delete error:', err);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
}
