import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Clock, Calendar, Globe, CheckCircle, Sliders, RefreshCw, AlertTriangle, Plus, X } from 'lucide-react';
import styles from './Backoffice.module.css';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Dom', full: 'Domingo' },
  { id: 1, label: 'Seg', full: 'Segunda-feira' },
  { id: 2, label: 'Ter', full: 'Terça-feira' },
  { id: 3, label: 'Qua', full: 'Quarta-feira' },
  { id: 4, label: 'Qui', full: 'Quinta-feira' },
  { id: 5, label: 'Sex', full: 'Sexta-feira' },
  { id: 6, label: 'Sáb', full: 'Sábado' },
];

export default function SystemSettings() {
  const queryClient = useQueryClient();

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState<string[]>(['07:00']);
  const [newTimeInput, setNewTimeInput] = useState('13:00');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [isActive, setIsActive] = useState(true);
  const [onlyActiveClients, setOnlyActiveClients] = useState(true);
  const [isPropagateModalOpen, setIsPropagateModalOpen] = useState(false);

  const { data: defaults, isLoading } = useQuery({
    queryKey: ['backoffice', 'sync-defaults'],
    queryFn: async () => {
      const { data } = await api.get('/backoffice/settings/sync-defaults');
      return data;
    }
  });

  useEffect(() => {
    if (defaults) {
      if (Array.isArray(defaults.daysOfWeek)) setDaysOfWeek(defaults.daysOfWeek);
      if (Array.isArray(defaults.times)) setTimes(defaults.times);
      if (defaults.timezone) setTimezone(defaults.timezone);
      if (defaults.isActive !== undefined) setIsActive(defaults.isActive);
      if (defaults.onlyActiveClients !== undefined) setOnlyActiveClients(defaults.onlyActiveClients);
    }
  }, [defaults]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        daysOfWeek,
        times,
        timezone,
        isActive,
        onlyActiveClients
      };
      const { data } = await api.put('/backoffice/settings/sync-defaults', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice', 'sync-defaults'] });
      alert('Padrões globais de sincronização salvos com sucesso!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao salvar padrões');
    }
  });

  const propagateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/backoffice/settings/sync-defaults/apply-all');
      return data;
    },
    onSuccess: (data: any) => {
      setIsPropagateModalOpen(false);
      alert(data.message || 'Padrão propagado com sucesso!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Erro ao propagar padrão');
    }
  });

  const handleToggleDay = (dayId: number) => {
    if (daysOfWeek.includes(dayId)) {
      if (daysOfWeek.length === 1) {
        alert('Selecione pelo menos um dia da semana.');
        return;
      }
      setDaysOfWeek(daysOfWeek.filter(d => d !== dayId));
    } else {
      setDaysOfWeek([...daysOfWeek, dayId].sort());
    }
  };

  const handleAddTime = () => {
    if (!newTimeInput || !/^\d{2}:\d{2}$/.test(newTimeInput)) {
      alert('Por favor, selecione um horário válido.');
      return;
    }
    if (times.includes(newTimeInput)) {
      alert('Este horário já foi adicionado.');
      return;
    }
    const updated = [...times, newTimeInput].sort();
    setTimes(updated);
  };

  const handleRemoveTime = (timeToRemove: string) => {
    if (times.length === 1) {
      alert('É necessário ter ao menos um horário configurado.');
      return;
    }
    setTimes(times.filter(t => t !== timeToRemove));
  };

  if (isLoading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>Carregando configurações...</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Padrões do Sistema</h1>
            <p>Defina as parametrizações globais pré-configuradas que são herdadas ao criar novos escritórios</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className={styles.btnSecondary}
              onClick={() => setIsPropagateModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} /> Propagar para Escritórios
            </button>
            <button 
              className={styles.btnPrimary}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <CheckCircle size={16} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar Padrões'}
            </button>
          </div>
        </div>
      </header>

      {/* Card Principal: Sincronização Automática */}
      <div className={styles.tableContainer} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <Sliders size={22} color="var(--color-primary)" />
          <div>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Sincronização Automática Padrão</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Parâmetros aplicados automaticamente no momento em que um novo escritório é criado no BackOffice.
            </p>
          </div>
        </div>

        {/* 1. Status Geral da Sincronização */}
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            Status da Sincronização por Padrão
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="isActive" 
                checked={isActive} 
                onChange={() => setIsActive(true)} 
              />
              <span style={{ fontSize: '0.875rem', color: '#10B981', fontWeight: 500 }}>● Ativada por Padrão</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="isActive" 
                checked={!isActive} 
                onChange={() => setIsActive(false)} 
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>○ Pausada por Padrão</span>
            </label>
          </div>
        </div>

        {/* 2. Dias da Semana */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} /> Dias da Semana Padrão
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setDaysOfWeek([1, 2, 3, 4, 5])}
              >
                Dias Úteis (Seg-Sex)
              </button>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])}
              >
                Todos os Dias
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {DAYS_OF_WEEK.map(day => {
              const selected = daysOfWeek.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleToggleDay(day.id)}
                  style={{
                    padding: '0.75rem 0.5rem',
                    borderRadius: '8px',
                    border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: selected ? 'rgba(59, 130, 246, 0.15)' : 'var(--color-bg-base)',
                    color: selected ? '#93c5fd' : 'var(--color-text-secondary)',
                    fontWeight: selected ? 700 : 500,
                    cursor: 'pointer',
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

        {/* 3. Horários de Varredura */}
        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
            <Clock size={16} /> Horários de Varredura Diária
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {times.map(t => (
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
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}
              >
                <Clock size={13} color="var(--color-primary)" />
                {t}
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
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '400px' }}>
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

          {/* Atalhos Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Atalhos rápidos:</span>
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
                  if (!times.includes(shortcut)) {
                    setTimes([...times, shortcut].sort());
                  }
                }}
              >
                + {shortcut}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Fuso Horário e Filtro */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
              <Globe size={16} /> Fuso Horário Padrão
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              style={{
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-base)',
                color: '#fff',
                width: '100%'
              }}
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

          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Filtro de Empresas Monitoradas
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.75rem' }}>
              <input 
                type="checkbox" 
                checked={onlyActiveClients} 
                onChange={e => setOnlyActiveClients(e.target.checked)} 
              />
              <span style={{ fontSize: '0.875rem' }}>Varre apenas empresas com status <strong>Ativo</strong></span>
            </label>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação: Propagar para Todos os Escritórios */}
      {isPropagateModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle color="#F59E0B" size={20} />
                <h2>Propagar Padrão para Escritórios</h2>
              </div>
              <button 
                className={styles.closeBtn} 
                onClick={() => setIsPropagateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', lineHeight: '1.5', margin: 0 }}>
                Tem certeza de que deseja sobrescrever a parametrização de sincronização de <strong>todos os escritórios ativos</strong> com este padrão atual?
              </p>
              <div style={{ backgroundColor: 'var(--color-bg-base)', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                <div><strong>Dias:</strong> {daysOfWeek.map(d => DAYS_OF_WEEK.find(item => item.id === d)?.label).join(', ')}</div>
                <div><strong>Horários:</strong> {times.join(', ')}</div>
                <div><strong>Fuso:</strong> {timezone}</div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className={styles.btnSecondary} 
                onClick={() => setIsPropagateModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className={styles.btnPrimary}
                onClick={() => propagateMutation.mutate()}
                disabled={propagateMutation.isPending}
              >
                {propagateMutation.isPending ? 'Propagando...' : 'Confirmar e Propagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
