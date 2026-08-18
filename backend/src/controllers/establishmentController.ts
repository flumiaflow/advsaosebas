import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function createEstablishment(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor') return res.status(403).json({ error: 'Restrito a supervisores' });

    const tenantId = req.user.tenantId!;
    const { clientId } = req.params;
    const { cnpj, razaoSocial, fantasyName, type, state, city } = req.body;

    if (!cnpj || !razaoSocial) {
      return res.status(400).json({ error: 'CNPJ e Razão Social são obrigatórios' });
    }

    const cleanedCnpj = cnpj.replace(/\D/g, '');
    if (cleanedCnpj.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido' });
    }

    // Verificar se CNPJ já existe para este tenant
    const existing = await prisma.establishment.findUnique({
      where: {
        tenantId_cnpj: {
          tenantId,
          cnpj: cleanedCnpj
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Este CNPJ já está cadastrado neste escritório' });
    }

    const establishment = await prisma.establishment.create({
      data: {
        clientId,
        tenantId,
        cnpj: cleanedCnpj,
        razaoSocial,
        fantasyName,
        type: type || 'matriz',
        state,
        city
      }
    });

    return res.status(201).json(establishment);
  } catch (error) {
    console.error('Create establishment error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

export async function deactivateEstablishment(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor') return res.status(403).json({ error: 'Restrito a supervisores' });

    const { id } = req.params;
    
    // Soft delete / deactivate
    const est = await prisma.establishment.update({
      where: { id },
      data: { isActive: false }
    });

    // Desativa também o vínculo nos processos (como ditado pela regra de negócio)
    await prisma.processParty.updateMany({
      where: { establishmentId: id },
      data: { isActive: false }
    });

    return res.status(200).json(est);
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}
