import { Router } from 'express';
import * as newsletterController from '../controllers/newsletterController.js';

const router = Router();

router.post('/', newsletterController.submit);

/** Public unsubscribe. GET is the footer link a recipient clicks; POST is the
 *  RFC 8058 one-click request mail providers send on the recipient's behalf. */
router.get('/unsubscribe', newsletterController.unsubscribe);
router.post('/unsubscribe', newsletterController.unsubscribeOneClick);

export default router;
