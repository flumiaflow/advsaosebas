import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';

export default function Settings() {
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [datajudKey, setDatajudKey] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save
    setSuccess('Configurações salvas com sucesso!');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className={styles.page} style={{ maxWidth: '800px' }}>
      <header className={styles.header}>
        <h1>Configurações</h1>
        <p>Ajustes do escritório e integrações</p>
      </header>

      {success && <div style={{ color: 'var(--color-success)', marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(35,134,54,0.1)', borderRadius: '6px' }}>{success}</div>}

      <div className={styles.tableContainer} style={{ padding: '2rem' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Geral</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Fuso Horário (Timezone)</label>
              <select 
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%', maxWidth: '300px' }}
              >
                <option value="America/Sao_Paulo">Brasília (America/Sao_Paulo)</option>
                <option value="America/Manaus">Manaus (America/Manaus)</option>
              </select>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--color-border)', margin: '1rem 0' }} />

          <div>
            <h3 style={{ marginBottom: '1rem' }}>Credenciais (API Keys AES-256)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Chave API DataJud (Tenant Level)</label>
                <input 
                  type="password" 
                  value={datajudKey}
                  onChange={(e) => setDatajudKey(e.target.value)}
                  placeholder="••••••••••••••••••••••"
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff', width: '100%' }}
                />
                <small style={{ color: 'var(--color-text-secondary)' }}>Essas credenciais serão criptografadas no banco de dados.</small>
              </div>

            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className={styles.btnPrimary}>Salvar Alterações</button>
          </div>

        </form>
      </div>
    </div>
  );
}
