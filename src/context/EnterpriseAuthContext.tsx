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
  sessionLoading: boolean;
  requiresPasswordChange: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<{
    requiresPasswordChange: boolean;
    user: EnterpriseUserProfile;
  }>;
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
  // HttpOnly session cookie is primary; optional in-memory token kept for backward Bearer header compatibility
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<EnterpriseUserProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const userRef = useRef<EnterpriseUserProfile | null>(null);
  userRef.current = user;

  const clearAuthState = useCallback(() => {
    setToken(null);
    tokenRef.current = null;
    setUser(null);
    userRef.current = null;
    setRequiresPasswordChange(false);
  }, []);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }
      headers.set('X-Requested-With', 'VCPL-Workspace');
      if (init.body && !headers.has('Content-Type') && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(path, {
        ...init,
        credentials: 'include',
        headers,
      });
      if (res.status === 401 && (tokenRef.current || userRef.current)) {
        clearAuthState();
      }
      return res;
    },
    [clearAuthState]
  );

  const refreshSession = useCallback(async () => {
    try {
      const headers = new Headers({ 'X-Requested-With': 'VCPL-Workspace' });
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }
      const res = await fetch('/api/enterprise/auth/me', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        clearAuthState();
        return;
      }
      const data = (await res.json()) as {
        user?: EnterpriseUserProfile;
        requiresPasswordChange?: boolean;
      };
      if (!data.user) {
        clearAuthState();
        return;
      }
      setUser(data.user);
      setRequiresPasswordChange(Boolean(data.requiresPasswordChange));
    } catch {
      // Ignore transient network failures
    } finally {
      setSessionLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/enterprise/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'VCPL-Workspace',
      },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => null)) as {
      token?: string;
      requiresPasswordChange?: boolean;
      user?: EnterpriseUserProfile;
      error?: string;
    } | null;

    if (!res.ok || !data?.user) {
      throw new Error(data?.error || 'Unable to sign in. Please verify your User ID and Password.');
    }

    setToken(data.token || null);
    tokenRef.current = data.token || null;
    setUser(data.user);
    setRequiresPasswordChange(Boolean(data.requiresPasswordChange));
    setSessionLoading(false);
    return {
      requiresPasswordChange: Boolean(data.requiresPasswordChange),
      user: data.user,
    };
  }, []);

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

      if (!res.ok || !data?.user) {
        throw new Error(data?.error || 'Unable to change password.');
      }

      setToken(data.token || null);
      tokenRef.current = data.token || null;
      setUser(data.user);
      setRequiresPasswordChange(false);
      return data.user;
    },
    [apiFetch]
  );

  const requestPasswordReset = useCallback(async (username: string, note = '') => {
    const res = await fetch('/api/enterprise/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'VCPL-Workspace',
      },
      body: JSON.stringify({ username, note }),
    });
    const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to submit password reset request.');
    }
    return (
      data?.message ||
      'If your User ID exists in VCPL Tools, your reset request has been logged for the Super Admin. Contact your administrator directly for a one-time temporary password.'
    );
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/enterprise/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless
    } finally {
      clearAuthState();
    }
  }, [apiFetch, clearAuthState]);

  const isAuthenticated = Boolean(user);
  const isSuperAdmin = Boolean(user?.role === 'super_admin' && !requiresPasswordChange);

  const hasPermission = useCallback(
    (moduleId: string, action: PermissionActionKey): boolean => {
      if (!user || requiresPasswordChange) return false;
      if (user.role === 'super_admin') return true;
      const modPerms = user.permissions?.[moduleId];
      if (!modPerms) return false;
      if (modPerms.admin) return true;
      return Boolean(modPerms[action]);
    },
    [requiresPasswordChange, user]
  );

  const canAccessTool = useCallback(
    (toolId: string): boolean => {
      if (isSuperAdmin) return true;
      if (!user || requiresPasswordChange) {
        return !RESTRICTED_ENTERPRISE_TOOL_IDS.has(toolId);
      }
      return hasPermission(toolId, 'view');
    },
    [hasPermission, isSuperAdmin, requiresPasswordChange, user]
  );

  const value = useMemo<EnterpriseAuthContextValue>(
    () => ({
      token,
      user,
      sessionLoading,
      requiresPasswordChange,
      isAuthenticated,
      isSuperAdmin,
      refreshSession,
      login,
      changePassword,
      requestPasswordReset,
      logout,
      apiFetch,
      hasPermission,
      canAccessTool,
    }),
    [
      apiFetch,
      canAccessTool,
      changePassword,
      hasPermission,
      isAuthenticated,
      isSuperAdmin,
      login,
      logout,
      refreshSession,
      requestPasswordReset,
      requiresPasswordChange,
      sessionLoading,
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
