import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/admin',                    label: 'Dashboard',        icon: '⊞',  end: true },
  { to: '/admin/products',           label: 'Products',         icon: '⬡'  },
  { to: '/admin/stock',              label: 'Stock In',         icon: '↑'  },
  { to: '/admin/sales',              label: 'Sales Log',        icon: '≡'  },
  { to: '/admin/reports/sales',      label: 'Sales Report',     icon: '↗'  },
  { to: '/admin/reports/inventory',  label: 'Inventory Report', icon: '▦'  },
  { to: '/admin/users',              label: 'Users',            icon: '👥' },
  { to: '/admin/recycle-bin',        label: 'Recycle Bin',      icon: '🗑' },
  { to: '/admin/settings',           label: 'Settings',         icon: '⚙'  },
];

function initials(str = '') {
  return str.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'A';
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { settings }     = useSettings();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on Escape
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
          <div className="sidebar-brand-role">Admin Panel</div>
        </div>
        {/* Close button — mobile only */}
        <button className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-item-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user?.username)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">Administrator</div>
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
      {/* Mobile overlay */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {sidebar}

      <div className="main-content">
        {/* Mobile top bar */}
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
