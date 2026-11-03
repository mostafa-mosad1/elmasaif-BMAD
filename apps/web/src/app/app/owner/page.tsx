'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  PlusCircle,
  FileText,
  CreditCard,
  ArrowLeft,
  Building,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { ListingStatus, PropertyType } from '@elmasaif/shared';
import { apiClient } from '../../../lib/api-client';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

export default function OwnerDashboardPage() {
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ statusCode: number; data: { items: any[] } }>('/listings/my')
      .then((res) => {
        if (res?.data?.items) {
          setMyListings(res.data.items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
              <span>العقارات المعتمدة والمنشورة:</span>
              <span className="font-bold font-mono text-sm">
                {myListings.filter((l) => l.status === ListingStatus.ACTIVE).length}
              </span>
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
              <Badge variant="verified" size="sm">
                إدارة حسابات الآيبان
              </Badge>
            </div>
            <Link href="/app/settings/payout">
              <Button variant="outline" size="sm" className="w-full">
                إدارة الحساب البنكي
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Owner Submitted Listings & Moderation Status */}
      {myListings.length > 0 ? (
        <Card>
          <CardHeader className="border-b border-surface-border dark:border-dark-surface-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">
                  عقاراتي وحالة المراجعة الإدارية ({myListings.length})
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  تابع حالة عقاراتك المقدمة للمنصة (معتمدة ومنشورة، بانتظار المراجعة، أو مرفوضة مع الملاحظات).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-surface-border dark:divide-dark-surface-border p-0">
            {myListings.map((item) => (
              <div key={item.id} className="p-5 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">
                        {PROPERTY_TYPE_LABELS[item.propertyType] || item.propertyType}
                      </span>
                      <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                        {item.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-secondary">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span>{`${item.cityName} — حي ${item.districtName}`}</span>
                      <span>•</span>
                      <span className="font-mono">{`${item.areaSquareMeters} م²`}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div dir="ltr" className="font-mono font-bold text-sm text-[#1B4332] dark:text-emerald-400">
                      {`${Number(item.askPrice).toLocaleString('en-US')} SAR`}
                    </div>

                    {item.status === ListingStatus.ACTIVE ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>معتمد ومنشور في السوق</span>
                      </span>
                    ) : item.status === ListingStatus.REJECTED ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>مرفوض من الإدارة</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>بانتظار المراجعة الإدارية</span>
                      </span>
                    )}

                    {item.status === ListingStatus.ACTIVE && (
                      <Link
                        href="/#listings"
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>مشاهدة في السوق</span>
                      </Link>
                    )}
                  </div>
                </div>

                {item.status === ListingStatus.REJECTED && item.rejectionReason && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
                    <span className="font-bold">سبب الرفض من الإدارة: </span>
                    <span>{item.rejectionReason}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        !loading && (
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
        )
      )}
    </div>
  );
}
