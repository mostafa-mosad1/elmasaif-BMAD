'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminResetPasswordForm } from '../../../components/admin/admin-reset-password-form';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  return <AdminResetPasswordForm token={token} />;
}

export default function AdminResetPasswordPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-surface-sunken dark:bg-dark-surface"
    >
      <Suspense fallback={<div className="text-sm text-ink-secondary">جاري التحميل...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
