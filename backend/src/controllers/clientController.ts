import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function getClients(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });

    // Se for supervisor, vê todos. Se for user comum, vê só os atribuídos
    let clients;
    if (req.user?.role === 'supervisor') {
      clients = await prisma.client.findMany({
        where: { tenantId },
        include: { _count: { select: { establishments: true } } }
      });
    } else {
      clients = await prisma.client.findMany({
        where: { 
          tenantId,
          userClientAccesses: { some: { userId: req.user.userId } }
        },
        include: { _count: { select: { establishments: true } } }
      });
    }

    return res.status(200).json(clients);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Acesso negado' });
    
    // Apenas supervisor pode criar empresa monitorada
    if (req.user?.role !== 'supervisor') return res.status(403).json({ error: 'Acesso restrito a supervisores' });

    const { name, fantasyName, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const client = await prisma.client.create({
      data: {
        tenantId,
        name,
        fantasyName,
        notes,
        createdById: req.user.userId
      }
    });

    return res.status(201).json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    // clientAccessMiddleware must be applied before this to check permissions
    const id = req.params.id as string;
    
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        establishments: true,
        userClientAccesses: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    return res.status(200).json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function assignUsersToClient(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor') return res.status(403).json({ error: 'Acesso restrito' });
    
    const id = req.params.id as string;
    const { userIds } = req.body; // array of user UUIDs
    
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds deve ser um array' });

    // Remove acessos antigos e cria novos atomicamente
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
