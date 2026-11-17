'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  BarChart2,
  Heart,
  TrendingUp,
  Building2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  AdminGlobalEngagementAnalytics,
  PropertyType,
  PROPERTY_TYPE_LABELS_AR,
} from '@elmasaif/shared';
import { apiClient } from '../../../../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';

export default function AdminListingsAnalyticsPage() {
  const [data, setData] = useState<AdminGlobalEngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        statusCode: number;
        data: AdminGlobalEngagementAnalytics;
      }>('/admin/listings/analytics/overview?days=30');
      if (res?.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل تحليلات التفاعل العامة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div dir="rtl" className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl bg-primary text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 text-accent-light px-3 py-1 rounded-full border border-white/10">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>لوحة المؤشرات والتحليلات العامة • FR-66 / FR-67</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span>تحليلات تفاعل ومؤشرات السوق العقاري</span>
          </h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            مؤشرات مجمعة ومحدثة لحظياً لأداء الإعلانات وحجم التفاعل والظهور، متوافقة كلياً مع نظام حماية البيانات الشخصية السعودي (PDPL).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/listings">
            <Button variant="outline" size="sm" className="bg-white/15 text-white border-white/20 hover:bg-white/25 gap-1.5 text-xs">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لطابور المراجعة</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="bg-white/15 text-white border-white/20 hover:bg-white/25 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث المؤشرات</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-ink-secondary">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm">جاري تجميع مؤشرات المنصة التراكمية...</span>
        </div>
      ) : (
        data && (
          <>
            {/* Top 5 Platform Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary text-xs">
                    <span>العقارات النشطة</span>
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {data.totalActiveListings.toLocaleString('en-US')}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">عقارات منشورة في السوق</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary text-xs">
                    <span>مرات الظهور التراكمية</span>
                    <BarChart2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {data.totalLifetimeImpressions.toLocaleString('en-US')}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">ظهور بطاقات العقار للزوار</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary text-xs">
                    <span>مشاهدات التفاصيل</span>
                    <Eye className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {data.totalLifetimeViews.toLocaleString('en-US')}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">زيارات صفحات الإعلانات</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary text-xs">
                    <span>إجمالي المفضلة</span>
                    <Heart className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {data.totalLifetimeFavorites.toLocaleString('en-US')}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">إشارات مرجعية مسجلة</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between text-ink-secondary dark:text-dark-ink-secondary text-xs">
                    <span>متوسط التحويل والعروض</span>
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {`${data.averageConversionRatio}%`}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">نسبة تقديم العروض للمشاهدات</p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Platform Engagement Trend Chart (Histogram) */}
            <Card>
              <CardHeader className="border-b border-surface-border dark:border-dark-surface-border">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>اتجاه التفاعل اليومي للمنصة (آخر 30 يوماً)</span>
                  <div className="flex items-center gap-4 text-xs font-normal text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-primary" />
                      <span>المشاهدات</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-blue-300 dark:bg-blue-600" />
                      <span>الظهور</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-rose-400" />
                      <span>المفضلة</span>
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {data.dailyTrends && data.dailyTrends.length > 0 ? (
                  <div className="space-y-3">
                    <div className="h-48 flex items-end gap-1.5 sm:gap-2 pt-6">
                      {data.dailyTrends.map((trend) => {
                        const maxVal = Math.max(
                          ...data.dailyTrends.map((t) => Math.max(t.detailViews, t.impressions / 5, t.favorites)),
                          10,
                        );
                        const viewsHeightPct = Math.min(100, Math.max(8, (trend.detailViews / maxVal) * 100));

                        return (
                          <div
                            key={trend.date}
                            className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                          >
                            {/* Tooltip on hover */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 z-20 pointer-events-none bg-primary text-white text-[10px] p-2 rounded-lg shadow-level2 whitespace-nowrap">
                              <div className="font-bold">{trend.date}</div>
                              <div>مشاهدات: {trend.detailViews}</div>
                              <div>ظهور: {trend.impressions}</div>
                              <div>مفضلة: {trend.favorites}</div>
                            </div>

                            <div
                              style={{ height: `${viewsHeightPct}%` }}
                              className="w-full rounded-t-md bg-primary hover:bg-primary/80 transition-all cursor-pointer min-h-[4px]"
                            />
                            <span className="text-[9px] text-ink-muted truncate w-full text-center hidden md:block">
                              {trend.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-ink-muted">
                    لا تتوفر سجلات تفاعل مسجلة خلال الفترة الزمنية المحددة.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 10 Most Engaged Properties Table */}
            <Card>
              <CardHeader className="border-b border-surface-border dark:border-dark-surface-border">
                <CardTitle className="text-base font-bold">
                  أعلى 10 عقارات تفاعلاً واهتماماً من المشترين
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-surface-sunken dark:bg-dark-surface text-ink-secondary border-b border-surface-border dark:border-dark-surface-border">
                      <tr>
                        <th className="py-3.5 px-4 font-bold">العقار</th>
                        <th className="py-3.5 px-4 font-bold">النوع</th>
                        <th className="py-3.5 px-4 font-bold">المدينة</th>
                        <th className="py-3.5 px-4 font-bold">السعر المطلوب</th>
                        <th className="py-3.5 px-4 font-bold text-center">المشاهدات</th>
                        <th className="py-3.5 px-4 font-bold text-center">المفضلة</th>
                        <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                      {data.topListings && data.topListings.length > 0 ? (
                        data.topListings.map((prop, idx) => (
                          <tr key={prop.id} className="hover:bg-surface-sunken/60 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-ink-primary dark:text-dark-ink-primary">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="line-clamp-1">{prop.title}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-ink-secondary">
                              {PROPERTY_TYPE_LABELS_AR[prop.propertyType as PropertyType] || prop.propertyType}
                            </td>
                            <td className="py-3.5 px-4 text-ink-secondary">
                              {prop.cityName || 'غير محدد'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {`${prop.askPrice.toLocaleString('en-US')} ر.س`}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-primary">
                              {prop.views.toLocaleString('en-US')}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-500">
                              {prop.favorites.toLocaleString('en-US')}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <Link href={`/admin/listings`}>
                                <Button variant="outline" size="sm" className="text-xs h-7 px-2.5 gap-1">
                                  <span>مراجعة</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-ink-muted">
                            لا توجد عقارات مسجلة حتى الآن.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  );
}

