import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, FileText, Settings, ShieldAlert, UsersRound, LogOut } from 'lucide-react';
import NotificationBadge from '../components/NotificationBadge';
import styles from './Layout.module.css';

export default function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isSupervisor = user?.role === 'supervisor';

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h2>JurisWatch</h2>
          <span className={styles.badge} style={{ backgroundColor: 'var(--color-primary)' }}>
            {user?.role}
          </span>
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
              <div style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginTop: '1rem' }}>
                Administração
              </div>
              <Link to="/dashboard/users" className={location.pathname.includes('/users') ? styles.active : ''}>
                <UsersRound size={18} /> Equipe
              </Link>
              <Link to="/dashboard/audit" className={location.pathname.includes('/audit') ? styles.active : ''}>
                <ShieldAlert size={18} /> Auditoria
              </Link>
              <Link to="/dashboard/settings" className={location.pathname.includes('/settings') ? styles.active : ''}>
                <Settings size={18} /> Configurações
              </Link>
            </>
          )}
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '60px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', backgroundColor: 'var(--color-bg-surface)' }}>
          <NotificationBadge />
        </header>
        
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
