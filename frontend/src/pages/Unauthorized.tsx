import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Login.module.css';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    if (user?.role === 'super_admin') {
      navigate('/backoffice');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card} style={{ textAlign: 'center', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--red)' }}>
          <ShieldAlert size={48} />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--t1)', marginBottom: '8px' }}>
          Acesso Não Autorizado
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '24px' }}>
          Você não possui permissão para acessar esta área ou sua sessão mudou de contexto.
        </p>
        <button 
          onClick={handleBack} 
          className={styles.btnMain}
          style={{ width: '100%' }}
        >
          Voltar ao Início
        </button>
      </div>
    </div>
  );
}
