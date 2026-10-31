import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldCheck, ChevronLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { ChangePasswordForm } from '../../../../components/auth/change-password-form';

export const metadata: Metadata = {
  title: 'كلمة المرور والأمان | منصة المصايف',
  description: 'إدارة كلمة المرور وتأمين حسابك وجلساتك النشطة'
};

export default function PasswordSettingsPage() {
  return (
    <div dir="rtl" className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-secondary dark:text-dark-ink-secondary">
        <Link href="/app/settings/profile" className="hover:text-primary transition-colors">
          الإعدادات
        </Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
          كلمة المرور والأمان
        </span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-primary" />
          كلمة المرور والأمان
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إدارة وتحديث كلمة المرور لتأمين حسابك والتحكم في الجلسات النشطة.
        </p>
      </header>

      {/* Main Card */}
      <Card className="border-surface-border dark:border-dark-surface-border shadow-level1">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
            تغيير كلمة المرور
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

