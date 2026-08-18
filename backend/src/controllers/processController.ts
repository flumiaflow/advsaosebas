import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getProcesses(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId!;
    const { clientId } = req.query; // Filtro opcional por empresa

    let processIds: string[] | undefined;

    // Se passou clientId, pega os processos daquela client
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
          include: { establishment: true }
        }
      }
    });

    return res.status(200).json(processes);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function getProcessDetails(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId!;

    const proc = await prisma.process.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { eventDate: 'desc' } },
        processParties: { include: { client: true, establishment: true } }
      }
    });

    if (!proc || proc.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    return res.status(200).json(proc);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}
