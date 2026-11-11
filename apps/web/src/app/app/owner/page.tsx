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
  SellerListingEngagement,
} from '../../../components/listings';

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
        <div className="p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-surface-base dark:from-primary/20 dark:via-dark-surface-base dark:to-dark-surface-base shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-4 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Building className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              عرض عقار للبيع أو الإيجار
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
              أرسل بيانات عقارك ليتولى فريق المنصة فحص الصك وصياغة العقد المعتمد.
            </p>
          </div>
          <div className="pt-5 mt-4 border-t border-primary/15">
            <Link href="/app/owner/listings/new" className="block">
              <Button variant="primary" size="sm" className="w-full gap-2 shadow-xs">
                <span>تقديم طلب عرض مباشر</span>
                <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Electronic Contracts Overview */}
        <div className="p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              عقود الوساطة الإلكترونية
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
              عقود وساطة نظامية ملزمة معتمدة من الهيئة العامة للعقار.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-surface-border/60 dark:border-dark-surface-border/60 space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-secondary dark:text-dark-ink-secondary bg-surface-sunken dark:bg-dark-surface-sunken px-3 py-1.5 rounded-lg">
              <span>العقارات المعتمدة والمنشورة:</span>
              <span className="font-bold font-mono text-sm text-ink-primary dark:text-dark-ink-primary">
                {myListings.filter((l) => l.status === ListingStatus.ACTIVE).length}
              </span>
            </div>
            <Link href="/app/owner/contracts" className="block">
              <Button variant="secondary" size="sm" className="w-full gap-2">
                <span>استعراض العقود</span>
                <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Payout IBAN Status */}
        <div className="p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              حساب التحويل البنكي (IBAN)
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
              الحساب البنكي المعتمد لاستلام مبالغ صفقات البيع عند الإتمام.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-surface-border/60 dark:border-dark-surface-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="verified" size="sm">
                إدارة حسابات الآيبان
              </Badge>
              <span className="text-[11px] text-ink-muted">حساب معتمد</span>
            </div>
            <Link href="/app/settings/payout" className="block">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <span>إدارة الحساب البنكي</span>
                <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Owner Submitted Listings & Moderation Status */}
      {myListings.length > 0 ? (
        <Card className="rounded-2xl border border-surface-border dark:border-dark-surface-border overflow-hidden">
          <CardHeader className="border-b border-surface-border dark:border-dark-surface-border p-5 sm:p-6">
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

                {/* Listing Engagement & Conversion Analytics */}
                <SellerListingEngagement
                  listingId={item.id}
                  totalViews={item.totalViews}
                  totalImpressions={item.totalImpressions}
                  totalFavorites={item.totalFavorites}
                  offersCount={item.offersCount}
                />

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
