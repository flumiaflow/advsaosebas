import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { addSyncJob } from '../services/sync/worker';

export async function triggerManualSync(req: Request, res: Response) {
  try {
    const { clientId } = req.params;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) return res.status(401).json({ error: 'Não autorizado' });

    // 1. Throttle Logic (apenas para User comum; Supervisor ignora, mas vamos assumir 60min global p/ não onerar o server)
    const throttle = await prisma.syncThrottle.findUnique({ where: { clientId } });
    
    if (throttle && req.user.role === 'user') {
      const now = new Date();
      const diffMinutes = (now.getTime() - throttle.lastManualAt.getTime()) / (1000 * 60);
      
      if (diffMinutes < 60) {
        return res.status(429).json({ error: `Por favor, aguarde ${Math.ceil(60 - diffMinutes)} minutos para sincronizar esta empresa novamente.` });
      }
    }

    // 2. Atualiza / Cria o throttle
    await prisma.syncThrottle.upsert({
      where: { clientId },
      update: { lastManualAt: new Date(), triggeredById: userId },
      create: { clientId, lastManualAt: new Date(), triggeredById: userId }
    });

    // 3. Enfileira o Job
    await addSyncJob(tenantId, clientId, req.user.name || 'User');

    return res.status(202).json({ message: 'Sincronização iniciada com sucesso em background' });
  } catch (error) {
    console.error('Trigger sync error:', error);
    return res.status(500).json({ error: 'Erro interno ao iniciar sincronização' });
  }
}
