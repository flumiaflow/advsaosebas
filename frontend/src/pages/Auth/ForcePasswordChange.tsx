import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import styles from './Login.module.css';
import { ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForcePasswordChange() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, initAuth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Se o usuário não tiver mustChangePassword, redirecionar de volta
    if (user && !user.mustChangePassword) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/change-password', { newPassword: password });
      toast.success('Senha atualizada com sucesso!');
      
      // Atualiza o estado global de autenticação para o usuário ganhar acesso ao Dashboard
      await initAuth();
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.logo}>
          Juris<span style={{color: 'var(--blue)'}}>Watch</span>
        </div>
        <div className={styles.heroText}>
          <h1>Proteja seu acesso</h1>
          <p>Para garantir a segurança dos dados do escritório, solicitamos que você crie uma nova senha de uso pessoal.</p>
          
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--t2)' }}>
              <CheckCircle2 color="var(--blue)" size={20} />
              Mínimo de 8 caracteres
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--t2)' }}>
              <ShieldCheck color="var(--blue)" size={20} />
              Senha criptografada e segura
            </li>
          </ul>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.formWrapper}>
          <h2>Cadastrar Nova Senha</h2>
          <p className={styles.subtitle}>Este é o seu primeiro acesso. Por favor, cadastre sua senha definitiva.</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Nova Senha</label>
              <div className={styles.inputIcon}>
                <Lock size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Confirmar Nova Senha</label>
              <div className={styles.inputIcon}>
                <Lock size={18} />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Senha e Entrar'}
            </button>
            
            <button type="button" onClick={logout} className={styles.btnSecondary} style={{ marginTop: '1rem', width: '100%' }}>
              Cancelar e Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
