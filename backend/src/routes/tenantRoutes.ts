import { Router } from 'express';
import { getTenants, getTenantById, createTenant, updateTenant, getTenantSmtp, updateTenantSmtp, testTenantSmtp } from '../controllers/tenantController';
import { authMiddleware, superAdminMiddleware } from '../middlewares/auth';

const router = Router();

// Todas as rotas de tenant exigem autenticação
router.use(authMiddleware);

// Rotas de SMTP (Acessíveis pelo Supervisor do Tenant)
router.get('/smtp', getTenantSmtp);
router.put('/smtp', updateTenantSmtp);
router.post('/smtp/test', testTenantSmtp);

// Rotas exclusivas de Super Admin
router.get('/', superAdminMiddleware, getTenants);
router.get('/:id', superAdminMiddleware, getTenantById);
router.post('/', superAdminMiddleware, createTenant);
router.put('/:id', superAdminMiddleware, updateTenant);

export default router;
