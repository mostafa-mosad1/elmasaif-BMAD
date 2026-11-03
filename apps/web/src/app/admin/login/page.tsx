import React from 'react';
import { AdminLoginForm } from '../../../components/admin/admin-login-form';

export default function AdminLoginPage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-surface-sunken dark:bg-dark-surface"
    >
      <AdminLoginForm />
    </main>
  );
}

