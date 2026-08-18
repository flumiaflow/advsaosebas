import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { logAuditAction } from '../middlewares/auditLogger';

export async function getSyncConfig(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    let config = await prisma.syncConfig.findUnique({ where: { tenantId } });
    if (!config) {
      config = await prisma.syncConfig.create({
        data: { tenantId }
      });
    }

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching sync config:', error);
    return res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
}

export async function updateSyncConfig(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor') {
      return res.status(403).json({ error: 'Apenas supervisores podem editar as configurações de sincronização' });
    }

    const { daysOfWeek, times, timezone, onlyActiveClients, tribunalTypes, isActive } = req.body;

    const updated = await prisma.syncConfig.upsert({
      where: { tenantId },
      update: {
        daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : undefined,
        times: times !== undefined ? times : undefined,
        timezone: timezone !== undefined ? timezone : undefined,
        onlyActiveClients: onlyActiveClients !== undefined ? onlyActiveClients : undefined,
        tribunalTypes: tribunalTypes !== undefined ? tribunalTypes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        daysOfWeek: daysOfWeek || [1,2,3,4,5],
        times: times || ['07:00'],
        timezone: timezone || 'America/Sao_Paulo',
        onlyActiveClients: onlyActiveClients !== undefined ? onlyActiveClients : true,
        tribunalTypes: tribunalTypes || [],
        isActive: isActive !== undefined ? isActive : true
      }
    });

    await logAuditAction({
      tenantId,
      userId: req.user.userId,
      action: 'SYNC_CONFIG_UPDATED',
      metadata: updated
    });

    // Also update tenant timezone if they passed a new one
    if (timezone) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { timezone } });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating sync config:', error);
    return res.status(500).json({ error: 'Erro ao atualizar configuração' });
  }
}

export async function getSyncHistory(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const { limit = 20 } = req.query;

    const jobs = await prisma.syncJob.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: Number(limit)
    });

    return res.status(200).json(jobs);
  } catch (error) {
    console.error('Error fetching sync jobs:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}
