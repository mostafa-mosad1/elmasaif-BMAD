'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  ShieldCheck,
  Building,
  PlusCircle,
  MessageSquare,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  Archive,
} from 'lucide-react';
import { ListingStatus, PropertyType } from '@elmasaif/shared';
import { apiClient } from '../../../lib/api-client';
import { SellerPriceSuggestionCard } from '../../../components/listings/seller-price-suggestion-card';
import {
  SellerListingArchiveActions,
  ListingStatusBadge,
} from '../../../components/listings';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

export default function MarketerDashboardPage() {
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

  const activeCount = myListings.filter((l) => l.status === ListingStatus.ACTIVE).length;

  const stats = [
    {
      title: 'العقارات المعروضة',
      count: activeCount,
      description: 'عقارات نشطة ومعتمدة في المنصة',
      icon: Building,
      href: '/app/marketer'
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

      {/* Marketer Listings or Empty State */}
      {myListings.length > 0 ? (
        <Card>
          <CardHeader className="border-b border-surface-border dark:border-dark-surface-border">
            <CardTitle className="text-lg font-bold">
              العقارات المسوقة وحالة الاعتماد ({myListings.length})
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              قائمة العقارات المرفوعة وحالتها الحالية في المنصة.
            </CardDescription>
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

                    <ListingStatusBadge status={item.status} />

                    {(item.status === ListingStatus.ACTIVE ||
                      item.status === ListingStatus.ARCHIVED) && (
                      <SellerListingArchiveActions
                        listingId={item.id}
                        status={item.status}
                        archiveReason={item.archiveReason}
                        onStatusChanged={(newStatus, updatedData) => {
                          setMyListings((prev) =>
                            prev.map((l) =>
                              l.id === item.id
                                ? {
                                    ...l,
                                    status: newStatus,
                                    ...(updatedData || {}),
                                  }
                                : l,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>
                </div>

                {item.status === ListingStatus.SUSPENDED && item.complianceReason && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>
                        <span className="font-bold">إعلان موقوف مؤقتاً للامتثال والرقابة: </span>
                        <span>{item.complianceReason}</span>
                      </div>
                      <p className="text-ink-secondary dark:text-dark-ink-secondary text-[11px]">
                        تم إخفاء هذا الإعلان مؤقتاً من نتائج البحث العام لحين استيفاء المتطلبات النظامية وتعديل الملاحظات.
                      </p>
                    </div>
                  </div>
                )}

                {item.status === ListingStatus.BLOCKED && item.complianceReason && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-900 dark:text-red-200 text-xs flex items-start gap-2.5">
                    <Ban className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>
                        <span className="font-bold">إعلان محظور نهائياً بموجب قرار الامتثال: </span>
                        <span>{item.complianceReason}</span>
                      </div>
                      <p className="text-red-700 dark:text-red-300 text-[11px]">
                        تم فرض حظر نهائي على هذا العقار لمخالفته لوائح الهيئة العامة للعقار وضوابط المنصة، ولا يمكن تعديله أو إعادة نشره.
                      </p>
                    </div>
                  </div>
                )}

                {item.status === ListingStatus.ARCHIVED && item.archiveReason && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 text-xs">
                    <span className="font-bold">سبب الأرشفة: </span>
                    <span>{item.archiveReason}</span>
                  </div>
                )}

                {item.status === ListingStatus.REJECTED && item.rejectionReason && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
                    <span className="font-bold">سبب الرفض من الإدارة: </span>
                    <span>{item.rejectionReason}</span>
                  </div>
                )}

                {item.activePriceSuggestion && (
                  <div className="mt-2">
                    <SellerPriceSuggestionCard
                      listingId={item.id}
                      suggestion={item.activePriceSuggestion}
                      onResponded={(action, updatedSuggestion, updatedListing) => {
                        setMyListings((prev) =>
                          prev.map((l) => {
                            if (l.id !== item.id) return l;
                            return {
                              ...l,
                              ...(updatedListing
                                ? {
                                    askPrice: updatedListing.askPrice,
                                    status: updatedListing.status,
                                  }
                                : {}),
                              activePriceSuggestion: updatedSuggestion,
                            };
                          }),
                        );
                      }}
                    />
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
                title="لا توجد عقارات مضافة في محفظتك"
                description="ابدأ بإضافة أول عقار مسوق لديك، مع إرفاق ترخيص الإعلان وبيانات الصك للنشر المباشر."
                icon={<Building className="w-7 h-7" />}
                actionLabel="إضافة عقار جديد"
                actionHref="/app/marketer/listings/new"
              />
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
