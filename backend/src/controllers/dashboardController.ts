import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { getCache, setCache } from '../config/redis';

export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    const userId = req.user?.userId;
    const role = req.user?.role;

    const cacheKey = `metrics:${tenantId || 'global'}:${userId || 'anon'}:${role}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Se user for comum, só conta clientes vinculados
    let clientIds: string[] | undefined;
    if (role === 'user') {
      const accesses = await prisma.userClientAccess.findMany({
        where: { userId },
        select: { clientId: true }
      });
      clientIds = accesses.map(a => a.clientId);
    }

    const [activeClients, totalProcesses, lastSystemSync] = await Promise.all([
      prisma.client.count({
        where: {
          ...(tenantId && { tenantId }),
          isActive: true,
          ...(clientIds && { id: { in: clientIds } })
        }
      }),
      (async () => {
        // Busca somente processos vinculados a clientes ativos
        const activeClientFilter = clientIds || (await prisma.client.findMany({
          where: { ...(tenantId && { tenantId }), isActive: true },
          select: { id: true }
        })).map(c => c.id);

        const parties = await prisma.processParty.findMany({
          where: { 
            ...(tenantId && { tenantId }), 
            isActive: true,
            clientId: { in: activeClientFilter } 
          },
          select: { processId: true }
        });
        const processIds = [...new Set(parties.map(p => p.processId))];

        return prisma.process.count({
          where: {
            ...(tenantId && { tenantId }),
            id: { in: processIds }
          }
        });
      })(),
      prisma.syncJob.findFirst({
        where: {
          ...(tenantId && { tenantId }),
          triggeredBy: 'system'
        },
        orderBy: { startedAt: 'desc' },
      })
    ]);

    const isSystemSyncError = lastSystemSync?.status === 'error';

    const responseData = {
      clients: activeClients,
      processes: totalProcesses,
      systemSyncError: isSystemSyncError
    };

    // Cache por 30 segundos
    await setCache(cacheKey, responseData, 30);

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(500).json({ error: 'Erro interno ao carregar métricas' });
  }
}
