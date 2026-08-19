import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import styles from './Login.module.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess('Senha redefinida com sucesso. Redirecionando...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Link inválido ou expirado.');
    }
  };

  if (!token) {
    return <div className={styles.container}>Token inválido.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Nova Senha</h2>
          <p>Defina sua nova senha de acesso</p>
        </div>
        
        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div style={{ color: 'var(--green)', marginBottom: '16px', fontSize: '13px' }}>{success}</div>}
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="password">Nova Senha</label>
              <input 
                type="password" 
                id="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
              />
            </div>
            
            <button type="submit" className={styles.btnMain}>Salvar Senha</button>
          </form>
        </div>
      </div>
    </div>
  );
}
