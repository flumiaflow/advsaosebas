import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { LayoutDashboard, Users, FileText, Settings, ShieldAlert, UsersRound, LogOut, EyeOff } from 'lucide-react';
import NotificationBadge from '../components/NotificationBadge';
import styles from './Layout.module.css';

export default function WorkspaceLayout() {
  const { user, logout, login, initAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'super_admin' || (user as any)?.isImpersonating;
  const isImpersonating = (user as any)?.isImpersonating || (user?.role === 'super_admin' && (user as any)?.tenantId);

  const handleExitImpersonate = async () => {
    try {
      const { data } = await api.post('/auth/impersonate/exit');
      if (data.accessToken && data.user) {
        login(data.accessToken, data.user);
      } else {
        await initAuth();
      }
      navigate('/backoffice');
    } catch (e) {
      console.error('Erro ao sair da sessão fantasma', e);
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h2>Juris<span className={styles.colorBlue}>Watch</span></h2>
          <span className={styles.badge}>{user?.role === 'supervisor' ? 'SUP' : 'USR'}</span>
        </div>
        
        <nav className={styles.nav}>
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? styles.active : ''}>
            <LayoutDashboard size={18} /> Início
          </Link>
          <Link to="/dashboard/clients" className={location.pathname.includes('/clients') ? styles.active : ''}>
            <Users size={18} /> Clientes
          </Link>
          <Link to="/dashboard/processes" className={location.pathname.includes('/processes') ? styles.active : ''}>
            <FileText size={18} /> Processos
          </Link>
          
          {isSupervisor && (
            <>
              <div className={styles.navGroupLabel}>Administração</div>
              <Link to="/dashboard/users" className={location.pathname.includes('/users') ? styles.active : ''}>
                <UsersRound size={16} /> Equipe
              </Link>
              <Link to="/dashboard/audit" className={location.pathname.includes('/audit') ? styles.active : ''}>
                <ShieldAlert size={16} /> Auditoria
              </Link>
              <Link to="/dashboard/settings" className={location.pathname.includes('/settings') ? styles.active : ''}>
                <Settings size={16} /> Configurações
              </Link>
            </>
          )}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userRow}>
            <div className={styles.uAv}>{user?.name?.charAt(0).toUpperCase()}</div>
            <div className={styles.userInfo}>
              <div className={styles.uName}>{user?.name}</div>
              <div className={styles.uRole}>{user?.role}</div>
            </div>
            <button className={styles.logoutBtn} onClick={logout} title="Sair">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isImpersonating && (
          <div style={{ 
            backgroundColor: '#F59E0B', 
            color: '#fff', 
            padding: '0.75rem 2rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '0.875rem',
            fontWeight: 500
          }}>
            <span>Atenção: Visualizando ambiente como Administrador. Ações feitas aqui serão registradas em log.</span>
            <button 
              onClick={handleExitImpersonate}
              style={{ 
                background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', 
                padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <EyeOff size={16} /> Voltar ao Backoffice
            </button>
          </div>
        )}

        <header style={{ height: '60px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', backgroundColor: 'var(--color-bg-surface)' }}>
          <NotificationBadge />
        </header>
        
        <main className={styles.page}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
