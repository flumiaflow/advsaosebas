import { Router } from 'express';
import { getSyncConfig, updateSyncConfig, getSyncHistory } from '../controllers/syncConfigController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getSyncConfig);
router.put('/', updateSyncConfig);
router.get('/history', getSyncHistory);

export default router;
