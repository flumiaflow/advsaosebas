import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Eye, Edit2, Search, Plus, X } from 'lucide-react';
import styles from './Backoffice.module.css';

export default function Tenants() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { login, initAuth } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State - Novo Escritório
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');

  // Modal State - Editar Escritório
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('trial');
  const [editStatus, setEditStatus] = useState('active');
  const [editTimezone, setEditTimezone] = useState('America/Sao_Paulo');

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['backoffice', 'tenants'],
    queryFn: async () => {
      const { data } = await api.get('/backoffice/tenants');
      return Array.isArray(data) ? data : data.tenants || [];
    },
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const createTenantMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/backoffice/tenants', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backoffice', 'tenants'] });
      setIsCreateOpen(false);
      setName('');
      setSupervisorName('');
      setSupervisorEmail('');
      alert(`Escritório criado com sucesso!\nSupervisor: ${data.supervisor?.name} (${data.supervisor?.email})`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao criar escritório');
    }
  });

  const updateTenantMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await api.put(`/backoffice/tenants/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice', 'tenants'] });
      setIsEditOpen(false);
      alert('Escritório atualizado com sucesso!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao atualizar escritório');
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !supervisorName.trim() || !supervisorEmail.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    createTenantMutation.mutate({
      name: name.trim(),
      plan,
      timezone,
      supervisorName: supervisorName.trim(),
      supervisorEmail: supervisorEmail.trim()
    });
  };

  const handleEditOpen = (tenant: any) => {
    setEditId(tenant.id);
    setEditName(tenant.name);
    setEditPlan(tenant.plan || 'trial');
    setEditStatus(tenant.status || 'active');
    setEditTimezone(tenant.timezone || 'America/Sao_Paulo');
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('O nome do escritório não pode ficar vazio.');
      return;
    }
    updateTenantMutation.mutate({
      id: editId,
      payload: {
        name: editName.trim(),
        plan: editPlan,
        status: editStatus,
        timezone: editTimezone
      }
    });
  };

  const handleImpersonate = async (tenantId: string) => {
    try {
      const { data } = await api.post(`/auth/impersonate/${tenantId}`);
      queryClient.clear(); // Limpa caches anteriores de outros escritórios
      if (data.accessToken && data.user) {
        login(data.accessToken, data.user);
      } else {
        await initAuth();
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao acessar workspace', error);
      alert('Erro ao acessar o workspace desse escritório.');
    }
  };

  const filteredTenants = tenants?.filter((t: any) => {
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.plan && t.plan.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--t2)' }}>Carregando escritórios...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Escritórios (Tenants)</h1>
            <p>Gestão de escritórios de advocacia cadastrados na plataforma</p>
          </div>
          <button 
            className={styles.btnPrimary} 
            onClick={() => setIsCreateOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', fontSize: '13px' }}
          >
            <Plus size={15} /> Novo Escritório
          </button>
        </div>
      </header>

      <div>
        {/* Controles de Busca e Filtro */}
        <div className={styles.controls} style={{ gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="#8b949e" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou plano..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.5rem 0.75rem 0.5rem 2rem', 
                borderRadius: '6px', 
                border: '1px solid var(--line)', 
                background: 'var(--card)', 
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              color: '#fff',
              fontSize: '13px'
            }}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        {/* Tabela de Escritórios */}
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome do Escritório</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Fuso Horário</th>
                <th>Criado em</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants?.map((tenant: any) => (
                <tr key={tenant.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{tenant.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>
                      ID: {tenant.id.slice(0, 8)}...
                    </div>
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                      {tenant.plan || 'Trial'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[tenant.status] || styles.active}`}>
                      {tenant.status === 'active' ? 'Ativo' : tenant.status === 'suspended' ? 'Suspenso' : 'Cancelado'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--t2)' }}>
                      {tenant.timezone || 'America/Sao_Paulo'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--t3)' }}>
                      {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleEditOpen(tenant)}
                        style={{ background: 'transparent', color: 'var(--blue)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px' }}
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                      <button 
                        onClick={() => handleImpersonate(tenant.id)}
                        style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--blue)', border: '1px solid rgba(37, 99, 235, 0.25)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '12px', fontWeight: 500 }}
                        title="Acessar como Administrador deste escritório"
                      >
                        <Eye size={13} /> Acessar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!filteredTenants || filteredTenants.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--t3)' }}>
                    Nenhum escritório encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: NOVO ESCRITÓRIO */}
      {isCreateOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Cadastrar Novo Escritório</h2>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Dados do Escritório
              </div>

              <div className={styles.formGroup}>
                <label>Razão Social / Nome do Escritório *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Beatrici & Associados Advocacia" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>Plano de Assinatura</label>
                  <select value={plan} onChange={e => setPlan(e.target.value)}>
                    <option value="trial">Trial (14 dias)</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Fuso Horário</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                    <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                    <option value="America/Manaus">Manaus (GMT-4)</option>
                    <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue)', marginTop: '1.25rem', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Supervisor Inicial do Escritório
              </div>

              <div className={styles.formGroup}>
                <label>Nome do Supervisor Gestor *</label>
                <input 
                  type="text" 
                  placeholder="Ex: Dra. Carla Beatrici" 
                  value={supervisorName} 
                  onChange={e => setSupervisorName(e.target.value)} 
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label>E-mail Corporativo do Supervisor *</label>
                <input 
                  type="email" 
                  placeholder="carla@beatrici.adv.br" 
                  value={supervisorEmail} 
                  onChange={e => setSupervisorEmail(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.8rem', color: '#93c5fd', marginTop: '1rem' }}>
                ℹ️ <strong>Sincronização Automática:</strong> As regras e horários definidos em <em>Padrões do Sistema</em> serão aplicados automaticamente a este escritório e poderão ser personalizados posteriormente pelo supervisor.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={styles.btnPrimary}
                  disabled={createTenantMutation.isPending}
                >
                  {createTenantMutation.isPending ? 'Criando...' : 'Criar Escritório'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR ESCRITÓRIO */}
      {isEditOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Editar Escritório</h2>
              <button onClick={() => setIsEditOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className={styles.formGroup}>
                <label>Razão Social / Nome do Escritório *</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>Plano</label>
                  <select value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Status do Escritório</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Fuso Horário</label>
                <select value={editTimezone} onChange={e => setEditTimezone(e.target.value)}>
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsEditOpen(false)}>
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={styles.btnPrimary}
                  disabled={updateTenantMutation.isPending}
                >
                  {updateTenantMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
