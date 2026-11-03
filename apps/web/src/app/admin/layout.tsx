'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceShell } from '../../components/layout/workspace-shell';
import { AdminAuthProvider } from '../../components/providers/admin-auth-provider';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';

  const isStandaloneAdminAuthRoute =
    pathname.startsWith('/admin/login') || pathname.startsWith('/admin/reset-password');

  if (isStandaloneAdminAuthRoute) {
    return <>{children}</>;
  }

  return <WorkspaceShell>{children}</WorkspaceShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminAuthProvider>
  );
}
