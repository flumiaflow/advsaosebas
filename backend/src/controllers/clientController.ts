import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { logAuditAction } from '../middlewares/auditLogger';
import { getCache, setCache } from '../config/redis';

export async function getClients(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    const userId = req.user?.userId;
    const role = req.user?.role;
    const cacheKey = `clients:${tenantId}:${role === 'user' ? userId : 'all'}`;

    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Se for supervisor ou super_admin, vê todos. Se for user comum, vê só os atribuídos
    let clients;
    if (role === 'supervisor' || role === 'super_admin') {
      clients = await prisma.client.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          name: true,
          fantasyName: true,
          notes: true,
          isActive: true,
          createdAt: true,
          establishments: {
            select: { id: true, cnpj: true, razaoSocial: true, fantasyName: true, alias: true, type: true },
            orderBy: { createdAt: 'asc' }
          },
          _count: { select: { establishments: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      clients = await prisma.client.findMany({
        where: { 
          tenantId,
          userClientAccesses: { some: { userId: req.user!.userId } }
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          fantasyName: true,
          notes: true,
          isActive: true,
          createdAt: true,
          establishments: {
            select: { id: true, cnpj: true, razaoSocial: true, fantasyName: true, alias: true, type: true },
            orderBy: { createdAt: 'asc' }
          },
          _count: { select: { establishments: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // Cache por 60 segundos
    await setCache(cacheKey, clients, 60);

    return res.status(200).json(clients);
  } catch (error) {
    console.error('getClients error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });
    
    // Supervisor e Super Admin podem criar empresa monitorada
    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito a supervisores' });
    }

    const { name, fantasyName, notes, cnpjs, cnpj } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome / Razão Social é obrigatório' });

    // Processa lista de documentos (array de strings ou objetos com alias/razaoSocial)
    const rawList: any[] = Array.isArray(cnpjs) ? cnpjs : (cnpj ? [cnpj] : []);
    const formatDoc = (c: string) => c.length === 11
      ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      : c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    const parsedDocs = rawList.map((c: any) => {
      if (typeof c === 'string') {
        const clean = c.replace(/\D/g, '');
        return { clean, formatted: formatDoc(clean), alias: null as string | null, razaoSocial: null as string | null };
      }
      const clean = String(c.cnpj || c.document || c).replace(/\D/g, '');
      return { clean, formatted: formatDoc(clean), alias: c.alias || null, razaoSocial: c.razaoSocial || null };
    }).filter(d => d.clean.length === 11 || d.clean.length === 14);

    // Deduplica
    const seen = new Set<string>();
    const uniqueDocs = parsedDocs.filter(d => {
      if (seen.has(d.formatted)) return false;
      seen.add(d.formatted);
      return true;
    });

    // Checa se algum documento já pertence a outro cliente deste tenant
    const formattedList = uniqueDocs.map(d => d.formatted);
    if (formattedList.length > 0) {
      const existingEsts = await prisma.establishment.findMany({
        where: {
          tenantId,
          cnpj: { in: formattedList }
        },
        include: { client: { select: { name: true } } }
      });

      if (existingEsts.length > 0) {
        const conflict = existingEsts[0];
        return res.status(409).json({ 
          error: `O documento ${conflict.cnpj} já está cadastrado na empresa "${conflict.client?.name || 'outra empresa'}".` 
        });
      }
    }

    // Consulta automática da Razão Social oficial de cada CNPJ via BrasilAPI / ReceitaWS
    // Para CPFs, pula o enriquecimento — nome completo é informado pelo usuário
    const { lookupCompanyByCnpj } = await import('../services/cnpjLookup');
    const establishmentsData = await Promise.all(
      uniqueDocs.map(async (doc, idx) => {
        const isCpf = doc.clean.length === 11;
        const companyInfo = isCpf ? null : await lookupCompanyByCnpj(doc.formatted);
        return {
          tenantId: tenantId!,
          cnpj: doc.formatted,
          razaoSocial: doc.razaoSocial || companyInfo?.razaoSocial || name,
          fantasyName: companyInfo?.fantasyName || fantasyName || name,
          alias: doc.alias || null,
          type: isCpf ? 'pessoa_fisica' : (idx === 0 ? 'matriz' : 'filial')
        };
      })
    );

    const client = await prisma.client.create({
      data: {
        tenantId,
        name,
        fantasyName,
        notes,
        createdById: req.user!.userId,
        ...(establishmentsData.length > 0 ? {
          establishments: {
            create: establishmentsData
          }
        } : {})
      },
      include: {
        establishments: true,
        _count: { select: { establishments: true } }
      }
    });

    await logAuditAction({
      tenantId,
      userId: req.user!.userId,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      metadata: { name, docsCount: uniqueDocs.length }
    });

    return res.status(201).json(client);
  } catch (error: any) {
    console.error('Create client error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Um dos documentos informados já está cadastrado para este escritório.' });
    }
    return res.status(500).json({ error: 'Erro interno ao criar cliente' });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        establishments: { orderBy: { createdAt: 'asc' } },
        userClientAccesses: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    return res.status(200).json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function assignUsersToClient(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso restrito' });
    }
    
    const id = req.params.id as string;
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds deve ser um array' });

    await prisma.$transaction(async (tx) => {
      await tx.userClientAccess.deleteMany({ where: { clientId: id } });
      
      const inserts = userIds.map((userId: string) => ({
        clientId: id,
        userId: userId
      }));

      if (inserts.length > 0) {
        await tx.userClientAccess.createMany({ data: inserts });
      }
    });

    return res.status(200).json({ message: 'Acessos atualizados com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    const id = req.params.id as string;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

    if (req.user?.role !== 'supervisor' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Apenas supervisores podem editar clientes' });
    }

    const { name, fantasyName, notes, isActive, cnpjs } = req.body;

    const existingClient = await prisma.client.findUnique({
      where: { id },
      include: { establishments: true }
    });

    if (!existingClient || (existingClient.tenantId !== tenantId && req.user?.role !== 'super_admin')) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Atualiza dados básicos
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name,
        fantasyName,
        notes,
        isActive
      }
    });

    // Se cnpjs foi enviado, sincroniza estabelecimentos (aceita strings ou objetos com alias)
    if (Array.isArray(cnpjs)) {
      const formatDoc = (c: string) => c.length === 11
        ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
        : c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      const parsedDocs = cnpjs.map((c: any) => {
        if (typeof c === 'string') {
          const clean = c.replace(/\D/g, '');
          return { clean, formatted: formatDoc(clean), alias: null as string | null, razaoSocial: null as string | null };
        }
        const clean = String(c.cnpj || c.document || c).replace(/\D/g, '');
        return { clean, formatted: formatDoc(clean), alias: c.alias || null, razaoSocial: c.razaoSocial || null };
      }).filter((d: any) => d.clean.length === 11 || d.clean.length === 14);

      const seen = new Set<string>();
      const uniqueDocs = parsedDocs.filter((d: any) => {
        if (seen.has(d.formatted)) return false;
        seen.add(d.formatted);
        return true;
      });

      const existingEsts = existingClient.establishments;
      const existingDocSet = new Set(existingEsts.map(e => e.cnpj));
      const targetDocSet = new Set(uniqueDocs.map((d: any) => d.formatted));

      // Novos documentos a adicionar
      const toCreate = uniqueDocs.filter((d: any) => !existingDocSet.has(d.formatted));
      if (toCreate.length > 0) {
        const { lookupCompanyByCnpj } = await import('../services/cnpjLookup');
        const establishmentsToCreate = await Promise.all(
          toCreate.map(async (doc: any, idx: number) => {
            const isCpf = doc.clean.length === 11;
            const info = isCpf ? null : await lookupCompanyByCnpj(doc.formatted);
            return {
              tenantId: existingClient.tenantId,
              clientId: id,
              cnpj: doc.formatted,
              razaoSocial: doc.razaoSocial || info?.razaoSocial || name || existingClient.name,
              fantasyName: info?.fantasyName || fantasyName || existingClient.fantasyName || name,
              alias: doc.alias || null,
              type: isCpf ? 'pessoa_fisica' : (existingEsts.length === 0 && idx === 0 ? 'matriz' : 'filial')
            };
          })
        );

        await prisma.establishment.createMany({
          data: establishmentsToCreate
        });
      }

      // Atualiza alias de documentos existentes que foram reenviados
      for (const doc of uniqueDocs) {
        const existingEst = existingEsts.find((e: any) => e.cnpj === doc.formatted);
        if (existingEst && doc.alias !== undefined) {
          await prisma.establishment.update({
            where: { id: existingEst.id },
            data: { alias: doc.alias || null }
          });
        }
      }

      // Documentos a remover
      const toRemove = existingEsts.filter(e => !targetDocSet.has(e.cnpj));
      if (toRemove.length > 0) {
        await prisma.establishment.deleteMany({
          where: { id: { in: toRemove.map(e => e.id) } }
        });
      }
    }

    await logAuditAction({
      tenantId: existingClient.tenantId,
      userId: req.user!.userId,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: id,
      metadata: { name, isActive }
    });

    const refreshedClient = await prisma.client.findUnique({
      where: { id },
      include: {
        establishments: { orderBy: { createdAt: 'asc' } },
        _count: { select: { establishments: true } }
      }
    });

    return res.status(200).json(refreshedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    return res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}
