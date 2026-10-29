'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/providers/auth-provider';
import { WorkspaceShell } from '../../components/layout/workspace-shell';

export default function AppWorkspaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login?redirect=/app');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-sunken dark:bg-dark-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
            جاري تهيئة مساحة العمل...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
