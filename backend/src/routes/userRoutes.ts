import { Router } from 'express';
import { getUsers, createUser, updateUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

export default router;
