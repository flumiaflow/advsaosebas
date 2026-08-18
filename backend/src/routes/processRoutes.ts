import { Router } from 'express';
import { getProcesses, getProcessDetails } from '../controllers/processController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', getProcesses);
router.get('/:id', getProcessDetails);

export default router;
