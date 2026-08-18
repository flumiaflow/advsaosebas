import axios from 'axios';

// Mock structure based on DataJud API response
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
  private baseUrl = 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/v1'; // TST/TRT ex

  constructor() {
    // Para simplificar, pegamos a env global (que é pública conforme o plano)
    this.apiKey = process.env.DATAJUD_API_KEY || 'mock_datajud_key';
  }

  // Tries to fetch data with max 3 attempts and rate limit back-off
  async fetchByCnpj(cnpj: string): Promise<DataJudProcess[]> {
    let attempts = 0;
    const maxAttempts = 3;
    let searchAfter: string | null = null;
    const allResults: DataJudProcess[] = [];

    while (attempts < maxAttempts) {
      try {
        const payload: any = {
          query: {
            match: { "partes.numero_documento": cnpj }
          },
          size: 100 // max elements per page
        };

        if (searchAfter) {
          payload.search_after = searchAfter;
        }

        // --- MOCK INICIO ---
        // Simular comportamento sem fazer requisição real à DataJud ainda
        console.log(`[DATAJUD ADAPTER] Buscando CNPJ ${cnpj}, página com search_after: ${searchAfter}`);
        await sleep(1000); // Simulate network
        
        // Simulação de retorno de 1 processo mock na primeira chamada
        if (!searchAfter) {
          const mockData: DataJudProcess = {
            processNumber: `0001234-56.2023.5.02.0000`,
            justiceType: 'Trabalho',
            tribunal: 'TRT2',
            className: 'Ação Trabalhista',
            subjectMain: 'Horas Extras',
            subjectsExtra: [],
            value: 5000000,
            distributionDate: new Date(),
            status: 'Ativo',
            parties: [{ name: 'Empresa Teste SA', type: 'Reclamado' }],
            movements: [{
              eventId: 'mov_12345',
              date: new Date(),
              code: '123',
              name: 'Sentença Proferida',
              typeGroup: 'Sentença',
              description: 'Julgamento procedente em parte'
            }]
          };
          allResults.push(mockData);
        }
        
        // Simular que não tem mais páginas
        break; 
        // --- MOCK FIM ---

        /* Código real ficaria mais ou menos assim:
        const response = await axios.post(`${this.baseUrl}/_search`, payload, {
          headers: {
            'Authorization': `ApiKey ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // Parse response, map to DataJudProcess...
        // searchAfter = response.data.hits.hits[last].sort;
        */

      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          // Rate Limit
          console.warn(`[DATAJUD] Rate limit atingido para ${cnpj}. Aguardando 60s...`);
          await sleep(60000); 
          attempts++;
        } else {
          console.error(`[DATAJUD] Erro ao buscar CNPJ ${cnpj}:`, error.message);
          attempts++;
          await sleep(2000); // Back-off básico
        }
      }
    }

    if (attempts === maxAttempts) {
      throw new Error(`Falha ao sincronizar CNPJ ${cnpj} após ${maxAttempts} tentativas.`);
    }

    return allResults;
  }

  async fetchByProcessNumber(processNumber: string): Promise<DataJudProcess | null> {
    // --- MOCK ---
    console.log(`[DATAJUD ADAPTER] Buscando processo específico: ${processNumber}`);
    await sleep(500);

    // Se o processo terminar em '0000', simulamos que não foi encontrado.
    if (processNumber.endsWith('0000')) {
      return null;
    }

    return {
      processNumber,
      justiceType: 'Trabalho',
      tribunal: 'TRT2',
      className: 'Ação Trabalhista (Histórico)',
      subjectMain: 'Horas Extras',
      subjectsExtra: [],
      value: 10000,
      distributionDate: new Date('2020-01-01'),
      status: 'Ativo',
      parties: [{ name: 'Empresa Teste', type: 'Reclamado' }],
      movements: [{
        eventId: 'mov_old_1',
        date: new Date('2020-02-01'),
        code: '123',
        name: 'Petição Inicial',
        typeGroup: 'Petição',
        description: 'Distribuição da ação'
      }]
    };
  }
}
