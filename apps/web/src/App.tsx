import { useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { LandingPage } from './features/landing/LandingPage';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ProductsPage } from './features/products/ProductsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SalesPage } from './features/sales/SalesPage';
import { PurchasingPage } from './features/purchasing/PurchasingPage';
import { CashSessionsPage } from './features/cash-sessions/CashSessionsPage';
import { ReturnsPage } from './features/returns/ReturnsPage';
import { PharmacyPage } from './features/pharmacy/PharmacyPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { Card } from './components/ui/Card';
import { LoadingState } from './components/ui/LoadingState';
import { RequirePermissions, useAuth } from './components/auth/AuthProvider';

function AppShell({
  user,
  onLogout,
}: {
  user: any;
  onLogout: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-body bg-canvas min-h-screen">
      <Sidebar isCollapsed={isCollapsed} toggleCollapse={() => setIsCollapsed((p) => !p)} />
      <div className="flex flex-col flex-1">
        <Topbar
          tenantName={user?.tenantName ?? 'Business workspace'}
          userName={user?.name ?? user?.email ?? 'User'}
          onLogout={() => {
            onLogout();
            navigate('/login');
          }}
        />
        <main className="main-content container-max">
          <Routes location={location}>
            <Route path="/app/" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/products" element={
              <RequirePermissions permissions="products.view">
                <ProductsPage />
              </RequirePermissions>
            } />
            <Route path="/app/sales" element={
              <RequirePermissions permissions="sales.view">
                <SalesPage />
              </RequirePermissions>
            } />
            <Route path="/app/purchasing" element={
              <RequirePermissions permissions="purchases.view">
                <PurchasingPage />
              </RequirePermissions>
            } />
            <Route path="/app/cash-sessions" element={
              <RequirePermissions permissions="sales.view">
                <CashSessionsPage />
              </RequirePermissions>
            } />
            <Route path="/app/returns" element={
              <RequirePermissions permissions="sales.refund">
                <ReturnsPage />
              </RequirePermissions>
            } />
            <Route path="/app/pharmacy" element={
              <RequirePermissions permissions="pharmacy.batches.view">
                <PharmacyPage />
              </RequirePermissions>
            } />
            <Route path="/app/reports" element={
              <RequirePermissions permissions="reports.view">
                <ReportsPage />
              </RequirePermissions>
            } />
            <Route path="/app/campaigns" element={
              <RequirePermissions permissions="campaigns.view">
                <CampaignsPage />
              </RequirePermissions>
            } />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function RequireAuth({
  children,
  user,
  onLogout,
}: {
  children: React.ReactElement;
  user: any;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingState message="Restoring your session..." />;
  }

  if (!isAuthenticated || !user) {
    navigate('/login', { replace: true });
    return null;
  }

  return children;
}

function AppRoutes() {
  const { token, user, isInitializing, login, logout } = useAuth();

  if (isInitializing) {
    return <LoadingState message="Restoring your session..." />;
  }

  const handleLogin = (newToken: string, newUser: any) => {
    login(newToken, newUser);
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/register" element={<RegisterPage onRegister={handleLogin} />} />
      
      {/* Protected app shell */}
      <Route
        path="/app/*"
        element={
          <RequireAuth user={user} onLogout={logout}>
            <AppShell user={user} onLogout={logout} />
          </RequireAuth>
        }
      />
      
      {/* Redirects */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
