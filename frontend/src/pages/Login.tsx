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
          <h1>JurisWatch</h1>
          <p>Faça login para acessar o sistema</p>
        </div>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">E-mail</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Senha</label>
            <input 
              type="password" 
              id="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className={styles.submitBtn}>Entrar</button>
        </form>

        <div className={styles.divider}>
          <span>OU</span>
        </div>

        <button type="button" className={styles.googleBtn} onClick={handleGoogleLogin}>
          Entrar com Google
        </button>

        <div className={styles.footer}>
          <a href="/forgot-password">Esqueceu a senha?</a>
        </div>
      </div>
    </div>
  );
}
