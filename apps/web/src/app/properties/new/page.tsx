'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PropertiesNewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/listings/new');
  }, [router]);
  return null;
}
