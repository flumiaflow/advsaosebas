import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from './Backoffice.module.css';

export default function Tenants() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['backoffice', 'tenants'],
    queryFn: async () => {
      const { data } = await api.get('/backoffice/tenants');
      return data.tenants;
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Escritórios</h1>
        <p>Gestão de tenants da plataforma</p>
      </header>

      <div>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Buscar escritório..." 
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
          />
          <button className={styles.btnPrimary}>+ Novo Escritório</button>
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants?.map((tenant: any) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.plan}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[tenant.status]}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>
                    {/* Ações (Editar, Suspender) - Mock v1 */}
                    <button style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none' }}>Editar</button>
                  </td>
                </tr>
              ))}
              {(!tenants || tenants.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum escritório cadastrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
