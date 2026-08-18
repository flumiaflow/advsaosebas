import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import styles from '../Backoffice/Backoffice.module.css';
import { FileText, Users, AlertCircle } from 'lucide-react';

export default function WorkspaceDashboard() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['workspace', 'dashboard'],
    queryFn: async () => {
      // Esse endpoint seria ideal existir no backend para resumir os dados
      // Mas podemos compor fazendo multiplas chamadas:
      const [clientsRes, processesRes] = await Promise.all([
        api.get('/clients'),
        api.get('/processes')
      ]);
      return {
        clients: clientsRes.data.clients.length,
        processes: processesRes.data.processes.length
      };
    }
  });

  if (isLoading) return <div>Carregando Dashboard...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Olá, {user?.name}</h1>
        <p>Acompanhe as movimentações de seus clientes</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ color: 'var(--color-primary)' }}>
            <FileText size={24} />
          </div>
          <div>
            <h3>Processos Acompanhados</h3>
            <p className={styles.value}>{stats?.processes || 0}</p>
          </div>
        </div>

        <div className={styles.card}>
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
