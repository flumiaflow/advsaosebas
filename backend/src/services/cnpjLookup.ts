import axios from 'axios';

export interface CompanyData {
  cnpj: string;
  razaoSocial: string;
  fantasyName?: string;
  uf?: string;
  municipio?: string;
}

export function generateCompanySearchTerms(razaoSocial: string, fantasyName?: string | null): string[] {
  const terms = new Set<string>();
  
  if (razaoSocial) {
    const cleanRazao = razaoSocial.trim().toUpperCase();
    terms.add(cleanRazao);
    
    // Se não tem indicadores de pessoa jurídica, retorna apenas o nome limpo (é PF)
    const hasCorpIndicator = /\b(LTDA|EIRELI|S\.?A\.?|S\/A|ME|EPP|MEI)\b/i.test(cleanRazao);
    if (!hasCorpIndicator) return Array.from(terms);

    // Remove sufixos societários (LTDA, EIRELI, ME, S.A., EPP, S/A)
    const baseName = cleanRazao
      .replace(/\s*-\s*ME\b/g, '')
      .replace(/\s*-\s*EPP\b/g, '')
      .replace(/\bLTDA\b/g, '')
      .replace(/\bEIRELI\b/g, '')
      .replace(/\bS\.A\.?\b/g, '')
      .replace(/\bS\/A\b/g, '')
      .replace(/\bME\b/g, '')
      .replace(/\bEPP\b/g, '')
      .trim();

    if (baseName.length >= 6) {
      terms.add(baseName);
      // Gera variações societárias comuns
      terms.add(`${baseName} LTDA`);
      terms.add(`${baseName} EIRELI`);
    }
  }

  if (fantasyName) {
    const cleanFantasia = fantasyName.trim().toUpperCase();
    if (cleanFantasia.length >= 6) {
      terms.add(cleanFantasia);
    }
  }

  return Array.from(terms);
}

export async function lookupCompanyByCnpj(cnpj: string): Promise<CompanyData | null> {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return null;

  // 1. Tenta BrasilAPI
  try {
    const res = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, { timeout: 4000 });
    if (res.data && res.data.razao_social) {
      return {
        cnpj: clean,
        razaoSocial: res.data.razao_social.trim(),
        fantasyName: res.data.nome_fantasia ? res.data.nome_fantasia.trim() : undefined,
        uf: res.data.uf,
        municipio: res.data.municipio
      };
    }
  } catch (e) {}

  // 2. Fallback: ReceitaWS
  try {
    const res = await axios.get(`https://receitaws.com.br/v1/cnpj/${clean}`, { timeout: 4000 });
    if (res.data && res.data.nome) {
      return {
        cnpj: clean,
        razaoSocial: res.data.nome.trim(),
        fantasyName: res.data.fantasia ? res.data.fantasia.trim() : undefined,
        uf: res.data.uf,
        municipio: res.data.municipio
      };
    }
  } catch (e) {}

  return null;
}
