import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import styles from '../Backoffice/Backoffice.module.css';
import { Plus, Trash2, Building2, UploadCloud, RefreshCw, Edit3, CheckCircle2, Loader2, AlertCircle, ArrowRight, X, Terminal, ShieldCheck, Scale } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatCNPJ, formatCPF, formatDocument, maskCPF, isDocCpf } from '../../utils/formatters';

const SYNC_STEPS = [
  { id: 1, title: 'Catalogação de Documentos', desc: 'Mapeando CNPJs, CPFs e termos de busca' },
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
    documents: { document: string; alias: string; razaoSocial: string; type: 'cnpj' | 'cpf' }[];
    currentDocument: string;
    currentAlias: string;
    currentDocName: string;
  } | null>(null);

  // Import Modal state
  const [importModalClient, setImportModalClient] = useState<any>(null);
  const [importInput, setImportInput] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);

  // Sync Radar Modal State
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    
    const handleSyncCompleted = (payload: any) => {
      if (payload.success) {
        queryClient.invalidateQueries({ queryKey: ['workspace', 'processes'] });
        queryClient.invalidateQueries({ queryKey: ['workspace', 'clients'] });
        queryClient.invalidateQueries({ queryKey: ['workspace', 'dashboard'] });
        toast.success(`Varredura concluída! ${payload.summary?.newProcessesCount ?? 0} processos atualizados.`);
      } else {
        toast.error(`Falha na varredura: ${payload.error}`);
      }
    };

    socket.on('sync:completed', handleSyncCompleted);
    return () => {
      socket.off('sync:completed', handleSyncCompleted);
    };
  }, [socket, queryClient]);

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

  const handleStartSync = async (client: any) => {
    try {
      await api.post(`/sync/client/${client.id}`);
      toast.success(`Sincronização de ${client.name} iniciada! Acompanhe o progresso.`);
      
      // Define optimistic state immediately before navigating
      queryClient.setQueryData(['workspace', 'syncStatus', client.id], { status: 'running' });
      
      navigate(`/dashboard/processes?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro na requisição inicial da varredura');
    }
  };

  const handleOpenCreate = () => {
    setClientForm({
      name: '',
      fantasyName: '',
      notes: '',
      isActive: true,
      documents: [],
      currentDocument: '',
      currentAlias: '',
      currentDocName: ''
    });
    setClientModalOpen(true);
  };

  const handleOpenEdit = (client: any) => {
    const existingDocs = (client.establishments || []).map((e: any) => ({
      document: e.cnpj,
      alias: e.alias || '',
      razaoSocial: e.razaoSocial || '',
      type: isDocCpf(e.cnpj) ? 'cpf' : 'cnpj'
    }));
    setClientForm({
      id: client.id,
      name: client.name,
      fantasyName: client.fantasyName || '',
      notes: client.notes || '',
      isActive: client.isActive !== false,
      documents: existingDocs as any,
      currentDocument: '',
      currentAlias: '',
      currentDocName: ''
    });
    setClientModalOpen(true);
  };

  const handleAddDocument = () => {
    if (!clientForm) return;
    const clean = clientForm.currentDocument.replace(/\D/g, '');
    if (clean.length !== 11 && clean.length !== 14) {
      toast.error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    const isCpf = clean.length === 11;
    if (isCpf && !clientForm.currentDocName.trim()) {
      toast.error('Para CPF, informe o nome completo da pessoa.');
      return;
    }
    const formatted = formatDocument(clean);
    if (clientForm.documents.some(d => d.document === formatted)) {
      toast.error('Este documento já está na lista deste cliente.');
      return;
    }
    setClientForm({
      ...clientForm,
      documents: [
        ...clientForm.documents, 
        { 
          document: formatted, 
          alias: clientForm.currentAlias.trim(), 
          razaoSocial: clientForm.currentDocName.trim(),
          type: isCpf ? 'cpf' : 'cnpj' 
        }
      ],
      currentDocument: '',
      currentAlias: '',
      currentDocName: ''
    });
  };

  const handleRemoveDocument = (docToRemove: string) => {
    if (!clientForm) return;
    setClientForm({
      ...clientForm,
      documents: clientForm.documents.filter(d => d.document !== docToRemove)
    });
  };

  const handleSave = () => {
    if (!clientForm) return;
    if (!clientForm.name.trim()) {
      toast.error('A Razão Social / Nome do Grupo é obrigatória.');
      return;
    }

    let finalDocs = [...clientForm.documents];
    const cleanPending = clientForm.currentDocument.replace(/\D/g, '');
    if (cleanPending.length === 11 || cleanPending.length === 14) {
      const formattedPending = formatDocument(cleanPending);
      if (!finalDocs.some(d => d.document === formattedPending)) {
        finalDocs.push({
          document: formattedPending,
          alias: clientForm.currentAlias.trim(),
          razaoSocial: clientForm.currentDocName.trim(),
          type: cleanPending.length === 11 ? 'cpf' : 'cnpj'
        });
      }
    }

    saveClientMutation.mutate({
      id: clientForm.id,
      name: clientForm.name.trim(),
      fantasyName: clientForm.fantasyName?.trim() || null,
      notes: clientForm.notes?.trim() || null,
      isActive: clientForm.isActive,
      cnpjs: finalDocs.map(d => ({
        cnpj: d.document,
        alias: d.alias || null,
        razaoSocial: d.razaoSocial || null
      }))
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
    const matchAlias = c.establishments?.some((e: any) => e.alias?.toLowerCase().includes(term));
    return matchName || matchFantasy || matchCnpj || matchAlias;
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
                <th>Documentos Monitorados</th>
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
                          ⚠️ Nenhum Documento (Clique em Editar para adicionar)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                          {ests.slice(0, 3).map((e: any, idx: number) => {
                            const isCpf = isDocCpf(e.cnpj);
                            const displayName = e.alias || (isCpf ? maskCPF(e.cnpj) : e.cnpj);
                            const isMatriz = e.type === 'matriz' || (!isCpf && idx === 0);
                            return (
                              <span 
                                key={e.id || idx}
                                style={{ 
                                  background: idx === 0 ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                                  border: `1px solid ${idx === 0 ? 'var(--blue)' : 'var(--line)'}`,
                                  color: idx === 0 ? 'var(--blue)' : 'var(--t2)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title={e.alias ? (isCpf ? maskCPF(e.cnpj) : e.cnpj) : e.razaoSocial}
                              >
                                {displayName} {isMatriz && <small style={{ opacity: 0.8 }}>(Matriz)</small>}
                                {isCpf && <small style={{ opacity: 0.8 }}>(PF)</small>}
                              </span>
                            );
                          })}
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
                              +{ests.length - 3} documento(s)
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

              {/* LISTA DE DOCUMENTOS: CNPJ / CPF */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. Documentos Monitorados (CNPJ / CPF)
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--t3)', margin: '0 0 1rem 0' }}>
                  Processos atrelados a estes documentos serão centralizados no grupo.
                </p>

                {/* Input para adicionar Documento */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="CNPJ ou CPF (somente números)" 
                    value={clientForm.currentDocument} 
                    onChange={e => setClientForm({ ...clientForm, currentDocument: formatDocument(e.target.value) })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && clientForm.currentDocument.length === 18) {
                        e.preventDefault();
                        handleAddDocument();
                      }
                    }}
                    style={{ 
                      width: '180px', 
                      padding: '0.6rem 0.75rem', 
                      borderRadius: '6px', 
                      border: '1px solid var(--line)', 
                      background: 'var(--card)', 
                      color: '#fff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px'
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Apelido para o grid (Opcional, ex: Matriz SP)" 
                    value={clientForm.currentAlias} 
                    onChange={e => setClientForm({ ...clientForm, currentAlias: e.target.value })}
                    style={{ 
                      flex: 1, 
                      padding: '0.6rem 0.75rem', 
                      borderRadius: '6px', 
                      border: '1px solid var(--line)', 
                      background: 'var(--card)', 
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  />
                </div>
                
                {isDocCpf(clientForm.currentDocument) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input 
                      type="text" 
                      placeholder="Nome completo da pessoa física (obrigatório para CPF)" 
                      value={clientForm.currentDocName} 
                      onChange={e => setClientForm({ ...clientForm, currentDocName: e.target.value })}
                      style={{ 
                        flex: 1, 
                        padding: '0.6rem 0.75rem', 
                        borderRadius: '6px', 
                        border: '1px solid var(--blue)', 
                        background: 'rgba(37,99,235,0.05)', 
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                  <button 
                    type="button" 
                    onClick={handleAddDocument}
                    className={styles.btnPrimary}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', fontSize: '13px' }}
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>

                {/* Lista de Documentos Adicionados */}
                {clientForm.documents.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--line)', borderRadius: '6px', color: 'var(--t3)', fontSize: '0.8125rem' }}>
                    Nenhum documento adicionado ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {clientForm.documents.map((doc, idx) => (
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: idx === 0 ? 'var(--blue)' : '#fff', fontSize: '12.5px' }}>
                              {doc.type === 'cpf' ? maskCPF(doc.document) : doc.document}
                            </span>
                            {doc.alias && (
                              <span style={{ color: 'var(--t2)', fontSize: '12px' }}>— {doc.alias}</span>
                            )}
                            {idx === 0 && doc.type !== 'cpf' && (
                              <span className={styles.tag} style={{ background: 'rgba(37, 99, 235, 0.2)', color: 'var(--blue)', border: '1px solid rgba(37, 99, 235, 0.4)', fontSize: '10px' }}>
                                Matriz Principal
                              </span>
                            )}
                            {doc.type === 'cpf' && (
                              <span className={styles.tag} style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--t3)', fontSize: '10px' }}>
                                Pessoa Física
                              </span>
                            )}
                          </div>
                          {doc.type === 'cpf' && doc.razaoSocial && (
                            <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
                              Nome: {doc.razaoSocial}
                            </div>
                          )}
                        </div>

                        <button 
                          type="button" 
                          onClick={() => handleRemoveDocument(doc.document)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f85149',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Remover"
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
                {saveClientMutation.isPending ? 'Salvando...' : 'Salvar Grupo e Documentos'}
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
