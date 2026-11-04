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

export default function BuyerDashboardPage() {
  const { identityStatus, refreshIdentityStatus } = useAuth();
  const [identityPromptDismissed, setIdentityPromptDismissed] = useState(false);
  const [identityStatusError, setIdentityStatusError] = useState<string | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    // Dashboard must never break on a favorites failure — silent catch keeps 0.
    apiClient
      .get('/listings/favorites')
      .then((payload) => setFavoritesCount(unwrapFavoritesPayload(payload).length))
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
      count: 0,
      description: 'عروض شراء قيد التفاوض والمراجعة',
      icon: HandCoins,
      href: '/app/buyer/offers'
    },
    {
      title: 'العقارات المفضلة',
      count: favoritesCount,
      description: 'عقارات محفوظة للمتابعة السريعة',
      icon: Heart,
      href: '/app/buyer/favorites'
    },
    {
      title: 'طلبات الشراء النشطة',
      count: 0,
      description: 'طلبات عقارية مسجلة لمطابقة السوق',
      icon: FileQuestion,
      href: '/app/buyer/demands'
    }
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
            <Link key={s.title} href={s.href} className="group">
              <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-ink-secondary dark:text-dark-ink-secondary">
                    {s.title}
                  </CardTitle>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {s.count}
                  </div>
                  <p className="text-xs text-ink-muted dark:text-dark-ink-muted mt-1">
                    {s.description}
                  </p>
                </CardContent>
              </Card>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
