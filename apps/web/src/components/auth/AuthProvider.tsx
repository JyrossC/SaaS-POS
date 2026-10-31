import { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
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
  | 'pharmacy.batches.manage'
  | 'pharmacy.batches.view'
  | 'pharmacy.dispensing.create'
  | 'reports.view'
  | 'subscriptions.view'
  | 'subscriptions.manage'
  | 'campaigns.view'
  | 'campaigns.create'
  | 'campaigns.update'
  | 'campaigns.delete';

interface AuthContextType {
  token: string | null;
  user: any | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(null);
  const [isInitializing, setIsInitializing] = useState(Boolean(localStorage.getItem('token')));

  const permissions = useMemo(() => {
    if (!user?.permissions) return [];
    return user.permissions as Permission[];
  }, [user]);

  const isAuthenticated = !!token;

  const login = useCallback((newToken: string, newUser: any) => {
    localStorage.setItem('token', newToken);
    apiClient.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    apiClient.setToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    apiClient.setToken(token);
    if (!token) {
      setUser(null);
      setIsInitializing(false);
      return;
    }

    let active = true;
    setIsInitializing(true);
    void apiClient.get<any>('/auth/me')
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          logout();
        }
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
    };
  }, [token, logout]);

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
      login,
      logout,
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

  const allowed = permissions.length === 1
    ? hasAnyPermission(perms)
    : hasAllPermissions(perms);

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
