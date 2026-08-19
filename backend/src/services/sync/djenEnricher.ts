import axios from 'axios';
import { prisma } from '../../config/db';
import { findOrCreateParty, linkPartyToProcess, normalizeName } from '../parties/partyService';

interface DjenAdvogado {
  nome: string;
  numero_oab?: string;
  uf_oab?: string;
}

interface DjenDestinatario {
  nome: string;
  polo?: string; // "A" (Autor), "P" (Réu), "T" (Terceiro)
  advogados?: DjenAdvogado[];
}

interface DjenItem {
  id: number;
  data_disponibilizacao: string;
  texto: string;
  destinatarios?: DjenDestinatario[];
  orgao?: string;
}

export async function enrichProcessFromDjen(processNumber: string, tenantId: string, processId: string) {
  try {
    const cleanNumber = processNumber.replace(/\D/g, '');
    if (cleanNumber.length < 15) return { success: false, reason: 'Número CNJ inválido' };

    // Endpoint público oficial do Diário de Justiça Eletrônico Nacional (DJEN / CNJ)
    const url = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
    
    const response = await axios.get(url, {
      params: {
        numeroProcesso: cleanNumber,
        itensPorPagina: 10
      },
      timeout: 6000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JurisWatch-SyncEngine/1.0'
      }
    }).catch(err => {
      // Falha de rede silenciosa para não travar o sync
      return null;
    });

    if (!response || !response.data || !response.data.items || response.data.items.length === 0) {
      return { success: false, reason: 'Nenhuma publicação localizada no DJEN' };
    }

    const items: DjenItem[] = response.data.items;
    const enrichedParties = [];

    for (const item of items) {
      if (item.destinatarios && Array.isArray(item.destinatarios)) {
        for (const dest of item.destinatarios) {
          if (!dest.nome || dest.nome.length < 3) continue;

          const poloMap: Record<string, string> = {
            'A': 'autor',
            'P': 'reu',
            'T': 'terceiro'
          };
          const sideMap: Record<string, string> = {
            'A': 'ativo',
            'P': 'passivo',
            'T': 'outros'
          };

          const polo = poloMap[dest.polo?.toUpperCase() || ''] || 'outro';
          const side = sideMap[dest.polo?.toUpperCase() || ''] || 'outros';

          // 1. Cria ou desmascara a Parte principal
          const party = await findOrCreateParty(tenantId, {
            name: dest.nome.trim(),
            type: dest.nome.includes('LTDA') || dest.nome.includes('S.A.') || dest.nome.includes('S/A') || dest.nome.includes('EIRELI') || dest.nome.includes('ME') 
              ? 'pessoa_juridica' 
              : 'pessoa_fisica',
            isMasked: false,
            enrichmentSource: 'djen_cnj'
          });

          await linkPartyToProcess({
            processId,
            partyId: party.id,
            tenantId,
            polo,
            side
          });

          enrichedParties.push({ id: party.id, name: party.name, polo });

          // 2. Se houver advogados informados na publicação, cadastra-os também
          if (dest.advogados && Array.isArray(dest.advogados)) {
            for (const adv of dest.advogados) {
              if (!adv.nome) continue;
              const advParty = await findOrCreateParty(tenantId, {
                name: adv.nome.trim(),
                type: 'advogado',
                oabNumber: adv.numero_oab || null,
                oabState: adv.uf_oab || null,
                isMasked: false,
                enrichmentSource: 'djen_cnj'
              });

              await linkPartyToProcess({
                processId,
                partyId: advParty.id,
                tenantId,
                polo: 'advogado',
                side,
                lawyerOab: adv.numero_oab ? `${adv.uf_oab || ''} ${adv.numero_oab}`.trim() : undefined
              });
            }
          }
        }
      }
    }

    return { success: true, count: enrichedParties.length, parties: enrichedParties };
  } catch (error) {
    console.error(`DJEN enrichment error for process ${processNumber}:`, error);
    return { success: false, error: 'Erro no enriquecimento DJEN' };
  }
}
