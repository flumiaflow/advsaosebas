import { Router } from 'express';
import { triggerManualSync } from '../controllers/syncController';
import { authMiddleware } from '../middlewares/auth';
import { clientAccessMiddleware } from '../middlewares/clientAccess';

const router = Router();

router.use(authMiddleware);
router.post('/client/:id', clientAccessMiddleware, triggerManualSync);
router.post('/process/:id', triggerManualSync);

export default router;
