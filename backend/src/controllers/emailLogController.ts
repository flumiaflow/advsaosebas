import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getEmailLogs(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });
    
    // Apenas supervisores e admins devem ter acesso à auditoria
    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }

    const logs = await prisma.emailLog.findMany({
      where: { tenantId },
      include: {
        client: { select: { name: true, fantasyName: true } },
        user: { select: { name: true, email: true } }
      },
      orderBy: { sentAt: 'desc' },
      take: 100 // Limite simples para não sobrecarregar
    });

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return res.status(500).json({ error: 'Erro ao buscar logs de e-mail' });
  }
}
