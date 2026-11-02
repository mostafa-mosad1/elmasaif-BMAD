import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Sliders, ChevronLeft } from 'lucide-react';
import { PreferencesEditor } from '../../../../components/settings/preferences-editor';

export const metadata: Metadata = {
  title: 'تفضيلات العرض والمظهر والإشعارات | منصة المصايف',
  description: 'إدارة لغة الواجهة، نمط المظهر والألوان، وقنوات وتنبيهات الإشعارات'
};

export default function PreferencesSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-ink-secondary dark:text-dark-ink-secondary"
      >
        <Link href="/app" className="hover:text-primary transition-colors">
          لوحة التحكم
        </Link>
        <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        <Link href="/app/settings/profile" className="hover:text-primary transition-colors">
          إعدادات الحساب
        </Link>
        <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        <span className="font-semibold text-primary dark:text-primary-light">
          التفضيلات والمظهر
        </span>
      </nav>

      {/* Page Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-primary" />
          تفضيلات العرض والمظهر والإشعارات
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          تخصيص لغة الواجهة، النمط البصري، وقنوات الإشعارات التشغيلية والتسويقية مع الحفاظ على التنبيهات الإلزامية.
        </p>
      </header>

      {/* Main Preferences Form Editor */}
      <section aria-labelledby="preferences-editor-section">
        <PreferencesEditor />
      </section>
    </div>
  );
}

