'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, SessionUser, UserProfileSummary } from '@elmasaif/shared';
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
  isLoading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  attachOwnerRole: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  activeRole: UserRole.BUYER,
  profiles: [],
  isLoading: true,
  switchRole: async () => {},
  attachOwnerRole: async () => {},
  logout: async () => {},
  refreshSession: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.BUYER);
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useSafeRouter();

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiClient.get<{
        code: string;
        data: { user: SessionUser };
      }>('/auth/me');

      if (response?.data?.user) {
        const u = response.data.user;
        setUser(u);
        const resolvedRole = (u.activeRole as UserRole) || (u.role as UserRole) || UserRole.BUYER;
        setActiveRole(resolvedRole);
        setProfiles(u.profiles || []);
      } else {
        setUser(null);
        setActiveRole(UserRole.BUYER);
        setProfiles([]);
      }
    } catch {
      setUser(null);
      setActiveRole(UserRole.BUYER);
      setProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

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
      router.push('/');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        profiles,
        isLoading,
        switchRole,
        attachOwnerRole,
        logout,
        refreshSession
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
