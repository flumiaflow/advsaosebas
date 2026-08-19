import { prisma } from '../../config/db';

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s]/gi, '') // remove pontuação
    .replace(/\s+/g, ' ') // normaliza espaços
    .trim()
    .toUpperCase();
}

export function cleanDocument(doc?: string | null): string | null {
  if (!doc) return null;
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length === 11 || cleaned.length === 14) {
    return cleaned;
  }
  return null;
}

export function isMaskedName(name: string): boolean {
  if (!name) return false;
  // Detecta se o nome está no formato J. A. S. ou ***.456 ou iniciais com pontos
  const trimmed = name.trim();
  if (trimmed.includes('***') || /^[A-Z]\.\s*[A-Z]\.\s*[A-Z]\.?/i.test(trimmed)) {
    return true;
  }
  return false;
}

export interface PartyInput {
  name: string;
  document?: string | null;
  documentType?: 'cpf' | 'cnpj' | 'oab' | 'outro';
  type?: 'pessoa_fisica' | 'pessoa_juridica' | 'advogado' | 'orgao_publico';
  oabNumber?: string | null;
  oabState?: string | null;
  isMasked?: boolean;
  enrichmentSource?: string;
}

export async function findOrCreateParty(tenantId: string, data: PartyInput) {
  const normName = normalizeName(data.name);
  const cleanDoc = cleanDocument(data.document);
  const isMasked = data.isMasked ?? isMaskedName(data.name);

  // 1. Tenta buscar por documento limpo (CPF/CNPJ) dentro do tenant
  if (cleanDoc) {
    const existingByDoc = await prisma.party.findUnique({
      where: {
        tenantId_document: {
          tenantId,
          document: cleanDoc
        }
      }
    });

    if (existingByDoc) {
      // Se o registro existente estava mascarado e agora veio um nome completo, desmascara
      if (existingByDoc.isMasked && !isMasked) {
        return prisma.party.update({
          where: { id: existingByDoc.id },
          data: {
            name: data.name,
            normalizedName: normName,
            isMasked: false,
            enrichmentSource: data.enrichmentSource || 'djen_cnj',
            enrichedAt: new Date(),
            ...(data.oabNumber && { oabNumber: data.oabNumber, oabState: data.oabState })
          }
        });
      }
      return existingByDoc;
    }
  }

  // 2. Se não tem doc limpo ou não achou por doc, busca por nome normalizado
  if (normName.length > 3) {
    const existingByName = await prisma.party.findFirst({
      where: {
        tenantId,
        normalizedName: normName
      }
    });

    if (existingByName) {
      // Se veio documento agora, vincula ao registro
      if (!existingByName.document && cleanDoc) {
        return prisma.party.update({
          where: { id: existingByName.id },
          data: {
            document: cleanDoc,
            documentType: data.documentType || (cleanDoc.length === 11 ? 'cpf' : 'cnpj'),
            isMasked: isMasked ? existingByName.isMasked : false,
            ...(data.enrichmentSource && { enrichmentSource: data.enrichmentSource, enrichedAt: new Date() })
          }
        });
      }
      return existingByName;
    }
  }

  // 3. Se não existe, cria a nova entidade canônica
  return prisma.party.create({
    data: {
      tenantId,
      name: data.name,
      normalizedName: normName || 'SEM NOME',
      document: cleanDoc || data.document || null,
      documentType: data.documentType || (cleanDoc ? (cleanDoc.length === 11 ? 'cpf' : 'cnpj') : 'outro'),
      type: data.type || (cleanDoc?.length === 14 ? 'pessoa_juridica' : 'pessoa_fisica'),
      oabNumber: data.oabNumber || null,
      oabState: data.oabState || null,
      isMasked,
      enrichmentSource: data.enrichmentSource || 'datajud',
      enrichedAt: isMasked ? null : new Date()
    }
  });
}

export interface LinkPartyParams {
  processId: string;
  partyId: string;
  tenantId: string;
  polo?: string;
  side?: string;
  lawyerOab?: string;
  isPrimary?: boolean;
  clientId?: string | null;
  establishmentId?: string | null;
}

export async function linkPartyToProcess(params: LinkPartyParams) {
  // Verifica se o vínculo já existe para não duplicar
  const existing = await prisma.processParty.findFirst({
    where: {
      processId: params.processId,
      partyId: params.partyId,
      tenantId: params.tenantId
    }
  });

  if (existing) {
    return prisma.processParty.update({
      where: { id: existing.id },
      data: {
        ...(params.polo && { polo: params.polo }),
        ...(params.side && { side: params.side }),
        ...(params.lawyerOab && { lawyerOab: params.lawyerOab }),
        ...(params.clientId && { clientId: params.clientId }),
        ...(params.establishmentId && { establishmentId: params.establishmentId })
      }
    });
  }

  return prisma.processParty.create({
    data: {
      processId: params.processId,
      partyId: params.partyId,
      tenantId: params.tenantId,
      polo: params.polo || 'outro',
      side: params.side || 'outros',
      lawyerOab: params.lawyerOab || null,
      isPrimary: params.isPrimary ?? false,
      clientId: params.clientId || null,
      establishmentId: params.establishmentId || null
    }
  });
}
