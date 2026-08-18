import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const { action, startDate, endDate, page = 1, limit = 50 } = req.query;

    if (!tenantId && req.user?.role !== 'super_admin') {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const whereClause: any = {
      tenantId: tenantId || null // If super admin, fetch global logs (tenantId = NULL) or filter if needed
    };

    if (req.user?.role === 'super_admin' && req.query.tenantId) {
      whereClause.tenantId = req.query.tenantId; // Super Admin filtering by specific tenant
    }

    if (action) {
      whereClause.action = action;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
      if (endDate) whereClause.createdAt.lte = new Date(endDate as string);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.auditLog.count({ where: whereClause })
    ]);

    return res.status(200).json({
      data: logs,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
  }
}
