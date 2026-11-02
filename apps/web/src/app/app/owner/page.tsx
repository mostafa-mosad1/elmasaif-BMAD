'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { PlusCircle, FileText, CreditCard, ArrowLeft, Building } from 'lucide-react';

export default function OwnerDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
              لوحة تحكم المالك
            </h1>
            <Badge variant="verified" size="sm">
              مالك مباشر
            </Badge>
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
            إدارة عروض العقارات المباشرة، وتوقيع عقود الوساطة الإلكترونية، ومتابعة الحسابات البنكية.
          </p>
        </div>

        <Link href="/app/owner/listings/new">
          <Button variant="primary" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            <span>طلب عرض عقار مباشر</span>
          </Button>
        </Link>
      </div>

      {/* Owner Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Direct Listing Request CTA Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mb-2">
              <Building className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold">عرض عقار للبيع أو الإيجار</CardTitle>
            <CardDescription className="text-xs">
              أرسل بيانات عقارك ليتولى فريق المنصة فحص الصك وصياغة العقد المعتمد.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/owner/listings/new">
              <Button variant="primary" size="sm" className="w-full gap-2">
                <span>تقديم طلب عرض مباشر</span>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Electronic Contracts Overview */}
        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center mb-2">
              <FileText className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold">عقود الوساطة الإلكترونية</CardTitle>
            <CardDescription className="text-xs">
              عقود وساطة نظامية ملزمة معتمدة من الهيئة العامة للعقار.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary pb-3">
              <span>العقود النشطة:</span>
              <span className="font-bold font-mono text-sm">0</span>
            </div>
            <Link href="/app/owner/contracts">
              <Button variant="secondary" size="sm" className="w-full">
                استعراض العقود
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Payout IBAN Status */}
        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5" />
            </div>
            <CardTitle className="text-base font-bold">حساب التحويل البنكي (IBAN)</CardTitle>
            <CardDescription className="text-xs">
              الحساب البنكي المعتمد لاستلام مبالغ صفقات البيع عند الإتمام.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="pending" size="sm">
                لم يتم تسجيل الآيبان
              </Badge>
            </div>
            <Link href="/app/settings/payout">
              <Button variant="outline" size="sm" className="w-full">
                إضافة حساب بنكي
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      <Card>
        <CardContent className="p-6">
          <EmptyState
            title="لا توجد عقارات مدرجة حالياً"
            description="لم تقم بإرسال أي طلبات لعرض عقاراتك حتى الآن. ابدأ بطلب عرض مباشر لربط عقارك بالمشترين المؤهلين."
            icon={<Building className="w-7 h-7" />}
            actionLabel="طلب عرض عقار مباشر"
            actionHref="/app/owner/listings/new"
          />
        </CardContent>
      </Card>
    </div>
  );
}
