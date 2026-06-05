import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCategoryCollection } from '../models/Category.js';
import { getProductCollection } from '../models/Product.js';
import type { ProductCategory } from '../types/index.js';

const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;

function validateSlug(s: unknown): string | null {
  if (typeof s !== 'string' || !s.trim()) return null;
  return SLUG_REGEX.test(s) ? s.trim() : null;
}

function validateCategoryBody(
  body: Record<string, unknown>
): Omit<ProductCategory, '_id' | 'createdAt' | 'updatedAt'> | { error: string } {
  const slug = validateSlug(body.slug);
  if (!slug) return { error: 'slug is required and must be alphanumeric with hyphens' };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  if (!name) return { error: 'name is required' };
  const description = typeof body.description === 'string' ? body.description.trim() : undefined;
  const image = typeof body.image === 'string' ? body.image.trim() : undefined;
  const heroImage = typeof body.heroImage === 'string' ? body.heroImage.trim() : undefined;
  const heroHeading = typeof body.heroHeading === 'string' ? body.heroHeading.trim() : undefined;
  const heroDescription =
    typeof body.heroDescription === 'string' ? body.heroDescription.trim() : undefined;
  const order = typeof body.order === 'number' ? body.order : 0;
  const tagline = typeof body.tagline === 'string' ? body.tagline.trim() || undefined : undefined;
  const metaTitle = typeof body.metaTitle === 'string' ? body.metaTitle.trim() || undefined : undefined;
  const metaDescription = typeof body.metaDescription === 'string' ? body.metaDescription.trim() || undefined : undefined;
  return {
    slug,
    name,
    description,
    image,
    heroImage,
    heroHeading,
    heroDescription,
    order,
    tagline,
    metaTitle,
    metaDescription,
  };
}

/** Admin: GET /api/admin/categories — includes products where product.categorySlug matches category.slug */
export async function listCategoriesAdmin(req: Request, res: Response): Promise<void> {
  try {
    const coll = getCategoryCollection();
    const categories = await coll.find({}).sort({ order: 1, slug: 1 }).toArray();

    const productColl = getProductCollection();
    const products = await productColl
      .find(
        { categorySlug: { $type: 'string', $ne: '' } },
        { projection: { slug: 1, title: 1, categorySlug: 1, order: 1 } }
      )
      .sort({ order: 1, slug: 1 })
      .toArray();

    const byCategorySlug = new Map<string, { slug: string; title: string }[]>();
    for (const p of products) {
      const cs = p.categorySlug;
      if (typeof cs !== 'string' || !cs.trim()) continue;
      const list = byCategorySlug.get(cs) ?? [];
      list.push({ slug: p.slug, title: p.title });
      byCategorySlug.set(cs, list);
    }

    res.json({
      items: categories.map((c) => ({
        _id: c._id?.toString(),
        slug: c.slug,
        name: c.name,
        description: c.description,
        image: c.image,
        heroImage: c.heroImage,
        heroHeading: c.heroHeading,
        heroDescription: c.heroDescription,
        order: c.order ?? 0,
        tagline: c.tagline,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        linkedProducts: byCategorySlug.get(c.slug) ?? [],
      })),
    });
  } catch (err) {
    console.error('listCategoriesAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

/** Admin: POST /api/admin/categories */
export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const parsed = validateCategoryBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getCategoryCollection();
    const existing = await coll.findOne({ slug: parsed.slug });
    if (existing) {
      res.status(400).json({ error: 'A category with this slug already exists' });
      return;
    }
    const now = new Date();
    const doc: ProductCategory = {
      ...parsed,
      createdAt: now,
      updatedAt: now,
    };
    const result = await coll.insertOne(doc as ProductCategory);
    const inserted = await coll.findOne({ _id: result.insertedId });
    res.status(201).json({
      _id: inserted?._id?.toString(),
      slug: inserted?.slug,
      name: inserted?.name,
      description: inserted?.description,
      image: inserted?.image,
      heroImage: inserted?.heroImage,
      heroHeading: inserted?.heroHeading,
      heroDescription: inserted?.heroDescription,
      order: inserted?.order ?? 0,
      tagline: inserted?.tagline,
      metaTitle: inserted?.metaTitle,
      metaDescription: inserted?.metaDescription,
      createdAt: inserted?.createdAt,
      updatedAt: inserted?.updatedAt,
    });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
}

/** Admin: PUT /api/admin/categories/:id */
export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid category id' });
      return;
    }
    const parsed = validateCategoryBody(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getCategoryCollection();
    const existing = await coll.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    if (parsed.slug !== existing.slug) {
      const slugTaken = await coll.findOne({ slug: parsed.slug });
      if (slugTaken) {
        res.status(400).json({ error: 'A category with this slug already exists' });
        return;
      }
    }
    const now = new Date();
    await coll.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          slug: parsed.slug,
          name: parsed.name,
          description: parsed.description,
          image: parsed.image,
          heroImage: parsed.heroImage,
          heroHeading: parsed.heroHeading,
          heroDescription: parsed.heroDescription,
          order: parsed.order,
          tagline: parsed.tagline,
          metaTitle: parsed.metaTitle,
          metaDescription: parsed.metaDescription,
          updatedAt: now,
        },
      }
    );
    const updated = await coll.findOne({ _id: new ObjectId(id) });
    res.json({
      _id: updated?._id?.toString(),
      slug: updated?.slug,
      name: updated?.name,
      description: updated?.description,
      image: updated?.image,
      heroImage: updated?.heroImage,
      heroHeading: updated?.heroHeading,
      heroDescription: updated?.heroDescription,
      order: updated?.order ?? 0,
      tagline: updated?.tagline,
      metaTitle: updated?.metaTitle,
      metaDescription: updated?.metaDescription,
      createdAt: updated?.createdAt,
      updatedAt: updated?.updatedAt,
    });
  } catch (err) {
    console.error('updateCategory error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
}

/** Admin: DELETE /api/admin/categories/:id */
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid category id' });
      return;
    }
    const coll = getCategoryCollection();
    const result = await coll.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('deleteCategory error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
}
