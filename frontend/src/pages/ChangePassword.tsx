import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from './Login.module.css';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      window.location.href = user?.role === 'super_admin' ? '/backoffice' : '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alterar senha.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Troca Obrigatória</h2>
          <p>Por favor, altere sua senha temporária</p>
        </div>
        
        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="currentPassword">Senha Atual</label>
              <input 
                type="password" 
                id="currentPassword" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                required 
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="newPassword">Nova Senha</label>
              <input 
                type="password" 
                id="newPassword" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                required 
              />
            </div>
            
            <button type="submit" className={styles.btnMain}>Atualizar Senha</button>
          </form>
        </div>
      </div>
    </div>
  );
}
