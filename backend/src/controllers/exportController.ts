import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { Parser } from 'json2csv';
import { logAuditAction } from '../middlewares/auditLogger';

export async function exportAuditLogs(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role !== 'super_admin') {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { startDate, endDate, action } = req.query;

    const whereClause: any = { tenantId: tenantId || null };
    if (action) whereClause.action = action;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) whereClause.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    const data = logs.map(log => ({
      'Data/Hora': log.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      'Ação': log.action,
      'Usuário': log.userName || 'Sistema',
      'IP': log.ipAddress || 'N/A',
      'Tipo de Entidade': log.entityType || '',
      'Detalhes': JSON.stringify(log.metadata)
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    await logAuditAction({
      tenantId,
      userId: req.user?.userId,
      action: 'EXPORT_AUDIT_CSV'
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('auditoria.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return res.status(500).json({ error: 'Erro ao gerar exportação' });
  }
}

export async function exportProcesses(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    const { clientId } = req.query;

    const whereClause: any = { tenantId };
    if (clientId) {
      whereClause.processParties = {
        some: { clientId: clientId as string }
      };
    }

    const processes = await prisma.process.findMany({
      where: whereClause,
      include: {
        processParties: {
          include: { client: true, establishment: true }
        }
      },
      orderBy: { lastSyncAt: 'desc' }
    });

    const data = processes.map(p => {
      const clients = Array.from(new Set(p.processParties.map(pp => pp.client?.name).filter(Boolean))).join(' | ');
      const cnpjs = Array.from(new Set(p.processParties.map(pp => pp.establishment?.cnpj).filter(Boolean))).join(' | ');
      
      return {
        'Número CNJ': p.processNumber,
        'Tribunal': p.tribunal || '',
        'Justiça': p.justiceType || '',
        'Status': p.status,
        'Clientes': clients,
        'CNPJs': cnpjs,
        'Última Sincronização': p.lastSyncAt ? p.lastSyncAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Nunca',
      };
    });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    await logAuditAction({
      tenantId,
      userId: req.user?.userId,
      action: 'EXPORT_PROCESSES_CSV',
      metadata: { clientId }
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('processos.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting processes:', error);
    return res.status(500).json({ error: 'Erro ao gerar exportação' });
  }
}
