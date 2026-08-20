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
      const establishments = await prisma.establishment.findMany({
        where: { clientId: String(clientId), tenantId },
        select: { id: true }
      });
      const establishmentIds = establishments.map(e => e.id);

      const parties = await prisma.processParty.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { clientId: String(clientId) },
            ...(establishmentIds.length > 0 ? [{ establishmentId: { in: establishmentIds } }] : [])
          ]
        },
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

export async function getProcessDocuments(req: Request, res: Response) {
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
        movements: { orderBy: { eventDate: 'desc' } }
      }
    });

    if (!proc || (proc.tenantId !== tenantId && req.user?.role !== 'super_admin')) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    // Categoriza e mapeia os documentos e peças associados
    const documents = proc.movements.map(m => {
      const name = m.eventName || '';
      const desc = m.description || '';
      const comp = m.complement || '';
      const raw = (m.rawData as any) || {};

      let category: 'sentenca' | 'decisao' | 'intimacao' | 'peticao' | 'certidao' | 'outros' = 'outros';
      const lowerName = name.toLowerCase();

      if (lowerName.includes('sentença') || lowerName.includes('acórdão') || lowerName.includes('acolhimento') || lowerName.includes('julgamento')) {
        category = 'sentenca';
      } else if (lowerName.includes('decisão') || lowerName.includes('despacho') || lowerName.includes('deferimento') || lowerName.includes('indeferimento') || lowerName.includes('liminar') || lowerName.includes('tutela')) {
        category = 'decisao';
      } else if (lowerName.includes('intimação') || lowerName.includes('citação') || lowerName.includes('publicação') || lowerName.includes('djen') || lowerName.includes('dje')) {
        category = 'intimacao';
      } else if (lowerName.includes('petição') || lowerName.includes('protocolo') || lowerName.includes('juntada') || lowerName.includes('contestação') || lowerName.includes('recurso') || lowerName.includes('réplica')) {
        category = 'peticao';
      } else if (lowerName.includes('certidão') || lowerName.includes('mandado') || lowerName.includes('alvará') || lowerName.includes('guia') || lowerName.includes('ar ') || lowerName.includes('recebimento')) {
        category = 'certidao';
      }

      const documentUrl = (comp.startsWith('http://') || comp.startsWith('https://')) ? comp : raw.link || null;
      let tribunalSource = proc.tribunal || 'Tribunal de Justiça';
      if (documentUrl) {
        if (documentUrl.includes('projudi')) tribunalSource = 'Projudi / TJPR';
        else if (documentUrl.includes('eproc')) tribunalSource = 'Eproc / TJSP';
        else if (documentUrl.includes('pje')) tribunalSource = 'PJe / CNJ';
        else if (documentUrl.includes('esaj') || documentUrl.includes('tjsp.jus.br')) tribunalSource = 'e-SAJ / TJSP';
        else if (documentUrl.includes('dje')) tribunalSource = 'Diário Oficial (DJe)';
      }

      const hasFullText = desc.length > 60 && !desc.includes('Andamento registrado nos autos eletrônicos');

      return {
        id: m.id,
        movementId: m.id,
        sourceEventId: m.sourceEventId,
        title: name,
        category,
        eventDate: m.eventDate,
        publishedAt: m.publishedAt || m.eventDate,
        description: desc,
        hasFullText,
        documentUrl,
        hash: raw.hash || null,
        tribunalSource,
        importType: m.importType,
        source: m.source
      };
    });

    const stats = {
      total: documents.length,
      withDirectUrl: documents.filter(d => !!d.documentUrl).length,
      withFullText: documents.filter(d => d.hasFullText).length,
      byCategory: {
        sentenca: documents.filter(d => d.category === 'sentenca').length,
        decisao: documents.filter(d => d.category === 'decisao').length,
        intimacao: documents.filter(d => d.category === 'intimacao').length,
        peticao: documents.filter(d => d.category === 'peticao').length,
        certidao: documents.filter(d => d.category === 'certidao').length,
        outros: documents.filter(d => d.category === 'outros').length
      }
    };

    return res.status(200).json({
      processId: proc.id,
      processNumber: proc.processNumber,
      tribunal: proc.tribunal,
      stats,
      documents
    });
  } catch (error) {
    console.error('getProcessDocuments error:', error);
    return res.status(500).json({ error: 'Erro interno ao listar documentos do processo' });
  }
}
