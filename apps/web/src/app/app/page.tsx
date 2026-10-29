'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/providers/auth-provider';

export default function WorkspaceIndexPage() {
  const { activeRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      const target = activeRole ? activeRole.toLowerCase() : 'buyer';
      router.replace(`/app/${target}`);
    }
  }, [activeRole, isLoading, router]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
