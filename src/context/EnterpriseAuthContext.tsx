import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type EnterpriseAccountStatus,
  type PermissionActionKey,
  RESTRICTED_ENTERPRISE_TOOL_IDS,
  type UserPermissionMatrix,
} from '../data/enterpriseModules.ts';

export interface EnterpriseUserProfile {
  id: string;
  username: string;
  displayUsername: string;
  internalAuthId?: string;
  fullName: string;
  employeeId: string;
  department: string;
  designation: string;
  contactNumber: string;
  role: 'super_admin' | 'employee';
  status: EnterpriseAccountStatus;
  isArchived: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  permissions: UserPermissionMatrix;
}

interface EnterpriseAuthContextValue {
  token: string | null;
  user: EnterpriseUserProfile | null;
  requiresPasswordChange: boolean;
  superAdminConfigured: boolean | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  refreshSuperAdminStatus: () => Promise<boolean>;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<{
    requiresPasswordChange: boolean;
    user: EnterpriseUserProfile;
  }>;
  bootstrapSuperAdmin: (payload: {
    username: string;
    password: string;
    fullName: string;
    designation?: string;
    contactNumber?: string;
  }) => Promise<EnterpriseUserProfile>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<EnterpriseUserProfile>;
  requestPasswordReset: (username: string, note?: string) => Promise<string>;
  logout: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  hasPermission: (moduleId: string, action: PermissionActionKey) => boolean;
  canAccessTool: (toolId: string) => boolean;
}

const EnterpriseAuthContext = createContext<EnterpriseAuthContextValue | null>(null);

export const EnterpriseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Strictly in-memory token storage (never saved to localStorage or sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<EnterpriseUserProfile | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [superAdminConfigured, setSuperAdminConfigured] = useState<boolean | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const clearAuthState = useCallback(() => {
    setToken(null);
    tokenRef.current = null;
    setUser(null);
    setRequiresPasswordChange(false);
  }, []);

  useEffect(() => {
    const onPageExit = () => {
      clearAuthState();
    };
    window.addEventListener('pagehide', onPageExit);
    window.addEventListener('beforeunload', onPageExit);
    return () => {
      window.removeEventListener('pagehide', onPageExit);
      window.removeEventListener('beforeunload', onPageExit);
    };
  }, [clearAuthState]);

  const refreshSuperAdminStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/enterprise/auth/super-admin-status');
      if (!res.ok) return true;
      const data = (await res.json()) as { configured?: boolean };
      const configured = Boolean(data.configured);
      setSuperAdminConfigured(configured);
      return configured;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    void refreshSuperAdminStatus();
  }, [refreshSuperAdminStatus]);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }
      if (init.body && !headers.has('Content-Type') && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(path, { ...init, headers });
      if (res.status === 401 && tokenRef.current) {
        clearAuthState();
      }
      return res;
    },
    [clearAuthState]
  );

  const refreshSession = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await apiFetch('/api/enterprise/auth/me');
      if (!res.ok) {
        clearAuthState();
        return;
      }
      const data = (await res.json()) as {
        user: EnterpriseUserProfile;
        requiresPasswordChange: boolean;
      };
      setUser(data.user);
      setRequiresPasswordChange(Boolean(data.requiresPasswordChange));
    } catch {
      // Ignore transient network failures
    }
  }, [apiFetch, clearAuthState]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/enterprise/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => null)) as {
      token?: string;
      requiresPasswordChange?: boolean;
      user?: EnterpriseUserProfile;
      error?: string;
    } | null;

    if (!res.ok || !data?.token || !data?.user) {
      throw new Error(data?.error || 'Unable to sign in. Please verify your credentials.');
    }

    setToken(data.token);
    tokenRef.current = data.token;
    setUser(data.user);
    setRequiresPasswordChange(Boolean(data.requiresPasswordChange));
    setSuperAdminConfigured(true);
    return {
      requiresPasswordChange: Boolean(data.requiresPasswordChange),
      user: data.user,
    };
  }, []);

  const bootstrapSuperAdmin = useCallback(
    async (payload: {
      username: string;
      password: string;
      fullName: string;
      designation?: string;
      contactNumber?: string;
    }) => {
      const res = await fetch('/api/enterprise/auth/bootstrap-super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        token?: string;
        user?: EnterpriseUserProfile;
        error?: string;
      } | null;

      if (!res.ok || !data?.token || !data?.user) {
        throw new Error(data?.error || 'Unable to initialize Super Admin account.');
      }

      setToken(data.token);
      tokenRef.current = data.token;
      setUser(data.user);
      setRequiresPasswordChange(false);
      setSuperAdminConfigured(true);
      return data.user;
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      const res = await apiFetch('/api/enterprise/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => null)) as {
        token?: string;
        user?: EnterpriseUserProfile;
        error?: string;
      } | null;

      if (!res.ok || !data?.token || !data?.user) {
        throw new Error(data?.error || 'Unable to change password.');
      }

      setToken(data.token);
      tokenRef.current = data.token;
      setUser(data.user);
      setRequiresPasswordChange(false);
      return data.user;
    },
    [apiFetch]
  );

  const requestPasswordReset = useCallback(async (username: string, note = '') => {
    const res = await fetch('/api/enterprise/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, note }),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to submit password reset request.');
    }
    return (
      data?.message ||
      'Your password reset request has been submitted to the Super Admin. Contact your administrator directly for your temporary password.'
    );
  }, []);

  const logout = useCallback(async () => {
    try {
      if (tokenRef.current) {
        await apiFetch('/api/enterprise/auth/logout', { method: 'POST' });
      }
    } catch {
      // Clear local session regardless
    } finally {
      clearAuthState();
    }
  }, [apiFetch, clearAuthState]);

  const isAuthenticated = Boolean(token && user);
  const isSuperAdmin = Boolean(token && user?.role === 'super_admin' && !requiresPasswordChange);

  const hasPermission = useCallback(
    (moduleId: string, action: PermissionActionKey): boolean => {
      if (!token || !user || requiresPasswordChange) return false;
      if (user.role === 'super_admin') return true;
      const modPerms = user.permissions?.[moduleId];
      if (!modPerms) return false;
      if (modPerms.admin) return true;
      return Boolean(modPerms[action]);
    },
    [requiresPasswordChange, token, user]
  );

  const canAccessTool = useCallback(
    (toolId: string): boolean => {
      if (isSuperAdmin) return true;
      if (!token || !user || requiresPasswordChange) {
        return !RESTRICTED_ENTERPRISE_TOOL_IDS.has(toolId);
      }
      return hasPermission(toolId, 'view');
    },
    [hasPermission, isSuperAdmin, requiresPasswordChange, token, user]
  );

  const value = useMemo<EnterpriseAuthContextValue>(
    () => ({
      token,
      user,
      requiresPasswordChange,
      superAdminConfigured,
      isAuthenticated,
      isSuperAdmin,
      refreshSuperAdminStatus,
      refreshSession,
      login,
      bootstrapSuperAdmin,
      changePassword,
      requestPasswordReset,
      logout,
      apiFetch,
      hasPermission,
      canAccessTool,
    }),
    [
      apiFetch,
      bootstrapSuperAdmin,
      canAccessTool,
      changePassword,
      hasPermission,
      isAuthenticated,
      isSuperAdmin,
      login,
      logout,
      refreshSession,
      refreshSuperAdminStatus,
      requestPasswordReset,
      requiresPasswordChange,
      superAdminConfigured,
      token,
      user,
    ]
  );

  return <EnterpriseAuthContext.Provider value={value}>{children}</EnterpriseAuthContext.Provider>;
};

export function useEnterpriseAuth(): EnterpriseAuthContextValue {
  const ctx = useContext(EnterpriseAuthContext);
  if (!ctx) {
    throw new Error('useEnterpriseAuth must be used inside EnterpriseAuthProvider');
  }
  return ctx;
}
