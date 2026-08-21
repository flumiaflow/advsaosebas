import { Router } from 'express';
import { 
  getGlobalSyncDefaults, 
  updateGlobalSyncDefaults, 
  applyDefaultsToAllTenants 
} from '../controllers/systemSettingsController';
import { authMiddleware, superAdminMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);
router.use(superAdminMiddleware);

router.get('/sync-defaults', getGlobalSyncDefaults);
router.put('/sync-defaults', updateGlobalSyncDefaults);
router.post('/sync-defaults/apply-all', applyDefaultsToAllTenants);

export default router;
