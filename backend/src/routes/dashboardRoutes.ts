import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/metrics', getDashboardMetrics);

export default router;
