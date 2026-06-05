import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getProductCollection } from '../models/Product.js';
import { getCategoryCollection } from '../models/Category.js';
import type {
  Product,
  ProductCategory,
  SubProductSpec,
  SubProductGallerySlide,
  SubProductGalleryImage,
  SubProductProfilesSection,
  SubProductSubstratesSection,
  SubProductAboutTab,
  SubProductCertification,
  SubProductFinishesSection,
  VisualizerItem,
  VisualizerItemProfile,
  VisualizerTexture,
} from '../types/index.js';

const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;

function validateSlug(s: unknown): string | null {
  if (typeof s !== 'string' || !s.trim()) return null;
  return SLUG_REGEX.test(s) ? s.trim() : null;
}

/** Escape string for safe use in RegExp (slug is [a-zA-Z0-9-] only; kept for clarity). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * URL segments like "Acoustics" or "ACOUSTIC" that should map to the canonical DB slug.
 * Vercel/Linux uses case-sensitive paths; Mongo slug match is exact — this bridges common mistakes.
 */
const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  acoustics: 'acoustic',
};

/** Resolve public category URL segment to a category document (canonical slug may differ). */
async function findCategoryBySlugParam(slugParam: string): Promise<ProductCategory | null> {
  const catColl = getCategoryCollection();
  const key = slugParam.toLowerCase();
  const preferred = CATEGORY_SLUG_ALIASES[key] ?? key;

  let doc = await catColl.findOne({ slug: preferred });
  if (doc) return doc as ProductCategory;

  doc = await catColl.findOne({ slug: slugParam });
  if (doc) return doc as ProductCategory;

  const re = new RegExp(`^${escapeRegex(slugParam)}$`, 'i');
  doc = await catColl.findOne({ slug: { $regex: re } });
  return doc ? (doc as ProductCategory) : null;
}

function validateSpec(raw: unknown): SubProductSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  const value = typeof o.value === 'string' ? o.value.trim() : '';
  if (!label && !value) return null;
  return { label: label || '—', value: value || '—' };
}

function validateGallerySlide(raw: unknown): SubProductGallerySlide | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const large = typeof o.large === 'string' && o.large.trim() ? o.large.trim() : '';
  const small = typeof o.small === 'string' && o.small.trim() ? o.small.trim() : '';
  if (!large || !small) return null;
  return { large, small };
}

function validateGalleryImage(raw: unknown): SubProductGalleryImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim() : '';
  if (!url) return null;
  const alt = typeof o.alt === 'string' ? o.alt.trim() || undefined : undefined;
  return { url, alt };
}

function validateProfilesSection(raw: unknown): SubProductProfilesSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() || undefined : undefined;
  const description = typeof o.description === 'string' ? o.description.trim() || undefined : undefined;
  let profiles: SubProductProfilesSection['profiles'];
  if (Array.isArray(o.profiles)) {
    profiles = o.profiles
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const po = p as Record<string, unknown>;
        const name = typeof po.name === 'string' ? po.name.trim() : '';
        if (!name) return null;
        return {
          id: typeof po.id === 'string' ? po.id.trim() || undefined : undefined,
          name,
          size: typeof po.size === 'string' ? po.size.trim() || undefined : undefined,
          description: typeof po.description === 'string' ? po.description.trim() || undefined : undefined,
          image: typeof po.image === 'string' ? po.image.trim() || undefined : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!profiles.length) profiles = undefined;
  }
  if (!title && !description && !profiles) return undefined;
  return { title, description, profiles };
}

function validateSubstratesSection(raw: unknown): SubProductSubstratesSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() || undefined : undefined;
  const description = typeof o.description === 'string' ? o.description.trim() || undefined : undefined;
  let items: SubProductSubstratesSection['items'];
  if (Array.isArray(o.items)) {
    items = o.items
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const po = p as Record<string, unknown>;
        const name = typeof po.name === 'string' ? po.name.trim() : '';
        if (!name) return null;
        return {
          name,
          thickness: typeof po.thickness === 'string' ? po.thickness.trim() || undefined : undefined,
          description: typeof po.description === 'string' ? po.description.trim() || undefined : undefined,
          image: typeof po.image === 'string' ? po.image.trim() || undefined : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!items.length) items = undefined;
  }
  if (!title && !description && !items) return undefined;
  return { title, description, items };
}

function validateAboutTabs(raw: unknown): SubProductAboutTab[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tabs: SubProductAboutTab[] = [];
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
    const rows = rowsRaw
      .filter((r) => typeof r === 'string' && r.trim())
      .map((r) => (r as string).trim());
    if (!key || !title || !rows.length) continue;
    tabs.push({ key, title, rows });
  }
  return tabs.length ? tabs : undefined;
}

function validateCertifications(raw: unknown): SubProductCertification[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: SubProductCertification[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const image = typeof o.image === 'string' ? o.image.trim() : '';
    if (!name || !image) continue;
    const description = typeof o.description === 'string' ? o.description.trim() || undefined : undefined;
    items.push({ name, image, description });
  }
  return items.length ? items : undefined;
}

function validateFinishesSection(raw: unknown): SubProductFinishesSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() || undefined : undefined;
  const description = typeof o.description === 'string' ? o.description.trim() || undefined : undefined;
  let items: SubProductFinishesSection['items'];
  if (Array.isArray(o.items)) {
    items = o.items
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const po = p as Record<string, unknown>;
        const name = typeof po.name === 'string' ? po.name.trim() : '';
        const image = typeof po.image === 'string' ? po.image.trim() : '';
        if (!name || !image) return null;
        return {
          name,
          image,
          description: typeof po.description === 'string' ? po.description.trim() || undefined : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (!items.length) items = undefined;
  }
  if (!title && !description && !items) return undefined;
  return { title, description, items };
}

/** Common slug typo from older content */
function normalizeProductSlug(slug: string): string {
  return slug === 'linerlux' ? 'linearlux' : slug;
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductValidationError';
  }
}

function validateVisualizerItemProfile(raw: unknown, path: string): VisualizerItemProfile {
  if (!raw || typeof raw !== 'object') {
    throw new ProductValidationError(`${path} must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const image = typeof o.image === 'string' ? o.image.trim() : '';
  if (!name) throw new ProductValidationError(`${path}.name is required`);
  if (!image) throw new ProductValidationError(`${path}.image is required`);
  return { name, image };
}

function validateVisualizerItem(raw: unknown, path: string): VisualizerItem {
  if (!raw || typeof raw !== 'object') {
    throw new ProductValidationError(`${path} must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const thumbnail = typeof o.thumbnail === 'string' ? o.thumbnail.trim() : '';
  const glb = typeof o.glb === 'string' ? o.glb.trim() : '';
  const description =
    typeof o.description === 'string' && o.description.trim() ? o.description.trim() : undefined;
  if (!name) throw new ProductValidationError(`${path}.name is required`);
  if (!thumbnail) throw new ProductValidationError(`${path}.thumbnail is required`);
  if (!glb) throw new ProductValidationError(`${path}.glb is required`);

  const item: VisualizerItem = { name, thumbnail, glb, description };
  if ('profiles' in o && Array.isArray(o.profiles)) {
    const profiles: VisualizerItemProfile[] = [];
    for (let i = 0; i < o.profiles.length; i++) {
      try {
        profiles.push(validateVisualizerItemProfile(o.profiles[i], `${path}.profiles[${i}]`));
      } catch {
        // Skip incomplete profile rows (admin may leave blanks while editing).
      }
    }
    if (profiles.length > 0) item.profiles = profiles;
  }
  return item;
}

/** Flatten legacy visualizerTextures into visualizerItems for API responses. */
function resolveVisualizerItems(p: Product): VisualizerItem[] | undefined {
  if (Array.isArray(p.visualizerItems) && p.visualizerItems.length > 0) {
    return p.visualizerItems;
  }
  const legacy = (p as Product & { visualizerTextures?: VisualizerTexture[] }).visualizerTextures;
  if (!Array.isArray(legacy) || legacy.length === 0) return undefined;
  const items: VisualizerItem[] = [];
  for (const texture of legacy) {
    for (const profile of texture.profiles ?? []) {
      const thumbnail = profile.thumbnail?.trim() || texture.image?.trim() || '';
      const glb = profile.glb?.trim() || '';
      const name = profile.name?.trim() || texture.name?.trim() || '';
      if (name && thumbnail && glb) {
        items.push({ name, thumbnail, glb });
      }
    }
  }
  return items.length > 0 ? items : undefined;
}

/** Optional detail sections (specs, gallery, profiles, …) from request body */
function applyRichProductFields(
  o: Record<string, unknown>,
  doc: Omit<Product, '_id' | 'createdAt' | 'updatedAt'>
): void {
  if ('specSectionTitle' in o) {
    const t = typeof o.specSectionTitle === 'string' ? o.specSectionTitle.trim() : '';
    doc.specSectionTitle = t || undefined;
  }

  const specDescription =
    typeof o.specDescription === 'string' && o.specDescription.trim()
      ? o.specDescription.trim()
      : undefined;
  if (specDescription) doc.specDescription = specDescription;

  if ('specs' in o && Array.isArray(o.specs)) {
    const specs: SubProductSpec[] = [];
    for (const item of o.specs) {
      const spec = validateSpec(item);
      if (spec) specs.push(spec);
    }
    doc.specs = specs;
  }

  if ('gallerySlides' in o && Array.isArray(o.gallerySlides)) {
    const gallerySlides: SubProductGallerySlide[] = [];
    for (const item of o.gallerySlides) {
      const slide = validateGallerySlide(item);
      if (slide) gallerySlides.push(slide);
    }
    doc.gallerySlides = gallerySlides;
  }

  if ('galleryImages' in o && Array.isArray(o.galleryImages)) {
    const galleryImages: SubProductGalleryImage[] = [];
    for (const item of o.galleryImages) {
      const img = validateGalleryImage(item);
      if (img) galleryImages.push(img);
    }
    doc.galleryImages = galleryImages;
  } else if (doc.gallerySlides && doc.gallerySlides.length > 0) {
    const derived: SubProductGalleryImage[] = [];
    for (const s of doc.gallerySlides) {
      if (s.large) derived.push({ url: s.large });
      if (s.small && s.small !== s.large) derived.push({ url: s.small });
    }
    if (derived.length) doc.galleryImages = derived;
  }

  if ('profilesSection' in o) {
    const profilesSection = validateProfilesSection(o.profilesSection);
    if (profilesSection) doc.profilesSection = profilesSection;
    else delete doc.profilesSection;
  }

  if ('substratesSection' in o) {
    const substratesSection = validateSubstratesSection(o.substratesSection);
    if (substratesSection) doc.substratesSection = substratesSection;
    else delete doc.substratesSection;
  }

  if ('aboutTabs' in o) {
    const aboutTabs = validateAboutTabs(o.aboutTabs);
    if (aboutTabs) doc.aboutTabs = aboutTabs;
    else delete doc.aboutTabs;
  }

  if ('certificationsSectionTitle' in o) {
    const t = typeof o.certificationsSectionTitle === 'string' ? o.certificationsSectionTitle.trim() : '';
    doc.certificationsSectionTitle = t || undefined;
  }
  if ('certificationsSectionDescription' in o) {
    const t =
      typeof o.certificationsSectionDescription === 'string'
        ? o.certificationsSectionDescription.trim()
        : '';
    doc.certificationsSectionDescription = t || undefined;
  }

  if ('certifications' in o && Array.isArray(o.certifications)) {
    const certifications = validateCertifications(o.certifications);
    doc.certifications = certifications && certifications.length > 0 ? certifications : [];
  }

  if ('finishesSection' in o) {
    const finishesSection = validateFinishesSection(o.finishesSection);
    if (finishesSection) doc.finishesSection = finishesSection;
    else delete doc.finishesSection;
  }

  if ('visualizerTitle' in o) {
    const t = typeof o.visualizerTitle === 'string' ? o.visualizerTitle.trim() : '';
    doc.visualizerTitle = t || undefined;
  }
  if ('visualizerDescription' in o) {
    const t = typeof o.visualizerDescription === 'string' ? o.visualizerDescription.trim() : '';
    doc.visualizerDescription = t || undefined;
  }

  if ('visualizerItems' in o && Array.isArray(o.visualizerItems)) {
    const items: VisualizerItem[] = [];
    for (let i = 0; i < o.visualizerItems.length; i++) {
      items.push(validateVisualizerItem(o.visualizerItems[i], `visualizerItems[${i}]`));
    }
    doc.visualizerItems = items;
  }
}

function validateProductDocument(
  body: Record<string, unknown>
): Omit<Product, '_id' | 'createdAt' | 'updatedAt'> | { error: string } {
  const slugRaw = validateSlug(body.slug);
  if (!slugRaw) return { error: 'slug is required and must be alphanumeric with hyphens' };
  const slug = normalizeProductSlug(slugRaw);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null;
  if (!title) return { error: 'title is required' };
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : '';
  if (!image) return { error: 'image is required' };
  const heroImage = typeof body.heroImage === 'string' && body.heroImage.trim() ? body.heroImage.trim() : undefined;
  const order = typeof body.order === 'number' ? body.order : 0;
  const categorySlug = validateSlug(body.categorySlug) ?? undefined;
  const shortDescription =
    typeof body.shortDescription === 'string' ? body.shortDescription.trim() || undefined : undefined;
  const metaTitle = typeof body.metaTitle === 'string' ? body.metaTitle.trim() || undefined : undefined;
  const metaDescription =
    typeof body.metaDescription === 'string' ? body.metaDescription.trim() || undefined : undefined;
  const showTrademark = body.showTrademark === true;

  let brochureUrl: string | undefined;
  if ('brochureUrl' in body) {
    const raw = body.brochureUrl;
    if (raw === null || raw === undefined) {
      brochureUrl = undefined;
    } else if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) {
        brochureUrl = undefined;
      } else {
        try {
          const u = new URL(t);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            return { error: 'brochureUrl must use http or https' };
          }
          brochureUrl = u.href;
        } catch {
          return { error: 'brochureUrl must be a valid URL' };
        }
      }
    } else {
      return { error: 'brochureUrl must be a string' };
    }
  }

  const doc: Omit<Product, '_id' | 'createdAt' | 'updatedAt'> = {
    slug,
    title,
    description,
    image,
    heroImage,
    order,
    categorySlug,
    shortDescription,
    metaTitle,
    metaDescription,
    showTrademark,
    brochureUrl,
  };

  try {
    applyRichProductFields(body, doc);
  } catch (err) {
    if (err instanceof ProductValidationError) {
      return { error: err.message };
    }
    throw err;
  }
  return doc;
}

function productToPublicSummary(p: Product) {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    image: p.image,
    heroImage: p.heroImage,
    categorySlug: p.categorySlug,
    showTrademark: p.showTrademark === true,
    shortDescription: p.shortDescription,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  };
}

function productToPublicFull(p: Product) {
  return {
    ...productToPublicSummary(p),
    brochureUrl: p.brochureUrl,
    specSectionTitle: p.specSectionTitle,
    specDescription: p.specDescription,
    specs: p.specs,
    gallerySlides: p.gallerySlides,
    galleryImages: p.galleryImages,
    profilesSection: p.profilesSection,
    substratesSection: p.substratesSection,
    aboutTabs: p.aboutTabs,
    certificationsSectionTitle: p.certificationsSectionTitle,
    certificationsSectionDescription: p.certificationsSectionDescription,
    certifications: p.certifications,
    finishesSection: p.finishesSection,
    visualizerTitle: p.visualizerTitle,
    visualizerDescription: p.visualizerDescription,
    visualizerItems: resolveVisualizerItems(p),
  };
}

function productToAdminItem(p: Product) {
  return {
    _id: p._id?.toString(),
    order: p.order ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...productToPublicFull(p),
  };
}

/** Public: GET /api/products – all products (optional ?category=acoustic). No _id in response. */
export async function listProducts(req: Request, res: Response): Promise<void> {
  try {
    const rawCategory = validateSlug(req.query['category'] as string) ?? undefined;
    const coll = getProductCollection();
    let filter: Record<string, string> = {};
    if (rawCategory) {
      const cat = await findCategoryBySlugParam(rawCategory);
      filter = { categorySlug: cat?.slug ?? rawCategory };
    }
    const products = await coll.find(filter).sort({ order: 1, slug: 1 }).toArray();
    const normalized = products.map((p) => productToPublicSummary(p));
    res.json({ products: normalized });
  } catch (err) {
    console.error('listProducts error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/** Public: GET /api/products/categories – list all categories for nav / products overview. */
export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const coll = getCategoryCollection();
    const categories = await coll.find({}).sort({ order: 1, slug: 1 }).toArray();
    const normalized = categories.map((c) => ({
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
    }));
    res.json({ categories: normalized });
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

/** Public: GET /api/products/categories/:categorySlug – category details + products in that category. */
export async function getCategoryBySlug(req: Request, res: Response): Promise<void> {
  try {
    const slug = validateSlug(req.params['categorySlug']);
    if (!slug) {
      res.status(400).json({ error: 'Invalid category slug' });
      return;
    }
    const productColl = getProductCollection();
    const category = await findCategoryBySlugParam(slug);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const canonicalSlug = category.slug;
    const products = await productColl
      .find({ categorySlug: canonicalSlug })
      .sort({ order: 1, slug: 1 })
      .toArray();
    const normalizedProducts = products.map((p) => productToPublicSummary(p));
    res.json({
      category: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        image: category.image,
        heroImage: category.heroImage,
        heroHeading: category.heroHeading,
        heroDescription: category.heroDescription,
        order: category.order ?? 0,
        tagline: category.tagline,
        metaTitle: category.metaTitle,
        metaDescription: category.metaDescription,
      },
      products: normalizedProducts,
    });
  } catch (err) {
    console.error('getCategoryBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
}

/** Public: GET /api/products/slug/:productSlug – single product details by slug (for /products/:category/:productSlug). */
export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  try {
    const slugRaw = validateSlug(req.params['productSlug']);
    if (!slugRaw) {
      res.status(400).json({ error: 'Invalid product slug' });
      return;
    }
    const slug = normalizeProductSlug(slugRaw);
    const coll = getProductCollection();
    const product = await coll.findOne({ slug });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(productToPublicFull(product));
  } catch (err) {
    console.error('getProductBySlug error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

/** Admin: GET /api/admin/products – list with _id for editing */
export async function listProductsAdmin(req: Request, res: Response): Promise<void> {
  try {
    const coll = getProductCollection();
    const products = await coll.find({}).sort({ order: 1, slug: 1 }).toArray();
    res.json({
      items: products.map((p) => productToAdminItem(p)),
    });
  } catch (err) {
    console.error('listProductsAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/** Admin: POST /api/admin/products */
export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const parsed = validateProductDocument(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getProductCollection();
    const existing = await coll.findOne({ slug: parsed.slug });
    if (existing) {
      res.status(400).json({ error: 'A product with this slug already exists' });
      return;
    }
    const now = new Date();
    const doc = {
      ...parsed,
      createdAt: now,
      updatedAt: now,
    } as Product;
    const result = await coll.insertOne(doc as Product);
    const inserted = await coll.findOne({ _id: result.insertedId });
    res.status(201).json(inserted ? productToAdminItem(inserted) : null);
  } catch (err) {
    console.error('createProduct error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

/** Admin: PUT /api/admin/products/:id */
export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }
    const parsed = validateProductDocument(req.body as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const coll = getProductCollection();
    const existing = await coll.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    if (parsed.slug !== existing.slug) {
      const slugTaken = await coll.findOne({ slug: parsed.slug });
      if (slugTaken) {
        res.status(400).json({ error: 'A product with this slug already exists' });
        return;
      }
    }
    const now = new Date();
    const next = {
      ...existing,
      ...parsed,
      _id: existing._id,
      createdAt: existing.createdAt,
      updatedAt: now,
    } as Product;
    delete (next as unknown as Record<string, unknown>).visualizerProfiles;
    delete (next as unknown as Record<string, unknown>).subProducts;
    delete (next as unknown as Record<string, unknown>).panelsSectionTitle;
    delete (next as unknown as Record<string, unknown>).panelsSectionDescription;
    await coll.replaceOne({ _id: new ObjectId(id) }, next);
    const updated = await coll.findOne({ _id: new ObjectId(id) });
    res.json(updated ? productToAdminItem(updated) : null);
  } catch (err) {
    console.error('updateProduct error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

/** Admin: DELETE /api/admin/products/:id */
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params['id'] === 'string' ? req.params['id'] : '';
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }
    const coll = getProductCollection();
    const result = await coll.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error('deleteProduct error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}

const TEXTURE_PROXY_MAX_BYTES = 15 * 1024 * 1024;

/** Hostnames allowed for texture proxy (comma-separated env override). Default: ImageKit CDN. */
function getTextureProxyAllowedHosts(): string[] {
  const raw = process.env.TEXTURE_PROXY_ALLOWED_HOSTS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return ['ik.imagekit.io'];
}

function isTextureProxyHostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const allowed = getTextureProxyAllowedHosts();
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

function isBlockedTextureHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '[::1]') return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.startsWith('127.')) return true;
  if (h.startsWith('10.')) return true;
  if (h.startsWith('192.168.')) return true;
  if (h.startsWith('172.')) {
    const parts = h.split('.');
    const second = parseInt(parts[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Public: GET /api/products/texture-proxy?url=...
 * Fetches a remote image and streams it with CORS so the browser can use it in Three.js/WebGL
 * (cross-origin images without CORP/CORS would taint the canvas).
 */
export async function proxyVisualizerTexture(req: Request, res: Response): Promise<void> {
  const raw = req.query['url'];
  if (typeof raw !== 'string' || !raw.trim()) {
    res.status(400).json({ error: 'Missing url query parameter' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http(s) URLs are allowed' });
    return;
  }

  const host = parsed.hostname;
  if (isBlockedTextureHostname(host)) {
    res.status(400).json({ error: 'Host not allowed' });
    return;
  }
  if (!isTextureProxyHostAllowed(host)) {
    res.status(403).json({
      error:
        'Image host not allowed for texture proxy. Set TEXTURE_PROXY_ALLOWED_HOSTS (comma-separated) on the server.',
    });
    return;
  }

  try {
    const upstream = await fetch(parsed.href, {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const lenHeader = upstream.headers.get('content-length');
    if (lenHeader) {
      const n = parseInt(lenHeader, 10);
      if (!Number.isNaN(n) && n > TEXTURE_PROXY_MAX_BYTES) {
        res.status(413).json({ error: 'Image too large' });
        return;
      }
    }

    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!ct.startsWith('image/')) {
      res.status(400).json({ error: 'URL did not return an image' });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > TEXTURE_PROXY_MAX_BYTES) {
      res.status(413).json({ error: 'Image too large' });
      return;
    }

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buf);
  } catch (err) {
    console.error('proxyVisualizerTexture error:', err);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
}

const MODEL_PROXY_MAX_BYTES = 50 * 1024 * 1024;

function isAllowedModelContentType(ct: string): boolean {
  const lower = ct.toLowerCase();
  return (
    lower.startsWith('model/') ||
    lower === 'application/octet-stream' ||
    lower.includes('gltf')
  );
}

/**
 * Public: GET /api/products/model-proxy?url=...
 * Fetches a remote GLB/GLTF and streams it with CORS for Three.js GLTFLoader.
 */
export async function proxyVisualizerModel(req: Request, res: Response): Promise<void> {
  const raw = req.query['url'];
  if (typeof raw !== 'string' || !raw.trim()) {
    res.status(400).json({ error: 'Missing url query parameter' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http(s) URLs are allowed' });
    return;
  }

  const host = parsed.hostname;
  if (isBlockedTextureHostname(host)) {
    res.status(400).json({ error: 'Host not allowed' });
    return;
  }
  if (!isTextureProxyHostAllowed(host)) {
    res.status(403).json({
      error:
        'Model host not allowed for proxy. Set TEXTURE_PROXY_ALLOWED_HOSTS (comma-separated) on the server.',
    });
    return;
  }

  try {
    const upstream = await fetch(parsed.href, {
      redirect: 'follow',
      headers: { Accept: 'model/gltf-binary,model/gltf+json,*/*;q=0.8' },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const lenHeader = upstream.headers.get('content-length');
    if (lenHeader) {
      const n = parseInt(lenHeader, 10);
      if (!Number.isNaN(n) && n > MODEL_PROXY_MAX_BYTES) {
        res.status(413).json({ error: 'Model too large' });
        return;
      }
    }

    const ct = upstream.headers.get('content-type') || 'model/gltf-binary';
    if (!isAllowedModelContentType(ct)) {
      res.status(400).json({ error: 'URL did not return a 3D model' });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MODEL_PROXY_MAX_BYTES) {
      res.status(413).json({ error: 'Model too large' });
      return;
    }

    res.setHeader('Content-Type', ct.startsWith('model/') ? ct : 'model/gltf-binary');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buf);
  } catch (err) {
    console.error('proxyVisualizerModel error:', err);
    res.status(500).json({ error: 'Failed to proxy model' });
  }
}
