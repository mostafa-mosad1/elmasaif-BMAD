'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminSessionUser } from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: () => {},
      replace: () => {},
      refresh: () => {},
      back: () => {},
      forward: () => {},
      prefetch: () => {},
    };
  }
}

function useSafePathname(): string {
  try {
    return usePathname() || '';
  } catch {
    return '';
  }
}

export interface AdminAuthContextType {
  admin: AdminSessionUser | null;
  isLoading: boolean;
  logoutAdmin: () => Promise<void>;
  refreshAdminSession: () => Promise<void>;
  setSessionAdmin: (admin: AdminSessionUser | null) => void;
  hasPermission: (permission: string) => boolean;
}

export const AdminAuthContext = createContext<AdminAuthContextType>({
  admin: null,
  isLoading: true,
  logoutAdmin: async () => {},
  refreshAdminSession: async () => {},
  setSessionAdmin: () => {},
  hasPermission: () => false,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useSafeRouter();
  const pathname = useSafePathname();

  const isPublicAdminAuthRoute =
    pathname.startsWith('/admin/login') || pathname.startsWith('/admin/reset-password');

  const refreshAdminSession = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        code: string;
        data: { admin: AdminSessionUser };
      }>('/admin/auth/me');

      if (response?.data?.admin) {
        setAdmin(response.data.admin);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPublicAdminAuthRoute) {
      setIsLoading(false);
      return;
    }
    refreshAdminSession();
  }, [isPublicAdminAuthRoute, refreshAdminSession]);

  const setSessionAdmin = useCallback((nextAdmin: AdminSessionUser | null) => {
    setAdmin(nextAdmin);
    setIsLoading(false);
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await apiClient.post('/admin/auth/logout');
    } catch {
      // Ignore logout transport errors
    } finally {
      setAdmin(null);
      router.push('/admin/login');
    }
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!admin?.permissions) return false;
      return admin.permissions.includes(permission);
    },
    [admin]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isLoading,
        logoutAdmin,
        refreshAdminSession,
        setSessionAdmin,
        hasPermission,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  return useContext(AdminAuthContext);
}

