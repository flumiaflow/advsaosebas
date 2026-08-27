import { Router } from 'express';
import { getEmailLogs } from '../controllers/emailLogController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getEmailLogs);

export default router;
