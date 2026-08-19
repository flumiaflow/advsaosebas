import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import styles from '../Backoffice/Backoffice.module.css';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [name, setName] = useState('');
  
  const [juditKey, setJuditKey] = useState('');
  const [escavadorKey, setEscavadorKey] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['workspace', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    }
  });

  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setTimezone(settings.timezone || 'America/Sao_Paulo');
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      await api.put('/settings', { name, timezone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'settings'] });
      alert('Configurações salvas com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar configurações');
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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate();
  };

  const handleSaveApiKeys = (e: React.FormEvent) => {
    e.preventDefault();
    saveApiKeysMutation.mutate();
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

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page} style={{ maxWidth: '800px' }}>
      <header className={styles.header}>
        <h1>Configurações</h1>
        <p>Ajustes do escritório e integrações</p>
      </header>

      <div className={styles.tableContainer} style={{ padding: '2rem', marginBottom: '2rem' }}>
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Geral</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Nome do Escritório</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%', maxWidth: '400px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Fuso Horário (Timezone)</label>
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%', maxWidth: '400px' }}
                >
                  <option value="America/Sao_Paulo">Brasília (America/Sao_Paulo)</option>
                  <option value="America/Manaus">Manaus (America/Manaus)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className={styles.btnPrimary} disabled={saveSettingsMutation.isPending}>
              {saveSettingsMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.tableContainer} style={{ padding: '2rem' }}>
        <form onSubmit={handleSaveApiKeys} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
