import { Router } from 'express';
import { getUnreadNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.get('/unread', getUnreadNotifications);
router.post('/read-all', markAllAsRead);
router.post('/:id/read', markAsRead);

export default router;
