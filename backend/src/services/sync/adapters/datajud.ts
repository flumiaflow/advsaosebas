import axios from 'axios';
import { normalizeName } from '../../parties/partyService';

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
  parties: { name: string; type: string; document?: string; lawyerOab?: string }[];
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

const TJ_ENDPOINTS: Record<string, string> = {
  '01': 'api_publica_tjac',
  '02': 'api_publica_tjal',
  '03': 'api_publica_tjap',
  '04': 'api_publica_tjam',
  '05': 'api_publica_tjba',
  '06': 'api_publica_tjce',
  '07': 'api_publica_tjdft',
  '08': 'api_publica_tjes',
  '09': 'api_publica_tjgo',
  '10': 'api_publica_tjma',
  '11': 'api_publica_tjmt',
  '12': 'api_publica_tjms',
  '13': 'api_publica_tjmg',
  '14': 'api_publica_tjpa',
  '15': 'api_publica_tjpb',
  '16': 'api_publica_tjpr',
  '17': 'api_publica_tjpe',
  '18': 'api_publica_tjpi',
  '19': 'api_publica_tjrj',
  '20': 'api_publica_tjrn',
  '21': 'api_publica_tjrs',
  '22': 'api_publica_tjro',
  '23': 'api_publica_tjrr',
  '24': 'api_publica_tjsc',
  '25': 'api_publica_tjse',
  '26': 'api_publica_tjsp',
  '27': 'api_publica_tjto',
};

export function getTribunalEndpoint(processNumber: string): string {
  const clean = processNumber.replace(/\D/g, '');
  if (clean.length < 20) return 'api_publica_tst';

  const j = clean.slice(13, 14);
  const tr = clean.slice(14, 16);

  // 8 = Justiça Estadual
  if (j === '8') {
    return TJ_ENDPOINTS[tr] || `api_publica_tj${tr}`;
  }

  // 5 = Justiça do Trabalho
  if (j === '5') {
    if (tr === '00') return 'api_publica_tst';
    const numTr = parseInt(tr, 10);
    return `api_publica_trt${numTr}`;
  }

  // 4 = Justiça Federal
  if (j === '4') {
    const numTr = parseInt(tr, 10);
    return `api_publica_trf${numTr}`;
  }

  // 3 = Superior Tribunal de Justiça
  if (j === '3') return 'api_publica_stj';

  // 1 = Supremo Tribunal Federal
  if (j === '1') return 'api_publica_stf';

  // 2 = Conselho Nacional de Justiça
  if (j === '2') return 'api_publica_cnj';

  return 'api_publica_tst';
}

export function cleanPublicationText(raw?: string): string {
  if (!raw) return '';
  let str = raw;

  // Se tiver tags HTML, substitui tags de quebra/bloco por nova linha e limpa tags
  if (/<[a-z][\s\S]*>/i.test(str)) {
    str = str
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<\s*(?:br|p|div|section|article|header|footer|tr|li|h\d)[^>]*>/gi, '\n')
      .replace(/<\/[^>]+>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  // Decodifica entidades HTML comuns
  str = str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Ccedil;/gi, 'Ç')
    .replace(/&eacute;/gi, 'é')
    .replace(/&Eacute;/gi, 'É')
    .replace(/&aacute;/gi, 'á')
    .replace(/&Aacute;/gi, 'Á')
    .replace(/&agrave;/gi, 'à')
    .replace(/&Agrave;/gi, 'À')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&Atilde;/gi, 'Ã')
    .replace(/&acirc;/gi, 'â')
    .replace(/&Acirc;/gi, 'Â')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&Ecirc;/gi, 'Ê')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&Otilde;/gi, 'Õ')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&Ocirc;/gi, 'Ô')
    .replace(/&iacute;/gi, 'í')
    .replace(/&Iacute;/gi, 'Í')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&Uacute;/gi, 'Ú')
    .replace(/&ordm;/gi, 'º')
    .replace(/&ordf;/gi, 'ª')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // Remove linhas em branco excessivas
  return str
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .trim();
}

function extractDetailsFromText(rawText?: string) {
  if (!rawText) return {};
  const text = cleanPublicationText(rawText);
  const res: { subject?: string; value?: number; classe?: string; vara?: string } = {};

  // Assunto Principal: ...
  const matchAssunto = text.match(/Assunto\s*(?:Principal)?:\s*([^\n\r]+)/i);
  if (matchAssunto && matchAssunto[1]) {
    res.subject = matchAssunto[1].trim();
  }

  // Classe Processual: ...
  const matchClasse = text.match(/Classe\s*(?:Processual)?:\s*([^\n\r]+)/i);
  if (matchClasse && matchClasse[1]) {
    res.classe = matchClasse[1].trim();
  }

  // Valor da Causa: R$ 3.847,19
  const matchValor = text.match(/Valor\s*da\s*Causa:\s*R\$\s*([\d\.,]+)/i);
  if (matchValor && matchValor[1]) {
    const cleanVal = matchValor[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleanVal);
    if (!isNaN(num)) res.value = Math.round(num); // Nominal value in Reais
  }

  return res;
}

export class DataJudAdapter {
  private apiKey: string;
  private djenUrl = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

  constructor() {
    this.apiKey = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
  }

  async fetchByCnpjAndTerms(cnpj: string, terms: string[] = []): Promise<DataJudProcess[]> {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const processMap = new Map<string, {
      rawNum: string;
      tribunal: string;
      destinatarios: { nome: string; polo?: string }[];
      advogados: { nome: string; oab?: string; uf?: string }[];
      nomeClasse?: string;
      nomeOrgao?: string;
      tipoComunicacao?: string;
      texto?: string;
      link?: string;
      dataDisponibilizacao?: string;
    }>();

    // 1. Descoberta no DJEN pelos Termos / Razão Social / Nome dos Estabelecimentos (CNPJs)
    for (const term of terms) {
      if (!term || term.length < 5) continue;
      // Ignora termos genéricos curtos
      if (term.toUpperCase() === 'BOMMEISTER' || term.toUpperCase() === 'LTDA') continue;

      try {
        console.log(`[DJEN DISCOVERY] Buscando publicações pelo Nome / Razão Social Oficial "${term}"...`);
        let pagina = 1;
        let hasMore = true;
        const maxPages = 20; // Limite de salvaguarda

        while (hasMore && pagina <= maxPages) {
          const resTerm = await axios.get(this.djenUrl, {
            params: { nomeParte: term, itensPorPagina: 100, pagina },
            timeout: 8000
          });
          
          const items = resTerm.data?.items || [];
          if (items.length === 0) {
            hasMore = false;
            break;
          }

          if (items.length < 100) {
            hasMore = false;
          }

          for (const it of items) {
            if (it.numero_processo) {
              // Valida se o processo realmente contém a Razão Social da empresa nos destinatários com correspondência exata (evita homônimos como "Artefatos de Cimento e Materiais...")
              const dests = (it.destinatarios || []).map((d: any) => ({ nome: d.nome || '', polo: d.polo }));
              const hasMatchingRecipient = dests.some((d: any) => {
                const dNorm = normalizeName(d.nome);
                return terms.some(t => {
                  const tNorm = normalizeName(t);
                  if (tNorm.length < 5) return false;
                  // Exige correspondência exata de início ou igualdade completa
                  return dNorm === tNorm || dNorm.startsWith(tNorm) || tNorm.startsWith(dNorm);
                });
              });

              // Se o nome não bateu com nenhum destinatário, descarta o processo (evita falsos positivos)
              if (!hasMatchingRecipient) continue;

              const numKey = it.numero_processo.replace(/\D/g, '');
              if (!processMap.has(numKey)) {
                processMap.set(numKey, {
                  rawNum: it.numeroprocessocommascara || it.numero_processo,
                  tribunal: it.siglaTribunal || 'TJ',
                  destinatarios: dests,
                  advogados: (it.destinatarioadvogados || []).map((a: any) => ({
                    nome: a.advogado?.nome,
                    oab: a.advogado?.numero_oab,
                    uf: a.advogado?.uf_oab
                  })).filter((a: any) => a.nome),
                  nomeClasse: it.nomeClasse,
                  nomeOrgao: it.nomeOrgao,
                  tipoComunicacao: it.tipoComunicacao,
                  texto: it.texto,
                  link: it.link,
                  dataDisponibilizacao: it.data_disponibilizacao
                });
              }
            }
          }
          pagina++;
        }
      } catch (e: any) {
        console.warn(`[DJEN DISCOVERY] Aviso na busca por termo "${term}":`, e.message);
      }
    }

    console.log(`[SYNC ENGINE] Total de processos reais descobertos nas publicações: ${processMap.size}`);

    // 3. Para cada processo descoberto, consulta o DataJud no Tribunal específico para extrair a árvore completa de andamentos
    const allResults: DataJudProcess[] = [];
    for (const [procNum, djenMeta] of processMap.entries()) {
      try {
        const fullProc = await this.fetchByProcessNumber(procNum);
        const parsedFromText = extractDetailsFromText(djenMeta.texto);

        if (fullProc) {
          // Acrescenta os destinatários reais do DJEN às partes se não vieram do DataJud
          if (djenMeta.destinatarios.length > 0) {
            djenMeta.destinatarios.forEach(dest => {
              let tipoPolo = 'Polo Indeterminado';
              if (dest.polo === 'P') tipoPolo = 'Polo Passivo';
              if (dest.polo === 'A') tipoPolo = 'Polo Ativo';

              if (!fullProc.parties.some(p => p.name.toUpperCase() === dest.nome.toUpperCase())) {
                fullProc.parties.push({
                  name: dest.nome,
                  type: tipoPolo
                });
              }
            });
          }

          // Se faltavam detalhes de assunto/vara no DataJud, enriquece com DJEN
          if (fullProc.subjectMain === 'Não informado' && parsedFromText.subject) {
            fullProc.subjectMain = parsedFromText.subject;
          }
          if (fullProc.className === 'Não informada' && djenMeta.nomeClasse) {
            fullProc.className = djenMeta.nomeClasse;
          }
          if ((fullProc.justiceType === 'Desconhecido' || !fullProc.justiceType) && djenMeta.nomeOrgao) {
            fullProc.justiceType = djenMeta.nomeOrgao;
          }

          // Adiciona a publicação do DJEN aos movimentos
          if (djenMeta.texto) {
            fullProc.movements.unshift({
              eventId: `djen-${procNum}`,
              date: djenMeta.dataDisponibilizacao ? new Date(djenMeta.dataDisponibilizacao) : new Date(),
              code: '1061',
              name: djenMeta.tipoComunicacao ? `Publicação Oficial: ${djenMeta.tipoComunicacao}` : 'Publicação no Diário de Justiça Eletrônico Nacional (DJEN)',
              typeGroup: 'Publicação Oficial',
              description: djenMeta.texto
            });
          }

          allResults.push(fullProc);
        } else {
          // Processo descoberto no DJEN mas ainda não indexado no Elasticsearch aberto do DataJud
          const getTipoPolo = (dest: { nome: string; polo?: string }) => {
            if (dest.polo === 'P') return 'Polo Passivo';
            if (dest.polo === 'A') return 'Polo Ativo';
            return 'Polo Indeterminado';
          };
          
          const finalClasse = djenMeta.nomeClasse || parsedFromText.classe || 'Ação Judicial Eletrônica';
          const finalAssunto = parsedFromText.subject || djenMeta.nomeClasse || 'Processo Judicial Cível / Trabalhista';
          const finalOrgao = djenMeta.nomeOrgao || `Justiça Estadual / Federal (${djenMeta.tribunal})`;

          allResults.push({
            processNumber: djenMeta.rawNum || procNum,
            justiceType: finalOrgao,
            tribunal: djenMeta.tribunal,
            className: finalClasse,
            subjectMain: finalAssunto,
            subjectsExtra: parsedFromText.subject && djenMeta.nomeClasse ? [djenMeta.nomeClasse] : [],
            value: parsedFromText.value || 0,
            distributionDate: djenMeta.dataDisponibilizacao ? new Date(djenMeta.dataDisponibilizacao) : new Date(),
            status: 'Ativo',
            parties: djenMeta.destinatarios.map(d => ({
              name: d.nome,
              type: getTipoPolo(d)
            })),
            movements: [
              {
                eventId: `djen-${procNum}`,
                date: djenMeta.dataDisponibilizacao ? new Date(djenMeta.dataDisponibilizacao) : new Date(),
                code: '1061',
                name: djenMeta.tipoComunicacao ? `Publicação Oficial: ${djenMeta.tipoComunicacao}` : 'Publicação no Diário de Justiça Eletrônico Nacional (DJEN)',
                typeGroup: 'Publicação Oficial',
                description: djenMeta.texto || `Publicação e intimação oficial registrada nos autos do tribunal ${djenMeta.tribunal}.`
              }
            ]
          });
        }
      } catch (err: any) {
        console.warn(`[SYNC ENGINE] Erro ao extrair dados do processo ${procNum}:`, err.message);
      }
    }

    return allResults;
  }

  async fetchByCnpj(cnpj: string): Promise<DataJudProcess[]> {
    return this.fetchByCnpjAndTerms(cnpj, []);
  }

  async fetchByProcessNumber(processNumber: string): Promise<DataJudProcess | null> {
    if (!this.apiKey) {
      console.warn('[DATAJUD] Nenhuma chave de API configurada para busca por número de processo.');
      return null;
    }

    const cleanNumber = processNumber.replace(/\D/g, '');
    const endpointName = getTribunalEndpoint(cleanNumber);
    const endpointUrl = `https://api-publica.datajud.cnj.jus.br/${endpointName}/_search`;

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const payload = {
          query: {
            match: { "numeroProcesso": cleanNumber }
          },
          size: 1
        };

        const response = await axios.post(endpointUrl, payload, {
          headers: {
            'Authorization': `APIKey ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });

        const hits = response.data?.hits?.hits || [];
        if (hits.length === 0) return null;

        return this.mapDataJudResponse(hits[0]);

      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          attempts++;
          console.warn(`[DATAJUD] Rate limit (429) em ${endpointName} para ${cleanNumber}. Aguardando 5s...`);
          await sleep(5000);
        } else {
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
        name: m.nome || 'Movimentação Processual',
        typeGroup: m.nome || 'Andamento', 
        description: desc || 'Andamento registrado nos autos eletrônicos pelo tribunal de origem.'
      };
    });

    const mappedParties = (source.partes || []).map((p: any) => ({
      name: p.pessoa?.nome || p.nome || 'Desconhecido',
      type: p.polo === 'PA' || p.polo === 'AT' || p.polo === 'autor' ? 'Polo Ativo' : 'Polo Passivo',
      document: p.pessoa?.numeroDocumentoPrincipal || p.numeroDocumentoPrincipal
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

