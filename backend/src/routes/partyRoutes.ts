import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getParties, getPartyDetails, forceEnrichProcess } from '../controllers/partyController';

const router = Router();

router.use(authMiddleware);

router.get('/', getParties);
router.get('/:id', getPartyDetails);
router.post('/enrich-process/:processId', forceEnrichProcess);

export default router;
