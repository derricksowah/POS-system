import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

function initials(str = '') {
  return str.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'C';
}

export default function CashierLayout() {
  const { user, logout } = useAuth();
  const { settings }     = useSettings();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out.');
    navigate('/login');
  };

  const sidebar = (
    <aside className={`sidebar ${open ? 'sidebar-mobile-open' : ''}`}>
      <div className="sidebar-brand">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="logo" className="sidebar-brand-logo" />
        ) : (
          <div className="sidebar-brand-initials">
            {initials(settings.shop_name || 'POS')}
          </div>
        )}
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">Retail Shop</div>
          <div className="sidebar-brand-role">Cashier</div>
        </div>
        <button className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/pos" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-item-icon">⊕</span> Point of Sale
        </NavLink>
        <NavLink to="/pos/summary" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-item-icon">≡</span> Today's Summary
        </NavLink>
        <NavLink to="/pos/sales-log" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-item-icon">📋</span> Sales Log
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user?.username)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">Cashier</div>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <span>⎋</span> Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="app-shell">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {sidebar}

      <div className="main-content">
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <span className="mobile-topbar-title">Retail Shop</span>
          <div className="sidebar-avatar" style={{ width: 30, height: 30, fontSize: '0.72rem' }}>
            {initials(user?.username)}
          </div>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
