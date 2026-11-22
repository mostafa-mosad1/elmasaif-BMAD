'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IdentityStatusResponse, UserRole, SessionUser, UserProfileSummary } from '@elmasaif/shared';
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
      prefetch: () => {}
    };
  }
}

export interface AuthContextType {
  user: SessionUser | null;
  activeRole: UserRole;
  profiles: UserProfileSummary[];
  identityStatus: IdentityStatusResponse | null;
  isLoading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  attachOwnerRole: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshIdentityStatus: () => Promise<IdentityStatusResponse>;
  setSessionUser: (user: SessionUser) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  activeRole: UserRole.BUYER,
  profiles: [],
  identityStatus: null,
  isLoading: true,
  switchRole: async () => {},
  attachOwnerRole: async () => {},
  logout: async () => {},
  refreshSession: async () => {},
  refreshIdentityStatus: async () => {
    throw new Error('AuthProvider is not available');
  },
  setSessionUser: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.BUYER);
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([]);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useSafeRouter();

  const refreshIdentityStatus = useCallback(async () => {
    const response = await apiClient.get<{ data: IdentityStatusResponse }>('/users/identity');
    setIdentityStatus(response.data);
    return response.data;
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        code: string;
        data: { user: SessionUser };
      }>('/auth/me');

      if (response?.data?.user) {
        const u = response.data.user;
        setUser(u);
        let resolvedRole = (u.activeRole as UserRole) || (u.role as UserRole);
        if ((!resolvedRole || resolvedRole === UserRole.BUYER) && typeof window !== 'undefined' && u.id) {
          const stored = localStorage.getItem(`elmasaif_default_role_${u.id}`) as UserRole;
          if (stored && ['BUYER', 'OWNER', 'MARKETER'].includes(stored)) {
            const hasProfile = stored === UserRole.BUYER || u.profiles?.some((p) => p.role === stored);
            if (hasProfile) {
              resolvedRole = stored;
            }
          }
        }
        resolvedRole = resolvedRole || UserRole.BUYER;
        setActiveRole(resolvedRole);
        setProfiles(u.profiles || []);
      } else {
        setUser(null);
        setActiveRole(UserRole.BUYER);
        setProfiles([]);
        setIdentityStatus(null);
      }
    } catch {
      setUser(null);
      setActiveRole(UserRole.BUYER);
      setProfiles([]);
      setIdentityStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const setSessionUser = useCallback((newUser: SessionUser) => {
    setUser(newUser);
    let resolvedRole = (newUser.activeRole as UserRole) || (newUser.role as UserRole);
    if ((!resolvedRole || resolvedRole === UserRole.BUYER) && typeof window !== 'undefined' && newUser.id) {
      const stored = localStorage.getItem(`elmasaif_default_role_${newUser.id}`) as UserRole;
      if (stored && ['BUYER', 'OWNER', 'MARKETER'].includes(stored)) {
        const hasProfile = stored === UserRole.BUYER || newUser.profiles?.some((p) => p.role === stored);
        if (hasProfile) {
          resolvedRole = stored;
        }
      }
    }
    resolvedRole = resolvedRole || UserRole.BUYER;
    setActiveRole(resolvedRole);
    setProfiles(newUser.profiles || []);
    setIsLoading(false);
  }, []);

  const switchRole = useCallback(
    async (targetRole: UserRole) => {
      const response = await apiClient.post<{
        code: string;
        message: string;
        data: { user: SessionUser };
      }>('/users/profiles/switch', { role: targetRole });

      if (response?.data?.user) {
        const u = response.data.user;
        setUser(u);
        setActiveRole(targetRole);
        setProfiles(u.profiles || []);
        router.push(`/app/${targetRole.toLowerCase()}`);
      }
    },
    [router]
  );

  const attachOwnerRole = useCallback(async () => {
    await apiClient.post('/users/profiles/attach-owner');
    await switchRole(UserRole.OWNER);
  }, [switchRole]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setActiveRole(UserRole.BUYER);
      setProfiles([]);
      setIdentityStatus(null);
      router.push('/');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        profiles,
        identityStatus,
        isLoading,
        switchRole,
        attachOwnerRole,
        logout,
        refreshSession,
        refreshIdentityStatus,
        setSessionUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
