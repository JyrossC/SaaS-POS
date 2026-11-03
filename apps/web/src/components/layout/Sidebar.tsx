import { Link, useLocation } from 'react-router-dom';
import { tokens } from '../../lib/design-tokens';
import { Permission, useAuth } from '../auth/AuthProvider';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onNavigate: () => void;
}

export function NavItem({ to, label, icon, isActive, onNavigate }: NavItemProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`nav-item ${isActive ? 'bg-selected text-brand' : ''} border-default border border-transparent rounded-md flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-fast`}
    >
      {icon}
      <span className="text-primary">{label}</span>
    </Link>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  onNavigate: () => void;
  toggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, isMobileMenuOpen, onNavigate, toggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { hasAllPermissions } = useAuth();
  const navItems: Array<{ to: string; label: string; icon: string; permissions: Permission[] }> = [
    { to: '/app/dashboard', label: 'Overview', icon: 'O', permissions: ['reports.view'] },
    { to: '/app/security', label: 'Security', icon: 'Sec', permissions: [] },
    { to: '/app/stores', label: 'Stores', icon: 'S', permissions: ['stores.view'] },
    { to: '/app/products', label: 'Products', icon: 'P', permissions: ['products.view'] },
    { to: '/app/inventory', label: 'Inventory', icon: 'I', permissions: ['inventory.view', 'stores.view'] },
    { to: '/app/sales', label: 'Sales', icon: '$', permissions: ['sales.view'] },
    { to: '/app/purchasing', label: 'Purchasing', icon: 'PO', permissions: ['purchases.view'] },
    { to: '/app/returns', label: 'Returns', icon: 'R', permissions: ['sales.refund', 'sales.view'] },
    { to: '/app/cash-sessions', label: 'Cash Sessions', icon: 'C', permissions: ['sales.view'] },
    { to: '/app/reports', label: 'Reports', icon: 'BI', permissions: ['reports.view'] },
    { to: '/app/campaigns', label: 'Campaigns', icon: 'M', permissions: ['campaigns.view'] },
    { to: '/app/pharmacy', label: 'Pharmacy', icon: 'Rx', permissions: ['pharmacy.batches.view'] },
    { to: '/app/roles', label: 'Roles & Permissions', icon: 'ACL', permissions: ['roles.view'] },
    { to: '/app/settings', label: 'Business Settings', icon: 'Set', permissions: ['business_settings.view'] },
  ];

  return (
    <>
      {isMobileMenuOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={onNavigate} />}
      <aside
        className={`sidebar flex flex-col ${isCollapsed ? 'is-collapsed' : ''} ${isMobileMenuOpen ? 'is-open' : ''}`}
        style={{ width: isCollapsed ? tokens.size.sidebarCollapsed : tokens.size.sidebarExpanded }}
      >
      <div className="flex items-center justify-between px-4 py-4">
        <span className="sidebar-brand text-title-md font-bold text-primary flex items-center gap-2">SPOS</span>
        <button
          type="button"
          onClick={toggleCollapse}
          className="p-2 rounded-md hover:bg-subtle transition-colors"
          aria-label="Toggle sidebar"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? '◀' : '▶'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
        {navItems.filter((item) => hasAllPermissions(item.permissions)).map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={<span className="nav-icon" aria-hidden="true">{item.icon}</span>}
            onNavigate={onNavigate}
            isActive={location.pathname === item.to || location.pathname.startsWith(item.to + '/')}
          />
        ))}
      </nav>
      </aside>
    </>
  );
}
