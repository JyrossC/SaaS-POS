import { Link, useLocation } from 'react-router-dom';
import { tokens } from '../../lib/design-tokens';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}

export function NavItem({ to, label, icon, isActive }: NavItemProps) {
  return (
    <Link
      to={to}
      className={`nav-item ${isActive ? 'bg-selected text-brand' : ''} border-default border border-transparent rounded-md flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-fast`}
    >
      {icon}
      <span className="text-primary">{label}</span>
    </Link>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const location = useLocation();
  const navItems = [
    { to: '/app/dashboard', label: 'Overview', icon: <span className="text-muted">⊕</span> },
    { to: '/app/stores', label: 'Stores', icon: <span className="text-muted">🏪</span> },
    { to: '/app/products', label: 'Products', icon: <span className="text-muted">📦</span> },
    { to: '/app/inventory', label: 'Inventory', icon: <span className="text-muted">📊</span> },
    { to: '/app/sales', label: 'Sales', icon: <span className="text-muted">💰</span> },
    { to: '/app/purchasing', label: 'Purchasing', icon: <span className="text-muted">🧾</span> },
    { to: '/app/returns', label: 'Returns', icon: <span className="text-muted">↩️</span> },
    { to: '/app/cash-sessions', label: 'Cash Sessions', icon: <span className="text-muted">💵</span> },
    { to: '/app/reports', label: 'Reports', icon: <span className="text-muted">📈</span> },
    { to: '/app/campaigns', label: 'Campaigns', icon: <span className="text-muted">🏷️</span> },
    { to: '/app/pharmacy', label: 'Pharmacy', icon: <span className="text-muted">💊</span> },
    { to: '/app/settings', label: 'Settings', icon: <span className="text-muted">⚙️</span> },
  ];

  return (
    <aside className="sidebar flex flex-col" style={{ width: isCollapsed ? tokens.size.sidebarCollapsed : tokens.size.sidebarExpanded }}>
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-title-md font-bold text-primary flex items-center gap-2">
          SPOS
        </span>
        <button
          onClick={toggleCollapse}
          className="p-2 rounded-md hover:bg-subtle transition-colors"
          aria-label="Toggle sidebar"
        >
          {isCollapsed ? '◀' : '▶'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            isActive={location.pathname === item.to || location.pathname.startsWith(item.to + '/')}
          />
        ))}
      </nav>
    </aside>
  );
}
