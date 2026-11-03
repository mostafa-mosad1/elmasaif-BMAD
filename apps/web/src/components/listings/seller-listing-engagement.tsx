'use client';

import React, { useState } from 'react';
import { Eye, BarChart2, Heart, TrendingUp, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { ListingAnalyticsSummary } from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/button';

export interface SellerListingEngagementProps {
  listingId: string;
  totalViews?: number;
  totalImpressions?: number;
  totalFavorites?: number;
  offersCount?: number;
}

export function SellerListingEngagement({
  listingId,
  totalViews = 0,
  totalImpressions = 0,
  totalFavorites = 0,
  offersCount = 0,
}: SellerListingEngagementProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<ListingAnalyticsSummary | null>(null);

  const conversionRatio =
    totalViews > 0 ? ((offersCount / totalViews) * 100).toFixed(1) + '%' : '0%';

  const handleToggle = async () => {
    if (!isExpanded && !analytics) {
      setLoading(true);
      try {
        const res = await apiClient.get<{ data: ListingAnalyticsSummary }>(
          `/listings/${listingId}/analytics?days=7`,
        );
        if (res?.data) {
          setAnalytics(res.data);
        }
      } catch (err) {
        console.error('Failed to load listing analytics trend', err);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="w-full mt-2 pt-2 border-t border-surface-border dark:border-dark-surface-border">
      {/* 4 Interactive Engagement Metric Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Views Chip */}
          <div
            title="إجمالي عدد مشاهدات صفحة العقار"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary text-xs border border-surface-border dark:border-dark-surface-border"
          >
            <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-ink-secondary dark:text-dark-ink-secondary">المشاهدات:</span>
            <span className="font-bold font-mono">{totalViews.toLocaleString('en-US')}</span>
          </div>

          {/* Impressions Chip */}
          <div
            title="إجمالي مرات ظهور بطاقة العقار في شاشات البحث"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary text-xs border border-surface-border dark:border-dark-surface-border"
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-ink-secondary dark:text-dark-ink-secondary">الظهور:</span>
            <span className="font-bold font-mono">{totalImpressions.toLocaleString('en-US')}</span>
          </div>

          {/* Bookmarks Chip */}
          <div
            title="عدد المشترين الذين أضافوا العقار للمفضلة"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary text-xs border border-surface-border dark:border-dark-surface-border"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-ink-secondary dark:text-dark-ink-secondary">المفضلة:</span>
            <span className="font-bold font-mono">{totalFavorites.toLocaleString('en-US')}</span>
          </div>

          {/* Offer Conversion Ratio Chip */}
          <div
            title="نسبة تحويل المشاهدات إلى عروض شراء رسمية"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800/40"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-emerald-700 dark:text-emerald-400">نسبة التفاعل:</span>
            <span className="font-bold font-mono">{conversionRatio}</span>
          </div>
        </div>

        {/* Expandable Breakdown Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="text-xs h-7 px-2.5 gap-1 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>{isExpanded ? 'إخفاء التحليل' : 'تحليل التفاعل (7 أيام)'}</span>
        </Button>
      </div>

      {/* Expandable 7-Day Trend Panel */}
      {isExpanded && (
        <div className="mt-3 p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-ink-primary dark:text-dark-ink-primary">
            <span>اتجاه التفاعل اليومي (آخر 7 أيام)</span>
            <span className="text-[11px] text-ink-muted">وفق نظام حماية البيانات الشخصية (PDPL)</span>
          </div>

          {loading ? (
            <div className="py-4 text-center text-ink-secondary flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>جاري تحميل الاتجاه اليومي...</span>
            </div>
          ) : analytics && analytics.dailyMetrics && analytics.dailyMetrics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
              {analytics.dailyMetrics.map((day) => (
                <div
                  key={day.date}
                  className="p-2 rounded-lg bg-surface dark:bg-dark-surface border border-surface-border dark:border-dark-surface-border text-center flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-[10px] text-ink-muted font-mono">{day.date}</span>
                  <div className="flex items-center justify-center gap-1 font-bold text-primary font-mono text-xs">
                    <Eye className="w-3 h-3 shrink-0" />
                    <span>{day.detailViews}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-ink-secondary">
                    <span>ظهور: {day.impressions}</span>
                    <span>•</span>
                    <span className="text-rose-500">مفضلة: {day.favoriteAdds}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-center text-ink-muted text-xs">
              لا توجد تفاعلات مسجلة خلال الأيام الـ 7 الأخيرة.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

