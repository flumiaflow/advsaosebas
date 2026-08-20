import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { enrichProcessFromDjen } from '../services/sync/djenEnricher';

export async function getParties(req: Request, res: Response) {
  try {
    let tenantId = (req as any).user?.tenantId;
    if (!tenantId && (req as any).user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst({ where: { status: 'active' } });
      tenantId = firstTenant?.id;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant não especificado' });
    }

    const { search, type, isMasked, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };

    if (type) {
      where.type = type as string;
    }

    if (isMasked !== undefined) {
      where.isMasked = isMasked === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { document: { contains: search as string } },
        { oabNumber: { contains: search as string } }
      ];
    }

    const [total, parties] = await Promise.all([
      prisma.party.count({ where }),
      prisma.party.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { processParties: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
    ]);

    return res.json({
      total,
      page: pageNum,
      limit: limitNum,
      parties
    });
  } catch (error) {
    console.error('getParties error:', error);
    return res.status(500).json({ error: 'Erro ao listar partes' });
  }
}

export async function getPartyDetails(req: Request, res: Response) {
  try {
    let tenantId = (req as any).user?.tenantId;
    if (!tenantId && (req as any).user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst({ where: { status: 'active' } });
      tenantId = firstTenant?.id;
    }

    const id = String(req.params.id);

    const party = await prisma.party.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
      include: {
        processParties: {
          include: {
            process: true,
            client: true
          }
        }
      }
    });

    if (!party) {
      return res.status(404).json({ error: 'Parte não encontrada' });
    }

    return res.json(party);
  } catch (error) {
    console.error('getPartyDetails error:', error);
    return res.status(500).json({ error: 'Erro ao buscar detalhes da parte' });
  }
}

export async function forceEnrichProcess(req: Request, res: Response) {
  try {
    let tenantId = (req as any).user?.tenantId;
    if (!tenantId && (req as any).user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst({ where: { status: 'active' } });
      tenantId = firstTenant?.id;
    }

    const processId = String(req.params.processId);

    const process = await prisma.process.findFirst({
      where: { id: processId, ...(tenantId && { tenantId }) }
    });

    if (!process) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await enrichProcessFromDjen(process.processNumber, tenantId, process.id);
    return res.json(result);
  } catch (error) {
    console.error('forceEnrichProcess error:', error);
    return res.status(500).json({ error: 'Erro ao executar enriquecimento DJEN' });
  }
}
