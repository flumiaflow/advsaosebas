import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, login } = useAuth();

  // Watch for user state update to redirect
  useEffect(() => {
    if (user) {
      if (user.role === 'super_admin') {
        navigate('/backoffice');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      console.log('Sending login request...');
      const { data } = await api.post('/auth/login', { email, password });
      console.log('Login success:', data);
      
      // Store token and user data in context (will trigger useEffect above)
      login(data.accessToken, data.user);
    } catch (err: any) {
      console.error('Login catch error:', err);
      if (err.response?.status === 402) {
        setError(err.response.data.error || 'Escritório suspenso. Entre em contato com o suporte.');
      } else {
        setError('E-mail ou senha incorretos.');
      }
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className={styles.brandName}>Juris<span>Watch</span></div>
          </div>
          <h2>Entrar no sistema</h2>
          <p>Acesse o backoffice ou workspace.</p>
        </div>
        
        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input 
                type="email" 
                id="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            
            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <input 
                type="password" 
                id="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            
            <div className={styles.rowLink}>
              <a href="/forgot-password">Esqueceu a senha?</a>
            </div>
            
            <button type="submit" className={styles.btnMain}>Entrar</button>
          </form>

          <div className={styles.orSep}>ou</div>

          <button type="button" className={styles.btnGoogle} onClick={handleGoogleLogin}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>
    </div>
  );
}
