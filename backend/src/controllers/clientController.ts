import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { logAuditAction } from '../middlewares/auditLogger';

export async function getClients(req: Request, res: Response) {
  try {
    let tenantId = req.user?.tenantId;
    if (!tenantId && req.user?.role === 'super_admin') {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    // Se for supervisor ou super_admin, vê todos. Se for user comum, vê só os atribuídos
    let clients;
    if (req.user?.role === 'supervisor' || req.user?.role === 'super_admin') {
      clients = await prisma.client.findMany({
        where: { tenantId },
        include: { 
          establishments: { orderBy: { createdAt: 'asc' } },
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
        include: { 
          establishments: { orderBy: { createdAt: 'asc' } },
          _count: { select: { establishments: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    return res.status(200).json(clients);
  } catch (error) {
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

    // Processa lista de CNPJs (array de strings ou objetos)
    const rawList: string[] = Array.isArray(cnpjs) ? cnpjs : (cnpj ? [cnpj] : []);
    const validCnpjs = rawList
      .map(c => typeof c === 'string' ? c.replace(/\D/g, '') : (c?.cnpj?.replace(/\D/g, '') || ''))
      .filter(c => c.length === 14)
      .map(c => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'));

    const uniqueCnpjs = Array.from(new Set(validCnpjs));

    // Checa se algum CNPJ já pertence a outro cliente deste tenant
    if (uniqueCnpjs.length > 0) {
      const existingEsts = await prisma.establishment.findMany({
        where: {
          tenantId,
          cnpj: { in: uniqueCnpjs }
        },
        include: { client: { select: { name: true } } }
      });

      if (existingEsts.length > 0) {
        const conflict = existingEsts[0];
        return res.status(409).json({ 
          error: `O CNPJ ${conflict.cnpj} já está cadastrado na empresa "${conflict.client?.name || 'outra empresa'}".` 
        });
      }
    }

    const client = await prisma.client.create({
      data: {
        tenantId,
        name,
        fantasyName,
        notes,
        createdById: req.user!.userId,
        ...(uniqueCnpjs.length > 0 ? {
          establishments: {
            create: uniqueCnpjs.map((cnpjStr, idx) => ({
              tenantId,
              cnpj: cnpjStr,
              razaoSocial: name,
              fantasyName: fantasyName || name,
              type: idx === 0 ? 'matriz' : 'filial'
            }))
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
      metadata: { name, cnpjsCount: uniqueCnpjs.length }
    });

    return res.status(201).json(client);
  } catch (error: any) {
    console.error('Create client error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Um dos CNPJs informados já está cadastrado para este escritório.' });
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

    // Se cnpjs foi enviado, sincroniza estabelecimentos
    if (Array.isArray(cnpjs)) {
      const validCnpjs = cnpjs
        .map(c => typeof c === 'string' ? c.replace(/\D/g, '') : (c?.cnpj?.replace(/\D/g, '') || ''))
        .filter(c => c.length === 14)
        .map(c => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'));
      const uniqueCnpjs = Array.from(new Set(validCnpjs));

      const existingEsts = existingClient.establishments;
      const existingCnpjSet = new Set(existingEsts.map(e => e.cnpj));
      const targetCnpjSet = new Set(uniqueCnpjs);

      // Novos CNPJs a adicionar
      const toCreate = uniqueCnpjs.filter(c => !existingCnpjSet.has(c));
      if (toCreate.length > 0) {
        await prisma.establishment.createMany({
          data: toCreate.map((cnpjStr, idx) => ({
            tenantId: existingClient.tenantId,
            clientId: id,
            cnpj: cnpjStr,
            razaoSocial: name || existingClient.name,
            fantasyName: fantasyName || existingClient.fantasyName,
            type: existingEsts.length === 0 && idx === 0 ? 'matriz' : 'filial'
          }))
        });
      }

      // CNPJs a remover
      const toRemove = existingEsts.filter(e => !targetCnpjSet.has(e.cnpj));
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
