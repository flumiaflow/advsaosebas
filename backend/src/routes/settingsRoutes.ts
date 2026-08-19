import { Router } from 'express';
import { getSettings, updateSettings, updateApiKeys } from '../controllers/settingsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/api-keys', updateApiKeys);

export default router;
