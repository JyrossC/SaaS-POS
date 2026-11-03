import { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export type Permission =
  | 'stores.create'
  | 'stores.view'
  | 'stores.update'
  | 'products.create'
  | 'products.view'
  | 'products.update'
  | 'inventory.adjust'
  | 'inventory.view'
  | 'sales.create'
  | 'sales.view'
  | 'sales.void'
  | 'sales.refund'
  | 'purchases.create'
  | 'purchases.view'
  | 'purchases.approve'
  | 'pharmacy.batches.create'
  | 'pharmacy.batches.manage'
  | 'pharmacy.batches.view'
  | 'pharmacy.dispensing.create'
  | 'reports.view'
  | 'subscriptions.view'
  | 'subscriptions.manage'
  | 'campaigns.view'
  | 'campaigns.create'
  | 'campaigns.update'
  | 'campaigns.delete'
  | 'staff.view'
  | 'staff.invite'
  | 'staff.update'
  | 'staff.deactivate'
  | 'roles.view'
  | 'roles.create'
  | 'roles.update'
  | 'roles.assign_permissions'
  | 'business_settings.view'
  | 'business_settings.update'
  | 'fiscal_settings.view'
  | 'fiscal_settings.update';

interface AuthContextType {
  token: string | null;
  user: any | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  sessionError: string | null;
  login: (token: string, user: any) => void;
  updateTenantName: (name: string) => void;
  logout: () => Promise<void>;
  retrySessionRestore: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const clearLocalSession = useCallback(() => {
    queryClient.clear();
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
    setSessionError(null);
  }, [queryClient]);

  const permissions = useMemo(() => {
    if (!user?.permissions) return [];
    return user.permissions as Permission[];
  }, [user]);

  const isAuthenticated = !!token;

  const login = useCallback((newToken: string, newUser: any) => {
    queryClient.clear();
    apiClient.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setSessionError(null);
  }, [queryClient]);

  const updateTenantName = useCallback((name: string) => {
    setUser((current: any) => current ? { ...current, tenantName: name } : current);
  }, []);

  const logout = useCallback(async () => {
    let requestError: Error | undefined;
    try {
      const response = await apiClient.post<{ loggedOut: boolean }>('/auth/logout');
      if (!response.success && response.error?.status !== 401) {
        requestError = new Error(response.error?.message || 'Could not revoke the current session.');
      }
    } catch (error) {
      requestError = error instanceof Error ? error : new Error('Could not revoke the current session.');
    } finally {
      clearLocalSession();
    }
    if (requestError) throw requestError;
  }, [clearLocalSession]);

  const retrySessionRestore = useCallback(() => {
    setSessionError(null);
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setIsInitializing(true);
    apiClient.setToken(null);
    void apiClient.post<{ accessToken: string; user: any }>('/auth/refresh')
      .then((response) => {
        if (!active) return;
        if (response.success && response.data?.accessToken && response.data.user) {
          apiClient.setToken(response.data.accessToken);
          setToken(response.data.accessToken);
          setUser(response.data.user);
          setSessionError(null);
        } else if (response.error?.status === 401) {
          clearLocalSession();
        } else {
          setSessionError(response.error?.message ?? 'Could not restore your session.');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSessionError(error instanceof Error ? error.message : 'Could not restore your session.');
        }
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
    };
  }, [restoreAttempt, clearLocalSession]);

  useEffect(() => {
    const handleExpiredSession = () => clearLocalSession();
    window.addEventListener('tenant-auth-expired', handleExpiredSession);
    return () => window.removeEventListener('tenant-auth-expired', handleExpiredSession);
  }, [clearLocalSession]);

  const hasPermission = useCallback((permission: Permission) => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: Permission[]) => {
    return perms.some((p) => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((perms: Permission[]) => {
    return perms.every((p) => permissions.includes(p));
  }, [permissions]);

  return (
    <AuthContext.Provider value={{
      token,
      user,
      permissions,
      isAuthenticated,
      isInitializing,
      sessionError,
      login,
      updateTenantName,
      logout,
      retrySessionRestore,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function RequirePermissions({
  permissions,
  fallback,
  children,
}: {
  permissions: Permission | Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasAnyPermission, hasAllPermissions } = useAuth();
  const perms = Array.isArray(permissions) ? permissions : [permissions];

  const allowed = Array.isArray(permissions)
    ? hasAllPermissions(perms)
    : hasAnyPermission(perms);

  if (!allowed) {
    return fallback ?? <ForbiddenFallback />;
  }
  return children;
}

function ForbiddenFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <h2 className="text-heading-h4 text-danger">Access Denied</h2>
      <p className="text-body-md text-muted mt-2">
        Your current account does not have permission to view this page.
      </p>
    </div>
  );
}
