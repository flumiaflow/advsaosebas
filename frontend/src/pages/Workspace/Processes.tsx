import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';
import { Search, Filter, Calendar, Gavel, FileText } from 'lucide-react';

export default function Processes() {
  const [selectedProcess, setSelectedProcess] = useState<any>(null);

  const { data: processes, isLoading } = useQuery({
    queryKey: ['workspace', 'processes'],
    queryFn: async () => {
      const { data } = await api.get('/processes');
      return data.processes;
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page} style={{ flexDirection: 'row', height: '100%', gap: '0' }}>
      
      {/* Coluna Esquerda: Lista de Processos */}
      <div style={{ width: '350px', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Processos</h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por número..." 
              style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {processes?.map((proc: any) => (
            <div 
              key={proc.id} 
              style={{ 
                padding: '1rem', 
                borderBottom: '1px solid var(--color-border)', 
                cursor: 'pointer',
                backgroundColor: selectedProcess?.id === proc.id ? 'var(--color-bg-surface-hover)' : 'transparent'
              }}
              onClick={() => setSelectedProcess(proc)}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                {proc.processNumber}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span>{proc.status}</span>
                <span>{new Date(proc.lastSyncAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {(!processes || processes.length === 0) && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Nenhum processo acompanhado.</div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes e Timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-surface)' }}>
        {selectedProcess ? (
          <>
            <header style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selectedProcess.processNumber}
                    <span className={`${styles.badge} ${styles.active}`}>{selectedProcess.status}</span>
                  </h1>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Sincronizado via {selectedProcess.sourceAdapter} em {new Date(selectedProcess.lastSyncAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button className={styles.btnPrimary} style={{ background: 'transparent', border: '1px solid var(--color-border)' }}>
                  Sincronizar Agora
                </button>
              </div>
            </header>

            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} /> Linha do Tempo
              </h3>
              
              <div style={{ position: 'relative', paddingLeft: '1rem' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18px', width: '2px', backgroundColor: 'var(--color-border)' }} />
                
                {/* Mocked movements since the backend didn't return them in this endpoint */}
                <div style={{ position: 'relative', paddingLeft: '2rem', paddingBottom: '2rem' }}>
                  <div style={{ position: 'absolute', top: '4px', left: '0', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', zIndex: 1 }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Hoje, 14:30</div>
                  <div style={{ backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Conclusão para Julgamento</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Os autos foram conclusos ao magistrado para deliberação final.</p>
                  </div>
                </div>

                <div style={{ position: 'relative', paddingLeft: '2rem', paddingBottom: '2rem' }}>
                  <div style={{ position: 'absolute', top: '4px', left: '0', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-border)', zIndex: 1 }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Ontem, 09:15</div>
                  <div style={{ backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Juntada de Petição</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Petição anexada pelo advogado do réu.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)' }}>
            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Selecione um processo na lista para ver os detalhes</p>
          </div>
        )}
      </div>

    </div>
  );
}
