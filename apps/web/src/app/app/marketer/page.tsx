'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { ShieldCheck, Building, PlusCircle, MessageSquare, TrendingUp } from 'lucide-react';

export default function MarketerDashboardPage() {
  const stats = [
    {
      title: 'العقارات المعروضة',
      count: 0,
      description: 'عقارات نشطة ومعتمدة في المنصة',
      icon: Building,
      href: '/app/marketer/listings'
    },
    {
      title: 'استفسارات المشترين',
      count: 0,
      description: 'استفسارات واردة عبر نظام الوساطة',
      icon: MessageSquare,
      href: '/app/marketer/inquiries'
    },
    {
      title: 'الصفقات المكتملة',
      count: 0,
      description: 'صفقات تم إغلاقها وصرف العمولات',
      icon: TrendingUp,
      href: '/app/settings/payout'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              لوحة تحكم الوسيط العقاري
            </h1>
            <Badge variant="verified" size="sm" className="gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>مرخص من فال (REGA)</span>
            </Badge>
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            إدارة وتوثيق العقارات المسوقة، واستقبال طلبات المشترين، ومتابعة عمولات الوساطة.
          </p>
        </div>

        <Link href="/app/marketer/listings/new">
          <Button variant="primary" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            <span>إضافة عقار جديد</span>
          </Button>
        </Link>
      </div>

      {/* Fal License Status Alert Card */}
      <Card className="bg-[#C69C45]/10 border-[#C69C45]/30">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#C69C45]/20 text-[#9A7328] dark:text-[#E0B865] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                رخصة فال للوساطة والتسويق العقاري معتمدة
              </div>
              <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
                حسابك مؤهل نظامياً لإضافة العقارات واستقبال عروض المشترين وفق ضوابط الهيئة العامة للعقار.
              </p>
            </div>
          </div>
          <Link href="/app/marketer/fal-license">
            <Button variant="outline" size="sm" className="border-[#C69C45]/40 text-xs shrink-0">
              تفاصيل الرخصة
            </Button>
          </Link>
        </CardContent>
      </Card>

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

      {/* Empty State */}
      <Card>
        <CardContent className="p-6">
          <EmptyState
            title="لا توجد عقارات مضافة في محفظتك"
            description="ابدأ بإضافة أول عقار مسوق لديك، مع إرفاق ترخيص الإعلان وبيانات الصك للنشر المباشر."
            icon={<Building className="w-7 h-7" />}
            actionLabel="إضافة عقار جديد"
            actionHref="/app/marketer/listings/new"
          />
        </CardContent>
      </Card>
    </div>
  );
}
