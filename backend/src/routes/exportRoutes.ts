import { Router } from 'express';
import { exportAuditLogs, exportProcesses } from '../controllers/exportController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/audit', exportAuditLogs);
router.get('/processes', exportProcesses);

export default router;
