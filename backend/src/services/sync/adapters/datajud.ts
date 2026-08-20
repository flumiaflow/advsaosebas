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

export function getTribunalEndpoint(processNumber: string): string {
  const clean = processNumber.replace(/\D/g, '');
  if (clean.length < 20) return 'api_publica_tst';

  const j = clean.slice(13, 14);
  const tr = clean.slice(14, 16);

  if (j === '5') {
    if (tr === '02') return 'api_publica_trt2';
    if (tr === '09') return 'api_publica_trt9';
    if (tr === '15') return 'api_publica_trt15';
    if (tr === '00') return 'api_publica_tst';
    return `api_publica_trt${parseInt(tr)}`;
  }
  if (j === '8') {
    if (tr === '16') return 'api_publica_tjpr';
    if (tr === '26') return 'api_publica_tjsp';
    if (tr === '13') return 'api_publica_tjmg';
    if (tr === '21') return 'api_publica_tjrs';
    if (tr === '24') return 'api_publica_tjsc';
    if (tr === '19') return 'api_publica_tjrj';
    return `api_publica_tj${tr}`;
  }
  if (j === '4') {
    if (tr === '04') return 'api_publica_trf4';
    if (tr === '03') return 'api_publica_trf3';
    if (tr === '02') return 'api_publica_trf2';
    if (tr === '01') return 'api_publica_trf1';
    return `api_publica_trf${parseInt(tr)}`;
  }
  if (j === '3') return 'api_publica_stj';
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
    if (!isNaN(num)) res.value = Math.round(num * 100);
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

    // 1. Descoberta no Diário Oficial Nacional (DJEN / PJe) por CNPJ
    try {
      console.log(`[DJEN DISCOVERY] Buscando publicações pelo CNPJ ${cleanCnpj}...`);
      const resDoc = await axios.get(this.djenUrl, {
        params: { numeroDocumento: cleanCnpj, itensPorPagina: 50 },
        timeout: 8000
      });
      for (const it of resDoc.data?.items || []) {
        if (it.numero_processo) {
          const numKey = it.numero_processo.replace(/\D/g, '');
          processMap.set(numKey, {
            rawNum: it.numeroprocessocommascara || it.numero_processo,
            tribunal: it.siglaTribunal || 'TJ',
            destinatarios: (it.destinatarios || []).map((d: any) => ({ nome: d.nome, polo: d.polo })),
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
    } catch (e: any) {
      console.warn(`[DJEN DISCOVERY] Aviso na busca por CNPJ ${cleanCnpj}:`, e.message);
    }

    // 2. Descoberta no DJEN pelos Termos / Razão Social / Nome do Cliente
    for (const term of terms) {
      if (!term || term.length < 3) continue;
      try {
        console.log(`[DJEN DISCOVERY] Buscando publicações pelo Nome / Razão Social "${term}"...`);
        const resTerm = await axios.get(this.djenUrl, {
          params: { nomeParte: term, itensPorPagina: 50 },
          timeout: 8000
        });
        for (const it of resTerm.data?.items || []) {
          if (it.numero_processo) {
            const numKey = it.numero_processo.replace(/\D/g, '');
            if (!processMap.has(numKey)) {
              processMap.set(numKey, {
                rawNum: it.numeroprocessocommascara || it.numero_processo,
                tribunal: it.siglaTribunal || 'TJ',
                destinatarios: (it.destinatarios || []).map((d: any) => ({ nome: d.nome, polo: d.polo })),
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
              const isPoloPassivo = dest.polo === 'P' || dest.nome.toUpperCase().includes('MATERIAIS') || dest.nome.toUpperCase().includes('ALIANCE') || dest.nome.toUpperCase().includes('SEBASTIAO') || dest.nome.toUpperCase().includes('BOMMEISTER');
              if (!fullProc.parties.some(p => p.name.toUpperCase() === dest.nome.toUpperCase())) {
                fullProc.parties.push({
                  name: dest.nome,
                  type: isPoloPassivo ? 'Polo Passivo' : 'Polo Ativo'
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
          const isPoloPassivo = (dest: { nome: string; polo?: string }) => 
            dest.polo === 'P' || dest.nome.toUpperCase().includes('MATERIAIS') || dest.nome.toUpperCase().includes('ALIANCE') || dest.nome.toUpperCase().includes('SEBASTIAO') || dest.nome.toUpperCase().includes('BOMMEISTER');
          
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
              type: isPoloPassivo(d) ? 'Polo Passivo' : 'Polo Ativo'
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

