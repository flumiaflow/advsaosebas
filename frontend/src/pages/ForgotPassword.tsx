import { useState } from 'react';
import { api } from '../services/api';
import styles from './Login.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.');
    } catch (err) {
      setMessage('Se o e-mail existir em nossa base, você receberá um link de recuperação em instantes.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Recuperar Senha</h1>
          <p>Informe seu e-mail para receber as instruções</p>
        </div>
        
        {message && <div style={{ color: 'var(--color-success)', marginBottom: '1rem', fontSize: '0.875rem' }}>{message}</div>}
        
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
          
          <button type="submit" className={styles.submitBtn}>Enviar Link</button>
        </form>

        <div className={styles.footer}>
          <a href="/login">Voltar para o login</a>
        </div>
      </div>
    </div>
  );
}
