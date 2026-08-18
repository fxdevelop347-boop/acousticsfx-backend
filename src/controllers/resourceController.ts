import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getBlogCollection } from '../models/Blog.js';
import { getCaseStudyCollection } from '../models/CaseStudy.js';
import { getEventCollection } from '../models/Event.js';
import type {
  Blog,
  CaseStudy,
  CaseStudyGalleryImage,
  CaseStudyMetric,
  CaseStudyQuote,
  Event,
} from '../types/index.js';

const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;

/** Case studies created before `isPublished` existed count as published. */
const PUBLISHED_FILTER = {
  $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
};

/** Featured first, then explicit order, then newest. */
const CASE_STUDY_SORT = { isFeatured: -1, order: 1, createdAt: -1 } as const;

function validateSlug(s: unknown): string | null {
  if (typeof s !== 'string' || !s.trim()) return null;
  return SLUG_REGEX.test(s) ? s.trim() : null;
}

// ---------- Public ----------

/** GET /api/resources – single payload with blogs, caseStudies, events */
export async function listResources(req: Request, res: Response): Promise<void> {
  try {
    const [blogs, caseStudies, events] = await Promise.all([
      getBlogCollection().find({}).sort({ publishedAt: -1, createdAt: -1 }).toArray(),
      // Published only: this payload feeds the home and product carousels, so an
      // unpublished draft would otherwise surface there.
      getCaseStudyCollection().find(PUBLISHED_FILTER).sort(CASE_STUDY_SORT).toArray(),
      getEventCollection().find({}).sort({ eventDate: -1, createdAt: -1 }).toArray(),
    ]);
    const stripId = <T extends { _id?: unknown }>(arr: T[]) =>
      arr.map(({ _id, ...rest }) => rest);
    res.json({
      blogs: stripId(blogs),
      caseStudies: stripId(caseStudies),
      events: stripId(events),
    });
  } catch (err) {
    console.error('listResources error:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
}

/** GET /api/blogs – public list; optional ?recent=true&limit=N&excludeSlug=xxx */
export async function listBlogs(req: Request, res: Response): Promise<void> {
  try {
    const limit = typeof req.query.limit === 'string' ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)) : undefined;
    const excludeSlug = typeof req.query.excludeSlug === 'string' && req.query.excludeSlug.trim() ? req.query.excludeSlug.trim() : undefined;
    const filter: Record<string, unknown> = {};
    // Only published blogs on public API
    filter.$or = [{ isPublished: true }, { isPublished: { $exists: false } }];
    if (excludeSlug) filter.slug = { $ne: excludeSlug };
    let cursor = getBlogCollection()
      .find(filter)
      .sort({ publishedAt: -1, createdAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    const blogs = await cursor.toArray();
    const stripId = (arr: Blog[]) =>
      arr.map(({ _id, ...rest }) => ({ ...rest, _id: _id?.toString() }));
    res.json({ success: true, blogs: stripId(blogs) });
  } catch (err) {
    console.error('listBlogs error:', err);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
}

/** GET /api/resources/case-studies – public list; optional ?industry=x&limit=N&excludeSlug=xxx */
export async function listCaseStudiesPublic(req: Request, res: Response): Promise<void> {
  try {
    const industry =
      typeof req.query['industry'] === 'string' && req.query['industry'].trim()
        ? req.query['industry'].trim()
        : undefined;
    const excludeSlug =
      typeof req.query['excludeSlug'] === 'string' && req.query['excludeSlug'].trim()
        ? req.query['excludeSlug'].trim()
        : undefined;
    const limit =
      typeof req.query['limit'] === 'string'
        ? Math.min(100, Math.max(1, parseInt(req.query['limit'], 10) || 20))
        : undefined;

    const filter: Record<string, unknown> = { ...PUBLISHED_FILTER };
    if (industry) filter['industry'] = industry;
    if (excludeSlug) filter['slug'] = { $ne: excludeSlug };

    let cursor = getCaseStudyCollection().find(filter).sort(CASE_STUDY_SORT);
    if (limit) cursor = cursor.limit(limit);
    const items = await cursor.toArray();

    const stripId = (arr: CaseStudy[]) =>
      arr.map(({ _id, ...rest }) => ({ ...rest, _id: _id?.toString() }));
    res.json({ success: true, caseStudies: stripId(items) });
  } catch (err) {
    console.error('listCaseStudiesPublic error:', err);
    res.status(500).json({ error: 'Failed to fetch case studies' });
  }
}

/** GET /api/resources/case-studies/slug/:slug – public by slug; published only */
export async function getCaseStudyBySlug(req: Request, res: Response): Promise<void> {
  try {
    const slug = validateSlug(req.params['slug']);
    if (!slug) {
      res.status(400).json({ error: 'Invalid slug' });
      return;
    }
    const item = await getCaseStudyCollection().findOne({ slug, ...PUBLISHED_FILTER });
    if (!item) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }
    const { _id, ...rest } = item;
    res.json({ success: true, caseStudy: { ...rest, _id: _id?.toString() } });
  } catch (err) {
    console.error('getCaseStudyBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch case study' });
  }
}

/** GET /api/resources/events – public list */
export async function listEventsPublic(req: Request, res: Response): Promise<void> {
  try {
    const items = await getEventCollection()
      .find({})
      .sort({ eventDate: -1, createdAt: -1 })
      .toArray();
    const stripId = (arr: Event[]) =>
      arr.map(({ _id, ...rest }) => ({ ...rest, _id: _id?.toString() }));
    res.json({ success: true, events: stripId(items) });
  } catch (err) {
    console.error('listEventsPublic error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

/** GET /api/resources/events/slug/:slug – public by slug */
export async function getEventBySlug(req: Request, res: Response): Promise<void> {
  try {
    const slug = validateSlug(req.params['slug']);
    if (!slug) {
      res.status(400).json({ error: 'Invalid slug' });
      return;
    }
    const item = await getEventCollection().findOne({ slug });
    if (!item) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    const { _id, ...rest } = item;
    res.json({ success: true, event: { ...rest, _id: _id?.toString() } });
  } catch (err) {
    console.error('getEventBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
}

/** GET /api/blogs/slug/:slug – public; only returns published blogs */
export async function getBlogBySlug(req: Request, res: Response): Promise<void> {
  try {
    const slug = validateSlug(req.params['slug']);
    if (!slug) {
      res.status(400).json({ error: 'Invalid slug' });
      return;
    }
    const blog = await getBlogCollection().findOne({
      slug,
      $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
    });
    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    await getBlogCollection().updateOne({ _id: blog._id }, { $inc: { views: 1 } });
    (blog as Blog).views = (blog.views ?? 0) + 1;
    const { _id, ...rest } = blog;
    res.json({ success: true, blog: { ...rest, _id: _id?.toString() } });
  } catch (err) {
    console.error('getBlogBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
}

// ---------- Admin: Blogs ----------

function validateBlogBody(body: Record<string, unknown>): Omit<Blog, '_id' | 'createdAt' | 'updatedAt'> | { error: string } {
  const slug = validateSlug(body.slug);
  if (!slug) return { error: 'slug is required and alphanumeric with hyphens' };
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
  if (!title) return { error: 'title is required' };
  const heroImage = typeof body.heroImage === 'string' ? body.heroImage.trim() : '';
  const authorName = typeof body.authorName === 'string' ? body.authorName.trim() : '';
  const authorId = typeof body.authorId === 'string' ? body.authorId.trim() || undefined : undefined;
  const authorEmail = typeof body.authorEmail === 'string' ? body.authorEmail.trim() || undefined : undefined;
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : undefined;
  const content = typeof body.content === 'string' ? body.content : undefined;
  const authorImage = typeof body.authorImage === 'string' ? body.authorImage.trim() : undefined;
  const metaDescription = typeof body.metaDescription === 'string' ? body.metaDescription.trim() || undefined : undefined;
  const tags = Array.isArray(body.tags) ? (body.tags as string[]).filter((t) => typeof t === 'string') : undefined;
  const isPublished = typeof body.isPublished === 'boolean' ? body.isPublished : body.isPublished === undefined ? true : !!body.isPublished;
  const views = typeof body.views === 'number' && body.views >= 0 ? body.views : undefined;
  const publishedAt = body.publishedAt ? (() => {
    const d = new Date(body.publishedAt as string);
    return isNaN(d.getTime()) ? undefined : d;
  })() : undefined;
  return {
    slug, title, excerpt, content, heroImage,
    authorId, authorName, authorEmail, authorImage, metaDescription,
    tags, isPublished, views, publishedAt,
  };
}

export async function listBlogsAdmin(req: Request, res: Response): Promise<void> {
  try {
    const blogs = await getBlogCollection().find({}).sort({ publishedAt: -1 }).toArray();
    res.json({
      items: blogs.map((b) => ({ ...b, _id: b._id?.toString() })),
    });
  } catch (err) {
    console.error('listBlogsAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
}

export async function createBlog(req: Request, res: Response): Promise<void> {
  try {
    const parsed = validateBlogBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getBlogCollection();
    const existing = await coll.findOne({ slug: parsed.slug });
    if (existing) {
      res.status(400).json({ error: 'Blog with this slug already exists' });
      return;
    }
    const now = new Date();
    const publishedAt = parsed.publishedAt ?? (parsed.isPublished !== false ? now : undefined);
    const views = parsed.views ?? 0;
    const doc: Blog = { ...parsed, publishedAt, views, createdAt: now, updatedAt: now };
    const result = await coll.insertOne(doc);
    const inserted = await coll.findOne({ _id: result.insertedId });
    res.status(201).json(inserted ? { ...inserted, _id: inserted._id?.toString() } : {});
  } catch (err) {
    console.error('createBlog error:', err);
    res.status(500).json({ error: 'Failed to create blog' });
  }
}

export async function updateBlog(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = validateBlogBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getBlogCollection();
    const existing = await coll.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    if (parsed.slug !== existing.slug) {
      const taken = await coll.findOne({ slug: parsed.slug });
      if (taken) {
        res.status(400).json({ error: 'Blog with this slug already exists' });
        return;
      }
    }
    const now = new Date();
    const setPayload: Record<string, unknown> = { updatedAt: now };
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined) setPayload[k] = v;
    }
    await coll.updateOne(
      { _id: new ObjectId(id) },
      { $set: setPayload }
    );
    const updated = await coll.findOne({ _id: new ObjectId(id) });
    res.json(updated ? { ...updated, _id: updated._id?.toString() } : {});
  } catch (err) {
    console.error('updateBlog error:', err);
    res.status(500).json({ error: 'Failed to update blog' });
  }
}

export async function deleteBlog(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await getBlogCollection().deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('deleteBlog error:', err);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
}

// ---------- Admin: Case studies ----------

const MAX_METRICS = 4;
const MAX_GALLERY_IMAGES = 8;

/** Trimmed string, or undefined when absent/blank. */
function optionalText(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Drops entries missing the keys that make them worth rendering. */
function parseMetrics(v: unknown): CaseStudyMetric[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const metrics = v
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => ({ value: optionalText(m['value']), label: optionalText(m['label']) }))
    .filter((m): m is CaseStudyMetric => !!m.value && !!m.label)
    .slice(0, MAX_METRICS);
  return metrics.length ? metrics : [];
}

function parseGallery(v: unknown): CaseStudyGalleryImage[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const gallery = v
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => {
      const url = optionalText(g['url']);
      const caption = optionalText(g['caption']);
      return url ? ({ url, ...(caption ? { caption } : {}) } as CaseStudyGalleryImage) : null;
    })
    .filter((g): g is CaseStudyGalleryImage => g !== null)
    .slice(0, MAX_GALLERY_IMAGES);
  return gallery.length ? gallery : [];
}

function parseQuote(v: unknown): CaseStudyQuote | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const q = v as Record<string, unknown>;
  const text = optionalText(q['text']);
  // A quote without its text has nothing to render.
  if (!text) return undefined;
  const author = optionalText(q['author']);
  const role = optionalText(q['role']);
  return { text, ...(author ? { author } : {}), ...(role ? { role } : {}) };
}

function parseProductsUsed(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .map((p) => optionalText(p))
    .filter((p): p is string => !!p)
    .slice(0, 20);
}

/**
 * Only `slug` and `title` are required — staff must be able to save a partially
 * written draft and finish it later.
 */
function validateCaseStudyBody(body: Record<string, unknown>): Omit<CaseStudy, '_id' | 'createdAt' | 'updatedAt'> | { error: string } {
  const slug = validateSlug(body.slug);
  if (!slug) return { error: 'slug is required and alphanumeric with hyphens' };
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
  if (!title) return { error: 'title is required' };

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const order = typeof body.order === 'number' ? body.order : 0;

  return {
    slug,
    title,
    description,
    image,
    order,

    client: optionalText(body.client),
    industry: optionalText(body.industry),
    location: optionalText(body.location),
    year: optionalText(body.year),

    challenge: optionalText(body.challenge),
    solution: optionalText(body.solution),
    results: optionalText(body.results),

    metrics: parseMetrics(body.metrics),
    gallery: parseGallery(body.gallery),
    productsUsed: parseProductsUsed(body.productsUsed),
    quote: parseQuote(body.quote),

    isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : true,
    isFeatured: typeof body.isFeatured === 'boolean' ? body.isFeatured : false,
    metaDescription: optionalText(body.metaDescription),
  };
}

export async function listCaseStudiesAdmin(req: Request, res: Response): Promise<void> {
  try {
    const items = await getCaseStudyCollection().find({}).sort(CASE_STUDY_SORT).toArray();
    res.json({ items: items.map((c) => ({ ...c, _id: c._id?.toString() })) });
  } catch (err) {
    console.error('listCaseStudiesAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch case studies' });
  }
}

export async function createCaseStudy(req: Request, res: Response): Promise<void> {
  try {
    const parsed = validateCaseStudyBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getCaseStudyCollection();
    const existing = await coll.findOne({ slug: parsed.slug });
    if (existing) {
      res.status(400).json({ error: 'Case study with this slug already exists' });
      return;
    }
    const now = new Date();
    // Strip undefined so optional fields are absent rather than stored as null.
    const defined = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined)
    ) as Omit<CaseStudy, '_id' | 'createdAt' | 'updatedAt'>;
    const doc: CaseStudy = { ...defined, createdAt: now, updatedAt: now };
    const result = await coll.insertOne(doc);
    const inserted = await coll.findOne({ _id: result.insertedId });
    res.status(201).json(inserted ? { ...inserted, _id: inserted._id?.toString() } : {});
  } catch (err) {
    console.error('createCaseStudy error:', err);
    res.status(500).json({ error: 'Failed to create case study' });
  }
}

export async function updateCaseStudy(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = validateCaseStudyBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getCaseStudyCollection();
    const existing = await coll.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }
    if (parsed.slug !== existing.slug) {
      const taken = await coll.findOne({ slug: parsed.slug });
      if (taken) {
        res.status(400).json({ error: 'Case study with this slug already exists' });
        return;
      }
    }
    const now = new Date();
    // The admin form always submits the whole record, so a field that came back
    // undefined was cleared by the user — unset it instead of storing null.
    const $set: Record<string, unknown> = { updatedAt: now };
    const $unset: Record<string, ''> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined) $unset[key] = '';
      else $set[key] = value;
    }
    await coll.updateOne(
      { _id: new ObjectId(id) },
      Object.keys($unset).length ? { $set, $unset } : { $set }
    );
    const updated = await coll.findOne({ _id: new ObjectId(id) });
    res.json(updated ? { ...updated, _id: updated._id?.toString() } : {});
  } catch (err) {
    console.error('updateCaseStudy error:', err);
    res.status(500).json({ error: 'Failed to update case study' });
  }
}

export async function deleteCaseStudy(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await getCaseStudyCollection().deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Case study not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('deleteCaseStudy error:', err);
    res.status(500).json({ error: 'Failed to delete case study' });
  }
}

// ---------- Admin: Events ----------

function validateEventBody(body: Record<string, unknown>): Omit<Event, '_id' | 'createdAt' | 'updatedAt'> | { error: string } {
  const slug = validateSlug(body.slug);
  if (!slug) return { error: 'slug is required' };
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
  if (!title) return { error: 'title is required' };
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  const eventDate = typeof body.eventDate === 'string' ? body.eventDate.trim() : undefined;
  const location = typeof body.location === 'string' ? body.location.trim() : undefined;
  return { slug, title, description, image, eventDate, location };
}

export async function listEventsAdmin(req: Request, res: Response): Promise<void> {
  try {
    const items = await getEventCollection().find({}).sort({ eventDate: -1 }).toArray();
    res.json({ items: items.map((e) => ({ ...e, _id: e._id?.toString() })) });
  } catch (err) {
    console.error('listEventsAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const parsed = validateEventBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getEventCollection();
    const existing = await coll.findOne({ slug: parsed.slug });
    if (existing) {
      res.status(400).json({ error: 'Event with this slug already exists' });
      return;
    }
    const now = new Date();
    const doc: Event = { ...parsed, createdAt: now, updatedAt: now };
    const result = await coll.insertOne(doc);
    const inserted = await coll.findOne({ _id: result.insertedId });
    res.status(201).json(inserted ? { ...inserted, _id: inserted._id?.toString() } : {});
  } catch (err) {
    console.error('createEvent error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const parsed = validateEventBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getEventCollection();
    const existing = await coll.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    const now = new Date();
    await coll.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: now } }
    );
    const updated = await coll.findOne({ _id: new ObjectId(id) });
    res.json(updated ? { ...updated, _id: updated._id?.toString() } : {});
  } catch (err) {
    console.error('updateEvent error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await getEventCollection().deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('deleteEvent error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}
