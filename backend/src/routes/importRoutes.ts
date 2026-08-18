import { Router } from 'express';
import { previewImport, confirmImport } from '../controllers/importController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/preview', previewImport);
router.post('/confirm', confirmImport);

export default router;
