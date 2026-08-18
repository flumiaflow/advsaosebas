import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients, isLoading } = useQuery({
    queryKey: ['workspace', 'clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return data.clients;
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Clientes (Empresas Monitoradas)</h1>
        <p>Gerencie as empresas e seus respectivos CNPJs</p>
      </header>

      <div>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
          />
          <button className={styles.btnPrimary}>+ Novo Cliente</button>
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Criado em</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients?.map((client: any) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{new Date(client.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td><span className={`${styles.badge} ${client.isActive ? styles.active : styles.cancelled}`}>{client.isActive ? 'Ativo' : 'Inativo'}</span></td>
                  <td style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none' }}>Editar</button>
                    <button style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: 'none' }}>CNPJs</button>
                  </td>
                </tr>
              ))}
              {(!clients || clients.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum cliente cadastrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
