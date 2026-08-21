import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import styles from '../Backoffice/Backoffice.module.css';
import { UserPlus, Edit2, X, Shield, Users as UsersIcon, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Users() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'users'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  });

  const handleDeleteUser = (user: any) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const [newPasswordAlert, setNewPasswordAlert] = useState<{name: string, tempPassword: string} | null>(null);

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim()) {
        throw new Error('Nome e E-mail são obrigatórios');
      }

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
        savedUser = data; // data contains tempPassword
        // Update Clients Access
        if (selectedClients.length > 0) {
          await api.put(`/users/${savedUser.id}/clients`, { clientIds: selectedClients });
        }
      }
      return { savedUser, isNew: !editingUser };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', 'users'] });
      
      if (result.isNew && result.savedUser.tempPassword) {
        setNewPasswordAlert({
          name: result.savedUser.name,
          tempPassword: result.savedUser.tempPassword
        });
      } else {
        toast.success('Usuário atualizado com sucesso!');
      }
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Erro ao salvar usuário');
    }
  });

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const filteredUsers = users?.filter((u: any) => {
    const term = searchTerm.toLowerCase();
    return u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
  });

  if (isLoadingUsers || isLoadingClients) return <div style={{ padding: '2rem', color: 'var(--t2)' }}>Carregando equipe...</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Equipe</h1>
            <p>Gerencie os advogados, assistentes e supervisores do seu escritório</p>
          </div>
          <button 
            className={styles.btnPrimary} 
            onClick={() => openModal()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '8px 16px', fontSize: '13px' }}
          >
            <UserPlus size={15} /> Convidar Membro
          </button>
        </div>
      </header>

      <div>
        <div className={styles.controls}>
          <input 
            type="text" 
            placeholder="Buscar por e-mail ou nome..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ 
              width: '320px',
              padding: '0.5rem 0.75rem', 
              borderRadius: '6px', 
              border: '1px solid var(--line)', 
              background: 'var(--card)', 
              color: '#fff',
              fontSize: '13px'
            }}
          />
        </div>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>Nome / Membro</th>
                <th>E-mail Corporativo</th>
                <th>Função / Permissão</th>
                <th>Empresas Atribuídas</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.map((user: any) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{user.name}</div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--t2)', fontSize: '13px' }}>{user.email}</span>
                  </td>
                  <td>
                    <span 
                      className={styles.badge} 
                      style={{ 
                        background: user.role === 'supervisor' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${user.role === 'supervisor' ? 'var(--blue)' : 'var(--line)'}`,
                        color: user.role === 'supervisor' ? 'var(--blue)' : 'var(--t2)'
                      }}
                    >
                      {user.role === 'supervisor' ? 'Supervisor' : 'Usuário Padrão'}
                    </span>
                  </td>
                  <td>
                    {user.role === 'supervisor' ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 500 }}>
                        Acesso Global (Todas)
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--t2)' }}>
                        {user.userClientAccesses?.length || 0} empresa(s)
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${user.isActive ? styles.active : styles.cancelled}`}>
                      {user.isActive ? 'Ativo' : 'Desativado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button 
                        className={styles.btnText}
                        onClick={() => openModal(user)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px' }}
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                      <button 
                        className={styles.btnText}
                        onClick={() => handleDeleteUser(user)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '12px', color: '#ef4444' }}
                        title="Excluir Usuário"
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!filteredUsers || filteredUsers.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--t3)' }}>
                    Nenhum membro encontrado na equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CONVIDAR / EDITAR USUÁRIO */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div 
            className={styles.modalContent} 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.75rem', background: '#121620', border: '1px solid var(--line)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} color="var(--blue)" />
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', border: 'none', padding: 0 }}>
                  {editingUser ? 'Editar Membro da Equipe' : 'Convidar Novo Membro'}
                </h2>
              </div>
              <button onClick={closeModal} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={e => { e.preventDefault(); saveUserMutation.mutate(); }}>
              <div className={styles.formGroup}>
                <label>Nome Completo *</label>
                <input 
                  type="text" 
                  value={name} 
                  placeholder="Ex: Dr. Marcelo Ramos"
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>E-mail Corporativo *</label>
                <input 
                  type="email" 
                  value={email} 
                  placeholder="marcelo@escritorio.adv.br"
                  onChange={e => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Função no Escritório</label>
                <select 
                  value={role} 
                  onChange={e => setRole(e.target.value)}
                >
                  <option value="user">Usuário (Restrito apenas às empresas atribuídas)</option>
                  <option value="supervisor">Supervisor (Acesso irrestrito e relatórios)</option>
                </select>
              </div>

              {editingUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      onChange={e => setIsActive(e.target.checked)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    <span>Usuário Ativo no Escritório</span>
                  </label>
                </div>
              )}

              {role === 'user' && (
                <div className={styles.formGroup}>
                  <label>Empresas Monitoradas que este usuário poderá visualizar:</label>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '6px', padding: '0.75rem', background: '#0a0d14' }}>
                    {clients?.map((client: any) => (
                      <label key={client.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedClients.includes(client.id)}
                          onChange={() => handleClientToggle(client.id)}
                          style={{ width: 'auto', margin: 0 }}
                        />
                        <span>{client.name}</span>
                      </label>
                    ))}
                    {(!clients || clients.length === 0) && (
                      <span style={{ fontSize: '12px', color: 'var(--t3)' }}>Nenhuma empresa cadastrada ainda.</span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button 
                  type="button"
                  onClick={closeModal}
                  className={styles.btnSecondary}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  className={styles.btnPrimary}
                >
                  {saveUserMutation.isPending ? 'Salvando...' : (editingUser ? 'Salvar Alterações' : 'Enviar Convite')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: SENHA PROVISÓRIA */}
      {newPasswordAlert && (
        <div className={styles.modalOverlay} onClick={() => setNewPasswordAlert(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: '#34d399' }}>Membro Cadastrado com Sucesso!</h2>
              <button className={styles.closeBtn} onClick={() => setNewPasswordAlert(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody} style={{ textAlign: 'center' }}>
              <p>O usuário <strong>{newPasswordAlert.name}</strong> foi criado.</p>
              <p style={{ marginTop: '1rem', color: 'var(--t2)' }}>A senha provisória de acesso é:</p>
              <div style={{ 
                margin: '1.5rem auto', 
                background: '#1e1e24', 
                padding: '1rem', 
                borderRadius: '8px',
                fontSize: '24px',
                letterSpacing: '3px',
                fontWeight: 'bold',
                color: 'var(--blue)',
                border: '1px solid var(--line)',
                display: 'inline-block'
              }}>
                {newPasswordAlert.tempPassword}
              </div>
              <p style={{ color: 'var(--color-warning)', fontSize: '13px' }}>
                Envie esta senha para o usuário. No primeiro acesso, ele será obrigado a cadastrar uma nova senha definitiva.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnPrimary} onClick={() => setNewPasswordAlert(null)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
