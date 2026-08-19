import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';
import { Download } from 'lucide-react';

export default function Audit() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['workspace', 'audit'],
    queryFn: async () => {
      const { data } = await api.get('/audit');
      return Array.isArray(data) ? data : data.logs || [];
    }
  });

  const handleExport = async () => {
    try {
      const response = await api.get('/audit/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Erro ao exportar auditoria em CSV');
    }
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Auditoria</h1>
            <p>Histórico completo de ações no sistema</p>
          </div>
          <button className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleExport}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </header>

      <div>
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Detalhes (Metadados)</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log: any) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{log.userName}</td>
                  <td><span className={styles.badge} style={{ backgroundColor: 'var(--color-border)' }}>{log.action}</span></td>
                  <td>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {JSON.stringify(log.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum log encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
