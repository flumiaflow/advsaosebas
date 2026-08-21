import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Clock, Calendar, Globe, CheckCircle, Sliders, Plus, X, ShieldAlert, History, RefreshCw } from 'lucide-react';
import styles from '../Backoffice/Backoffice.module.css';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Dom', full: 'Domingo' },
  { id: 1, label: 'Seg', full: 'Segunda-feira' },
  { id: 2, label: 'Ter', full: 'Terça-feira' },
  { id: 3, label: 'Qua', full: 'Quarta-feira' },
  { id: 4, label: 'Qui', full: 'Quinta-feira' },
  { id: 5, label: 'Sex', full: 'Sexta-feira' },
  { id: 6, label: 'Sáb', full: 'Sábado' },
];

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'super_admin' || (user as any)?.isImpersonating;

  // General Settings State
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [name, setName] = useState('');
  
  // API Keys State
  const [juditKey, setJuditKey] = useState('');
  const [escavadorKey, setEscavadorKey] = useState('');

  // Sync Settings State
  const [syncDays, setSyncDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [syncTimes, setSyncTimes] = useState<string[]>(['07:00']);
  const [newTimeInput, setNewTimeInput] = useState('13:00');
  const [syncActive, setSyncActive] = useState(true);
  const [onlyActiveClients, setOnlyActiveClients] = useState(true);

  // Queries
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['workspace', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    }
  });

  const { data: syncConfig, isLoading: isSyncConfigLoading } = useQuery({
    queryKey: ['workspace', 'sync-config'],
    queryFn: async () => {
      const { data } = await api.get('/sync/config');
      return data;
    }
  });

  const { data: syncHistory } = useQuery({
    queryKey: ['workspace', 'sync-history'],
    queryFn: async () => {
      const { data } = await api.get('/sync/config/history?limit=5');
      return data;
    }
  });

  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setTimezone(settings.timezone || 'America/Sao_Paulo');
    }
  }, [settings]);

  useEffect(() => {
    if (syncConfig) {
      if (Array.isArray(syncConfig.daysOfWeek)) setSyncDays(syncConfig.daysOfWeek);
      if (Array.isArray(syncConfig.times)) setSyncTimes(syncConfig.times);
      if (syncConfig.isActive !== undefined) setSyncActive(syncConfig.isActive);
      if (syncConfig.onlyActiveClients !== undefined) setOnlyActiveClients(syncConfig.onlyActiveClients);
    }
  }, [syncConfig]);

  // Mutations
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      await api.put('/settings', { name, timezone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'settings'] });
      alert('Configurações gerais salvas com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar configurações');
    }
  });

  const saveSyncConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        daysOfWeek: syncDays,
        times: syncTimes,
        timezone,
        isActive: syncActive,
        onlyActiveClients
      };
      await api.put('/sync/config', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'sync-config'] });
      queryClient.invalidateQueries({ queryKey: ['workspace', 'settings'] });
      alert('Configurações de sincronização atualizadas com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar configurações de sincronização');
    }
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: async () => {
      await api.put('/settings/api-keys', { juditKey, escavadorKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'settings'] });
      setJuditKey('');
      setEscavadorKey('');
      alert('API Keys salvas com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar API Keys');
    }
  });

  const handleToggleDay = (dayId: number) => {
    if (!isSupervisor) return;
    if (syncDays.includes(dayId)) {
      if (syncDays.length === 1) {
        alert('Selecione pelo menos um dia da semana.');
        return;
      }
      setSyncDays(syncDays.filter(d => d !== dayId));
    } else {
      setSyncDays([...syncDays, dayId].sort());
    }
  };

  const handleAddTime = () => {
    if (!isSupervisor) return;
    if (!newTimeInput || !/^\d{2}:\d{2}$/.test(newTimeInput)) {
      alert('Por favor, selecione um horário válido.');
      return;
    }
    if (syncTimes.includes(newTimeInput)) {
      alert('Este horário já está na lista.');
      return;
    }
    const updated = [...syncTimes, newTimeInput].sort();
    setSyncTimes(updated);
  };

  const handleRemoveTime = (timeToRemove: string) => {
    if (!isSupervisor) return;
    if (syncTimes.length === 1) {
      alert('É necessário ter ao menos um horário configurado.');
      return;
    }
    setSyncTimes(syncTimes.filter(t => t !== timeToRemove));
  };

  const handleUnlinkGoogle = async () => {
    try {
      await api.delete('/auth/google/link');
      alert('Conta Google desvinculada com sucesso!');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao desvincular Conta Google');
    }
  };

  if (isSettingsLoading || isSyncConfigLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page} style={{ maxWidth: '850px' }}>
      <header className={styles.header}>
        <h1>Configurações do Escritório</h1>
        <p>Parametrizações de agendamento automático, dados gerais e integrações</p>
      </header>

      {/* 1. Card: Sincronização Automática & Agendamento */}
      <div className={styles.tableContainer} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--color-primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Sincronização Automática & Agendamento</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Defina os dias da semana e horários em que o JurisWatch fará a varredura automática de novos processos e movimentações no DataJud e DJEN.
              </p>
            </div>
          </div>
          <span style={{ 
            padding: '4px 10px', 
            borderRadius: '20px', 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            backgroundColor: syncActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            color: syncActive ? '#10B981' : 'var(--color-text-secondary)',
            border: syncActive ? '1px solid #10B981' : '1px solid var(--color-border)'
          }}>
            {syncActive ? '● Automação Ativa' : '○ Pausada'}
          </span>
        </div>

        {!isSupervisor && (
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', padding: '0.75rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#F59E0B' }}>
            <ShieldAlert size={18} />
            <span>Você está visualizando as configurações em modo somente leitura. Apenas <strong>Supervisores</strong> podem alterar o agendamento de sincronização.</span>
          </div>
        )}

        {/* Toggle Ativo / Pausado */}
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            Status da Varredura Automática
          </label>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSupervisor ? 'pointer' : 'default' }}>
              <input 
                type="radio" 
                name="syncActive" 
                checked={syncActive} 
                onChange={() => isSupervisor && setSyncActive(true)}
                disabled={!isSupervisor}
              />
              <span style={{ fontSize: '0.875rem', color: '#10B981', fontWeight: 600 }}>Ativa (Varredura Programada)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSupervisor ? 'pointer' : 'default' }}>
              <input 
                type="radio" 
                name="syncActive" 
                checked={!syncActive} 
                onChange={() => isSupervisor && setSyncActive(false)}
                disabled={!isSupervisor}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Pausar Sincronização Automática</span>
            </label>
          </div>
        </div>

        {/* Dias da Semana */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} /> Dias da Semana para Sincronização
            </label>
            {isSupervisor && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className={styles.btnSecondary} 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => setSyncDays([1, 2, 3, 4, 5])}
                >
                  Seg a Sex
                </button>
                <button 
                  type="button" 
                  className={styles.btnSecondary} 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => setSyncDays([0, 1, 2, 3, 4, 5, 6])}
                >
                  Todos os Dias
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {DAYS_OF_WEEK.map(day => {
              const selected = syncDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleToggleDay(day.id)}
                  disabled={!isSupervisor}
                  style={{
                    padding: '0.65rem 0.4rem',
                    borderRadius: '8px',
                    border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: selected ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-bg-base)',
                    color: selected ? '#93c5fd' : 'var(--color-text-secondary)',
                    fontWeight: selected ? 700 : 500,
                    cursor: isSupervisor ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '0.85rem' }}>{day.label}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{day.full}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horários de Varredura */}
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
            <Clock size={16} /> Horários Programados
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {syncTimes.map(t => (
              <span
                key={t}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-primary)',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}
              >
                <Clock size={13} color="var(--color-primary)" />
                {t}
                {isSupervisor && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(t)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                    title="Remover horário"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
          </div>

          {isSupervisor && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '360px' }}>
                <input 
                  type="time" 
                  value={newTimeInput} 
                  onChange={e => setNewTimeInput(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-base)',
                    color: '#fff',
                    flex: 1
                  }}
                />
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleAddTime}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={15} /> Adicionar
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Atalhos:</span>
                {['06:00', '07:00', '12:00', '13:00', '18:00', '22:00'].map(shortcut => (
                  <button
                    key={shortcut}
                    type="button"
                    style={{
                      background: 'none',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      color: 'var(--color-text-secondary)',
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      if (!syncTimes.includes(shortcut)) {
                        setSyncTimes([...syncTimes, shortcut].sort());
                      }
                    }}
                  >
                    + {shortcut}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Filtro de Empresas Ativas */}
        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSupervisor ? 'pointer' : 'default' }}>
            <input 
              type="checkbox" 
              checked={onlyActiveClients} 
              onChange={e => isSupervisor && setOnlyActiveClients(e.target.checked)}
              disabled={!isSupervisor}
            />
            <span style={{ fontSize: '0.875rem' }}>Sincronizar apenas empresas e filiais com status <strong>Ativo</strong></span>
          </label>
        </div>

        {/* Botão de Salvar Agendamento */}
        {isSupervisor && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => saveSyncConfigMutation.mutate()}
              disabled={saveSyncConfigMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle size={16} />
              {saveSyncConfigMutation.isPending ? 'Salvando...' : 'Salvar Regras de Sincronização'}
            </button>
          </div>
        )}

        {/* Histórico Recente de Execuções */}
        {syncHistory && syncHistory.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={16} color="var(--color-primary)" /> Últimas Varreduras do Escritório
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Data / Hora</th>
                    <th style={{ padding: '6px 8px' }}>Origem</th>
                    <th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px' }}>Empresas</th>
                    <th style={{ padding: '6px 8px' }}>Movimentações</th>
                  </tr>
                </thead>
                <tbody>
                  {syncHistory.map((job: any) => (
                    <tr key={job.id} style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                        {new Date(job.startedAt).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: job.type === 'AUTO' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)' }}>
                          {job.type === 'AUTO' ? 'Automática' : 'Manual'} ({job.triggeredBy})
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ color: job.status === 'success' ? '#10B981' : job.status === 'running' ? '#3B82F6' : '#EF4444' }}>
                          {job.status === 'success' ? '● Concluído' : job.status === 'running' ? '⏳ Em execução' : '✕ Erro'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>{job.clientsProcessed || 1}</td>
                      <td style={{ padding: '6px 8px', color: '#10B981', fontWeight: 600 }}>
                        +{job.newMovementsFound || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. Card: Geral */}
      <div className={styles.tableContainer} style={{ padding: '2rem' }}>
        <form onSubmit={(e) => { e.preventDefault(); saveSettingsMutation.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Geral do Escritório</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Nome do Escritório</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isSupervisor}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%', maxWidth: '400px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Fuso Horário (Timezone)</label>
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!isSupervisor}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%', maxWidth: '400px' }}
                >
                  <option value="America/Sao_Paulo">Brasília / São Paulo (GMT-3)</option>
                  <option value="America/Manaus">Manaus / Amazonas (GMT-4)</option>
                  <option value="America/Cuiaba">Cuiabá / Mato Grosso (GMT-4)</option>
                  <option value="America/Campo_Grande">Campo Grande / MS (GMT-4)</option>
                  <option value="America/Porto_Velho">Porto Velho / Rondônia (GMT-4)</option>
                  <option value="America/Rio_Branco">Rio Branco / Acre (GMT-5)</option>
                  <option value="America/Belem">Belém / Pará (GMT-3)</option>
                  <option value="America/Fortaleza">Fortaleza / Ceará (GMT-3)</option>
                  <option value="America/Recife">Recife / Pernambuco (GMT-3)</option>
                  <option value="America/Bahia">Salvador / Bahia (GMT-3)</option>
                </select>
              </div>
            </div>
          </div>

          {isSupervisor && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className={styles.btnPrimary} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending ? 'Salvando...' : 'Salvar Dados Gerais'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 3. Card: Integrações Premium */}
      {isSupervisor && (
        <div className={styles.tableContainer} style={{ padding: '2rem' }}>
          <form onSubmit={(e) => { e.preventDefault(); saveApiKeysMutation.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Integrações Premium (API Keys AES-256)</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                Deixe em branco se não quiser alterar a chave atual. Todas as chaves são criptografadas no banco de dados.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Chave JUDIT {settings?.hasJuditKey && `(Atual: ${settings.juditKeyMasked})`}</label>
                  <input 
                    type="password" 
                    value={juditKey}
                    onChange={(e) => setJuditKey(e.target.value)}
                    placeholder="Nova chave JUDIT"
                    style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Chave Escavador {settings?.hasEscavadorKey && `(Atual: ${settings.escavadorKeyMasked})`}</label>
                  <input 
                    type="password" 
                    value={escavadorKey}
                    onChange={(e) => setEscavadorKey(e.target.value)}
                    placeholder="Nova chave Escavador"
                    style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className={styles.btnPrimary} disabled={saveApiKeysMutation.isPending}>
                {saveApiKeysMutation.isPending ? 'Salvando...' : 'Salvar Chaves'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Card: Contas Vinculadas */}
      <div className={styles.tableContainer} style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Contas Vinculadas</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Gerencie as contas usadas para acessar a plataforma.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" style={{ width: '24px' }} />
            </div>
            <div>
              <h4 style={{ margin: 0 }}>Google</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                {user?.googleId ? 'Conta conectada' : 'Não conectada'}
              </p>
            </div>
          </div>
          <div>
            {user?.googleId ? (
              <button onClick={handleUnlinkGoogle} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                Desvincular
              </button>
            ) : (
              <button 
                onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/auth/google/link`}
                style={{ padding: '0.5rem 1rem', background: '#fff', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
              >
                Vincular Google
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
