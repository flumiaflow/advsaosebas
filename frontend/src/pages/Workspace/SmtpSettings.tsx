import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Mail, CheckCircle } from 'lucide-react';
import styles from '../Backoffice/Backoffice.module.css';
import { useAuth } from '../../hooks/useAuth';

export default function SmtpSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'super_admin' || (user as any)?.isImpersonating;

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const { data: smtpData } = useQuery({
    queryKey: ['workspace', 'smtp'],
    queryFn: async () => {
      const { data } = await api.get('/tenants/smtp');
      return data;
    },
    enabled: isSupervisor
  });

  useEffect(() => {
    if (smtpData) {
      setSmtpHost(smtpData.smtpHost || '');
      setSmtpPort(smtpData.smtpPort ? String(smtpData.smtpPort) : '');
      setSmtpSecure(smtpData.smtpSecure || false);
      setSmtpUser(smtpData.smtpUser || '');
      setSmtpFrom(smtpData.smtpFrom || '');
    }
  }, [smtpData]);

  const saveSmtpMutation = useMutation({
    mutationFn: async () => {
      await api.put('/tenants/smtp', {
        smtpHost,
        smtpPort: parseInt(smtpPort, 10),
        smtpSecure,
        smtpUser,
        smtpPass: smtpPass || undefined,
        smtpFrom
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'smtp'] });
      setSmtpPass('');
      alert('Configurações de E-mail salvas com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar SMTP');
    }
  });

  const testSmtpMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/tenants/smtp/test', {
        smtpHost,
        smtpPort: parseInt(smtpPort, 10),
        smtpSecure,
        smtpUser,
        smtpPass: smtpPass || undefined,
        smtpFrom
      });
      return data;
    },
    onSuccess: (data) => {
      alert(data.message || 'E-mail de teste enviado com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao testar envio de e-mail');
    }
  });

  if (!isSupervisor) return null;

  return (
    <div className={styles.tableContainer} style={{ padding: '2rem' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Mail size={20} color="var(--color-primary)" />
        Configurações de E-mail (Notificações)
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
        Configure seu servidor SMTP para disparar e-mails de resumo de sincronização aos responsáveis. A senha será armazenada criptografada.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); saveSmtpMutation.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Servidor SMTP (Host)</label>
            <input 
              type="text" 
              value={smtpHost} 
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="ex: smtp.gmail.com"
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Porta SMTP</label>
            <input 
              type="number" 
              value={smtpPort} 
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="ex: 587 ou 465"
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Usuário SMTP</label>
            <input 
              type="text" 
              value={smtpUser} 
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="ex: contato@meuescritorio.com"
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Senha SMTP {smtpData?.hasPassword && '(Salva)'}</label>
            <input 
              type="password" 
              value={smtpPass} 
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={smtpData?.hasPassword ? "Deixe em branco para não alterar" : "Senha do e-mail"}
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>E-mail Remetente (Opcional)</label>
            <input 
              type="text" 
              value={smtpFrom} 
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="ex: Notificações <nao-responda@meuescritorio.com>"
              style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={smtpSecure} 
                onChange={(e) => setSmtpSecure(e.target.checked)}
              />
              <span style={{ fontSize: '0.875rem' }}>Usar conexão segura (SSL/TLS) - Geralmente porta 465</span>
            </label>
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button 
            type="button" 
            className={styles.btnSecondary} 
            onClick={() => testSmtpMutation.mutate()}
            disabled={testSmtpMutation.isPending || (!smtpHost || !smtpPort || !smtpUser)}
          >
            {testSmtpMutation.isPending ? 'Testando...' : 'Testar Conexão (Enviar e-mail para mim)'}
          </button>

          <button type="submit" className={styles.btnPrimary} disabled={saveSmtpMutation.isPending}>
            <CheckCircle size={16} style={{ marginRight: '6px' }} />
            {saveSmtpMutation.isPending ? 'Salvando...' : 'Salvar Servidor SMTP'}
          </button>
        </div>
      </form>
    </div>
  );
}
