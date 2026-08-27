import { Router } from 'express';
import { getProcesses, getProcessDetails, getProcessDocuments, enrichProcessWithDjen, markAllProcessesSeen } from '../controllers/processController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', getProcesses);
router.post('/mark-all-seen', markAllProcessesSeen);
router.get('/:id', getProcessDetails);
router.get('/:id/documents', getProcessDocuments);
router.post('/:id/enrich-djen', enrichProcessWithDjen);

export default router;
