import { Router } from 'express';
import { getTenants, getTenantById, createTenant, updateTenant } from '../controllers/tenantController';
import { authMiddleware, superAdminMiddleware } from '../middlewares/auth';

const router = Router();

// Todas as rotas de tenant exigem autenticação e privilégios de Super Admin
router.use(authMiddleware);
router.use(superAdminMiddleware);

router.get('/', getTenants);
router.get('/:id', getTenantById);
router.post('/', createTenant);
router.put('/:id', updateTenant);

export default router;
