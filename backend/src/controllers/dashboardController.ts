import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId!;
    const userId = req.user?.userId;
    const role = req.user?.role;

    // Se user for comum, só conta clientes vinculados
    let clientIds: string[] | undefined;
    if (role === 'user') {
      const accesses = await prisma.userClientAccess.findMany({
        where: { userId },
        select: { clientId: true }
      });
      clientIds = accesses.map(a => a.clientId);
    }

    const activeClients = await prisma.client.count({
      where: {
        tenantId,
        isActive: true,
        ...(clientIds && { id: { in: clientIds } })
      }
    });

    // Se user for comum, conta processos dos clientes vinculados
    let processIds: string[] | undefined;
    if (role === 'user' && clientIds) {
      const parties = await prisma.processParty.findMany({
        where: { tenantId, clientId: { in: clientIds } },
        select: { processId: true }
      });
      processIds = parties.map(p => p.processId);
    }

    const totalProcesses = await prisma.process.count({
      where: {
        tenantId,
        ...(processIds && { id: { in: processIds } })
      }
    });

    // Pega o último job de sync do sistema
    const lastSystemSync = await prisma.syncJob.findFirst({
      where: {
        tenantId,
        triggeredBy: 'system'
      },
      orderBy: { createdAt: 'desc' }
    });

    const isSystemSyncError = lastSystemSync?.status === 'error';

    return res.status(200).json({
      clients: activeClients,
      processes: totalProcesses,
      systemSyncError: isSystemSyncError
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar métricas' });
  }
}
