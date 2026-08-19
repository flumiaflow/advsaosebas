import { Router } from 'express';
import { getUsers, createUser, updateUser, updateUserClients } from '../controllers/userController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/clients', updateUserClients);

export default router;
