import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { getDisplayName, isDocCpf, maskCPF } from '../../utils/formatters';
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
  Building2,
  FolderOpen,
  Scale,
  FileCheck,
  Copy,
  CheckCircle,
  Eye,
  Download,
  X,
  Layers,
  Sparkles,
  BookOpen,
  SlidersHorizontal,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Briefcase,
  Loader2,
  Bell,
  EyeOff
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
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Uuml;/gi, 'Ü')
    .replace(/&ordm;/gi, 'º')
    .replace(/&ordf;/gi, 'ª')
    .replace(/&sect;/gi, '§')
    .replace(/&deg;/gi, '°')
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
  const [searchParams, setSearchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');
  const clientNameParam = searchParams.get('clientName');

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'parties' | 'timeline' | 'audit'>('overview');
  const [isSyncSummaryOpen, setIsSyncSummaryOpen] = useState(false);
  
  // Details Modal State
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  const { data: syncJobDetails, isLoading: isLoadingJobDetails } = useQuery({
    queryKey: ['workspace', 'syncJobDetails', selectedJobForDetails?.id],
    queryFn: async () => {
      const { data } = await api.get(`/sync/job/${selectedJobForDetails.id}/details`);
      return data.details || [];
    },
    enabled: !!selectedJobForDetails,
  });
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tribunalFilter, setTribunalFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState(clientIdParam || 'all');
  const [justiceTypeFilter, setJusticeTypeFilter] = useState('all');
  const [movementsFilter, setMovementsFilter] = useState('all');
  const [valueFilter, setValueFilter] = useState('all');
  const [authorSearch, setAuthorSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [quickPill, setQuickPill] = useState<'all' | 'active' | 'trabalhista' | 'civel' | 'with_mov' | 'unseen'>('all');
  const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // List of processes
  const { data: processes, isLoading } = useQuery({
    queryKey: ['workspace', 'processes', clientIdParam],
    queryFn: async () => {
      const { data } = await api.get('/processes', {
        params: clientIdParam ? { clientId: clientIdParam } : undefined
      });
      return Array.isArray(data) ? data : data.processes || [];
    }
  });

  // Sync Tracker Query
  const { data: syncStatus } = useQuery({
    queryKey: ['workspace', 'syncStatus', clientFilter],
    queryFn: async () => {
      const { data } = await api.get(`/sync/status/client/${clientFilter}`);
      return data;
    },
    enabled: clientFilter !== 'all',
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 3000 : false)
  });

  // Sync History Query
  const { data: syncHistory, refetch: refetchSyncHistory, isLoading: isLoadingSyncHistory } = useQuery({
    queryKey: ['workspace', 'syncHistory', clientFilter],
    queryFn: async () => {
      const { data } = await api.get(`/sync/history/client/${clientFilter}`);
      return data;
    },
    enabled: isSyncSummaryOpen && clientFilter !== 'all',
  });

  useEffect(() => {
    if (syncStatus?.status === 'success' || syncStatus?.status === 'error') {
      if (isSyncSummaryOpen) refetchSyncHistory();
    }
  }, [syncStatus?.status, isSyncSummaryOpen, refetchSyncHistory]);

  // Distinct Tribunals for dropdown
  const distinctTribunals = useMemo(() => {
    if (!processes) return [];
    const set = new Set<string>();
    processes.forEach((p: any) => {
      const t = p.tribunal || p.court;
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [processes]);

  // Distinct Clients for dropdown
  const distinctClients = useMemo(() => {
    if (!processes) return [];
    const map = new Map<string, string>();
    processes.forEach((p: any) => {
      p.processParties?.forEach((pp: any) => {
        const cId = pp.clientId || pp.client?.id;
        const cName = pp.client?.name || pp.establishment?.razaoSocial;
        if (cId && cName) {
          map.set(cId, cName);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [processes]);

  // Quick Filter Pill Counts
  const quickCounts = useMemo(() => {
    if (!processes) return { all: 0, active: 0, trabalhista: 0, civel: 0, with_mov: 0 };
    let active = 0;
    let trabalhista = 0;
    let civel = 0;
    let with_mov = 0;

    processes.forEach((p: any) => {
      if (p.status === 'active' || p.status === 'ativo' || p.status === 'Ativo') active++;
      const txt = `${p.justiceType || ''} ${p.tribunal || ''} ${p.className || ''}`.toLowerCase();
      if (txt.includes('trab') || txt.includes('trt') || txt.includes('tst')) trabalhista++;
      if (txt.includes('cív') || txt.includes('civ') || txt.includes('tj')) civel++;
      const movCount = p._count?.movements || p.movements?.length || 0;
      if (movCount > 0) with_mov++;
    });

    return { all: processes.length, active, trabalhista, civel, with_mov, unseen: processes.filter((p: any) => p.isNew || p.hasUnseenUpdates).length };
  }, [processes]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return [
      statusFilter !== 'all',
      tribunalFilter !== 'all',
      clientFilter !== 'all',
      justiceTypeFilter !== 'all',
      movementsFilter !== 'all',
      valueFilter !== 'all',
      authorSearch.trim().length > 0,
      quickPill !== 'all'
    ].filter(Boolean).length;
  }, [statusFilter, tribunalFilter, clientFilter, justiceTypeFilter, movementsFilter, valueFilter, authorSearch, quickPill]);

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTribunalFilter('all');
    setClientFilter('all');
    setJusticeTypeFilter('all');
    setMovementsFilter('all');
    setValueFilter('all');
    setAuthorSearch('');
    setSortBy('recent');
    setQuickPill('all');
    setCurrentPage(1);
  };

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

  // Marcar todos os processos como vistos
  const markAllSeenMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/processes/mark-all-seen', {
        until_timestamp: new Date().toISOString()
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'processes'] });
      toast.success('Todos os processos foram marcados como vistos!');
    },
    onError: () => {
      toast.error('Erro ao marcar processos como vistos');
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

  const filteredProcesses = useMemo(() => {
    if (!processes) return [];

    return processes.filter((p: any) => {
      // Quick pill filter
      if (quickPill === 'active' && !(p.status === 'active' || p.status === 'ativo' || p.status === 'Ativo')) return false;
      if (quickPill === 'unseen' && !p.isNew && !p.hasUnseenUpdates) return false;
      if (quickPill === 'trabalhista') {
        const txt = `${p.justiceType || ''} ${p.tribunal || ''} ${p.className || ''}`.toLowerCase();
        if (!txt.includes('trab') && !txt.includes('trt') && !txt.includes('tst')) return false;
      }
      if (quickPill === 'civel') {
        const txt = `${p.justiceType || ''} ${p.tribunal || ''} ${p.className || ''}`.toLowerCase();
        if (!txt.includes('cív') && !txt.includes('civ') && !txt.includes('tj')) return false;
      }
      if (quickPill === 'with_mov') {
        const movCount = p._count?.movements || p.movements?.length || 0;
        if (movCount === 0) return false;
      }

      // 1. Full-text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const numMatch = p.processNumber?.toLowerCase().includes(term);
        const codeMatch = p.id && `#prc-${p.id.slice(0, 8).toLowerCase()}`.includes(term);
        const tribunalMatch = (p.tribunal || p.court || '').toLowerCase().includes(term);
        const classMatch = (p.className || '').toLowerCase().includes(term);
        const subjectMatch = (p.subjectMain || '').toLowerCase().includes(term);
        const varaMatch = (p.justiceType || p.varaOrgao || '').toLowerCase().includes(term);
        
        const clientMatch = p.processParties?.some((pp: any) => 
          pp.client?.name?.toLowerCase().includes(term) ||
          pp.establishment?.razaoSocial?.toLowerCase().includes(term) ||
          pp.establishment?.cnpj?.includes(term)
        );

        const partyMatch = p.processParties?.some((pp: any) => 
          pp.party?.name?.toLowerCase().includes(term) ||
          pp.party?.document?.includes(term)
        );

        if (!numMatch && !codeMatch && !tribunalMatch && !classMatch && !subjectMatch && !varaMatch && !clientMatch && !partyMatch) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        const isAct = p.status === 'active' || p.status === 'ativo' || p.status === 'Ativo';
        const isSusp = p.status === 'suspended' || p.status === 'suspenso';
        const isArch = p.status === 'archived' || p.status === 'arquivado';
        if (statusFilter === 'active' && !isAct) return false;
        if (statusFilter === 'suspended' && !isSusp) return false;
        if (statusFilter === 'archived' && !isArch) return false;
      }

      // 3. Tribunal filter
      if (tribunalFilter !== 'all') {
        const t = p.tribunal || p.court;
        if (t !== tribunalFilter) return false;
      }

      // 4. Client filter
      if (clientFilter !== 'all') {
        const hasClient = p.processParties?.some((pp: any) => pp.clientId === clientFilter || pp.client?.id === clientFilter);
        if (!hasClient) return false;
      }

      // 5. Justice Type / Ramificação
      if (justiceTypeFilter !== 'all') {
        const txt = `${p.justiceType || ''} ${p.tribunal || ''} ${p.className || ''}`.toLowerCase();
        if (justiceTypeFilter === 'trabalhista' && !txt.includes('trab') && !txt.includes('trt') && !txt.includes('tst')) return false;
        if (justiceTypeFilter === 'civel' && !txt.includes('cív') && !txt.includes('civ') && !txt.includes('tj')) return false;
        if (justiceTypeFilter === 'federal' && !txt.includes('trf') && !txt.includes('jf') && !txt.includes('federal')) return false;
      }

      // 6. Movements filter
      if (movementsFilter !== 'all') {
        const count = p._count?.movements || p.movements?.length || 0;
        if (movementsFilter === 'with_mov' && count === 0) return false;
        if (movementsFilter === 'no_mov' && count > 0) return false;
      }

      // 7. Value filter
      if (valueFilter !== 'all') {
        const val = p.value ? Number(p.value) : 0;
        if (valueFilter === 'under_20k' && val >= 20000) return false;
        if (valueFilter === '20k_100k' && (val < 20000 || val > 100000)) return false;
        if (valueFilter === 'over_100k' && val <= 100000) return false;
      }

      // 8. Author / Parte Contrária search
      if (authorSearch.trim()) {
        const term = authorSearch.toLowerCase().trim();
        const hasAuthor = p.processParties?.some((pp: any) => 
          (pp.side === 'ativo' || pp.polo === 'autor') && 
          (pp.party?.name?.toLowerCase().includes(term) || pp.party?.document?.includes(term))
        );
        if (!hasAuthor) return false;
      }

      return true;
    }).sort((a: any, b: any) => {
      if (sortBy === 'recent') {
        const timeA = new Date(a.lastSyncAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastSyncAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = new Date(a.lastSyncAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastSyncAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'value_desc') {
        return (Number(b.value) || 0) - (Number(a.value) || 0);
      }
      if (sortBy === 'value_asc') {
        return (Number(a.value) || 0) - (Number(b.value) || 0);
      }
      if (sortBy === 'cnj_asc') {
        return (a.processNumber || '').localeCompare(b.processNumber || '');
      }
      if (sortBy === 'client_asc') {
        const nameA = a.processParties?.find((p: any) => p.client)?.client?.name || '';
        const nameB = b.processParties?.find((p: any) => p.client)?.client?.name || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [processes, quickPill, searchTerm, statusFilter, tribunalFilter, clientFilter, justiceTypeFilter, movementsFilter, valueFilter, authorSearch, sortBy]);

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
    const clientName = estParty?.alias || estParty?.razaoSocial || clientParty?.name || selectedProcess?.processParties?.find((pp: any) => pp.side === 'passivo')?.party?.name || 'Empresa Monitorada';
    const rawCnpj = estParty?.cnpj || selectedProcess?.processParties?.find((pp: any) => pp.side === 'passivo')?.party?.document || '07.049.926/0001-10';
    const clientCnpj = isDocCpf(rawCnpj) ? maskCPF(rawCnpj) : rawCnpj;

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
              <a onClick={() => { setSelectedProcessId(null); queryClient.invalidateQueries({ queryKey: ['workspace', 'processes'] }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
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
                <div className={styles.pml}>Empresa / Pessoa Monitorada</div>
                <div className={styles.pmv} title={clientName}>{clientName}</div>
              </div>
              <div className={styles.phMetaItem}>
                <div className={styles.pml}>Documento Monitorado</div>
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
          {activeTab === 'overview' && (() => {
            const num = selectedProcess.processNumber || '';
            const className = selectedProcess.className || 'Processo Judicial';
            const subject = selectedProcess.subjectMain || 'Não especificado';
            const juizo = selectedProcess.justiceType || selectedProcess.varaOrgao || 'Vara Cível';
            const tribunal = selectedProcess.tribunal || 'Tribunal de Justiça';
            
            let mainProcessNumber: string | null = null;
            for (const m of rawMovements) {
              const desc = m.description || '';
              const match = desc.match(/processo\s+principal\s*[:\s(]*([0-9]{7}\-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4})/i) ||
                            desc.match(/processo\s+principal\s*[:\s(]*([0-9\.\-]+[0-9])/i) ||
                            desc.match(/autos\s+n[ºo°]?\s*([0-9\.\-]+)/i);
              if (match && match[1] && match[1] !== num && match[1].length > 8) {
                mainProcessNumber = match[1];
                break;
              }
            }

            const autor = processDetails?.processParties?.find((p: any) => p.side === 'ativo' || p.polo === 'autor')?.party?.name || 
                          rawMovements.map((m: any) => m.description?.match(/EXEQUENTE\s*:\s*([^<\n\r]+)/i)?.[1]).find(Boolean) ||
                          'Polo Ativo';
                          
            const reu = processDetails?.processParties?.find((p: any) => p.side === 'passivo' || p.polo === 'reu')?.party?.name || 
                        rawMovements.map((m: any) => m.description?.match(/EXECUTADO\s*:\s*([^<\n\r]+)/i)?.[1]).find(Boolean) ||
                        clientName;

            const rawDigits = num.replace(/\D/g, '');
            const yearMatch = rawDigits.length === 20 ? rawDigits.substring(9, 13) : null;

            // Dates: Opening (Distribution) & Last Update (Newest Movement)
            const sortedMovementsByDateDesc = [...rawMovements].sort((a: any, b: any) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
            const lastMovement = sortedMovementsByDateDesc[0];
            const oldestMovement = sortedMovementsByDateDesc[sortedMovementsByDateDesc.length - 1];

            const lastMovementDateStr = lastMovement?.eventDate 
              ? new Date(lastMovement.eventDate).toLocaleDateString('pt-BR') 
              : (selectedProcess.lastSyncAt ? new Date(selectedProcess.lastSyncAt).toLocaleDateString('pt-BR') : 'Não informado');

            const lastMovementName = lastMovement?.eventName || lastMovement?.description?.slice(0, 30) || 'Movimentação Processual';

            const openingDateStr = selectedProcess.distributionDate 
              ? new Date(selectedProcess.distributionDate).toLocaleDateString('pt-BR')
              : (oldestMovement?.eventDate ? new Date(oldestMovement.eventDate).toLocaleDateString('pt-BR') : (yearMatch ? `Exercício de ${yearMatch}` : 'Não informada'));

            let text = `Trata-se de ação de ${className}`;
            if (subject && subject !== 'Não especificado') {
              text += ` tendo como matéria/objeto a cobrança de ${subject}`;
            }
            if (autor && autor !== 'Polo Ativo') {
              text += `, promovida por ${autor.trim()}`;
            }
            if (reu) {
              text += ` em face de ${reu.trim()}`;
            }
            text += `, em trâmite perante o juízo de ${juizo}`;
            if (tribunal) {
              text += ` (${tribunal})`;
            }
            text += '.';

            if (mainProcessNumber) {
              text += ` O procedimento é originário do processo principal nº ${mainProcessNumber}.`;
            }

            if (openingDateStr && openingDateStr !== 'Não informada') {
              text += ` Ação com abertura/distribuição registrada em ${openingDateStr}.`;
            } else if (yearMatch) {
              text += ` Ação distribuída no exercício de ${yearMatch}.`;
            }

            if (lastMovement) {
              text += ` Última atualização processual em ${lastMovementDateStr} (${lastMovementName}).`;
            }

            return (
              <div className={styles.tabPanel}>
                {/* CARD DE DESTAQUE: SÍNTESE EXECUTIVA DA CAUSA */}
                <div style={{ 
                  background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.85) 100%)', 
                  border: '1px solid rgba(88, 166, 255, 0.3)', 
                  borderRadius: 'var(--r)', 
                  padding: '1.25rem 1.5rem', 
                  marginBottom: '1.5rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: 'rgba(88, 166, 255, 0.2)', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                        <Sparkles size={18} color="#58a6ff" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#ffffff' }}>
                          Síntese da Causa & Do que se trata este Processo
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          Resumo contextual inteligente gerado a partir do cruzamento de dados dos autos e publicações
                        </span>
                      </div>
                    </div>
                    <span className={`${styles.tag} ${styles.tBlue}`} style={{ fontSize: '10.5px', padding: '4px 8px' }}>
                      Contexto da Ação
                    </span>
                  </div>

                  {isLoadingDetails ? (
                    <div style={{
                      margin: '0.5rem 0 1rem', 
                      background: 'rgba(0, 0, 0, 0.3)', 
                      padding: '24px 18px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(56, 139, 253, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#58a6ff' }}>
                        <Loader2 size={18} className={styles.spin} />
                        <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px' }}>Gerando síntese inteligente a partir da rede...</span>
                      </div>
                      <div style={{ width: '100%', maxWidth: '400px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                        <div className={styles.aiLoadingBar} />
                      </div>
                    </div>
                  ) : (
                    <p style={{ 
                      fontSize: '13.5px', 
                      lineHeight: '1.7', 
                      color: '#e2e8f0', 
                      margin: '0.5rem 0 1rem', 
                      background: 'rgba(0, 0, 0, 0.3)', 
                      padding: '14px 18px', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255, 255, 255, 0.08)' 
                    }}>
                      {text}
                    </p>
                  )}

                  {/* Badges de Metadados Chave */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 139, 253, 0.12)', border: '1px solid rgba(56, 139, 253, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', color: '#79c0ff' }}>
                      <Calendar size={12} />
                      <strong>Abertura / Ajuizamento:</strong> {openingDateStr}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(63, 185, 80, 0.12)', border: '1px solid rgba(63, 185, 80, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', color: '#56d364' }}>
                      <Clock size={12} />
                      <strong>Último Evento:</strong> {lastMovementDateStr}
                    </div>

                    {mainProcessNumber && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(210, 153, 34, 0.15)', border: '1px solid rgba(210, 153, 34, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', color: '#d29922' }}>
                        <strong>Processo Principal / Origem:</strong> {mainProcessNumber}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.2)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', color: '#93b4fb' }}>
                      <strong>Comarca / Vara:</strong> {juizo}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(188, 140, 255, 0.1)', border: '1px solid rgba(188, 140, 255, 0.2)', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', color: '#bc8cff' }}>
                      <strong>Rito / Classe:</strong> {className}
                    </div>
                  </div>
                </div>

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

                    {/* Metadados Chave: 4 Itens (Abertura, Última Atualização, Valor e Juízo) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--line-subtle)' }}>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} color="#58a6ff" /> Data de Abertura
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', marginTop: '2px' }}>
                          {openingDateStr}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} color="#3fb950" /> Última Atualização (Evento)
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#3fb950', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{lastMovementDateStr}</span>
                          {lastMovement && (
                            <span className={`${styles.tag} ${styles.tGreen}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                              {lastMovementName.length > 20 ? `${lastMovementName.slice(0, 20)}...` : lastMovementName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600 }}>Valor da Causa</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e3b341', marginTop: '2px' }}>
                          {selectedProcess.value ? `R$ ${Number(selectedProcess.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado nos autos'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 600 }}>Juízo Competente</div>
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
                        {autor}
                      </div>
                      {processDetails?.processParties?.find((p: any) => (p.side === 'ativo' || p.polo === 'autor') && (p.party?.document || p.establishment?.cnpj)) && (
                        <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {processDetails.processParties.find((p: any) => (p.side === 'ativo' || p.polo === 'autor') && (p.party?.document || p.establishment?.cnpj))?.party?.document || processDetails.processParties.find((p: any) => (p.side === 'ativo' || p.polo === 'autor'))?.establishment?.cnpj}
                        </div>
                      )}
                    </div>

                    {/* Polo Passivo */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span className={`${styles.tag} ${styles.tRed}`} style={{ fontSize: '10px' }}>Polo Passivo (Quem Responde)</span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                        {reu}
                      </div>
                      {processDetails?.processParties?.find((p: any) => (p.side === 'passivo' || p.polo === 'reu') && (p.party?.document || p.establishment?.cnpj)) && (
                        <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {processDetails.processParties.find((p: any) => (p.side === 'passivo' || p.polo === 'reu') && (p.party?.document || p.establishment?.cnpj))?.party?.document || processDetails.processParties.find((p: any) => (p.side === 'passivo' || p.polo === 'reu'))?.establishment?.cnpj}
                        </div>
                      )}
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
            );
          })()}

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
                              {mov.complement && (mov.complement.startsWith('http://') || mov.complement.startsWith('https://')) && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                  <a
                                    href={mov.complement}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '11.5px',
                                      color: '#58a6ff',
                                      textDecoration: 'none',
                                      padding: '4px 10px',
                                      background: 'rgba(56, 139, 253, 0.1)',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(56, 139, 253, 0.25)',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <FileText size={12} />
                                    <span>Abrir Documento / Peça Oficial no Tribunal</span>
                                    <ExternalLink size={11} style={{ marginLeft: '2px', opacity: 0.8 }} />
                                  </a>
                                </div>
                              )}
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
          {quickCounts.unseen > 0 && (
            <button 
              className={styles.markSeenBtn}
              onClick={() => markAllSeenMutation.mutate()}
              disabled={markAllSeenMutation.isPending}
              title="Marcar todos os processos como vistos"
            >
              <Eye size={13} />
              {markAllSeenMutation.isPending ? 'Marcando...' : `Marcar todos como vistos (${quickCounts.unseen})`}
            </button>
          )}
          <button className={`${styles.btnS} ${styles.ghost}`}>Exportar CSV</button>
        </div>
      </div>

      <div className={styles.pageContent}>
        {/* SYNC TRACKER BANNER */}
        {syncStatus && syncStatus.status !== 'none' && (
          <div style={{ 
            background: syncStatus.status === 'running' ? 'linear-gradient(90deg, #1e3a8a, #2563eb)' : syncStatus.status === 'success' ? 'linear-gradient(90deg, #064e3b, #047857)' : syncStatus.status === 'cancelled' ? 'linear-gradient(90deg, #854d0e, #a16207)' : 'linear-gradient(90deg, #7f1d1d, #b91c1c)', 
            color: '#fff', 
            padding: '0.85rem 1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            borderRadius: '10px', 
            marginBottom: '1.25rem', 
            border: `1px solid ${syncStatus.status === 'running' ? 'rgba(59, 130, 246, 0.5)' : syncStatus.status === 'success' ? 'rgba(16, 185, 129, 0.5)' : syncStatus.status === 'cancelled' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`, 
            boxShadow: `0 4px 15px ${syncStatus.status === 'running' ? 'rgba(37, 99, 235, 0.25)' : syncStatus.status === 'success' ? 'rgba(4, 120, 87, 0.25)' : syncStatus.status === 'cancelled' ? 'rgba(202, 138, 4, 0.25)' : 'rgba(185, 28, 28, 0.25)'}`
          }}>
            {syncStatus.status === 'running' ? (
              <Loader2 size={24} className="animate-spin" />
            ) : syncStatus.status === 'success' ? (
              <CheckCircle size={24} color="#34d399" />
            ) : syncStatus.status === 'cancelled' ? (
              <AlertCircle size={24} color="#fde047" />
            ) : (
              <AlertCircle size={24} color="#f87171" />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>
                {syncStatus.status === 'running' ? 'Sincronização em Andamento' : syncStatus.status === 'success' ? 'Última Sincronização Concluída' : syncStatus.status === 'cancelled' ? 'Última Sincronização Cancelada' : 'Erro na Última Sincronização'}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
                {syncStatus.status === 'running' 
                  ? 'Buscando processos e andamentos nos tribunais (DataJud/DJEN). Pode continuar navegando, os resultados aparecerão aqui.'
                  : `Finalizada em ${new Date(syncStatus.finishedAt || syncStatus.startedAt).toLocaleString('pt-BR')}.`}
              </div>
            </div>
              <button 
                onClick={() => setIsSyncSummaryOpen(true)}
                style={{ 
                  background: 'rgba(255,255,255,0.15)', 
                  border: 'none', 
                  color: '#fff', 
                  padding: '6px 14px', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'background 0.2s',
                  marginLeft: 'auto'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                Histórico de Sincronizações
              </button>
          </div>
        )}

        {/* Banner de Filtro de Cliente Ativo */}
        {clientIdParam && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)', 
            border: '1px solid rgba(59, 130, 246, 0.4)', 
            borderRadius: '8px', 
            padding: '12px 18px', 
            marginBottom: '1.25rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                <Building2 size={18} color="#58a6ff" />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', color: 'var(--t1)', fontWeight: 600 }}>
                  Exibindo processos do cliente: <span style={{ color: '#93b4fb' }}>{clientNameParam || 'Cliente Selecionado'}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
                  Filtro aplicado a partir da tela de Clientes ({filteredProcesses?.length || 0} processo(s) encontrado(s))
                </div>
              </div>
            </div>
            <button 
              className={`${styles.btnS} ${styles.ghost}`}
              style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--line)' }}
              onClick={() => {
                searchParams.delete('clientId');
                searchParams.delete('clientName');
                setSearchParams(searchParams);
              }}
              title="Remover filtro e visualizar processos de todos os clientes"
            >
              <X size={13} />
              Ver todos os clientes
            </button>
          </div>
        )}

        {/* Painel Avançado de Filtros e Busca Multi-critério */}
        <div className={styles.filterSection}>
          {/* Linha 1: Filtros Rápidos (Pills) e Contador */}
          <div className={styles.quickFiltersRow}>
            <div className={styles.pillsContainer}>
              <button 
                className={`${styles.pillBtn} ${quickPill === 'all' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill('all'); setCurrentPage(1); }}
              >
                Todos
                <span className={styles.pillCount}>{quickCounts.all}</span>
              </button>
              <button 
                className={`${styles.pillBtn} ${quickPill === 'active' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill(quickPill === 'active' ? 'all' : 'active'); setCurrentPage(1); }}
              >
                <span className={styles.dot} style={{ background: '#3fb950' }}></span>
                Ativos
                <span className={styles.pillCount}>{quickCounts.active}</span>
              </button>
              <button 
                className={`${styles.pillBtn} ${quickPill === 'trabalhista' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill(quickPill === 'trabalhista' ? 'all' : 'trabalhista'); setCurrentPage(1); }}
              >
                <Briefcase size={12} />
                Trabalhistas
                <span className={styles.pillCount}>{quickCounts.trabalhista}</span>
              </button>
              <button 
                className={`${styles.pillBtn} ${quickPill === 'civel' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill(quickPill === 'civel' ? 'all' : 'civel'); setCurrentPage(1); }}
              >
                <Scale size={12} />
                Cíveis / Outros
                <span className={styles.pillCount}>{quickCounts.civel}</span>
              </button>
              <button 
                className={`${styles.pillBtn} ${quickPill === 'with_mov' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill(quickPill === 'with_mov' ? 'all' : 'with_mov'); setCurrentPage(1); }}
              >
                <Layers size={12} />
                Com Movimentações
                <span className={styles.pillCount}>{quickCounts.with_mov}</span>
              </button>
              <button 
                className={`${styles.pillBtn} ${styles.pillUnseen} ${quickPill === 'unseen' ? styles.pillActive : ''}`}
                onClick={() => { setQuickPill(quickPill === 'unseen' ? 'all' : 'unseen'); setCurrentPage(1); }}
              >
                <Bell size={12} />
                Novidades
                {quickCounts.unseen > 0 && (
                  <span className={styles.pillCount} style={{ background: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}>{quickCounts.unseen}</span>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeFilterCount > 0 && (
                <button 
                  className={styles.clearBtn}
                  onClick={handleClearAllFilters}
                  title="Limpar todos os filtros aplicados"
                >
                  <RotateCcw size={12} />
                  Limpar Filtros ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* Linha 2: Barra de Busca Principal, Status, Ordenação e Toggle Avançado */}
          <div className={styles.mainFilterBar}>
            <div className={styles.mainSearchInput}>
              <Search size={14} color="#8b949e" />
              <input 
                type="text" 
                placeholder="Buscar por nº CNJ, código #PRC, empresa, autor, CNPJ, vara ou assunto..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className={styles.filterActionBtns}>
              {/* Filtro de Status */}
              <select 
                className={styles.filterSelect} 
                style={{ width: '140px' }}
                value={statusFilter} 
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Status: Todos</option>
                <option value="active">🟢 Ativos</option>
                <option value="suspended">🟡 Suspensos</option>
                <option value="archived">⚪ Arquivados</option>
              </select>

              {/* Ordenação */}
              <select 
                className={styles.filterSelect}
                style={{ width: '170px' }}
                value={sortBy}
                onChange={e => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="recent">🕒 Mais Recentes</option>
                <option value="oldest">🕒 Mais Antigos</option>
                <option value="value_desc">💰 Maior Valor</option>
                <option value="value_asc">💰 Menor Valor</option>
                <option value="cnj_asc">🔢 Número CNJ (A-Z)</option>
                <option value="client_asc">🏢 Empresa (A-Z)</option>
              </select>

              {/* Botão de Filtros Avançados */}
              <button 
                className={`${styles.advFilterToggle} ${isAdvFilterOpen ? styles.open : ''}`}
                onClick={() => setIsAdvFilterOpen(prev => !prev)}
              >
                <SlidersHorizontal size={13} />
                Filtros Avançados
                {activeFilterCount > 0 && (
                  <span className={styles.activeFilterBadge}>{activeFilterCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Linha 3: Grade de Filtros Avançados (Expansível) */}
          {isAdvFilterOpen && (
            <div className={styles.advancedFilterPanel}>
              {/* Filtro por Tribunal */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Tribunal / Corte</label>
                <select 
                  className={styles.filterSelect}
                  value={tribunalFilter}
                  onChange={e => {
                    setTribunalFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Todos os Tribunais</option>
                  {distinctTribunals.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Cliente / Empresa */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Empresa / Cliente</label>
                <select 
                  className={styles.filterSelect}
                  value={clientFilter}
                  onChange={e => {
                    setClientFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Todas as Empresas</option>
                  {distinctClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Ramo da Justiça */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Ramo da Justiça</label>
                <select 
                  className={styles.filterSelect}
                  value={justiceTypeFilter}
                  onChange={e => {
                    setJusticeTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Todos os Ramos</option>
                  <option value="trabalhista">Justiça do Trabalho (TRT/TST)</option>
                  <option value="civel">Justiça Estadual / Cível (TJ)</option>
                  <option value="federal">Justiça Federal (TRF/JF)</option>
                </select>
              </div>

              {/* Filtro por Movimentações */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Histórico de Eventos</label>
                <select 
                  className={styles.filterSelect}
                  value={movementsFilter}
                  onChange={e => {
                    setMovementsFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Qualquer Quantidade</option>
                  <option value="with_mov">Com Movimentações Registradas</option>
                  <option value="no_mov">Sem Movimentações</option>
                </select>
              </div>

              {/* Filtro por Valor da Causa */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Faixa de Valor da Causa</label>
                <select 
                  className={styles.filterSelect}
                  value={valueFilter}
                  onChange={e => {
                    setValueFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Qualquer Valor</option>
                  <option value="under_20k">Até R$ 20.000,00</option>
                  <option value="20k_100k">R$ 20.000,00 a R$ 100.000,00</option>
                  <option value="over_100k">Acima de R$ 100.000,00</option>
                </select>
              </div>

              {/* Filtro por Autor / Parte Contrária */}
              <div className={styles.filterField}>
                <label className={styles.filterFieldLabel}>Autor (Polo Ativo)</label>
                <input 
                  type="text"
                  className={styles.filterSelect}
                  placeholder="Nome ou documento do autor..."
                  value={authorSearch}
                  onChange={e => {
                    setAuthorSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          )}

          {/* Rodapé do Painel de Filtros com Sumário */}
          <div className={styles.filterStatsRow}>
            <div>
              Exibindo <strong>{filteredProcesses.length}</strong> de <strong>{processes?.length || 0}</strong> processos
              {activeFilterCount > 0 && <span style={{ color: 'var(--blue)', marginLeft: '6px' }}>({activeFilterCount} filtro(s) ativo(s))</span>}
            </div>
            {filteredProcesses.length === 0 && (processes?.length || 0) > 0 && (
              <button 
                onClick={handleClearAllFilters}
                style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '11.5px', textDecoration: 'underline' }}
              >
                Nenhum resultado com os filtros atuais. Clique aqui para resetar.
              </button>
            )}
          </div>
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
                  <th>Parte Contrária</th>
                  <th>Tribunal</th>
                  <th>Assunto / Natureza</th>
                  <th style={{ textAlign: 'center' }}>Eventos</th>
                  <th>Abertura</th>
                  <th>Última Ação</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProcesses?.map((proc: any) => {
                  const client = proc.processParties?.find((p: any) => p.client)?.client || proc.processParties?.[0]?.client;
                  const est = proc.processParties?.find((p: any) => p.establishment)?.establishment || proc.processParties?.[0]?.establishment;
                  const isClientAuthor = proc.processParties?.some((p: any) => 
                    (p.client || p.establishment) && (p.polo === 'autor' || p.side === 'ativo')
                  );
                  const adversaryParty = proc.processParties?.find((p: any) => 
                    isClientAuthor 
                      ? (p.polo === 'reu' || p.side === 'passivo')
                      : (p.polo === 'autor' || p.side === 'ativo')
                  )?.party;

                  return (
                    <tr 
                      key={proc.id} 
                      className={proc.isNew ? styles.rowNew : proc.hasUnseenUpdates ? styles.rowUpdated : ''}
                      onClick={() => {
                        setSelectedProcessId(proc.id);
                        setActiveTab('overview');
                      }}
                      title="Clique para abrir o Resumo da Causa, detalhes, partes e linha do tempo"
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className={styles.mono} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                            #PRC-{proc.id ? proc.id.slice(0, 8).toUpperCase() : '0000'}
                          </span>
                          {proc.isNew && (
                            <span className={styles.badgeNew}>
                              <Sparkles size={10} /> Novo
                            </span>
                          )}
                          {!proc.isNew && proc.hasUnseenUpdates && (
                            <span className={styles.badgeUpdated}>
                              <Bell size={10} /> Atualizado
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.mono} style={{ fontWeight: 600, color: 'var(--blue)' }}>
                          {proc.processNumber}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--t1)' }}>
                          {getDisplayName(est, client?.name)}
                        </div>
                        {est?.cnpj && (
                          <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                            {isDocCpf(est.cnpj) ? maskCPF(est.cnpj) : est.cnpj}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {adversaryParty?.name || 'Parte Contrária'}
                          {adversaryParty?.enrichmentSource === 'djen_cnj' ? (
                            <span className={`${styles.tag} ${styles.tGreen}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                              DJEN
                            </span>
                          ) : adversaryParty?.isMasked ? (
                            <span className={`${styles.tag} ${styles.tGold}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                              LGPD
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'monospace' }}>
                          {adversaryParty?.document ? (adversaryParty.document.length > 14 ? `CNPJ: ${adversaryParty.document}` : `CPF: ${adversaryParty.document}`) : 'Pessoa Física / Jurídica'}
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
                          {proc.distributionDate 
                            ? new Date(proc.distributionDate).toLocaleDateString('pt-BR') 
                            : (proc.processNumber?.replace(/\D/g, '').length === 20 ? `Ano ${proc.processNumber.replace(/\D/g, '').substring(9, 13)}` : '-')}
                        </span>
                      </td>
                      <td>
                        <span className={styles.mono} style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          {proc.movements?.[0]?.eventDate ? new Date(proc.movements[0].eventDate).toLocaleDateString('pt-BR') : '-'}
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
      {/* MODAL: HISTÓRICO DE SINCRONIZAÇÃO */}
      {isSyncSummaryOpen && (
        <div className={styles.docModalOverlay} onClick={() => setIsSyncSummaryOpen(false)}>
          <div className={styles.docModalContent} style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.docModalHeader}>
              <div className={styles.docModalHeaderLeft}>
                <RefreshCw size={18} color="var(--blue)" />
                <h3 className={styles.docModalTitle}>
                  Histórico de Sincronizações
                </h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsSyncSummaryOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.docModalBody} style={{ padding: 0 }}>
              {isLoadingSyncHistory ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--t2)' }}>
                  <Loader2 size={24} className={styles.spin} style={{ margin: '0 auto 1rem', display: 'block' }} />
                  Carregando histórico...
                </div>
              ) : syncHistory && syncHistory.length > 0 ? (
                <div className={styles.tableWrapper} style={{ maxHeight: '400px', overflowY: 'auto', border: 'none', borderRadius: 0 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Data/Hora Início</th>
                        <th>Data/Hora Fim</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Novos Proc.</th>
                        <th style={{ textAlign: 'center' }}>Novos Andam.</th>
                        <th>Disparado Por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistory.map((job: any) => (
                        <tr 
                          key={job.id} 
                          onClick={() => {
                            if (job.status === 'success') {
                              setSelectedJobForDetails(job);
                            }
                          }}
                          style={{ cursor: job.status === 'success' ? 'pointer' : 'default' }}
                          title={job.status === 'success' ? 'Clique para ver os detalhes' : ''}
                        >
                          <td>{new Date(job.startedAt).toLocaleString('pt-BR')}</td>
                          <td>{job.finishedAt ? new Date(job.finishedAt).toLocaleString('pt-BR') : '-'}</td>
                          <td>
                            {job.status === 'success' ? (
                              <span style={{ color: '#34d399', fontWeight: 600 }}>Sucesso</span>
                            ) : job.status === 'running' ? (
                              <span style={{ color: '#60a5fa', fontWeight: 600 }}>Buscando...</span>
                            ) : (
                              <span style={{ color: '#f87171', fontWeight: 600 }} title={job.errorMessage || ''}>Erro</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: job.newProcessesFound > 0 ? '#34d399' : 'inherit' }}>{job.newProcessesFound || 0}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: job.newMovementsFound > 0 ? '#34d399' : 'inherit' }}>{job.newMovementsFound || 0}</td>
                          <td>{job.triggeredBy || 'Sistema'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--t2)' }}>
                  Nenhum histórico encontrado para este cliente.
                </div>
              )}
            </div>
            <div className={styles.docModalFooter}>
              <button className={`${styles.btn} ${styles.outline}`} onClick={() => refetchSyncHistory()}>
                <RefreshCw size={16} /> Atualizar
              </button>
              <button className={`${styles.btnS} ${styles.primary}`} onClick={() => setIsSyncSummaryOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO JOB */}
      {selectedJobForDetails && (
        <div className={styles.docModalOverlay} onClick={() => setSelectedJobForDetails(null)}>
          <div className={styles.docModalContent} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.docModalHeader}>
              <div className={styles.docModalHeaderLeft}>
                <Sparkles size={18} color="var(--blue)" />
                <h3 className={styles.docModalTitle}>
                  Detalhes da Sincronização
                </h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedJobForDetails(null)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.docModalMetaBar}>
              <div>Início: <strong style={{ color: 'var(--t1)' }}>{new Date(selectedJobForDetails.startedAt).toLocaleString('pt-BR')}</strong></div>
              {selectedJobForDetails.finishedAt && (
                <div>Fim: <strong style={{ color: 'var(--t1)' }}>{new Date(selectedJobForDetails.finishedAt).toLocaleString('pt-BR')}</strong></div>
              )}
            </div>
            <div className={styles.docModalBody} style={{ padding: 0 }}>
              {isLoadingJobDetails ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--t2)' }}>
                  <Loader2 size={24} className={styles.spin} style={{ margin: '0 auto 1rem', display: 'block' }} />
                  Carregando lista detalhada...
                </div>
              ) : syncJobDetails && syncJobDetails.length > 0 ? (
                <>
                  {syncJobDetails.length > 200 && (
                    <div style={{ padding: '12px 20px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '12px' }}>
                      <strong>Aviso:</strong> Apenas os primeiros 200 registros estão sendo exibidos por questão de desempenho (Total encontrado: {syncJobDetails.length}).
                    </div>
                  )}
                  <div className={styles.tableWrapper} style={{ border: 'none', borderRadius: 0 }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Número do Processo</th>
                          <th>Tipo de Atualização</th>
                          <th>Descrição / Detalhe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncJobDetails.slice(0, 200).map((det: any, i: number) => (
                          <tr key={i}>
                            <td className={styles.mono} style={{ color: 'var(--blue)' }}>{det.processNumber}</td>
                            <td>
                              {det.type === 'process' ? (
                                <span className={`${styles.tag} ${styles.tGreen}`}>Processo Novo</span>
                              ) : (
                                <span className={`${styles.tag} ${styles.tPurple}`}>Novo Andamento</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--t2)' }}>
                              {det.type === 'process' ? 'Processo incluído na base' : (det.description || '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--t2)' }}>
                  Nenhum processo ou andamento novo foi encontrado nesta sincronização.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
