import { Router } from 'express';
import { getProcesses, getProcessDetails, enrichProcessWithDjen } from '../controllers/processController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', getProcesses);
router.get('/:id', getProcessDetails);
router.post('/:id/enrich-djen', enrichProcessWithDjen);

export default router;
