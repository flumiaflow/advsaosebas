import axios from 'axios';

export interface DataJudProcess {
  processNumber: string;
  justiceType: string;
  tribunal: string;
  className: string;
  subjectMain: string;
  subjectsExtra: string[];
  value: number;
  distributionDate: Date;
  status: string;
  parties: { name: string; type: string }[];
  movements: {
    eventId: string;
    date: Date;
    code: string;
    name: string;
    typeGroup: string;
    description: string;
  }[];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class DataJudAdapter {
  private apiKey: string;
  // Usando a TST como base conforme plano
  private baseUrl = 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/v1';

  constructor() {
    this.apiKey = process.env.DATAJUD_API_KEY || '';
  }

  async fetchByCnpj(cnpj: string): Promise<DataJudProcess[]> {
    if (!this.apiKey || this.apiKey === 'mock_datajud_key') {
      console.warn('[DATAJUD] Chave da API inválida ou mock. Retornando vazio para não quebrar fluxo.');
      return [];
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    let searchAfter: string[] | null = null;
    const allResults: DataJudProcess[] = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (true) {
      try {
        const payload: any = {
          query: {
            match: { "partes.numero_documento": cleanCnpj }
          },
          size: 100,
          sort: [{ "@timestamp": "desc" }]
        };

        if (searchAfter) {
          payload.search_after = searchAfter;
        }

        console.log(`[DATAJUD ADAPTER] Buscando CNPJ ${cleanCnpj}... (Página, registros até agora: ${allResults.length})`);
        
        const response = await axios.post(`${this.baseUrl}/_search`, payload, {
          headers: {
            'Authorization': `APIKey ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const hits = response.data?.hits?.hits || [];
        
        for (const hit of hits) {
          const mapped = this.mapDataJudResponse(hit);
          if (mapped) allResults.push(mapped);
        }

        if (hits.length < 100) {
          break; // Sem mais páginas
        }

        const lastHit = hits[hits.length - 1];
        if (lastHit && lastHit.sort) {
          searchAfter = lastHit.sort;
          attempts = 0; // reseta rate limit error count
        } else {
          break;
        }

      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          attempts++;
          console.warn(`[DATAJUD] Rate limit (429) atingido. Tentativa ${attempts}/${maxAttempts}. Aguardando 60s...`);
          if (attempts >= maxAttempts) {
            throw new Error(`[DATAJUD] Falha ao sincronizar CNPJ ${cleanCnpj} após ${maxAttempts} tentativas de Rate Limit.`);
          }
          await sleep(60000); 
        } else {
          console.error(`[DATAJUD] Erro HTTP ao buscar CNPJ ${cleanCnpj}:`, error?.response?.data || error.message);
          throw new Error(`[DATAJUD] Erro na API do CNJ: ${error.message}`);
        }
      }
    }

    return allResults;
  }

  async fetchByProcessNumber(processNumber: string): Promise<DataJudProcess | null> {
    if (!this.apiKey || this.apiKey === 'mock_datajud_key') {
      console.warn('[DATAJUD] Chave da API inválida ou mock. Sincronização de processo único interrompida.');
      return null;
    }

    const cleanNumber = processNumber.replace(/\D/g, '');
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const payload = {
          query: {
            match: { "numeroProcesso": cleanNumber }
          },
          size: 1
        };

        const response = await axios.post(`${this.baseUrl}/_search`, payload, {
          headers: {
            'Authorization': `APIKey ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const hits = response.data?.hits?.hits || [];
        if (hits.length === 0) return null;

        return this.mapDataJudResponse(hits[0]);

      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          attempts++;
          console.warn(`[DATAJUD] Rate limit (429) atingido para ${cleanNumber}. Aguardando 60s...`);
          await sleep(60000);
        } else {
          console.error(`[DATAJUD] Erro HTTP ao buscar processo ${cleanNumber}:`, error?.response?.data || error.message);
          return null; 
        }
      }
    }
    
    return null;
  }

  private mapDataJudResponse(hit: any): DataJudProcess | null {
    const source = hit._source;
    if (!source) return null;

    const mappedMovements = (source.movimentos || []).map((m: any) => {
      let desc = '';
      if (Array.isArray(m.complementosTabelados)) {
        desc = m.complementosTabelados.map((comp: any) => `${comp.nome || ''} - ${comp.valor || ''}`).join(' | ');
      }

      return {
        eventId: String(m.identificadorMovimento || m.codigo || Math.random().toString(36)),
        date: new Date(m.dataHora),
        code: String(m.codigo || '0'),
        name: m.nome || 'Movimentação Genérica',
        typeGroup: m.nome || 'Outros', 
        description: desc || 'Sem complementos'
      };
    });

    const mappedParties = (source.partes || []).map((p: any) => ({
      name: p.pessoa?.nome || 'Desconhecido',
      type: p.polo || 'Indefinido'
    }));

    let subjectMain = 'Não informado';
    let subjectsExtra: string[] = [];
    if (Array.isArray(source.assuntos) && source.assuntos.length > 0) {
      subjectMain = source.assuntos[0]?.nome || 'Não informado';
      subjectsExtra = source.assuntos.slice(1).map((s: any) => s.nome).filter(Boolean);
    }

    return {
      processNumber: source.numeroProcesso,
      justiceType: source.orgaoJulgador?.nome || 'Desconhecido',
      tribunal: source.tribunal || 'Não informado',
      className: source.classe?.nome || 'Não informada',
      subjectMain,
      subjectsExtra,
      value: source.valorCausa || 0,
      distributionDate: source.dataAjuizamento ? new Date(source.dataAjuizamento) : new Date(),
      status: 'Ativo',
      parties: mappedParties,
      movements: mappedMovements
    };
  }
}
