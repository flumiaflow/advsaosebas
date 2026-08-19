import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { addSyncJob } from '../services/sync/worker';

export async function triggerManualSync(req: Request, res: Response) {
  try {
    const clientId = (req.params.id || req.params.clientId) as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    const userId = req.user?.userId;

    if (!tenantId || !userId) return res.status(401).json({ error: 'Não autorizado' });

    // 1. Throttle Logic (apenas para User comum)
    const throttle = await prisma.syncThrottle.findUnique({ where: { clientId } });
    
    if (throttle && req.user!.role === 'user') {
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

    // 3. Executa o job síncrono ou enfileira via Redis
    if (process.env.NO_REDIS === 'true') {
      const { handleSyncJob } = await import('../services/sync/worker');
      const result = await handleSyncJob({ data: { tenantId, clientId, triggeredBy: req.user!.name || 'User' } });
      return res.status(200).json({
        message: 'Varredura concluída com sucesso!',
        summary: result || { success: true, establishmentsCount: 1, newProcessesCount: 0, newMovementsCount: 0 }
      });
    } else {
      await addSyncJob(tenantId, clientId, req.user!.name || 'User');
      return res.status(202).json({ 
        message: 'Sincronização iniciada com sucesso em background',
        summary: { success: true }
      });
    }
  } catch (error) {
    console.error('Trigger sync error:', error);
    return res.status(500).json({ error: 'Erro interno ao iniciar sincronização' });
  }
}
