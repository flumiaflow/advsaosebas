import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import styles from '../Backoffice/Backoffice.module.css';
import { FileText, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WorkspaceDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['workspace', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/metrics');
      return data;
    }
  });

  if (isLoading) return <div>Carregando Dashboard...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Olá, {user?.name}</h1>
        <p>Acompanhe as movimentações de seus clientes</p>
      </header>

      {user?.role === 'supervisor' && stats?.systemSyncError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--color-danger)',
          color: 'var(--color-danger)',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600 }}>Falha na Sincronização Automática</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>O último job automático de sincronização falhou. Verifique os logs de auditoria.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/dashboard/clients')}
            style={{
              backgroundColor: 'var(--color-danger)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <RefreshCw size={16} /> Sincronizar Manualmente
          </button>
        </div>
      )}

      <div className={styles.grid}>
        <div 
          className={styles.card} 
          onClick={() => navigate('/dashboard/processes')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Ver todos os processos deste escritório"
        >
          <div className={styles.cardIcon} style={{ color: 'var(--color-primary)' }}>
            <FileText size={24} />
          </div>
          <div>
            <h3>Processos Acompanhados</h3>
            <p className={styles.value}>{stats?.processes || 0}</p>
          </div>
        </div>

        <div 
          className={styles.card} 
          onClick={() => navigate('/dashboard/clients')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Ver empresas monitoradas deste escritório"
        >
          <div className={styles.cardIcon} style={{ color: 'var(--color-success)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3>Clientes Ativos</h3>
            <p className={styles.value}>{stats?.clients || 0}</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ color: 'var(--color-warning)' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h3>Notificações Pendentes</h3>
            <p className={styles.value} style={{ fontSize: '1rem', marginTop: '0.5rem' }}>Verifique o sino no canto superior direito</p>
          </div>
        </div>
      </div>
    </div>
  );
}
