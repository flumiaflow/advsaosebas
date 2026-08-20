import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';
import { Plus, Trash2, Building2, UploadCloud, RefreshCw, Edit3, CheckCircle2, Loader2, AlertCircle, ArrowRight, X, Terminal, ShieldCheck, Scale } from 'lucide-react';
import toast from 'react-hot-toast';

function formatCNPJ(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 14);
  if (raw.length > 12) return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
  if (raw.length > 8) return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
  if (raw.length > 5) return raw.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  if (raw.length > 2) return raw.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
  return raw;
}

const SYNC_STEPS = [
  { id: 1, title: 'Catalogação de CNPJs', desc: 'Mapeando matriz e filiais cadastradas' },
  { id: 2, title: 'Conexão DataJud (CNJ)', desc: 'Conectando às APIs de TRTs e Tribunais de Justiça' },
  { id: 3, title: 'Varredura de Processos', desc: 'Buscando novos feitos e movimentações recentes' },
  { id: 4, title: 'Enriquecimento DJEN', desc: 'Desmascarando nomes das partes via Diário Oficial' },
  { id: 5, title: 'Consolidação de Dados', desc: 'Indexando partes, deduplicando e gerando linha do tempo' }
];

export default function Clients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Client Modal state (Create & Edit)
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<{
    id?: string;
    name: string;
    fantasyName: string;
    notes: string;
    isActive: boolean;
    cnpjs: string[];
    currentCnpj: string;
  } | null>(null);

  // Import Modal state
  const [importModalClient, setImportModalClient] = useState<any>(null);
  const [importInput, setImportInput] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);

  // Sync Radar Modal State
  const [syncModalState, setSyncModalState] = useState<{
    isOpen: boolean;
    client: any | null;
    progress: number;
    currentStepIndex: number;
    logs: string[];
    status: 'idle' | 'running' | 'completed' | 'error';
    summary: {
      newProcessesCount: number;
      newMovementsCount: number;
      establishmentsCount: number;
    } | null;
    errorMessage?: string;
  }>({
    isOpen: false,
    client: null,
    progress: 0,
    currentStepIndex: 0,
    logs: [],
    status: 'idle',
    summary: null
  });

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [syncModalState.logs]);

  // Queries
  const { data: clients, isLoading } = useQuery({
    queryKey: ['workspace', 'clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return Array.isArray(data) ? data : data.clients || [];
    }
  });

  // Save / Update Client Mutation
  const saveClientMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        return api.put(`/clients/${payload.id}`, payload);
      }
      return api.post('/clients', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'dashboard'] });
      toast.success(clientForm?.id ? 'Grupo empresarial atualizado!' : 'Cliente e CNPJs cadastrados com sucesso!');
      setClientModalOpen(false);
      setClientForm(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erro ao salvar cliente');
    }
  });

  // Import Mutations
  const previewImportMutation = useMutation({
    mutationFn: async (processNumbers: string[]) => {
      const { data } = await api.post('/import/preview', { processNumbers });
      return data;
    },
    onSuccess: (data) => setImportPreview(data.previewResult),
    onError: (error: any) => alert(error.response?.data?.error || 'Erro ao gerar preview')
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (processNumbers: string[]) => {
      const { data } = await api.post('/import/confirm', { processNumbers, clientId: importModalClient.id });
      return data;
    },
    onSuccess: () => {
      toast.success('Importação em lote enviada com sucesso!');
      setImportModalClient(null);
      setImportInput('');
      setImportPreview(null);
    },
    onError: (error: any) => alert(error.response?.data?.error || 'Erro ao iniciar importação')
  });

  // Iniciar Sincronização Interativa com Radar e Gauge
  const handleStartSync = async (client: any) => {
    const ests = client.establishments || [];
    const nowStr = () => new Date().toLocaleTimeString('pt-BR');

    setSyncModalState({
      isOpen: true,
      client,
      progress: 5,
      currentStepIndex: 0,
      logs: [
        `[${nowStr()}] 🚀 Inicializando varredura para o grupo: ${client.name}`,
        `[${nowStr()}] 🏢 Mapeando ${ests.length} CNPJ(s) ativos cadastrados...`
      ],
      status: 'running',
      summary: null
    });

    try {
      // Simulação progressiva de feedback visual enquanto o backend executa
      const timer1 = setTimeout(() => {
        setSyncModalState(prev => ({
          ...prev,
          progress: 25,
          currentStepIndex: 1,
          logs: [
            ...prev.logs,
            `[${nowStr()}] 📡 Conectando ao DataJud (CNJ) - Varredura de Tribunais Regionais...`,
            `[${nowStr()}] 🔎 Consultando CNPJs: ${ests.map((e: any) => e.cnpj).join(', ') || 'N/D'}`
          ]
        }));
      }, 700);

      const timer2 = setTimeout(() => {
        setSyncModalState(prev => ({
          ...prev,
          progress: 55,
          currentStepIndex: 2,
          logs: [
            ...prev.logs,
            `[${nowStr()}] 📥 Extraindo metadados de processos e movimentações processuais...`
          ]
        }));
      }, 1500);

      const timer3 = setTimeout(() => {
        setSyncModalState(prev => ({
          ...prev,
          progress: 80,
          currentStepIndex: 3,
          logs: [
            ...prev.logs,
            `[${nowStr()}] 🏛️ Consultando API do Diário de Justiça Eletrônico Nacional (DJEN)...`,
            `[${nowStr()}] 🔓 Desmascarando nomes de polos ativos e advogados via DJE...`
          ]
        }));
      }, 2300);

      // Chamada real ao backend
      const response = await api.post(`/sync/client/${client.id}`);
      
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const summary = response.data?.summary || {
        establishmentsCount: ests.length,
        newProcessesCount: 0,
        newMovementsCount: 0
      };

      setSyncModalState(prev => ({
        ...prev,
        progress: 100,
        currentStepIndex: 4,
        status: 'completed',
        summary,
        logs: [
          ...prev.logs,
          `[${nowStr()}] ✨ Consolidação e deduplicação de partes concluídas com sucesso!`,
          `[${nowStr()}] 📊 Resumo: ${summary.newProcessesCount ?? 0} processo(s) atualizado(s), ${summary.newMovementsCount ?? 0} movimentação(ões) indexada(s).`,
          `[${nowStr()}] 🏁 Varredura finalizada.`
        ]
      }));

      queryClient.invalidateQueries({ queryKey: ['workspace', 'processes'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'dashboard'] });
      toast.success('Varredura concluída com sucesso!');
    } catch (err: any) {
      setSyncModalState(prev => ({
        ...prev,
        status: 'error',
        progress: 100,
        errorMessage: err.response?.data?.error || 'Erro ao sincronizar com os tribunais',
        logs: [
          ...prev.logs,
          `[${nowStr()}] ❌ Erro: ${err.response?.data?.error || err.message}`
        ]
      }));
      toast.error('Erro na varredura');
    }
  };

  const handleOpenCreate = () => {
    setClientForm({
      name: '',
      fantasyName: '',
      notes: '',
      isActive: true,
      cnpjs: [],
      currentCnpj: ''
    });
    setClientModalOpen(true);
  };

  const handleOpenEdit = (client: any) => {
    const existingCnpjs = (client.establishments || []).map((e: any) => e.cnpj);
    setClientForm({
      id: client.id,
      name: client.name,
      fantasyName: client.fantasyName || '',
      notes: client.notes || '',
      isActive: client.isActive !== false,
      cnpjs: existingCnpjs,
      currentCnpj: ''
    });
    setClientModalOpen(true);
  };

  const handleAddCnpj = () => {
    if (!clientForm) return;
    const clean = clientForm.currentCnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    const formatted = formatCNPJ(clean);
    if (clientForm.cnpjs.includes(formatted)) {
      toast.error('Este CNPJ já está na lista deste cliente.');
      return;
    }
    setClientForm({
      ...clientForm,
      cnpjs: [...clientForm.cnpjs, formatted],
      currentCnpj: ''
    });
  };

  const handleRemoveCnpj = (cnpjToRemove: string) => {
    if (!clientForm) return;
    setClientForm({
      ...clientForm,
      cnpjs: clientForm.cnpjs.filter(c => c !== cnpjToRemove)
    });
  };

  const handleSave = () => {
    if (!clientForm) return;
    if (!clientForm.name.trim()) {
      toast.error('A Razão Social / Nome do Grupo é obrigatória.');
      return;
    }

    let finalCnpjs = [...clientForm.cnpjs];
    const cleanPending = clientForm.currentCnpj.replace(/\D/g, '');
    if (cleanPending.length === 14) {
      const formattedPending = formatCNPJ(cleanPending);
      if (!finalCnpjs.includes(formattedPending)) {
        finalCnpjs.push(formattedPending);
      }
    }

    saveClientMutation.mutate({
      id: clientForm.id,
      name: clientForm.name.trim(),
      fantasyName: clientForm.fantasyName?.trim() || null,
      notes: clientForm.notes?.trim() || null,
      isActive: clientForm.isActive,
      cnpjs: finalCnpjs
    });
  };

  const handlePreview = () => {
    const list = importInput
      .split(/[\n,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (list.length === 0) return;
    previewImportMutation.mutate(list);
  };

  const handleConfirm = () => {
    const list = importInput
      .split(/[\n,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (list.length === 0) return;
    confirmImportMutation.mutate(list);
  };

  const filteredClients = clients?.filter((c: any) => {
    const term = searchTerm.toLowerCase();
    const matchName = c.name?.toLowerCase().includes(term);
    const matchFantasy = c.fantasyName?.toLowerCase().includes(term);
    const matchCnpj = c.establishments?.some((e: any) => e.cnpj.includes(term));
    return matchName || matchFantasy || matchCnpj;
  });

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--t2)' }}>Carregando empresas...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Clientes e Grupos Empresariais</h1>
            <p>Gerencie as empresas, matrizes e filiais para monitoramento automático de processos judiciais</p>
          </div>
          <button 
            className={styles.btnPrimary} 
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', fontSize: '13px' }}
          >
            <Plus size={15} /> Novo Grupo / Empresa
          </button>
        </div>
      </header>

      <div>
        {/* Barra de Filtro */}
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Buscar por Razão Social, Fantasia ou CNPJ..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ 
              width: '360px',
              padding: '0.5rem 0.75rem', 
              borderRadius: '6px', 
              border: '1px solid var(--line)', 
              background: 'var(--card)', 
              color: '#fff',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Tabela de Clientes */}
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Grupo / Razão Social</th>
                <th>CNPJs Monitorados</th>
                <th>Status</th>
                <th>Criado em</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients?.map((client: any) => {
                const ests = client.establishments || [];
                return (
                  <tr key={client.id}>
                    <td 
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/dashboard/processes?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
                      title={`Ver todos os processos de ${client.name}`}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{client.name}</span>
                        <ArrowRight size={12} style={{ opacity: 0.7 }} />
                      </div>
                      {client.fantasyName && (
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                          {client.fantasyName}
                        </div>
                      )}
                    </td>
                    <td>
                      {ests.length === 0 ? (
                        <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem' }}>
                          ⚠️ Nenhum CNPJ (Clique em Editar para adicionar)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                          {ests.slice(0, 3).map((e: any, idx: number) => (
                            <span 
                              key={e.id || idx}
                              style={{ 
                                background: idx === 0 ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                                border: `1px solid ${idx === 0 ? 'var(--blue)' : 'var(--line)'}`,
                                color: idx === 0 ? 'var(--blue)' : 'var(--t2)',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              {e.cnpj} {idx === 0 && <small style={{ opacity: 0.8 }}>(Matriz)</small>}
                            </span>
                          ))}
                          {ests.length > 3 && (
                            <span 
                              style={{ 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid var(--line)', 
                                color: 'var(--t3)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}
                            >
                              +{ests.length - 3} filial(is)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${client.isActive ? styles.active : styles.cancelled}`}>
                        {client.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{new Date(client.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'center' }}>
                        <button 
                          onClick={() => navigate(`/dashboard/processes?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
                          className={styles.btnText}
                          style={{ color: '#3fb950', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '12px', fontWeight: 600 }}
                          title="Visualizar processos deste cliente"
                        >
                          <Scale size={13} /> Processos
                        </button>
                        <button 
                          className={styles.btnText}
                          onClick={() => handleOpenEdit(client)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px' }}
                          title="Editar dados e gerenciar CNPJs do grupo"
                        >
                          <Edit3 size={13} /> Editar
                        </button>
                        <button 
                          onClick={() => handleStartSync(client)}
                          className={styles.btnText}
                          style={{ color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '12px', fontWeight: 600 }}
                          title="Iniciar varredura de processos para este grupo agora"
                        >
                          <RefreshCw size={13} /> Sincronizar
                        </button>
                        <button 
                          onClick={() => {
                            setImportModalClient(client);
                            setImportInput('');
                            setImportPreview(null);
                          }}
                          className={styles.btnText}
                          style={{ color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px' }}
                          title="Importar lista de processos específicos para este grupo"
                        >
                          <UploadCloud size={13} /> Importar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!filteredClients || filteredClients.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--t3)' }}>
                    Nenhuma empresa encontrada. Clique em "+ Novo Grupo / Empresa" para cadastrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: RADAR DE VARREDURA & GAUGE DE PROGRESSO AO VIVO     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {syncModalState.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '640px', padding: '1.75rem', background: '#0e131f', border: '1px solid rgba(56, 139, 253, 0.25)', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}>
            
            {/* Topo do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className={styles.tag} style={{ background: 'rgba(37, 99, 235, 0.15)', color: 'var(--blue)', border: '1px solid rgba(37, 99, 235, 0.3)', fontSize: '10px' }}>
                    DATAJUD & DJEN
                  </span>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', border: 'none', padding: 0 }}>
                    Varredura Judicial em Andamento
                  </h2>
                </div>
                <div style={{ color: 'var(--t2)', fontSize: '13px' }}>
                  Grupo: <strong style={{ color: '#fff' }}>{syncModalState.client?.name}</strong> · {syncModalState.client?.establishments?.length || 1} CNPJ(s)
                </div>
              </div>

              {syncModalState.status !== 'running' && (
                <button 
                  onClick={() => setSyncModalState(prev => ({ ...prev, isOpen: false }))} 
                  style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* SEÇÃO PRINCIPAL: RADIAL GAUGE + STATUS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(22, 27, 34, 0.8)', border: '1px solid var(--line)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
              
              {/* Radial Gauge Visual SVG */}
              <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="rgba(255, 255, 255, 0.08)" 
                    strokeWidth="8" 
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke={syncModalState.status === 'error' ? '#f85149' : syncModalState.status === 'completed' ? '#3fb950' : '#2563eb'} 
                    strokeWidth="8" 
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * syncModalState.progress) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease' }}
                  />
                </svg>

                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    {syncModalState.progress}%
                  </div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--t3)', letterSpacing: '0.4px' }}>
                    {syncModalState.status === 'completed' ? 'Concluído' : syncModalState.status === 'error' ? 'Falha' : 'Varrendo'}
                  </div>
                </div>
              </div>

              {/* Status Text & Dynamic Step Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {syncModalState.status === 'running' ? (
                    <Loader2 size={16} color="#3b82f6" className="animate-spin" />
                  ) : syncModalState.status === 'completed' ? (
                    <CheckCircle2 size={16} color="#3fb950" />
                  ) : (
                    <AlertCircle size={16} color="#f85149" />
                  )}
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: syncModalState.status === 'error' ? '#f85149' : syncModalState.status === 'completed' ? '#3fb950' : '#fff' }}>
                    {syncModalState.status === 'completed' 
                      ? 'Varredura finalizada com sucesso!' 
                      : syncModalState.status === 'error' 
                      ? 'Erro durante a varredura' 
                      : SYNC_STEPS[syncModalState.currentStepIndex]?.title}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: 1.4 }}>
                  {syncModalState.status === 'completed' 
                    ? 'Todos os processos e andamentos foram indexados e enriquecidos na base.' 
                    : syncModalState.status === 'error'
                    ? syncModalState.errorMessage
                    : SYNC_STEPS[syncModalState.currentStepIndex]?.desc}
                </div>
              </div>
            </div>

            {/* STEPPER DE ETAPAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {SYNC_STEPS.map((s, idx) => {
                const isDone = syncModalState.progress >= ((idx + 1) * 20) || syncModalState.status === 'completed';
                const isCurrent = syncModalState.currentStepIndex === idx && syncModalState.status === 'running';

                return (
                  <div 
                    key={s.id}
                    style={{
                      background: isCurrent ? 'rgba(37, 99, 235, 0.15)' : isDone ? 'rgba(63, 185, 80, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isCurrent ? 'var(--blue)' : isDone ? 'rgba(63, 185, 80, 0.3)' : 'var(--line)'}`,
                      borderRadius: '6px',
                      padding: '8px 6px',
                      textAlign: 'center',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: isCurrent ? 'var(--blue)' : isDone ? '#3fb950' : 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginBottom: '2px' }}>
                      {isDone ? (
                        <CheckCircle2 size={12} />
                      ) : isCurrent ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <span>#{s.id}</span>
                      )}
                      <span>Etapa {s.id}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: isCurrent ? '#fff' : isDone ? 'var(--t2)' : 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title.split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LIVE TERMINAL CONSOLE */}
            <div style={{ background: '#05070c', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.35rem' }}>
                <Terminal size={12} color="#8b949e" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Log de Varredura em Tempo Real
                </span>
              </div>
              <div style={{ height: '110px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8b949e', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {syncModalState.logs.map((line, idx) => (
                  <div key={idx} style={{ color: line.includes('❌') ? '#f85149' : line.includes('✨') || line.includes('✅') ? '#3fb950' : line.includes('🚀') ? '#3b82f6' : '#8b949e' }}>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* CARDS DE RESUMO AO FINALIZAR */}
            {syncModalState.status === 'completed' && syncModalState.summary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(22, 27, 34, 0.8)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--t3)' }}>CNPJs Varridos</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                    {syncModalState.summary.establishmentsCount || syncModalState.client?.establishments?.length || 1}
                  </div>
                </div>
                <div style={{ background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--blue)' }}>Novos Processos</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--blue)', marginTop: '2px' }}>
                    +{syncModalState.summary.newProcessesCount ?? 0}
                  </div>
                </div>
                <div style={{ background: 'rgba(63, 185, 80, 0.1)', border: '1px solid rgba(63, 185, 80, 0.3)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#3fb950' }}>Movimentações</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#3fb950', marginTop: '2px' }}>
                    +{syncModalState.summary.newMovementsCount ?? 0}
                  </div>
                </div>
              </div>
            )}

            {/* FOOTER ACTIONS */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                onClick={() => setSyncModalState(prev => ({ ...prev, isOpen: false }))}
                disabled={syncModalState.status === 'running'}
              >
                {syncModalState.status === 'running' ? 'Varrendo em segundo plano...' : 'Fechar'}
              </button>
              
              {syncModalState.status === 'completed' && (
                <button 
                  type="button" 
                  className={styles.btnPrimary}
                  onClick={() => {
                    setSyncModalState(prev => ({ ...prev, isOpen: false }));
                    navigate('/dashboard/processes');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  Ver Processos Encontrados <ArrowRight size={14} />
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: CADASTRO E EDIÇÃO DO GRUPO EMPRESARIAL COM CNPJS    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {clientModalOpen && clientForm && (
        <div className={styles.modalOverlay} onClick={() => setClientModalOpen(false)}>
          <div 
            className={styles.modalContent} 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '640px', padding: '2rem', background: '#121620', border: '1px solid var(--line)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Building2 size={20} color="var(--blue)" />
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', border: 'none', padding: 0 }}>
                  {clientForm.id ? 'Editar Grupo Empresarial' : 'Novo Grupo Empresarial'}
                </h2>
              </div>
              <button onClick={() => setClientModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* CABEÇALHO: DADOS GERAIS */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Dados do Grupo / Razão Social
                </div>

                <div className={styles.formGroup}>
                  <label>Razão Social / Nome Principal *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Grupo Gerdau S.A." 
                    value={clientForm.name} 
                    onChange={e => setClientForm({ ...clientForm, name: e.target.value })} 
                    required 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Nome Fantasia / Sigla do Grupo (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Gerdau Aços" 
                    value={clientForm.fantasyName} 
                    onChange={e => setClientForm({ ...clientForm, fantasyName: e.target.value })} 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Observações / Notas Internas</label>
                  <textarea 
                    placeholder="Informações adicionais do cliente..." 
                    value={clientForm.notes} 
                    onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                    rows={2} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="isActiveCheck"
                    checked={clientForm.isActive} 
                    onChange={e => setClientForm({ ...clientForm, isActive: e.target.checked })} 
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActiveCheck" style={{ margin: 0, cursor: 'pointer', color: '#fff', fontSize: '13px' }}>
                    Grupo Ativo para Monitoramento Automático
                  </label>
                </div>
              </div>

              {/* LISTA DE CNPJS: MATRIZ E FILIAIS */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. CNPJs do Grupo (Matriz e Filiais para Varredura)
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--t3)', margin: '0 0 1rem 0' }}>
                  Todos os processos encontrados nestes CNPJs serão centralizados sob este cliente.
                </p>

                {/* Input para adicionar CNPJ */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="00.000.000/0000-00" 
                    value={clientForm.currentCnpj} 
                    onChange={e => setClientForm({ ...clientForm, currentCnpj: formatCNPJ(e.target.value) })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCnpj();
                      }
                    }}
                    style={{ 
                      flex: 1, 
                      padding: '0.6rem 0.75rem', 
                      borderRadius: '6px', 
                      border: '1px solid var(--line)', 
                      background: 'var(--card)', 
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px'
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddCnpj}
                    className={styles.btnPrimary}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.6rem 1rem' }}
                  >
                    <Plus size={15} /> Adicionar CNPJ
                  </button>
                </div>

                {/* Lista de CNPJs Adicionados */}
                {clientForm.cnpjs.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--line)', borderRadius: '6px', color: 'var(--t3)', fontSize: '0.8125rem' }}>
                    Nenhum CNPJ adicionado ainda. Insira o CNPJ da matriz e/ou filiais acima.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {clientForm.cnpjs.map((cnpj, idx) => (
                      <div 
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: idx === 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${idx === 0 ? 'rgba(37, 99, 235, 0.3)' : 'var(--line)'}`,
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: idx === 0 ? 'var(--blue)' : '#fff', fontSize: '12.5px' }}>
                            {cnpj}
                          </span>
                          {idx === 0 && (
                            <span className={styles.tag} style={{ background: 'rgba(37, 99, 235, 0.2)', color: 'var(--blue)', border: '1px solid rgba(37, 99, 235, 0.4)', fontSize: '10px' }}>
                              Matriz Principal
                            </span>
                          )}
                          {idx > 0 && (
                            <span className={styles.tag} style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--t3)', fontSize: '10px' }}>
                              Filial #{idx}
                            </span>
                          )}
                        </div>

                        <button 
                          type="button" 
                          onClick={() => handleRemoveCnpj(cnpj)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f85149',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Remover este CNPJ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                onClick={() => setClientModalOpen(false)} 
                className={styles.btnSecondary}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSave} 
                disabled={saveClientMutation.isPending || !clientForm.name}
                className={styles.btnPrimary}
              >
                {saveClientMutation.isPending ? 'Salvando...' : 'Salvar Grupo e CNPJs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: IMPORTAÇÃO EM LOTE DE PROCESSOS                     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {importModalClient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Importação em Lote: {importModalClient.name}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Insira números de processos (separados por vírgula ou linha) para vincular a esta empresa:
            </p>

            <textarea 
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              placeholder="0010452-45.2025.5.02.0001&#10;0020453-12.2024.5.02.0002"
              rows={5}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', fontFamily: 'monospace' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
              <button onClick={() => setImportModalClient(null)} className={styles.btnSecondary}>Fechar</button>
              <button 
                onClick={handlePreview}
                disabled={previewImportMutation.isPending || !importInput.trim()}
                className={styles.btnPrimary}
              >
                {previewImportMutation.isPending ? 'Validando...' : 'Pré-visualizar'}
              </button>
            </div>

            {importPreview && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Resumo da Validação:</h4>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                  <p>• Novos processos válidos: <strong>{importPreview.newProcesses?.length || 0}</strong></p>
                  <p>• Já existentes no sistema: <strong>{importPreview.existingProcesses?.length || 0}</strong></p>
                  <p>• Inválidos ou com erro de formato: <strong>{importPreview.invalidNumbers?.length || 0}</strong></p>
                </div>

                <button 
                  onClick={handleConfirm}
                  disabled={confirmImportMutation.isPending}
                  className={styles.btnPrimary}
                  style={{ width: '100%', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                >
                  {confirmImportMutation.isPending ? 'Enviando...' : 'Confirmar e Importar Processos'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
