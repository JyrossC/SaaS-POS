import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { AccountSecurityPage } from './features/auth/AccountSecurityPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { TenantOnboardingPage } from './features/auth/TenantOnboardingPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
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
import { StoresPage } from './features/stores/StoresPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { RolesPage } from './features/roles/RolesPage';
import { BusinessSettingsPage } from './features/settings/BusinessSettingsPage';
import { PlatformReviewPage } from './features/platform/PlatformReviewPage';
import { PlatformInvitationPage } from './features/platform/PlatformInvitationPage';
import { Button } from './components/ui/Button';
import { LoadingState } from './components/ui/LoadingState';
import { RequirePermissions, useAuth } from './components/auth/AuthProvider';

function AppShell({
  user,
  onLogout,
}: {
  user: any;
  onLogout: () => Promise<void>;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-body bg-canvas min-h-screen">
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        onNavigate={() => setIsMobileMenuOpen(false)}
        toggleCollapse={() => setIsCollapsed((p) => !p)}
      />
      <div className="flex flex-col flex-1">
        <Topbar
          tenantName={user?.tenantName ?? 'Business workspace'}
          userName={user?.name ?? user?.email ?? 'User'}
          onMenuToggle={() => setIsMobileMenuOpen((open) => !open)}
          onLogout={() => {
            void onLogout()
              .then(() => navigate('/login'))
              .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : 'Could not revoke the current session.');
                navigate('/login');
              });
          }}
        />
        <main className="main-content container-max">
          <Routes location={location}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={
              <RequirePermissions permissions="reports.view">
                <DashboardPage />
              </RequirePermissions>
            } />
            <Route path="stores" element={
              <RequirePermissions permissions="stores.view">
                <StoresPage />
              </RequirePermissions>
            } />
            <Route path="products" element={
              <RequirePermissions permissions="products.view">
                <ProductsPage />
              </RequirePermissions>
            } />
            <Route path="inventory" element={
              <RequirePermissions permissions={['inventory.view', 'stores.view']}>
                <InventoryPage />
              </RequirePermissions>
            } />
            <Route path="sales" element={
              <RequirePermissions permissions="sales.view">
                <SalesPage />
              </RequirePermissions>
            } />
            <Route path="purchasing" element={
              <RequirePermissions permissions="purchases.view">
                <PurchasingPage />
              </RequirePermissions>
            } />
            <Route path="cash-sessions" element={
              <RequirePermissions permissions="sales.view">
                <CashSessionsPage />
              </RequirePermissions>
            } />
            <Route path="returns" element={
              <RequirePermissions permissions={['sales.refund', 'sales.view']}>
                <ReturnsPage />
              </RequirePermissions>
            } />
            <Route path="pharmacy" element={
              <RequirePermissions permissions="pharmacy.batches.view">
                <PharmacyPage />
              </RequirePermissions>
            } />
            <Route path="reports" element={
              <RequirePermissions permissions="reports.view">
                <ReportsPage />
              </RequirePermissions>
            } />
            <Route path="campaigns" element={
              <RequirePermissions permissions="campaigns.view">
                <CampaignsPage />
              </RequirePermissions>
            } />
            <Route path="roles" element={
              <RequirePermissions permissions="roles.view">
                <RolesPage />
              </RequirePermissions>
            } />
            <Route path="settings" element={
              <RequirePermissions permissions="business_settings.view">
                <BusinessSettingsPage />
              </RequirePermissions>
            } />
            <Route path="security" element={<AccountSecurityPage />} />
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
}: {
  children: React.ReactElement;
  user: any;
}) {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingState message="Restoring your session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, isInitializing, sessionError, retrySessionRestore, logout } = useAuth();

  if (isInitializing) {
    return <LoadingState message="Restoring your session..." />;
  }
  if (sessionError) {
    return (
      <main className="session-recovery">
        <h1 className="text-heading-h2">Session could not be restored</h1>
        <p className="text-body-md text-secondary">{sessionError}</p>
        <div className="flex gap-3">
          <Button onClick={retrySessionRestore}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              void logout().catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : 'Could not revoke the current session.');
              });
            }}
          >
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  if (user?.tenantStatus && user.tenantStatus !== 'ACTIVE') {
    return (
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/platform/review" element={<PlatformReviewPage />} />
        <Route path="/platform/accept-invitation" element={<PlatformInvitationPage />} />
        <Route
          path="/app/onboarding"
          element={
            <RequireAuth user={user}>
              <TenantOnboardingPage onLogout={logout} />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/app/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/platform/review" element={<PlatformReviewPage />} />
      <Route path="/platform/accept-invitation" element={<PlatformInvitationPage />} />
      
      {/* Protected app shell */}
      <Route
        path="/app/*"
        element={
          <RequireAuth user={user}>
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
