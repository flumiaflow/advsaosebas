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
          <h2>Recuperar Senha</h2>
          <p>Informe seu e-mail para receber as instruções</p>
        </div>
        
        <div className={styles.body}>
          {message && <div style={{ color: 'var(--green)', marginBottom: '16px', fontSize: '13px' }}>{message}</div>}
          
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
            
            <button type="submit" className={styles.btnMain}>Enviar Link</button>
          </form>

          <div className={styles.orSep}></div>

          <div className={styles.rowLink} style={{ justifyContent: 'center' }}>
            <a href="/login">Voltar para o login</a>
          </div>
        </div>
      </div>
    </div>
  );
}
