import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import * as adminsController from '../controllers/adminsController.js';
import * as contactController from '../controllers/contactController.js';
import * as newsletterController from '../controllers/newsletterController.js';
import * as categoryController from '../controllers/categoryController.js';
import * as productController from '../controllers/productController.js';
import * as resourceController from '../controllers/resourceController.js';
import * as testimonialController from '../controllers/testimonialController.js';
import * as uploadController from '../controllers/uploadController.js';
import * as clientLogoController from '../controllers/clientLogoController.js';
import * as trustedPartnerController from '../controllers/trustedPartnerController.js';
import * as footerLinkController from '../controllers/footerLinkController.js';
import * as locationController from '../controllers/locationController.js';
import * as faqController from '../controllers/faqController.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  uploadDocumentMiddleware,
  uploadImageMiddleware,
  uploadModelMiddleware,
  uploadVideoMiddleware,
} from '../middleware/upload.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = Router();

router.use(requireAuth);

/** Short-lived ImageKit auth for direct browser uploads (no file body). Requires resources:write. */
router.get(
  '/upload-image-auth',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  uploadController.getImageKitUploadAuth
);

/** Upload image to ImageKit. Requires resources:write. */
router.post(
  '/upload-image',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  (req, res, next) => {
    uploadImageMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Invalid file' });
        return;
      }
      next();
    });
  },
  uploadController.uploadImage
);

/** Upload PDF (e.g. product brochure) to ImageKit. Requires resources:write. */
router.post(
  '/upload-document',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  (req, res, next) => {
    uploadDocumentMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Invalid file' });
        return;
      }
      next();
    });
  },
  uploadController.uploadDocument
);

/** Upload GLB 3D model to ImageKit. Requires resources:write. */
router.post(
  '/upload-model',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  (req, res, next) => {
    uploadModelMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Invalid file' });
        return;
      }
      next();
    });
  },
  uploadController.uploadModel
);

/** Upload video (MP4, WebM, MOV) to ImageKit. Requires resources:write. */
router.post(
  '/upload-video',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  (req, res, next) => {
    uploadVideoMiddleware(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Invalid file' });
        return;
      }
      next();
    });
  },
  uploadController.uploadVideo
);

/** Admins CRUD – requires SYSTEM_MANAGE (super_admin only) */
router.get(
  '/admins',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  adminsController.list
);
router.post(
  '/admins',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  adminsController.create
);
router.patch(
  '/admins/:id',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  adminsController.update
);
router.delete(
  '/admins/:id',
  requirePermission(PERMISSIONS.SYSTEM_MANAGE),
  adminsController.remove
);

/** List all blogs. Requires resources:read */
router.get(
  '/blogs',
  requirePermission(PERMISSIONS.RESOURCES_READ),
  resourceController.listBlogsAdmin
);
router.post(
  '/blogs',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.createBlog
);
router.put(
  '/blogs/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.updateBlog
);
router.delete(
  '/blogs/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.deleteBlog
);

/** Case studies */
router.get(
  '/case-studies',
  requirePermission(PERMISSIONS.RESOURCES_READ),
  resourceController.listCaseStudiesAdmin
);
router.post(
  '/case-studies',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.createCaseStudy
);
router.put(
  '/case-studies/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.updateCaseStudy
);
router.delete(
  '/case-studies/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.deleteCaseStudy
);

/** Testimonials */
router.get(
  '/testimonials',
  requirePermission(PERMISSIONS.CONTENT_READ),
  testimonialController.listTestimonialsAdmin
);
router.post(
  '/testimonials',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  testimonialController.createTestimonial
);
router.put(
  '/testimonials/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  testimonialController.updateTestimonial
);
router.delete(
  '/testimonials/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  testimonialController.deleteTestimonial
);

/** Events */
router.get(
  '/events',
  requirePermission(PERMISSIONS.RESOURCES_READ),
  resourceController.listEventsAdmin
);
router.post(
  '/events',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.createEvent
);
router.put(
  '/events/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.updateEvent
);
router.delete(
  '/events/:id',
  requirePermission(PERMISSIONS.RESOURCES_WRITE),
  resourceController.deleteEvent
);

/** Categories CRUD */
router.get(
  '/categories',
  requirePermission(PERMISSIONS.CATEGORIES_READ),
  categoryController.listCategoriesAdmin
);
router.post(
  '/categories',
  requirePermission(PERMISSIONS.CATEGORIES_WRITE),
  categoryController.createCategory
);
router.put(
  '/categories/:id',
  requirePermission(PERMISSIONS.CATEGORIES_WRITE),
  categoryController.updateCategory
);
router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.CATEGORIES_WRITE),
  categoryController.deleteCategory
);

/** List all products. Requires products:read */
router.get(
  '/products',
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productController.listProductsAdmin
);
/** Create product. Requires products:write */
router.post(
  '/products',
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  productController.createProduct
);
/** Update product. Requires products:write */
router.put(
  '/products/:id',
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  productController.updateProduct
);
/** Delete product. Requires products:write */
router.delete(
  '/products/:id',
  requirePermission(PERMISSIONS.PRODUCTS_WRITE),
  productController.deleteProduct
);

/** Client logos CRUD */
router.get(
  '/clients',
  requirePermission(PERMISSIONS.CONTENT_READ),
  clientLogoController.listClientsAdmin
);
router.post(
  '/clients',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  clientLogoController.createClient
);
router.put(
  '/clients/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  clientLogoController.updateClient
);
router.delete(
  '/clients/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  clientLogoController.deleteClient
);

/** Trusted partners CRUD */
router.get(
  '/trusted-partners',
  requirePermission(PERMISSIONS.CONTENT_READ),
  trustedPartnerController.listAdmin
);
router.post(
  '/trusted-partners',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  trustedPartnerController.create
);
router.put(
  '/trusted-partners/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  trustedPartnerController.update
);
router.delete(
  '/trusted-partners/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  trustedPartnerController.remove
);

/** Footer links CRUD */
router.get(
  '/footer-links',
  requirePermission(PERMISSIONS.CONTENT_READ),
  footerLinkController.listAdmin
);
router.post(
  '/footer-links',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  footerLinkController.create
);
router.put(
  '/footer-links/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  footerLinkController.update
);
router.delete(
  '/footer-links/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  footerLinkController.remove
);

/** Locations CRUD */
router.get(
  '/locations',
  requirePermission(PERMISSIONS.CONTENT_READ),
  locationController.listAdmin
);
router.post(
  '/locations',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  locationController.create
);
router.put(
  '/locations/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  locationController.update
);
router.delete(
  '/locations/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  locationController.remove
);

/** FAQs CRUD */
router.get(
  '/faqs',
  requirePermission(PERMISSIONS.CONTENT_READ),
  faqController.listAdmin
);
router.post(
  '/faqs',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  faqController.create
);
router.put(
  '/faqs/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  faqController.update
);
router.delete(
  '/faqs/:id',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  faqController.remove
);

/** List contact form submissions. Requires content:read */
router.get(
  '/contact-submissions',
  requirePermission(PERMISSIONS.CONTENT_READ),
  contactController.list
);

/** List newsletter subscriptions. Requires content:read */
router.get(
  '/newsletter-subscriptions',
  requirePermission(PERMISSIONS.CONTENT_READ),
  newsletterController.list
);

/** List all content (paginated). Requires content:read */
router.get(
  '/content',
  requirePermission(PERMISSIONS.CONTENT_READ),
  adminController.listContent
);
/** Get one content by key. Requires content:read */
router.get(
  '/content/:key',
  requirePermission(PERMISSIONS.CONTENT_READ),
  adminController.getContentByKey
);
/** Upsert content by key. Requires content:write */
router.put(
  '/content/:key',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  adminController.upsertContent
);
/** Delete content by key. Requires content:write */
router.delete(
  '/content/:key',
  requirePermission(PERMISSIONS.CONTENT_WRITE),
  adminController.deleteContent
);

export default router;
