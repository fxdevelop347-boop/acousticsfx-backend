import express from 'express';
import cors from 'cors';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import productRoutes from './routes/products.js';
import resourceRoutes from './routes/resources.js';
import blogRoutes from './routes/blogs.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import newsletterRoutes from './routes/newsletter.js';
import testimonialRoutes from './routes/testimonials.js';
import clientRoutes from './routes/clients.js';
import trustedPartnerRoutes from './routes/trustedPartners.js';
import footerLinkRoutes from './routes/footerLinks.js';
import locationRoutes from './routes/locations.js';
import faqRoutes from './routes/faqs.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
// Before the JSON parser, because webhook signatures are checked against the raw body.
app.use('/api/webhooks', webhookRoutes);
// JSON body limit (upload uses multipart and is limited in middleware/upload.ts to 20MB)
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/trusted-partners', trustedPartnerRoutes);
app.use('/api/footer-links', footerLinkRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/faqs', faqRoutes);

async function start(): Promise<void> {
  await connectDb();
  app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
