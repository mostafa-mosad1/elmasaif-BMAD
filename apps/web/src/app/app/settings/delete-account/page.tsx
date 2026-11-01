import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldAlert, ChevronLeft } from 'lucide-react';
import { AccountDeletionWizard } from '../../../../components/auth/account-deletion-wizard';

export const metadata: Metadata = {
  title: 'حذف الحساب والامتثال لنظام PDPL | منصة المصايف',
  description: 'طلب حذف الحساب الشخصي والامتثال لنظام حماية البيانات الشخصية السعودي'
};

export default function DeleteAccountPage() {
  return (
    <div dir="rtl" className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-ink-secondary dark:text-dark-ink-secondary"
      >
        <Link href="/app" className="hover:text-primary transition-colors">
          لوحة التحكم
        </Link>
        <ChevronLeft className="w-4 h-4" />
        <Link href="/app/settings/profile" className="hover:text-primary transition-colors">
          إعدادات الحساب
        </Link>
        <ChevronLeft className="w-4 h-4" />
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          حذف الحساب
        </span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          حذف الحساب والامتثال لنظام حماية البيانات الشخصية (PDPL)
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إجراءات تقديم طلب الحذف النظامي أو تعطيل الحساب وفقاً للأنظمة واللوائح السعودية.
        </p>
      </header>

      {/* Main Wizard */}
      <AccountDeletionWizard />
    </div>
  );
}

