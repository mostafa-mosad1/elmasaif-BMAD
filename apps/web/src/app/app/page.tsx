'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/providers/auth-provider';

export default function WorkspaceIndexPage() {
  const { user, activeRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      let resolved = activeRole ? activeRole.toLowerCase() : '';
      if (!resolved && user?.id && typeof window !== 'undefined') {
        const stored = localStorage.getItem(`elmasaif_default_role_${user.id}`);
        if (stored && ['BUYER', 'OWNER', 'MARKETER'].includes(stored)) {
          resolved = stored.toLowerCase();
        }
      }
      const target = resolved || 'buyer';
      router.replace(`/app/${target}`);
    }
  }, [user, activeRole, isLoading, router]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
