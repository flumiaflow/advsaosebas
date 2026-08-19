import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';

export default function Users() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [isActive, setIsActive] = useState(true);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['workspace', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return Array.isArray(data) ? data : data.users || [];
    }
  });

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ['workspace', 'clients'],
    queryFn: async () => {
      const { data } = await api.get('/clients');
      return Array.isArray(data) ? data : data.clients || [];
    }
  });

  const openModal = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
      setSelectedClients(user.userClientAccesses?.map((acc: any) => acc.clientId) || []);
    } else {
      setEditingUser(null);
      setName('');
      setEmail('');
      setRole('user');
      setIsActive(true);
      setSelectedClients([]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      let savedUser;
      if (editingUser) {
        // Edit User
        const { data } = await api.put(`/users/${editingUser.id}`, { name, email, role, isActive });
        savedUser = data;
        // Update Clients Access
        await api.put(`/users/${editingUser.id}/clients`, { clientIds: selectedClients });
      } else {
        // Create User
        const { data } = await api.post('/users', { name, email, role });
        savedUser = data;
        // Update Clients Access
        await api.put(`/users/${savedUser.id}/clients`, { clientIds: selectedClients });
      }
      return savedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'users'] });
      closeModal();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erro ao salvar usuário');
    }
  });

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  if (isLoadingUsers || isLoadingClients) return <div>Carregando...</div>;

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
          <button className={styles.btnPrimary} onClick={() => openModal()}>+ Convidar Usuário</button>
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Função</th>
                <th>Empresas Atribuídas</th>
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
                  <td>{user.userClientAccesses?.length || 0}</td>
                  <td><span className={`${styles.badge} ${user.isActive ? styles.active : styles.cancelled}`}>{user.isActive ? 'Ativo' : 'Desativado'}</span></td>
                  <td>
                    <button 
                      style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}
                      onClick={() => openModal(user)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-bg-base)', padding: '2rem', borderRadius: '8px', width: '400px', border: '1px solid var(--color-border)' }}>
            <h2>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Nome</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: '#000', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>E-mail</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: editingUser ? 'var(--color-border)' : '#000', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Função</label>
                <select 
                  value={role} 
                  onChange={e => setRole(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', background: '#000', color: '#fff' }}
                >
                  <option value="user">Usuário (Restrito a clientes atribuídos)</option>
                  <option value="supervisor">Supervisor (Acesso total)</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      onChange={e => setIsActive(e.target.checked)}
                    />
                    Usuário Ativo
                  </label>
                </div>
              )}

              {role === 'user' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Empresas Monitoradas Atribuídas</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0.5rem', background: '#000' }}>
                    {clients.map((client: any) => (
                      <label key={client.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedClients.includes(client.id)}
                          onChange={() => handleClientToggle(client.id)}
                        />
                        {client.name}
                      </label>
                    ))}
                    {clients.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Nenhuma empresa cadastrada.</span>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={closeModal}
                  style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => saveUserMutation.mutate()}
                  disabled={saveUserMutation.isPending}
                  className={styles.btnPrimary}
                >
                  {saveUserMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
