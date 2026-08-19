import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getProcesses(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const { clientId } = req.query;

    let processIds: string[] | undefined;

    if (clientId) {
      const parties = await prisma.processParty.findMany({
        where: { clientId: String(clientId), tenantId, isActive: true },
        select: { processId: true }
      });
      processIds = parties.map(p => p.processId);
    }

    const processes = await prisma.process.findMany({
      where: {
        tenantId,
        ...(processIds && { id: { in: processIds } })
      },
      orderBy: { distributionDate: 'desc' },
      include: {
        _count: { select: { movements: true } },
        processParties: {
          include: { client: true, establishment: true, party: true }
        },
        movements: {
          orderBy: { eventDate: 'desc' },
          take: 1
        }
      }
    });

    return res.status(200).json(processes);
  } catch (error) {
    console.error('getProcesses error:', error);
    return res.status(500).json({ error: 'Erro interno ao listar processos' });
  }
}

export async function getProcessDetails(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const proc = await prisma.process.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { eventDate: 'desc' } },
        processParties: { include: { party: true, client: true, establishment: true } }
      }
    });

    if (!proc || (proc.tenantId !== tenantId && req.user?.role !== 'super_admin')) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    return res.status(200).json(proc);
  } catch (error) {
    console.error('getProcessDetails error:', error);
    return res.status(500).json({ error: 'Erro interno ao obter detalhes do processo' });
  }
}

export async function enrichProcessWithDjen(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const proc = await prisma.process.findUnique({
      where: { id }
    });

    if (!proc || (proc.tenantId !== tenantId && req.user?.role !== 'super_admin')) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const { enrichProcessFromDjen } = await import('../services/sync/djenEnricher');
    const result = await enrichProcessFromDjen(proc.processNumber, proc.tenantId, proc.id);

    const updated = await prisma.process.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { eventDate: 'desc' } },
        processParties: { include: { party: true, client: true, establishment: true } }
      }
    });

    return res.status(200).json({
      message: 'Enriquecimento DJEN executado com sucesso',
      result,
      process: updated
    });
  } catch (error) {
    console.error('enrichProcessWithDjen error:', error);
    return res.status(500).json({ error: 'Erro interno ao enriquecer com DJEN' });
  }
}
