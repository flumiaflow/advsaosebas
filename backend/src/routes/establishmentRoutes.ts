import { Router } from 'express';
import { createEstablishment, deactivateEstablishment } from '../controllers/establishmentController';
import { authMiddleware } from '../middlewares/auth';
import { clientAccessMiddleware } from '../middlewares/clientAccess';

const router = Router();

router.use(authMiddleware);

// Criação de CNPJ atrelado a um Client
router.post('/client/:id', clientAccessMiddleware, createEstablishment);

// Desativação (O ID aqui é o do Establishment, logo requer validação extra ou assumir que o controller verifica o tenant, 
// o que já fazemos implicitamente na query quando o usuário tem role supervisor e tenantId acoplado)
router.delete('/:id', deactivateEstablishment);

export default router;
