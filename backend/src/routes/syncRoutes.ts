import { Router } from 'express';
import { triggerManualSync, triggerProcessSync, getSyncStatus, getSyncHistory, getSyncJobDetails } from '../controllers/syncController';
import { authMiddleware } from '../middlewares/auth';
import { clientAccessMiddleware } from '../middlewares/clientAccess';

const router = Router();

router.use(authMiddleware);
router.post('/client/:id', clientAccessMiddleware, triggerManualSync);
router.get('/status/client/:clientId', getSyncStatus);
router.get('/history/client/:clientId', getSyncHistory);
router.get('/job/:id/details', getSyncJobDetails);
router.post('/process/:id', triggerProcessSync);

export default router;
