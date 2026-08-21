import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { logAuditAction } from '../middlewares/auditLogger';

export async function getSyncConfig(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
      if (!tenantId) {
        const firstTenant = await prisma.tenant.findFirst();
        tenantId = firstTenant?.id;
      }
    }
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    let config = await prisma.syncConfig.findUnique({ where: { tenantId } });
    if (!config) {
      const globalSetting = await prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_SYNC_CONFIG' } });
      const defaultSync = (globalSetting?.value as any) || {
        daysOfWeek: [1, 2, 3, 4, 5],
        times: ['07:00'],
        timezone: 'America/Sao_Paulo',
        onlyActiveClients: true,
        tribunalTypes: [],
        isActive: true
      };

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

      config = await prisma.syncConfig.create({
        data: {
          tenantId,
          daysOfWeek: defaultSync.daysOfWeek || [1, 2, 3, 4, 5],
          times: defaultSync.times || ['07:00'],
          timezone: tenant?.timezone || defaultSync.timezone || 'America/Sao_Paulo',
          onlyActiveClients: defaultSync.onlyActiveClients !== undefined ? defaultSync.onlyActiveClients : true,
          tribunalTypes: defaultSync.tribunalTypes || [],
          isActive: defaultSync.isActive !== undefined ? defaultSync.isActive : true
        }
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
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
      if (!tenantId) {
        const firstTenant = await prisma.tenant.findFirst();
        tenantId = firstTenant?.id;
      }
    }
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Apenas supervisores do escritório podem editar as configurações de sincronização' });
    }

    const { daysOfWeek, times, timezone, onlyActiveClients, tribunalTypes, isActive } = req.body;

    // Validações
    if (daysOfWeek !== undefined && (!Array.isArray(daysOfWeek) || daysOfWeek.some(d => typeof d !== 'number' || d < 0 || d > 6))) {
      return res.status(400).json({ error: 'Dias da semana inválidos' });
    }

    if (times !== undefined && (!Array.isArray(times) || times.some(t => typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)))) {
      return res.status(400).json({ error: 'Horários inválidos (formato HH:mm)' });
    }

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
        daysOfWeek: daysOfWeek || [1, 2, 3, 4, 5],
        times: times || ['07:00'],
        timezone: timezone || 'America/Sao_Paulo',
        onlyActiveClients: onlyActiveClients !== undefined ? onlyActiveClients : true,
        tribunalTypes: tribunalTypes || [],
        isActive: isActive !== undefined ? isActive : true
      }
    });

    await logAuditAction({
      tenantId,
      userId: req.user!.userId,
      action: 'SYNC_CONFIG_UPDATED',
      entityType: 'SyncConfig',
      entityId: tenantId,
      metadata: updated,
      ipAddress: req.ip
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
