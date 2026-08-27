import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';
import { Download, Activity, Mail } from 'lucide-react';

export default function Audit() {
  const [activeTab, setActiveTab] = useState<'system' | 'email'>('system');

  const { data: systemLogs, isLoading: isLoadingSystem } = useQuery({
    queryKey: ['workspace', 'audit', 'system'],
    queryFn: async () => {
      const { data } = await api.get('/audit');
      return Array.isArray(data) ? data : data.logs || [];
    },
    enabled: activeTab === 'system'
  });

  const { data: emailLogs, isLoading: isLoadingEmail } = useQuery({
    queryKey: ['workspace', 'audit', 'emails'],
    queryFn: async () => {
      const { data } = await api.get('/email-logs');
      return Array.isArray(data) ? data : [];
    },
    enabled: activeTab === 'email'
  });

  const handleExport = async () => {
    try {
      if (activeTab === 'system') {
        const response = await api.get('/audit/export', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `auditoria_sistema_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        alert('Exportação de logs de email ainda não disponível.');
      }
    } catch (e) {
      alert('Erro ao exportar');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Auditoria</h1>
            <p>Acompanhe logs do sistema e envios de e-mails</p>
          </div>
          <button className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleExport}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </header>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('system')}
          style={{ 
            padding: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', 
            color: activeTab === 'system' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'system' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600
          }}
        >
          <Activity size={18} /> Logs do Sistema
        </button>
        <button 
          onClick={() => setActiveTab('email')}
          style={{ 
            padding: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', 
            color: activeTab === 'email' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'email' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600
          }}
        >
          <Mail size={18} /> Histórico de E-mails
        </button>
      </div>

      <div>
        <div className={styles.tableContainer}>
          {activeTab === 'system' && (
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
                {isLoadingSystem ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center' }}>Carregando...</td></tr>
                ) : systemLogs?.map((log: any) => (
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
                {!isLoadingSystem && (!systemLogs || systemLogs.length === 0) && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum log encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'email' && (
            <table>
              <thead>
                <tr>
                  <th>Data do Envio</th>
                  <th>Cliente Vinculado</th>
                  <th>Destinatário</th>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Erro (se houver)</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingEmail ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>Carregando...</td></tr>
                ) : emailLogs?.map((log: any) => (
                  <tr key={log.id}>
                    <td>{new Date(log.sentAt).toLocaleString('pt-BR')}</td>
                    <td>{log.client?.fantasyName || log.client?.name || '-'}</td>
                    <td>{log.user?.email} <br/><small>{log.user?.name}</small></td>
                    <td>{log.subject}</td>
                    <td>
                      <span className={styles.badge} style={{ 
                        backgroundColor: log.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: log.status === 'success' ? '#10B981' : '#EF4444'
                      }}>
                        {log.status === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                    </td>
                    <td style={{ color: '#EF4444', fontSize: '0.8rem' }}>{log.errorReason || '-'}</td>
                  </tr>
                ))}
                {!isLoadingEmail && (!emailLogs || emailLogs.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum e-mail registrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

