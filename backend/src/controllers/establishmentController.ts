import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function createEstablishment(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'supervisor') return res.status(403).json({ error: 'Restrito a supervisores' });

    const tenantId = req.user!.tenantId!;
    const clientId = req.params.clientId as string;
    const { cnpj, razaoSocial, fantasyName, alias, type, state, city } = req.body;

    if (!cnpj) {
      return res.status(400).json({ error: 'Documento (CPF ou CNPJ) é obrigatório' });
    }

    const cleanedDoc = cnpj.replace(/\D/g, '');
    if (cleanedDoc.length !== 11 && cleanedDoc.length !== 14) {
      return res.status(400).json({ error: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' });
    }

    const isCpf = cleanedDoc.length === 11;
    if (isCpf && !razaoSocial) {
      return res.status(400).json({ error: 'Para CPF, o nome completo da pessoa é obrigatório.' });
    }
    if (!isCpf && !razaoSocial) {
      return res.status(400).json({ error: 'Razão Social é obrigatória para CNPJ.' });
    }

    // Formata o documento
    const formattedDoc = isCpf
      ? cleanedDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      : cleanedDoc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    // Verificar se documento já existe para este tenant
    const existing = await prisma.establishment.findUnique({
      where: {
        tenantId_cnpj: {
          tenantId,
          cnpj: formattedDoc
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Este documento já está cadastrado neste escritório.' });
    }

    const establishment = await prisma.establishment.create({
      data: {
        clientId,
        tenantId,
        cnpj: formattedDoc,
        razaoSocial,
        fantasyName,
        alias: alias || null,
        type: isCpf ? 'pessoa_fisica' : (type || 'matriz'),
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

    const id = req.params.id as string;
    
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
