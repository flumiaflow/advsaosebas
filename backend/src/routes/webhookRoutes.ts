import { Router, Request, Response } from 'express';
import { juditWebhook } from '../webhooks/judit';
import { escavadorWebhook } from '../webhooks/escavador';

const router = Router();

// Importante: Webhooks não passam pelo authMiddleware genérico.
// A validação de identidade é feita via HMAC no próprio webhook controller.

router.post('/judit', juditWebhook);
router.post('/escavador', escavadorWebhook);

export default router;
