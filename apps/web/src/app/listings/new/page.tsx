'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../components/providers/auth-provider';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { UserRole } from '@elmasaif/shared';
import {
  Building2,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  LogIn,
} from 'lucide-react';

export default function NewListingRouteHandler() {
  const router = useRouter();
  const { user, activeRole, profiles, isLoading, attachOwnerRole } = useAuth();
  const [attachingRole, setAttachingRole] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // 1. If not logged in, redirect to login with return redirect
    if (!user) {
      const loginUrl = `/auth/login?redirect=${encodeURIComponent('/listings/new')}`;
      router.replace(loginUrl);
      return;
    }

    // 2. If logged in as Marketer or has Marketer profile
    if (activeRole === UserRole.MARKETER || profiles?.some((p) => p.role === UserRole.MARKETER)) {
      router.replace('/app/marketer/listings/new');
      return;
    }

    // 3. If logged in as Owner or has Owner profile
    if (activeRole === UserRole.OWNER || profiles?.some((p) => p.role === UserRole.OWNER)) {
      router.replace('/app/owner/listings/new');
      return;
    }
  }, [user, activeRole, profiles, isLoading, router]);

  const handleChooseOwner = async () => {
    try {
      setAttachingRole(true);
      await attachOwnerRole();
      router.replace('/app/owner/listings/new');
    } catch {
      // Fallback direct navigation
      router.replace('/app/owner/listings/new');
    } finally {
      setAttachingRole(false);
    }
  };

  const handleChooseMarketer = () => {
    router.replace('/app/marketer/listings/new');
  };

  // Loading state
  if (isLoading) {
    return (
      <LayoutShell>
        <div className="py-20 text-center space-y-4" dir="rtl">
          <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
          <p className="text-sm font-bold text-ink-secondary dark:text-dark-ink-secondary">
            جارٍ التحقق من حسابك وصلاحيات إضافة العقار...
          </p>
        </div>
      </LayoutShell>
    );
  }

  // Not logged in (instant redirect fallback card)
  if (!user) {
    return (
      <LayoutShell>
        <div className="py-16 max-w-md mx-auto text-center space-y-6" dir="rtl">
          <div className="w-16 h-16 rounded-3xl bg-accent/15 text-accent flex items-center justify-center mx-auto shadow-xs">
            <LogIn className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary">
              تسجيل الدخول مطلوب لإضافة العقار
            </h1>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              وفق أنظمة الهيئة العامة للعقار (REGA)، يتطلب نشر أي عقار التحقق المسبق من هوية المالك أو رخصة فال للوسيط.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={`/auth/login?redirect=${encodeURIComponent('/listings/new')}`}
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-accent dark:hover:bg-accent-hover text-white dark:text-slate-950 font-bold text-sm shadow-xs transition-all"
            >
              <span>تسجيل الدخول والمتابعة</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </LayoutShell>
    );
  }

  // User is logged in as BUYER only: present choice to list as Owner or Marketer
  return (
    <LayoutShell>
      <div className="py-12 sm:py-16 max-w-2xl mx-auto space-y-8" dir="rtl">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>نظام الإدراج المعتمد • رخص فال وصكوك إلكترونية</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-ink-primary dark:text-dark-ink-primary tracking-tight">
            بأي صفة ترغب في إضافة هذا العقار؟
          </h1>

          <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-lg mx-auto leading-relaxed">
            مرحباً {user.fullName || user.username}، يرجى تحديد صفتك للبدء في معالج إضافة العقار وتدقيق المستندات الرسمية.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Owner */}
          <button
            type="button"
            onClick={handleChooseOwner}
            disabled={attachingRole}
            className="p-6 rounded-3xl bg-surface dark:bg-dark-surface-raised border-2 border-surface-border dark:border-dark-surface-border hover:border-accent dark:hover:border-accent text-start space-y-4 group transition-all duration-200 hover:shadow-level2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-black text-ink-primary dark:text-dark-ink-primary group-hover:text-accent transition-colors">
                أنا مالك العقار
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                لديك صك ملكية إلكتروني وترغب في عرض عقارك للبيع مباشرة أو تفويض مسوق معتمد.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-accent">
              <span>{attachingRole ? 'جارٍ التفعيل...' : 'المتابعة كمالك عقار'}</span>
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            </div>
          </button>

          {/* Option 2: Licensed Marketer */}
          <button
            type="button"
            onClick={handleChooseMarketer}
            className="p-6 rounded-3xl bg-surface dark:bg-dark-surface-raised border-2 border-surface-border dark:border-dark-surface-border hover:border-accent dark:hover:border-accent text-start space-y-4 group transition-all duration-200 hover:shadow-level2 cursor-pointer focus:outline-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
              <Briefcase className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-black text-ink-primary dark:text-dark-ink-primary group-hover:text-accent transition-colors">
                أنا وسيط عقاري مرخص (فال)
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                لديك رخصة فال سارية وترخيص إعلاني معتمد من الهيئة العامة للعقار لتسويق العقار.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-accent">
              <span>المتابعة كوسيط معتمد</span>
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            </div>
          </button>
        </div>

        <div className="text-center pt-4">
          <Link
            href="/properties"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة إلى تصفح العقارات</span>
          </Link>
        </div>
      </div>
    </LayoutShell>
  );
}
