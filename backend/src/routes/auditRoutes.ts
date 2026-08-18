import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// Apenas Super Admin e Supervisor deveriam ver logs. Mas deixaremos que a rota decida se User comum pode ou não.
router.get('/', getAuditLogs);

export default router;
