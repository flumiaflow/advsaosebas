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

export async function triggerProcessSync(req: Request, res: Response) {
  try {
    const processId = req.params.processId as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }

    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    const { handleProcessSync } = await import('../services/sync/worker');
    const result = await handleProcessSync(processId, tenantId, req.user!.name || 'User');
    
    if (!result?.success) {
      return res.status(400).json({ error: result?.error || 'Erro na sincronização' });
    }

    return res.status(200).json({
      message: 'Processo sincronizado com sucesso!',
      summary: result
    });
  } catch (error) {
    console.error('Trigger process sync error:', error);
    return res.status(500).json({ error: 'Erro interno ao sincronizar processo' });
  }
}

export async function getSyncStatus(req: Request, res: Response) {
  try {
    const clientId = req.params.clientId as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }

    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    // Busca o job mais recente para esse cliente
    const lastJob = await prisma.syncJob.findFirst({
      where: { tenantId, clientId },
      orderBy: { startedAt: 'desc' }
    });

    if (!lastJob) {
      return res.status(200).json({ status: 'none' });
    }

    return res.status(200).json(lastJob);
  } catch (error) {
    console.error('Get sync status error:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar status' });
  }
}

export async function getSyncHistory(req: Request, res: Response) {
  try {
    const clientId = req.params.clientId as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }

    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    // Busca o histórico, limitado aos últimos 50 jobs do cliente no tenant
    const history = await prisma.syncJob.findMany({
      where: { tenantId, clientId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        tenantId: true,
        clientId: true,
        triggeredBy: true,
        type: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        clientsProcessed: true,
        newProcessesFound: true,
        newMovementsFound: true,
        failedEstablishments: true,
        partialErrorCount: true,
        errorMessage: true
        // NOTA: 'details' é explicitamente excluído aqui
      }
    });

    return res.status(200).json(history);
  } catch (error) {
    console.error('Get sync history error:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar histórico' });
  }
}

export async function getSyncJobDetails(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }

    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    const job = await prisma.syncJob.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        details: true
      }
    });

    if (!job) return res.status(404).json({ error: 'Sincronização não encontrada' });
    if (job.tenantId !== tenantId) return res.status(403).json({ error: 'Acesso negado' });

    return res.status(200).json({ details: job.details || [] });
  } catch (error) {
    console.error('Get sync job details error:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar detalhes' });
  }
}

export async function cancelSync(req: Request, res: Response) {
  try {
    const clientId = (req.params.id || req.params.clientId) as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    const userId = req.user?.userId;

    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    const updatedJobs = await prisma.syncJob.updateMany({
      where: { tenantId, clientId, status: 'running' },
      data: {
        status: 'cancelled',
        errorMessage: 'Sincronização cancelada pelo usuário.',
        finishedAt: new Date()
      }
    });

    if (updatedJobs.count > 0) {
      // Remover o Throttle para permitir nova sincronização imediata
      await prisma.syncThrottle.deleteMany({
        where: { clientId }
      });

      // Gravar na auditoria
      if (userId) {
        const { logAuditAction } = await import('../middlewares/auditLogger');
        await logAuditAction({
          tenantId,
          userId,
          action: 'SYNC_CANCELLED',
          metadata: { clientId, message: 'Varredura abortada manualmente.' }
        });
      }

      const { getIO } = await import('../../socket');
      const io = getIO();
      io.to(`tenant:${tenantId}`).emit('sync:cancelled', {
        clientId,
        success: false,
        error: 'Sincronização cancelada pelo usuário.'
      });
      return res.status(200).json({ message: 'Sincronização cancelada com sucesso.' });
    } else {
      return res.status(404).json({ error: 'Nenhuma sincronização em andamento encontrada.' });
    }
  } catch (error) {
    console.error('Cancel sync error:', error);
    return res.status(500).json({ error: 'Erro interno ao cancelar sincronização' });
  }
}

export async function getActiveSyncs(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(401).json({ error: 'Não autorizado' });

    const activeJobs = await prisma.syncJob.findMany({
      where: { tenantId, status: 'running' },
      select: { clientId: true }
    });

    return res.status(200).json(activeJobs.map(j => j.clientId));
  } catch (error) {
    console.error('Get active syncs error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
