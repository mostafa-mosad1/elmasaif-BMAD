import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Smartphone, ChevronLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { PhoneChangeWizard } from '../../../../components/auth/phone-change-wizard';

export const metadata: Metadata = {
  title: 'رقم الجوال المعتمد | منصة المصايف',
  description: 'تحديث رقم الجوال المعتمد لحسابك مع التحقق الأمني المزدوج'
};

export default function MobileSettingsPage() {
  return (
    <div dir="rtl" className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-ink-secondary dark:text-dark-ink-secondary"
      >
        <Link href="/app/settings/profile" className="hover:text-primary transition-colors">
          الإعدادات
        </Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
          رقم الجوال المعتمد
        </span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2.5">
          <Smartphone className="w-6 h-6 text-primary" />
          رقم الجوال المعتمد
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إدارة وتحديث رقم هاتفك المعتمد لتسجيل الدخول، واستلام إشعارات الصفقات ورموز التحقق.
        </p>
      </header>

      {/* Main Wizard Card */}
      <Card className="border-surface-border dark:border-dark-surface-border shadow-level1">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
            تحديث رقم الجوال عبر التحقق الثنائي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PhoneChangeWizard />
        </CardContent>
      </Card>
    </div>
  );
}

