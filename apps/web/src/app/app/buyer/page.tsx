'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { HandCoins, Heart, FileQuestion, Search, ArrowLeft, Building2, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../../components/providers/auth-provider';
import { apiClient } from '../../../lib/api-client';
import { unwrapFavoritesPayload } from '../../../components/listings';
import { unwrapDemandsPayload } from '../../../components/demands';
import { countActiveOffers, unwrapOffersPayload } from '../../../components/offers';
import { DemandStatus } from '@elmasaif/shared';

export default function BuyerDashboardPage() {
  const { identityStatus, refreshIdentityStatus } = useAuth();
  const [identityPromptDismissed, setIdentityPromptDismissed] = useState(false);
  const [identityStatusError, setIdentityStatusError] = useState<string | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [demandsCount, setDemandsCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);

  useEffect(() => {
    // Dashboard must never break on a demands failure — silent catch keeps 0.
    apiClient
      .get('/demands/my')
      .then((payload) =>
        setDemandsCount(
          unwrapDemandsPayload(payload).filter((demand) => demand.status === DemandStatus.ACTIVE)
            .length,
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Dashboard must never break on a favorites failure — silent catch keeps 0.
    apiClient
      .get('/listings/favorites')
      .then((payload) => setFavoritesCount(unwrapFavoritesPayload(payload).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Dashboard must never break on an offers failure — silent catch keeps 0.
    apiClient
      .get('/offers/my')
      .then((payload) => setOffersCount(countActiveOffers(unwrapOffersPayload(payload))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshIdentityStatus().catch((error: unknown) => {
      setIdentityStatusError(
        error instanceof Error ? error.message : 'تعذر التحقق من حالة الهوية حالياً.'
      );
    });
  }, [refreshIdentityStatus]);

  const stats = [
    {
      title: 'عروضي النشطة',
      count: offersCount,
      description: 'عروض شراء قيد التفاوض والمراجعة',
      icon: HandCoins,
      href: '/app/buyer/offers',
      badge: 'العروض المالية',
      badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      accentGlow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      hoverBorder: 'group-hover:border-emerald-500/40',
      actionText: 'متابعة العروض',
    },
    {
      title: 'العقارات المفضلة',
      count: favoritesCount,
      description: 'عقارات محفوظة للمتابعة السريعة',
      icon: Heart,
      href: '/app/buyer/favorites',
      badge: 'قائمة الرغبات',
      badgeColor: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      iconColor: 'text-rose-500 dark:text-rose-400',
      iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
      accentGlow: 'from-rose-500/15 via-rose-500/5 to-transparent',
      hoverBorder: 'group-hover:border-rose-500/40',
      actionText: 'استعراض المفضلة',
    },
    {
      title: 'طلبات الشراء النشطة',
      count: demandsCount,
      description: 'طلبات عقارية مسجلة لمطابقة السوق',
      icon: FileQuestion,
      href: '/app/buyer/demands',
      badge: 'المطابقة الذكية',
      badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      accentGlow: 'from-amber-500/15 via-amber-500/5 to-transparent',
      hoverBorder: 'group-hover:border-amber-500/40',
      actionText: 'إدارة الطلبات',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              لوحة تحكم المشتري
            </h1>
            <Badge variant="verified" size="sm">
              حساب نشط
            </Badge>
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            تابع عروضك العقارية، وقوائم المفضلة، واستكشف الصفقات المتاحة والمطابقة لاحتياجاتك.
          </p>
        </div>

        <Link href="/">
          <Button variant="primary" className="gap-2">
            <Search className="w-4 h-4" />
            <span>تصفح الصفقات العقارية</span>
          </Button>
        </Link>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.title} href={s.href} className="group block focus:outline-none">
              <div
                className={`relative overflow-hidden rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${s.hoverBorder} flex flex-col justify-between h-full`}
              >
                {/* Decorative radial gradient glow in the corner */}
                <div
                  className={`pointer-events-none absolute -top-14 -left-14 h-36 w-36 rounded-full bg-gradient-to-br ${s.accentGlow} blur-2xl transition-transform duration-500 group-hover:scale-125`}
                />

                {/* Subtle watermark icon in the background to fill empty space */}
                <div className="pointer-events-none absolute -bottom-4 -left-4 opacity-5 dark:opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                  <Icon className="w-32 h-32 text-current" />
                </div>

                {/* Top Row: Icon + Category Badge */}
                <div className="relative z-10 flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-xl ${s.iconBg} ${s.iconColor} flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s.badgeColor}`}
                  >
                    {s.badge}
                  </span>
                </div>

                {/* Middle Content: Big Number + Title + Description */}
                <div className="relative z-10 my-5 space-y-1.5">
                  <div className="text-4xl font-black font-mono tracking-tight text-ink-primary dark:text-dark-ink-primary">
                    {s.count}
                  </div>
                  <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    {s.title}
                  </h3>
                  <p className="text-xs text-ink-muted dark:text-dark-ink-muted leading-relaxed">
                    {s.description}
                  </p>
                </div>

                {/* Interactive Footer: Action link with animated slide arrow */}
                <div className="relative z-10 pt-3 border-t border-surface-border/70 dark:border-dark-surface-border/70 flex items-center justify-between text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary group-hover:text-primary transition-colors">
                  <span>{s.actionText}</span>
                  <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {identityStatusError && (
        <div role="alert" className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-4 text-sm text-status-rejected">
          تعذر تحميل حالة توثيق الهوية: {identityStatusError}
        </div>
      )}

      {identityStatus && !identityStatus.canUploadDealPaymentProof && !identityPromptDismissed && (
        <section className="relative rounded-xl border border-[#C69C45]/30 bg-[#C69C45]/10 p-5 pe-12" role="status">
          <button
            type="button"
            className="absolute end-3 top-3 rounded p-1 text-ink-muted hover:bg-black/5"
            onClick={() => setIdentityPromptDismissed(true)}
            aria-label="إخفاء تنبيه توثيق الهوية"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C69C45]" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="font-bold text-ink-primary dark:text-dark-ink-primary">
                أكمل توثيق هويتك لتفعيل إثباتات الدفع
              </h2>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                يلزم رفع وثيقة هوية نظيفة قبل تقديم إثباتات الدفع للصفقات.
              </p>
              <Link href="/app/settings/identity" className="inline-flex text-sm font-semibold text-primary underline">
                الانتقال إلى توثيق الهوية
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Quick Search Shortcut Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Building2 className="w-4 h-4" />
              <span>البحث الذكي في الصفقات العقارية المعتمدة</span>
            </div>
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
              ابحث عن عقارك المثالي في الطائف ومصايف المملكة
            </h2>
            <p className="text-xs text-ink-muted dark:text-dark-ink-muted max-w-xl">
              تصفح العقارات الموثقة والمفحوصة صكوكها، وقدم عروضك مباشرة مع ضمانات منصة المصايف النظامية.
            </p>
          </div>
          <Link href="/">
            <Button variant="secondary" className="gap-2 shrink-0">
              <span>استعراض الخريطة التفاعلية</span>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Empty State CTA for Offers */}
      <Card>
        <CardContent className="p-6">
          <EmptyState
            title="لا توجد عروض شراء نشطة حالياً"
            description="لم تقم بتقديم أي عروض شراء حتى الآن. تصفح الصفقات العقارية المعروضة وقدم أول عرض للتفاوض المباشر."
            icon={<HandCoins className="w-7 h-7" />}
            actionLabel="تصفح العقارات المتاحة"
            actionHref="/"
            secondaryActionLabel="متابعة عروضي"
            secondaryActionHref="/app/buyer/offers"
          />
        </CardContent>
      </Card>
    </div>
  );
}
