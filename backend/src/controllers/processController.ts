import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { getCache, setCache } from '../config/redis';

export async function getProcesses(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const userId = req.user?.userId;
    const { clientId, search, limit, offset } = req.query;

    const cacheKey = `procs:${tenantId}:${clientId || 'all'}:${search || ''}:${limit || '500'}:${offset || '0'}`;
    const cached = await getCache<any>(cacheKey);

    let processIds: string[] | undefined;

    if (!cached) {
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
      } else {
        // GOLDEN RULE: Never show processes that are not explicitly linked to an active client
        const activeClients = await prisma.client.findMany({
          where: { tenantId, isActive: true },
          select: { id: true }
        });
        const activeClientIds = activeClients.map(c => c.id);

        const parties = await prisma.processParty.findMany({
          where: {
            tenantId,
            isActive: true,
            clientId: { in: activeClientIds }
          },
          select: { processId: true }
        });
        processIds = parties.map(p => p.processId);
      }
    }

    const take = limit ? Math.min(parseInt(String(limit)), 500) : 500;
    const skip = offset ? parseInt(String(offset)) : 0;

    const processes = cached || await prisma.process.findMany({
      where: {
        tenantId,
        ...(processIds && { id: { in: processIds } })
      },
      orderBy: { distributionDate: 'desc' },
      take,
      skip,
      select: {
        id: true,
        tenantId: true,
        processNumber: true,
        tribunal: true,
        justiceType: true,
        varaOrgao: true,
        className: true,
        subjectMain: true,
        subjectsExtra: true,
        status: true,
        distributionDate: true,
        value: true,
        lastSyncAt: true,
        _count: { select: { movements: true } },
        processParties: {
          select: {
            id: true,
            side: true,
            party: { select: { id: true, name: true, document: true } },
            client: { select: { id: true, name: true } },
            establishment: { select: { id: true, razaoSocial: true, cnpj: true, alias: true, type: true } }
          }
        },
        movements: {
          orderBy: { eventDate: 'desc' },
          take: 1,
          select: {
            id: true,
            eventName: true,
            eventDate: true,
            description: true,
            sourceEventId: true
          }
        }
      }
    });

    // Cache de 30 segundos (dados dos processos, sem estado de visualização)
    if (!cached) {
      await setCache(cacheKey, processes, 30);
    }

    // Enriquecer com estado de visualização per-user (NÃO cacheado)
    if (userId && processes.length > 0) {
      const procIds = processes.map((p: any) => p.id);
      const views = await prisma.processView.findMany({
        where: { userId, processId: { in: procIds } }
      });
      const viewMap = new Map(views.map(v => [v.processId, v]));

      const enriched = processes.map((proc: any) => {
        const view = viewMap.get(proc.id);
        const latestMovementDate = proc.movements?.[0]?.eventDate
          ? new Date(proc.movements[0].eventDate)
          : null;

        const isNew = !view;
        const hasUnseenUpdates = !isNew && latestMovementDate
          ? (!view.lastSeenMovementDate || latestMovementDate > view.lastSeenMovementDate)
          : false;

        return { ...proc, isNew, hasUnseenUpdates };
      });

      return res.status(200).json(enriched);
    }

    return res.status(200).json(processes);
  } catch (error) {
    console.error('getProcesses error:', error);
    return res.status(500).json({ error: 'Erro interno ao listar processos' });
  }
}

export async function getProcessDetails(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
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

    // Marcar processo como visualizado pelo usuário
    if (userId) {
      const latestMovementDate = proc.movements?.[0]?.eventDate || null;
      await prisma.processView.upsert({
        where: {
          userId_processId: { userId, processId: id }
        },
        update: {
          lastViewedAt: new Date(),
          lastSeenMovementDate: latestMovementDate
        },
        create: {
          userId,
          processId: id,
          lastViewedAt: new Date(),
          lastSeenMovementDate: latestMovementDate
        }
      });
    }

    return res.status(200).json(proc);
  } catch (error) {
    console.error('getProcessDetails error:', error);
    return res.status(500).json({ error: 'Erro interno ao obter detalhes do processo' });
  }
}

export async function markAllProcessesSeen(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId || !userId) return res.status(403).json({ error: 'Acesso negado' });

    const { until_timestamp } = req.body;
    if (!until_timestamp) {
      return res.status(400).json({ error: 'until_timestamp é obrigatório para evitar race conditions' });
    }

    const untilDate = new Date(until_timestamp);

    // Executa a inserção/atualização em massa usando Raw SQL para máxima performance.
    // Isso evita o gargalo de trazer milhares de registros para a memória do Node.js
    // e executar upserts sequenciais (que causariam timeout e travamento do pool do DB).
    const result = await prisma.$executeRaw`
      INSERT INTO process_views (user_id, process_id, last_viewed_at, last_seen_movement_date)
      SELECT 
        ${userId}::uuid as user_id,
        p.id as process_id,
        ${untilDate}::timestamp as last_viewed_at,
        (SELECT event_date FROM movements m WHERE m.process_id = p.id ORDER BY event_date DESC LIMIT 1) as last_seen_movement_date
      FROM processes p
      WHERE p.tenant_id = ${tenantId}::uuid AND p.first_seen_at <= ${untilDate}::timestamp
      ON CONFLICT (user_id, process_id) 
      DO UPDATE SET 
        last_viewed_at = EXCLUDED.last_viewed_at,
        last_seen_movement_date = EXCLUDED.last_seen_movement_date;
    `;

    return res.status(200).json({ success: true, count: result });
  } catch (error) {
    console.error('markAllProcessesSeen error:', error);
    return res.status(500).json({ error: 'Erro interno ao marcar processos como vistos' });
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
