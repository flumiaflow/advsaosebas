import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';

export default function Users() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['workspace', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.users;
    }
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Equipe</h1>
        <p>Gerencie os usuários do seu escritório</p>
      </header>

      <div>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Buscar por e-mail ou nome..." 
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-base)', color: '#fff' }}
          />
          <button className={styles.btnPrimary}>+ Convidar Usuário</button>
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Função</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user: any) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td><span className={styles.badge} style={{ backgroundColor: 'var(--color-border)' }}>{user.role}</span></td>
                  <td><span className={`${styles.badge} ${user.isActive ? styles.active : styles.cancelled}`}>{user.isActive ? 'Ativo' : 'Desativado'}</span></td>
                  <td>
                    <button style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none' }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
