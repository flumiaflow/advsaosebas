import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Building2, Sliders, LogOut } from 'lucide-react';
import styles from './Layout.module.css';

export default function BackofficeLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h2>Juris<span className={styles.colorBlue}>Watch</span></h2>
          <span className={styles.badge}>MASTER</span>
        </div>
        
        <nav className={styles.nav}>
          <Link 
            to="/backoffice" 
            className={location.pathname === '/backoffice' ? styles.active : ''}
          >
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link 
            to="/backoffice/tenants" 
            className={location.pathname.includes('/tenants') ? styles.active : ''}
          >
            <Building2 size={18} /> Escritórios
          </Link>
          <Link 
            to="/backoffice/settings" 
            className={location.pathname.includes('/settings') ? styles.active : ''}
          >
            <Sliders size={18} /> Padrões do Sistema
          </Link>
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

        <main className={styles.page}>
          <Outlet />
        </main>
    </div>
  );
}
