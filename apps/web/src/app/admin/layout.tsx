'use client';

import React from 'react';
import { WorkspaceShell } from '../../components/layout/workspace-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

