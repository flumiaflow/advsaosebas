import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { logAuditAction } from '../middlewares/auditLogger';

const FALLBACK_DEFAULTS = {
  daysOfWeek: [1, 2, 3, 4, 5],
  times: ['07:00'],
  timezone: 'America/Sao_Paulo',
  onlyActiveClients: true,
  tribunalTypes: [],
  isActive: true
};

export async function getGlobalSyncDefaults(req: Request, res: Response) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_SYNC_CONFIG' }
    });

    if (!setting) {
      return res.status(200).json(FALLBACK_DEFAULTS);
    }

    return res.status(200).json(setting.value);
  } catch (error) {
    console.error('getGlobalSyncDefaults error:', error);
    return res.status(500).json({ error: 'Erro ao buscar padrões de sincronização' });
  }
}

export async function updateGlobalSyncDefaults(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Apenas Super Administradores podem alterar os padrões do sistema' });
    }

    const { daysOfWeek, times, timezone, onlyActiveClients, tribunalTypes, isActive } = req.body;

    // Validações básicas
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some(d => typeof d !== 'number' || d < 0 || d > 6))) {
      return res.status(400).json({ error: 'Dias da semana inválidos (deve ser array de 0 a 6)' });
    }

    if (times && (!Array.isArray(times) || times.some(t => typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)))) {
      return res.status(400).json({ error: 'Horários inválidos (deve ser array de strings no formato HH:mm)' });
    }

    const currentSetting = await prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_SYNC_CONFIG' }
    });

    const currentValue = (currentSetting?.value as any) || FALLBACK_DEFAULTS;

    const newValue = {
      daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : currentValue.daysOfWeek,
      times: times !== undefined ? times : currentValue.times,
      timezone: timezone !== undefined ? timezone : currentValue.timezone,
      onlyActiveClients: onlyActiveClients !== undefined ? onlyActiveClients : currentValue.onlyActiveClients,
      tribunalTypes: tribunalTypes !== undefined ? tribunalTypes : currentValue.tribunalTypes,
      isActive: isActive !== undefined ? isActive : currentValue.isActive
    };

    const updated = await prisma.systemSetting.upsert({
      where: { key: 'DEFAULT_SYNC_CONFIG' },
      update: {
        value: newValue,
        updatedAt: new Date()
      },
      create: {
        key: 'DEFAULT_SYNC_CONFIG',
        value: newValue,
        description: 'Configuração padrão de sincronização automática herdada por novos escritórios'
      }
    });

    await logAuditAction({
      userId: req.user.userId,
      action: 'GLOBAL_SYNC_DEFAULTS_UPDATED',
      entityType: 'SystemSetting',
      entityId: 'DEFAULT_SYNC_CONFIG',
      metadata: newValue,
      ipAddress: req.ip
    });

    return res.status(200).json(updated.value);
  } catch (error) {
    console.error('updateGlobalSyncDefaults error:', error);
    return res.status(500).json({ error: 'Erro ao salvar padrões de sincronização' });
  }
}

export async function applyDefaultsToAllTenants(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_SYNC_CONFIG' }
    });

    const defaults = (setting?.value as any) || FALLBACK_DEFAULTS;

    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, timezone: true }
    });

    let updatedCount = 0;
    for (const t of tenants) {
      await prisma.syncConfig.upsert({
        where: { tenantId: t.id },
        update: {
          daysOfWeek: defaults.daysOfWeek,
          times: defaults.times,
          timezone: t.timezone || defaults.timezone,
          onlyActiveClients: defaults.onlyActiveClients,
          tribunalTypes: defaults.tribunalTypes,
          isActive: defaults.isActive,
          updatedAt: new Date()
        },
        create: {
          tenantId: t.id,
          daysOfWeek: defaults.daysOfWeek,
          times: defaults.times,
          timezone: t.timezone || defaults.timezone,
          onlyActiveClients: defaults.onlyActiveClients,
          tribunalTypes: defaults.tribunalTypes,
          isActive: defaults.isActive
        }
      });
      updatedCount++;
    }

    await logAuditAction({
      userId: req.user.userId,
      action: 'GLOBAL_SYNC_DEFAULTS_PROPAGATED',
      entityType: 'SystemSetting',
      metadata: { affectedTenants: updatedCount },
      ipAddress: req.ip
    });

    return res.status(200).json({
      message: `Padrão aplicado com sucesso a ${updatedCount} escritórios ativos!`,
      affectedTenants: updatedCount
    });
  } catch (error) {
    console.error('applyDefaultsToAllTenants error:', error);
    return res.status(500).json({ error: 'Erro ao propagar padrões para escritórios' });
  }
}
