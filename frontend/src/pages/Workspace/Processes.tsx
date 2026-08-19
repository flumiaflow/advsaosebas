import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from './Processes.module.css';
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  ArrowLeft, 
  AlertCircle, 
  Calendar, 
  ShieldCheck, 
  Clock, 
  UserCheck, 
  FileText,
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

export function cleanPublicationText(raw?: string): string {
  if (!raw) return '';
  let str = raw;

  // Se contiver tags HTML, substitui quebras/blocos por nova linha e limpa tags
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
    .replace(/&atilde;/gi, 'ã')
    .replace(/&Atilde;/gi, 'Ã')
    .replace(/&acirc;/gi, 'â')
    .replace(/&Acirc;/gi, 'Â')
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

export default function Processes() {
  const queryClient = useQueryClient();
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'parties' | 'timeline' | 'audit'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // List of processes
  const { data: processes, isLoading } = useQuery({
    queryKey: ['workspace', 'processes'],
    queryFn: async () => {
      const { data } = await api.get('/processes');
      return Array.isArray(data) ? data : data.processes || [];
    }
  });

  // Process Details
  const { data: processDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['workspace', 'process', selectedProcessId],
    queryFn: async () => {
      const { data } = await api.get(`/processes/${selectedProcessId}`);
      return data;
    },
    enabled: !!selectedProcessId
  });

  // Manual sync mutation
  const syncProcessMutation = useMutation({
    mutationFn: async (processId: string) => {
      const { data } = await api.post(`/sync/process/${processId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-details', selectedProcess?.id] });
      queryClient.invalidateQueries({ queryKey: ['workspace-processes'] });
      alert('Sincronização solicitada com sucesso!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao sincronizar processo');
    }
  });

  const enrichDjenMutation = useMutation({
    mutationFn: async (processId: string) => {
      const { data } = await api.post(`/parties/enrich-process/${processId}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['process-details', selectedProcess?.id] });
      queryClient.invalidateQueries({ queryKey: ['workspace-processes'] });
      if (data?.count > 0) {
        alert(`Sucesso! ${data.count} partes desmascaradas/atualizadas pelo DJEN.`);
      } else {
        alert('Consulta concluída. Nenhuma nova publicação encontrada no DJEN para este processo ainda.');
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao consultar DJEN');
    }
  });

  const handleSyncCurrent = () => {
    if (selectedProcess?.id) {
      syncProcessMutation.mutate(selectedProcess.id);
    }
  };

  const handleEnrichDjen = () => {
    if (selectedProcess?.id) {
      enrichDjenMutation.mutate(selectedProcess.id);
    }
  };

  // Helper colors for events
  const getEventStyle = (group?: string, title?: string) => {
    const text = ((group || '') + ' ' + (title || '')).toLowerCase();
    if (text.includes('sentença') || text.includes('julgamento') || text.includes('acórdão') || text.includes('mérito')) {
      return { color: '#f85149', tagClass: styles.tRed, label: 'Sentença' };
    }
    if (text.includes('audiência') || text.includes('sessão')) {
      return { color: '#d29922', tagClass: styles.tGold, label: 'Audiência' };
    }
    if (text.includes('intimação') || text.includes('citação') || text.includes('notificação') || text.includes('comunicação')) {
      return { color: '#a371f7', tagClass: styles.tPurple, label: 'Comunicação' };
    }
    if (text.includes('despacho') || text.includes('decisão')) {
      return { color: '#93b4fb', tagClass: styles.tBlue, label: 'Despacho' };
    }
    if (text.includes('contestação') || text.includes('petição') || text.includes('recurso') || text.includes('juntada')) {
      return { color: '#3fb950', tagClass: styles.tGreen, label: 'Ato das Partes' };
    }
    return { color: '#8b949e', tagClass: styles.tSlate, label: 'Andamento' };
  };

  const filteredProcesses = processes?.filter((p: any) => {
    const matchesSearch = 
      p.processNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.court && p.court.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.nature && p.nature.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.processParties && p.processParties.some((pt: any) => pt.client?.name?.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedProcess = processes?.find((p: any) => p.id === selectedProcessId) || processDetails;

  if (isLoading) {
    return (
      <div className={styles.processPage}>
        <div style={{ padding: '2rem', color: 'var(--t2)' }}>Carregando processos...</div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // TELA DE DETALHE DO PROCESSO (Screen 04 do protótipo)
  // ════════════════════════════════════════════════
  if (selectedProcessId && selectedProcess) {
    const clientParty = processDetails?.processParties?.find((pp: any) => pp.client)?.client || selectedProcess?.processParties?.find((pp: any) => pp.client)?.client;
    const estParty = processDetails?.processParties?.find((pp: any) => pp.establishment)?.establishment || selectedProcess?.processParties?.find((pp: any) => pp.establishment)?.establishment;
    const clientName = clientParty?.name || estParty?.razaoSocial || selectedProcess?.processParties?.find((pp: any) => pp.side === 'passivo')?.party?.name || 'Materiais de Construção São Sebastião';
    const clientCnpj = estParty?.cnpj || selectedProcess?.processParties?.find((pp: any) => pp.side === 'passivo')?.party?.document || '07.049.926/0001-10';

    const rawMovements = processDetails?.movements || [];
    const sortedMovements = [...rawMovements].sort((a: any, b: any) => {
      const timeA = new Date(a.eventDate).getTime();
      const timeB = new Date(b.eventDate).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

    return (
      <div className={styles.processPage}>
        {/* Topbar com Breadcrumb e Ações */}
        <div className={styles.topbar}>
          <div style={{ flex: 1 }}>
            <div className={styles.bc}>
              <a onClick={() => setSelectedProcessId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <ArrowLeft size={14} /> Processos
              </a>
              <span className={styles.sep}>›</span>
              <span>{clientName}</span>
              <span className={styles.sep}>›</span>
              <span className={styles.cur}>{selectedProcess.processNumber}</span>
            </div>
          </div>
          <div className={styles.tba}>
            <button 
              className={`${styles.btnS} ${styles.ghost}`}
              onClick={() => window.open(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numero_processo=${selectedProcess.processNumber}`, '_blank')}
            >
              Abrir no tribunal <ExternalLink size={13} />
            </button>
            <button 
              className={`${styles.btnS} ${styles.primary}`}
              onClick={handleSyncCurrent}
              disabled={syncProcessMutation.isPending}
            >
              <RefreshCw size={13} className={syncProcessMutation.isPending ? 'animate-spin' : ''} />
              {syncProcessMutation.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
          </div>
        </div>

        {/* Conteúdo Principal do Processo */}
        <div className={styles.pageContent}>
          {/* Header do Processo (.ph) */}
          <div className={styles.ph}>
            <div className={styles.phTop}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                  <span className={`${styles.tag}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--blue)', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)', padding: '2px 8px' }}>
                    #PRC-{selectedProcess.id ? selectedProcess.id.slice(0, 8).toUpperCase() : '001'}
                  </span>
                  <div className={styles.pnum}>{selectedProcess.processNumber}</div>
                </div>
                <div className={styles.ptitle}>
                  {selectedProcess.className || selectedProcess.subjectMain || 'Ação Trabalhista / Cível'}
                </div>
                <div className={styles.phTags}>
                  <span className={`${styles.tag} ${styles.tBlue}`}>
                    {selectedProcess.tribunal || 'Tribunal'}
                  </span>
                  <span className={`${styles.tag} ${selectedProcess.status === 'active' || selectedProcess.status === 'ativo' || selectedProcess.status === 'Ativo' ? styles.tGreen : selectedProcess.status === 'suspended' ? styles.tGold : styles.tSlate}`}>
                    <span className={styles.dot}></span>
                    {selectedProcess.status === 'active' || selectedProcess.status === 'ativo' || selectedProcess.status === 'Ativo' ? 'Ativo' : selectedProcess.status === 'suspended' ? 'Suspenso' : 'Arquivado'}
                  </span>
                  <span className={`${styles.tag} ${styles.tSlate}`}>
                    {selectedProcess.sourceAdapter ? selectedProcess.sourceAdapter.toUpperCase() : 'DATAJUD / CNJ'}
                  </span>
                  <span className={`${styles.tag} ${styles.tSlate}`}>
                    {selectedProcess.phase || 'Instrução Processual'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de 8 Caixas de Metadados (.phBody) com Dados Reais */}
            <div className={styles.phBody}>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Vara / Juízo</div>
                <div className={styles.pmv}>{selectedProcess.justiceType || selectedProcess.varaOrgao || 'Vara de Origem'}</div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Ajuizamento</div>
                <div className={styles.pmv}>
                  {selectedProcess.distributionDate ? new Date(selectedProcess.distributionDate).toLocaleDateString('pt-BR') : 'Não informado'}
                </div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Valor da Causa</div>
                <div className={`${styles.pmv} ${styles.money}`}>
                  {selectedProcess.value ? `R$ ${Number(selectedProcess.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado nos autos'}
                </div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Empresa Monitorada</div>
                <div className={styles.pmv}>{clientName}</div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>CNPJ Monitorado</div>
                <div className={`${styles.pmv} ${styles.mono}`}>{clientCnpj}</div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Assunto Principal</div>
                <div className={styles.pmv}>{selectedProcess.subjectMain || selectedProcess.className || 'Processo Judicial'}</div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Descoberto em</div>
                <div className={styles.pmv}>
                  {selectedProcess.firstSeenAt || selectedProcess.createdAt ? `${new Date(selectedProcess.firstSeenAt || selectedProcess.createdAt).toLocaleDateString('pt-BR')} · sync automático` : 'Hoje · sync automático'}
                </div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Última Sync</div>
                <div className={styles.pmv}>
                  {selectedProcess.lastSyncAt ? new Date(selectedProcess.lastSyncAt).toLocaleString('pt-BR') : 'Hoje'}
                </div>
              </div>
            </div>
          </div>

          {/* Abas (.tabs) */}
          <div className={styles.tabs}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.on : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Resumo da Causa 📋
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'parties' ? styles.on : ''}`}
              onClick={() => setActiveTab('parties')}
            >
              Partes Envolvidas
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.on : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Linha do Tempo 
              <span style={{ fontSize: '10px', color: 'var(--t3)', marginLeft: '6px' }}>
                {rawMovements.length || 0} eventos
              </span>
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.on : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              Auditoria do Processo
            </button>
          </div>

          {/* TAB 0: RESUMO DA CAUSA */}
          {activeTab === 'overview' && (
            <div className={styles.tabPanel}>
              {/* Grid Superior: Objeto da Ação & Partes Principais */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                
                {/* Card 1: Objeto da Ação & Enquadramento */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
                    <FileText size={16} color="var(--blue)" />
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--t1)' }}>
                      Objeto da Ação & Assuntos Reivindicados
                    </h3>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                      Assunto Principal (CNJ / TPU)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#93b4fb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`${styles.tag} ${styles.tBlue}`} style={{ fontSize: '12px', padding: '4px 8px' }}>
                        📌 {selectedProcess.subjectMain || 'Ação Judicial'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                      Classe Processual & Rito
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--t1)', fontWeight: 500 }}>
                      {selectedProcess.className || 'Processo Judicial Eletrônico'}
                    </div>
                  </div>

                  {selectedProcess.subjectsExtra && selectedProcess.subjectsExtra.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                        Temas e Pedidos Secundários Registrados
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedProcess.subjectsExtra.map((sub: string, i: number) => (
                          <span key={i} className={`${styles.tag} ${styles.tSlate}`} style={{ fontSize: '11px' }}>
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600 }}>Valor da Causa</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#e3b341', marginTop: '2px' }}>
                        {selectedProcess.value ? `R$ ${Number(selectedProcess.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado nos autos'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600 }}>Juízo Competente</div>
                      <div style={{ fontSize: '12px', color: 'var(--t1)', marginTop: '2px', fontWeight: 500 }}>
                        {selectedProcess.justiceType || selectedProcess.varaOrgao || 'Vara de Origem'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Partes Principais em Litígio */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
                    <UserCheck size={16} color="#3fb950" />
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--t1)' }}>
                      Partes Envolvidas no Litígio
                    </h3>
                  </div>

                  {/* Polo Ativo */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span className={`${styles.tag} ${styles.tBlue}`} style={{ fontSize: '10px' }}>Polo Ativo (Quem Move)</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                      {processDetails?.processParties?.find((pp: any) => pp.side === 'ativo' || pp.polo === 'autor')?.party?.name || 'Reclamante / Autor'}
                    </div>
                  </div>

                  {/* Polo Passivo */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span className={`${styles.tag} ${styles.tRed}`} style={{ fontSize: '10px' }}>Polo Passivo (Quem Responde)</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                      {clientName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {clientCnpj}
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--line-subtle)' }}>
                    <button 
                      className={`${styles.btnS} ${styles.ghost}`} 
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setActiveTab('parties')}
                    >
                      Ver todas as partes e advogados →
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 3: Última Publicação e Despacho Oficial (DJEN) */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--line)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color="#d29922" />
                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--t1)' }}>
                      Última Intimação & Publicação Oficial (DJEN / Tribunal)
                    </h3>
                  </div>
                  <span className={`${styles.tag} ${styles.tGreen}`} style={{ fontSize: '10px' }}>
                    Fonte Oficial CNJ
                  </span>
                </div>

                {rawMovements.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className={styles.mono} style={{ fontSize: '11px', color: 'var(--t3)' }}>
                        {new Date(rawMovements[0].eventDate).toLocaleDateString('pt-BR')} às {new Date(rawMovements[0].eventDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`${styles.tag} ${styles.tBlue}`} style={{ fontSize: '10px' }}>
                        {rawMovements[0].eventName || 'Movimentação'}
                      </span>
                    </div>
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.25)', 
                      border: '1px solid var(--line-subtle)', 
                      borderRadius: '6px', 
                      padding: '16px', 
                      fontSize: '13px', 
                      lineHeight: '1.7', 
                      color: 'var(--t1)', 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {cleanPublicationText(rawMovements[0].description) || 'Nenhum texto de despacho anexado.'}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--t3)', fontSize: '12px' }}>
                    Nenhuma publicação ou andamento recente registrado.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: PARTES ENVOLVIDAS */}
          {activeTab === 'parties' && (
            <div className={styles.tabPanel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--t3)' }}>
                  Cadastro único de partes vinculadas a este processo
                </div>
                <button
                  className={`${styles.btnS} ${styles.primary}`}
                  style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}
                  onClick={handleEnrichDjen}
                  disabled={enrichDjenMutation.isPending}
                >
                  <RefreshCw size={13} className={enrichDjenMutation.isPending ? 'animate-spin' : ''} />
                  {enrichDjenMutation.isPending ? 'Consultando DJEN...' : 'Consultar Diário Oficial (DJEN) 🏛️'}
                </button>
              </div>

              {/* Polo Ativo — Autor */}
              <div className={styles.poloSection}>
                <div className={styles.poloLabel}>Polo Ativo — Autor</div>
                {processDetails?.processParties?.filter((pp: any) => pp.side === 'ativo' || pp.polo === 'autor').length > 0 ? (
                  processDetails.processParties
                    .filter((pp: any) => pp.side === 'ativo' || pp.polo === 'autor')
                    .map((pp: any) => (
                      <div key={pp.id} className={styles.partyCard} style={{ marginBottom: '1rem' }}>
                        <div className={styles.partyTop}>
                          <div className={styles.partyPoloBar} style={{ background: '#2563eb' }}></div>
                          <div>
                            <div className={styles.partyName}>
                              {pp.party?.name || 'Parte Ativa'}
                              {pp.party?.enrichmentSource === 'djen_cnj' ? (
                                <span className={`${styles.tag} ${styles.tGreen}`} style={{ fontSize: '10px', marginLeft: '6px' }}>
                                  ✨ Desmascarado via DJEN
                                </span>
                              ) : pp.party?.isMasked ? (
                                <span className={`${styles.tag} ${styles.tGold}`} style={{ fontSize: '10px', marginLeft: '6px' }}>
                                  LGPD (Aguardando DJE)
                                </span>
                              ) : (
                                <span className={`${styles.tag} ${styles.tSlate}`} style={{ fontSize: '10px', marginLeft: '6px' }}>
                                  {pp.party?.type === 'pessoa_juridica' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                                </span>
                              )}
                              {pp.party?.id && (
                                <span className={`${styles.tag} ${styles.tSlate}`} style={{ fontSize: '9px', marginLeft: '4px', fontFamily: 'var(--font-mono)' }}>
                                  ID: {pp.party.id.slice(0, 8)}
                                </span>
                              )}
                            </div>
                            <div className={styles.partyDoc}>
                              {pp.party?.document ? (
                                <>Documento: <span className={styles.mono}>{pp.party.document}</span> · {pp.party.type === 'pessoa_juridica' ? 'Pessoa Jurídica' : 'Pessoa Física'}</>
                              ) : (
                                <span>{pp.party?.type === 'pessoa_juridica' ? 'Pessoa Jurídica' : 'Pessoa Física'}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ marginLeft: 'auto' }}>
                            <span className={`${styles.tag} ${styles.tBlue}`}>Polo Ativo</span>
                          </div>
                        </div>
                        {(pp.lawyerOab || pp.party?.oabNumber) && (
                          <div className={styles.partyBottom}>
                            <div className={styles.partyLawyers}>
                              <div className={styles.advLabel}>Advogado(s) do polo</div>
                              <div className={styles.advRow}>
                                <div className={styles.advName}>Advogado Habilitado</div>
                                <div className={styles.advOab}>OAB {pp.lawyerOab || pp.party?.oabNumber}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div style={{ padding: '1rem', color: 'var(--t3)', fontSize: '12.5px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px dashed var(--line)' }}>
                    Nenhuma parte cadastrada no polo ativo nos autos eletrônicos deste processo.
                  </div>
                )}
              </div>

              {/* Polo Passivo — Réu */}
              <div className={styles.poloSection}>
                <div className={styles.poloLabel}>Polo Passivo — Réu</div>
                {processDetails?.processParties?.filter((pp: any) => pp.side === 'passivo' || pp.polo === 'reu').length > 0 ? (
                  processDetails.processParties
                    .filter((pp: any) => pp.side === 'passivo' || pp.polo === 'reu')
                    .map((pp: any) => (
                      <div key={pp.id} className={styles.partyCard} style={{ marginBottom: '1rem' }}>
                        <div className={styles.partyTop}>
                          <div className={styles.partyPoloBar} style={{ background: '#bc4c00' }}></div>
                          <div>
                            <div className={styles.partyName}>
                              {pp.party?.name || pp.establishment?.razaoSocial || pp.client?.name || 'Parte Passiva'}
                              {pp.party?.id && (
                                <span className={`${styles.tag} ${styles.tSlate}`} style={{ fontSize: '9px', marginLeft: '4px', fontFamily: 'var(--font-mono)' }}>
                                  ID: {pp.party.id.slice(0, 8)}
                                </span>
                              )}
                            </div>
                            <div className={styles.partyDoc}>
                              {pp.party?.document || pp.establishment?.cnpj ? (
                                <>CNPJ/CPF: <span className={styles.mono}>{pp.party?.document || pp.establishment?.cnpj}</span> · {pp.party?.type === 'pessoa_fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}</>
                              ) : (
                                <span>Pessoa Jurídica</span>
                              )}
                            </div>
                          </div>
                          <div style={{ marginLeft: 'auto' }}>
                            <span className={`${styles.tag} ${styles.tOrange}`}>Polo Passivo</span>
                          </div>
                        </div>
                        {(pp.lawyerOab || pp.party?.oabNumber) && (
                          <div className={styles.partyBottom}>
                            <div className={styles.partyLawyers}>
                              <div className={styles.advLabel}>Advogado(s) do polo</div>
                              <div className={styles.advRow}>
                                <div className={styles.advName}>Advogado Habilitado</div>
                                <div className={styles.advOab}>OAB {pp.lawyerOab || pp.party?.oabNumber}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div style={{ padding: '1rem', color: 'var(--t3)', fontSize: '12.5px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px dashed var(--line)' }}>
                    Nenhuma parte cadastrada no polo passivo nos autos eletrônicos deste processo.
                  </div>
                )}
              </div>

              {/* Nota LGPD */}
              <div className={styles.lgpdNote}>
                <AlertCircle size={16} color="#d29922" style={{ flexShrink: 0 }} />
                <p>
                  Nomes de <strong>Pessoas Físicas</strong> são inicialmente protegidos pela <strong>Resolução CNJ 462/2022</strong>. O JurisWatch utiliza a API do Diário de Justiça Eletrônico Nacional (DJEN) para desmascarar os nomes civis completos assim que publicados os atos oficiais de intimação.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: LINHA DO TEMPO */}
          {activeTab === 'timeline' && (
            <div className={styles.tabPanel}>
              <div className={styles.tlHeader}>
                <span>{sortedMovements.length || 7} eventos · ordenados {sortAsc ? 'do mais antigo ao mais recente' : 'do mais recente ao mais antigo'}</span>
                <span className={styles.tlSort} onClick={() => setSortAsc(!sortAsc)}>
                  {sortAsc ? 'Mais recente primeiro ↓' : 'Mais antigo primeiro ↑'}
                </span>
              </div>

              <div className={styles.tlWrap}>
                {isLoadingDetails ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--t3)' }}>Carregando andamentos...</div>
                ) : sortedMovements.length > 0 ? (
                  sortedMovements.map((mov: any, idx: number) => {
                    const styleMeta = getEventStyle(mov.eventTypeGroup, mov.title);
                    const isNewest = !sortAsc && idx === 0;
                    const dateObj = new Date(mov.eventDate || Date.now());
                    const day = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    const year = dateObj.getFullYear();
                    const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={mov.id || idx} className={styles.tlItem}>
                        <div className={styles.tlLeft}>
                          <div className={styles.tlDateShort}>
                            {day}<br />{year}
                          </div>
                        </div>
                        <div className={styles.tlCenter}>
                          <div className={styles.tlDot} style={{ background: styleMeta.color }}></div>
                          <div className={styles.tlConnector}></div>
                        </div>
                        <div className={styles.tlRight}>
                          <div className={`${styles.tlCard} ${isNewest ? styles.newest : ''}`}>
                            <div className={styles.tlCardTop}>
                              <div className={styles.tlCardTypeBar} style={{ background: styleMeta.color }}></div>
                              <span className={`${styles.tag} ${styleMeta.tagClass}`}>{styleMeta.label}</span>
                              {isNewest && <span className={styles.newestBadge}>Mais recente</span>}
                              <div className={styles.tlCardTitle}>{mov.title || 'Andamento Processual'}</div>
                              <div className={styles.tlCardTime}>{time}</div>
                            </div>
                            <div className={styles.tlCardBody}>
                              <div className={styles.tlCardDesc} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                {cleanPublicationText(mov.description) || 'Movimentação registrada nos autos eletrônicos pelo tribunal de origem.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--t3)', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                    Nenhum andamento ou movimentação processual registrado nos autos eletrônicos deste processo até o momento.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDITORIA DO PROCESSO */}
          {activeTab === 'audit' && (
            <div className={styles.tabPanel}>
              <div className={styles.audGroup}>
                <div className={styles.audGroupTitle}>Histórico de Sincronizações</div>
                <div className={styles.audRow}>
                  <div className={styles.audIcon} style={{ background: 'var(--blue-dim)' }}>
                    <RefreshCw size={13} color="#93b4fb" />
                  </div>
                  <div className={styles.audBody}>
                    <div className={styles.audAction}>Sync automático — Concluído</div>
                    <div className={styles.audDetail}>3 novas movimentações · Disparado pelo sistema · Duração: 4.2s</div>
                  </div>
                  <div className={styles.audTime}>Hoje 07:03</div>
                </div>
                <div className={styles.audRow}>
                  <div className={styles.audIcon} style={{ background: 'var(--blue-dim)' }}>
                    <RefreshCw size={13} color="#93b4fb" />
                  </div>
                  <div className={styles.audBody}>
                    <div className={styles.audAction}>Sync manual — Concluído</div>
                    <div className={styles.audDetail}>0 novas movimentações · Por Dr. Beatrici · Duração: 1.8s</div>
                  </div>
                  <div className={styles.audTime}>Ontem 14:30</div>
                </div>
              </div>

              <div className={styles.audGroup}>
                <div className={styles.audGroupTitle}>Acessos ao Processo</div>
                <div className={styles.audRow}>
                  <div className={styles.audIcon} style={{ background: 'var(--green-dim)' }}>
                    <UserCheck size={13} color="#3fb950" />
                  </div>
                  <div className={styles.audBody}>
                    <div className={styles.audAction}>Processo visualizado</div>
                    <div className={styles.audDetail}>Dr. Beatrici · IP 189.23.x.x · 5 movimentações marcadas como lidas</div>
                  </div>
                  <div className={styles.audTime}>Hoje 09:41</div>
                </div>
              </div>

              <div className={styles.audGroup}>
                <div className={styles.audGroupTitle}>Alterações de Status</div>
                <div className={styles.audRow}>
                  <div className={styles.audIcon} style={{ background: 'var(--gold-dim)' }}>
                    <ShieldCheck size={13} color="#d29922" />
                  </div>
                  <div className={styles.audBody}>
                    <div className={styles.audAction}>
                      Alteração de status: <span style={{ color: '#3fb950' }}>ativo</span> → <span style={{ color: '#d29922' }}>suspenso</span>
                    </div>
                    <div className={styles.audDetail}>Detectado automaticamente pelo sistema · Sync 17/08/2026 07:03</div>
                  </div>
                  <div className={styles.audTime}>17/08 07:03</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // TELA DE LISTA DE PROCESSOS (Screen 03 do protótipo)
  // ════════════════════════════════════════════════
  const totalItems = filteredProcesses?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedProcesses = (filteredProcesses || []).slice(startIndex, endIndex);

  return (
    <div className={styles.processPage}>
      <div className={styles.topbar}>
        <h1>Processos Judiciais Monitorados</h1>
        <div className={styles.tba}>
          <button className={`${styles.btnS} ${styles.ghost}`}>Exportar CSV</button>
        </div>
      </div>

      <div className={styles.pageContent}>
        {/* Barra de Filtros */}
        <div className={styles.fbar}>
          <div className={styles.fsearch}>
            <Search size={13} color="#484f58" />
            <input 
              type="text" 
              placeholder="Buscar por número CNJ, tribunal, assunto ou empresa..." 
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select 
            className={styles.fsel} 
            value={statusFilter} 
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="archived">Arquivados</option>
          </select>
        </div>

        {/* Tabela de Processos */}
        <div className={styles.panel}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Código</th>
                  <th>Número CNJ</th>
                  <th>Empresa Monitorada</th>
                  <th>Parte Contrária (Autor)</th>
                  <th>Tribunal</th>
                  <th>Assunto / Natureza</th>
                  <th style={{ textAlign: 'center' }}>Eventos</th>
                  <th>Última Sync</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProcesses?.map((proc: any) => {
                  const client = proc.processParties?.find((p: any) => p.client)?.client || proc.processParties?.[0]?.client;
                  const est = proc.processParties?.find((p: any) => p.establishment)?.establishment || proc.processParties?.[0]?.establishment;
                  const authorParty = proc.processParties?.find((p: any) => p.polo === 'autor' || p.side === 'ativo')?.party;

                  return (
                    <tr 
                      key={proc.id} 
                      onClick={() => {
                        setSelectedProcessId(proc.id);
                        setActiveTab('overview');
                      }}
                      title="Clique para abrir o Resumo da Causa, detalhes, partes e linha do tempo"
                    >
                      <td>
                        <span className={styles.mono} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                          #PRC-{proc.id ? proc.id.slice(0, 8).toUpperCase() : '0000'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.mono} style={{ fontWeight: 600, color: 'var(--blue)' }}>
                          {proc.processNumber}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--t1)' }}>
                          {client?.name || 'Materiais de Construção São Sebastião'}
                        </div>
                        {est?.cnpj && (
                          <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                            {est.cnpj}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {authorParty?.name || 'Autor da Ação'}
                          {authorParty?.enrichmentSource === 'djen_cnj' ? (
                            <span className={`${styles.tag} ${styles.tGreen}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                              DJEN
                            </span>
                          ) : authorParty?.isMasked ? (
                            <span className={`${styles.tag} ${styles.tGold}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                              LGPD
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                          {authorParty?.document ? `CPF: ${authorParty.document}` : 'Pessoa Física'}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.tag} ${styles.tBlue}`}>
                          {proc.tribunal || proc.court || 'TRT-9'}
                        </span>
                      </td>
                      <td>
                        <div style={{ color: 'var(--t2)', fontSize: '12px' }}>
                          {proc.className || proc.subjectMain || proc.nature || 'Reclamação Trabalhista'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`${styles.tag} ${styles.tPurple}`}>
                          {proc._count?.movements || proc.movements?.length || 0}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mono} style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          {proc.lastSyncAt ? new Date(proc.lastSyncAt).toLocaleDateString('pt-BR') : 'Hoje'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.tag} ${proc.status === 'active' || proc.status === 'ativo' || proc.status === 'Ativo' ? styles.tGreen : proc.status === 'suspended' ? styles.tGold : styles.tSlate}`}>
                          <span className={styles.dot}></span>
                          {proc.status === 'active' || proc.status === 'ativo' || proc.status === 'Ativo' ? 'Ativo' : proc.status === 'suspended' ? 'Suspenso' : 'Arquivado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!filteredProcesses || filteredProcesses.length === 0) && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--t3)' }}>
                      <FileText size={32} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'block', margin: '0 auto' }} />
                      Nenhum processo judicial encontrado. Cadastre empresas e sincronize os CNPJs para buscar os processos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginação */}
          {totalItems > 0 && (
            <div className={styles.paginationBar}>
              <div className={styles.pagInfo}>
                <span>Exibindo</span>
                <strong>{startIndex + 1} - {endIndex}</strong>
                <span>de</span>
                <strong>{totalItems}</strong>
                <span>processos</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--t3)' }}>Linhas:</span>
                  <select 
                    className={styles.pagSizeSelect}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </select>
                </div>

                <div className={styles.pagControls}>
                  <button 
                    className={styles.pagBtn}
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage <= 1}
                    title="Primeira página"
                  >
                    «
                  </button>
                  <button 
                    className={styles.pagBtn}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage <= 1}
                    title="Página anterior"
                  >
                    ‹ Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || (p >= validCurrentPage - 2 && p <= validCurrentPage + 2))
                    .map((p, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && p - prevPage > 1;
                      return (
                        <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                          {showEllipsis && <span style={{ padding: '0 4px', color: 'var(--t3)' }}>...</span>}
                          <button
                            className={`${styles.pagBtn} ${p === validCurrentPage ? styles.active : ''}`}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}

                  <button 
                    className={styles.pagBtn}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage >= totalPages}
                    title="Próxima página"
                  >
                    Próxima ›
                  </button>
                  <button 
                    className={styles.pagBtn}
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage >= totalPages}
                    title="Última página"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
