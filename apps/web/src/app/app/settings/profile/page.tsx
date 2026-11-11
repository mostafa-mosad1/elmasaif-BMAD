import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  KeyRound,
  Smartphone,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { ProfileEditor } from '../../../../components/auth/profile-editor';

export default function ProfileSettingsPage() {
  const settingSections = [
    {
      title: 'التفضيلات والمظهر والإشعارات',
      description: 'تخصيص لغة الواجهة، النمط البصري (فاتح/داكن/نظام)، وتفضيلات قنوات الإشعارات.',
      icon: Sliders,
      href: '/app/settings/preferences',
      buttonText: 'تعديل التفضيلات',
      buttonVariant: 'outline' as const,
      iconColor: 'text-primary dark:text-primary-light',
      iconBg: 'bg-primary/10 dark:bg-primary/20',
    },
    {
      title: 'رقم الجوال المعتمد',
      description: 'تحديث رقم الجوال المسجل بحسابك عبر التحقق المزدوج الآمن.',
      icon: Smartphone,
      href: '/app/settings/mobile',
      buttonText: 'تحديث رقم الجوال',
      buttonVariant: 'outline' as const,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    },
    {
      title: 'كلمة المرور والأمان',
      description: 'تغيير كلمة المرور وتأمين حسابك وإدارة الجلسات النشطة عبر الأجهزة.',
      icon: KeyRound,
      href: '/app/settings/password',
      buttonText: 'إدارة كلمة المرور',
      buttonVariant: 'outline' as const,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    },
    {
      title: 'التحقق من الهوية',
      description: 'ارفع هويتك الوطنية أو الإقامة لإتمام التعاملات المالية في المنصة.',
      icon: ShieldCheck,
      href: '/app/settings/identity',
      buttonText: 'توثيق الهوية',
      buttonVariant: 'primary' as const,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    },
    {
      title: 'حسابات التحويل البنكي (IBAN)',
      description: 'إدارة وتوثيق حسابات الآيبان السعودية المعتمدة لاستلام عوائد المبيعات والسعي العقاري.',
      icon: Building2,
      href: '/app/settings/payout',
      buttonText: 'إدارة الحسابات البنكية',
      buttonVariant: 'outline' as const,
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    },
    {
      title: 'منطقة الحذف والأمان (PDPL)',
      description: 'تقديم طلب حذف الحساب أو تعطيله نظامياً مع مهلة 14 يوماً وفق متطلبات نظام حماية البيانات الشخصية.',
      icon: ShieldAlert,
      href: '/app/settings/delete-account',
      buttonText: 'إجراءات حذف الحساب',
      buttonVariant: 'outline' as const,
      isDanger: true,
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    },
  ];

  return (
    <div dir="rtl" className="space-y-8">
      {/* Breadcrumbs & Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-2 text-xs text-ink-muted mb-2" aria-label="Breadcrumb">
          <Link href="/app" className="hover:text-primary transition font-medium">
            لوحة التحكم
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">إعدادات الحساب</span>
          <span>/</span>
          <span className="text-ink-primary dark:text-dark-ink-primary font-bold">البيانات الشخصية</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
          إعدادات الحساب
        </h1>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إدارة الاسم والبريد الإلكتروني والبيانات المعتمدة والمتطلبات النظامية.
        </p>
      </div>

      {/* Main Profile Editor Form Card */}
      <section aria-labelledby="profile-editor-heading">
        <ProfileEditor />
      </section>

      {/* Preserved Sub-navigation Cards */}
      <section className="space-y-5 pt-6 border-t border-surface-border dark:border-dark-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
              إجراءات الأمان والتحقق والخدمات المالية والتفضيلات
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              إدارة وسائل الأمان والتوثيق والمدفوعات الخاصة بحسابك
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {settingSections.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`rounded-2xl border ${
                  item.isDanger
                    ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base'
                } p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3
                      className={`text-base font-bold ${
                        item.isDanger
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-ink-primary dark:text-dark-ink-primary'
                      }`}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed mb-5">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-surface-border/60 dark:border-dark-surface-border/60">
                  <Link href={item.href} className="inline-block w-full sm:w-auto">
                    <Button
                      variant={item.buttonVariant}
                      className={`gap-2 w-full sm:w-auto text-xs ${
                        item.isDanger
                          ? 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300'
                          : ''
                      }`}
                    >
                      <span>{item.buttonText}</span>
                      <ArrowLeft
                        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1"
                        aria-hidden="true"
                      />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
