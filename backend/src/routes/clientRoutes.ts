import { Router } from 'express';
import { getClients, createClient, getClientById, assignUsersToClient } from '../controllers/clientController';
import { authMiddleware } from '../middlewares/auth';
import { clientAccessMiddleware } from '../middlewares/clientAccess';

const router = Router();

router.use(authMiddleware);

// Listar e Criar (não precisam de validação de ID específico)
router.get('/', getClients);
router.post('/', createClient);

// Rotas que exigem checagem de acesso à empresa específica
router.get('/:id', clientAccessMiddleware, getClientById);
router.post('/:id/users', clientAccessMiddleware, assignUsersToClient);

export default router;
