import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Building2, LogOut } from 'lucide-react';
import styles from './Layout.module.css';

export default function BackofficeLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h2>JurisWatch</h2>
          <span className={styles.badge}>Admin</span>
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

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
