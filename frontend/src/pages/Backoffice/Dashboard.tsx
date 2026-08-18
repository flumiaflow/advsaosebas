import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from './Backoffice.module.css';
import { Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function BackofficeDashboard() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['backoffice', 'tenants'],
    queryFn: async () => {
      const { data } = await api.get('/tenants');
      return data;
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  const active = tenants?.filter((t: any) => t.status === 'active').length || 0;
  const suspended = tenants?.filter((t: any) => t.status === 'suspended').length || 0;
  const cancelled = tenants?.filter((t: any) => t.status === 'cancelled').length || 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Dashboard Geral</h1>
        <p>Visão de alto nível da plataforma</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ color: 'var(--color-primary)' }}>
            <Building2 size={24} />
          </div>
          <div>
            <h3>Total de Escritórios</h3>
            <p className={styles.value}>{tenants?.length || 0}</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ color: 'var(--color-success)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3>Ativos</h3>
            <p className={styles.value}>{active}</p>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ color: 'var(--color-warning)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3>Suspensos / Cancelados</h3>
            <p className={styles.value}>{suspended + cancelled}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
