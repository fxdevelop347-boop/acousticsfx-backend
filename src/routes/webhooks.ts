import express from 'express';
import * as newsletterWebhookController from '../controllers/newsletterWebhookController.js';

const router = express.Router();

/** Public, and authenticated by the signature on each request. */
router.post(
  '/resend',
  express.raw({ type: '*/*', limit: '1mb' }),
  newsletterWebhookController.resendEvent
);

export default router;
