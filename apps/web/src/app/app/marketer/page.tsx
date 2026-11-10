'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  ShieldCheck,
  Building,
  Building2,
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
  Eye,
  BarChart2,
  Heart,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  X,
  FileCheck2,
  Sparkles,
  ArrowUpLeft,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { ListingStatus, PropertyType, ProfileStatus } from '@elmasaif/shared';
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

type FilterTab = 'all' | 'active' | 'pending' | 'alerts' | 'archived';

export interface MarketerDashboardPageProps {
  initialLoading?: boolean;
  initialListings?: any[];
  initialFalData?: { profile: any; falLicense: any } | null;
}

export default function MarketerDashboardPage({
  initialLoading = true,
  initialListings = [],
  initialFalData = null,
}: MarketerDashboardPageProps = {}) {
  const [myListings, setMyListings] = useState<any[]>(initialListings);
  const [falData, setFalData] = useState<{ profile: any; falLicense: any } | null>(initialFalData);
  const [loading, setLoading] = useState(initialLoading);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialListings.length === 0 && initialLoading) {
      apiClient
        .get<{ statusCode: number; data: { items: any[] } }>('/listings/my')
        .then((res) => {
          if (res?.data?.items) {
            setMyListings(res.data.items);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    if (!initialFalData) {
      apiClient
        .get<{ statusCode?: number; profile: any; falLicense: any } | { data: { profile: any; falLicense: any } }>('/users/fal-license')
        .then((res: any) => {
          const payload = res?.data || res;
          if (payload?.falLicense || payload?.profile) {
            setFalData(payload);
          }
        })
        .catch(() => {});
    }
  }, []);

  const falLicense = falData?.falLicense;
  const profileStatus = falData?.profile?.status;
  const isRestricted =
    falLicense?.status === ProfileStatus.COMPLIANCE_RESTRICTED ||
    profileStatus === ProfileStatus.COMPLIANCE_RESTRICTED;

  const daysRemaining = falLicense?.daysRemaining ?? null;
  const showWarning =
    !isRestricted &&
    falLicense?.status === ProfileStatus.ACTIVE &&
    typeof daysRemaining === 'number' &&
    daysRemaining <= 30 &&
    daysRemaining >= 0;

  const activeCount = myListings.filter((l) => l.status === ListingStatus.ACTIVE).length;
  const pendingCount = myListings.filter(
    (l) => !l.status || l.status === 'PENDING' || l.status === 'PENDING_REVIEW',
  ).length;
  const alertsCount = myListings.filter((l) =>
    [
      ListingStatus.SUSPENDED,
      ListingStatus.UNDER_COMPLIANCE_REVIEW,
      ListingStatus.BLOCKED,
      ListingStatus.REJECTED,
    ].includes(l.status),
  ).length;
  const archivedCount = myListings.filter((l) => l.status === ListingStatus.ARCHIVED).length;

  const totalViews = myListings.reduce((sum, l) => sum + (l.totalViews || 0), 0);
  const totalImpressions = myListings.reduce((sum, l) => sum + (l.totalImpressions || 0), 0);
  const totalFavorites = myListings.reduce((sum, l) => sum + (l.totalFavorites || 0), 0);

  // Filter listings based on active tab and search query
  const filteredListings = useMemo(() => {
    return myListings.filter((item) => {
      // Tab filter
      if (activeTab === 'active' && item.status !== ListingStatus.ACTIVE) return false;
      if (
        activeTab === 'pending' &&
        item.status &&
        item.status !== 'PENDING' &&
        item.status !== 'PENDING_REVIEW'
      )
        return false;
      if (
        activeTab === 'alerts' &&
        ![
          ListingStatus.SUSPENDED,
          ListingStatus.UNDER_COMPLIANCE_REVIEW,
          ListingStatus.BLOCKED,
          ListingStatus.REJECTED,
        ].includes(item.status)
      )
        return false;
      if (activeTab === 'archived' && item.status !== ListingStatus.ARCHIVED) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const cityMatch = (item.cityName || '').toLowerCase().includes(query);
        const districtMatch = (item.districtName || '').toLowerCase().includes(query);
        const typeMatch = (PROPERTY_TYPE_LABELS[item.propertyType] || '')
          .toLowerCase()
          .includes(query);
        return titleMatch || cityMatch || districtMatch || typeMatch;
      }

      return true;
    });
  }, [myListings, activeTab, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-base dark:bg-dark-surface-base p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary tracking-tight">
              لوحة تحكم الوسيط العقاري
            </h1>
            {isRestricted ? (
              <div
                data-testid="header-restricted-badge"
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 shrink-0"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold text-xs whitespace-nowrap leading-none">
                  حساب مقيد لانتهاء رخصة فال
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-xs whitespace-nowrap leading-none">
                  مرخص وموثق من فال (REGA)
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-2xl">
            إدارة وتوثيق العقارات المسوقة، واستقبال طلبات المشترين المباشرة، ومتابعة التحليلات والعمولات النظامية.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isRestricted ? (
            <Button
              variant="primary"
              disabled
              data-testid="add-listing-btn"
              title="لا يمكن إنشاء إعلانات جديدة نظراً لانتهاء صلاحية رخصة فال وتقييد الحساب للامتثال"
              className="gap-2 shadow-sm font-bold px-4 py-2.5 opacity-50 cursor-not-allowed bg-rose-600 hover:bg-rose-600 text-white"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة عقار جديد</span>
            </Button>
          ) : (
            <Link href="/app/marketer/listings/new">
              <Button
                variant="primary"
                data-testid="add-listing-btn"
                className="gap-2 shadow-sm hover:shadow transition-all font-bold px-4 py-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إضافة عقار جديد</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Fal License Status Alert Card */}
      {isRestricted ? (
        <div
          data-testid="fal-restriction-card"
          className="relative overflow-hidden rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 p-5 sm:p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    تم تقييد حسابك لانتهاء صلاحية رخصة فال
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full border border-rose-300">
                    <span>مقيد للامتثال</span>
                  </span>
                </div>
                <p className="text-xs text-rose-800/90 dark:text-rose-200/90 leading-relaxed">
                  تم تقييد حسابك لانتهاء صلاحية رخصة فال. تم تعليق ظهور إعلاناتك النشطة آلياً، بينما تستمر الصفقات الجارية دون انقطاع. يرجى تجديد الرخصة لاستعادة نشاط الحساب.
                </p>
              </div>
            </div>
            <Link href="/app/marketer/fal-license" className="shrink-0">
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 gap-1.5 rounded-xl shadow-xs"
                data-testid="renew-fal-btn"
              >
                <span>تجديد رخصة فال</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : showWarning ? (
        <div
          data-testid="fal-warning-card"
          className="relative overflow-hidden rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 sm:p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    تنبيه: اقتراب انتهاء صلاحية رخصة فال
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300">
                    <span>{`متبقي ${daysRemaining} يوم`}</span>
                  </span>
                </div>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  {`تنبيه: تنتهي صلاحية رخصة فال خلال ${daysRemaining} يوم. يرجى تجديد الرخصة في الوقت المحدد لتفادي تعليق الإعلانات.`}
                </p>
              </div>
            </div>
            <Link href="/app/marketer/fal-license" className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 text-xs font-semibold px-4 py-2 gap-1.5 rounded-xl shadow-xs"
                data-testid="renew-fal-warning-btn"
              >
                <span>تجديد رخصة فال</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[#C69C45]/40 bg-gradient-to-r from-[#C69C45]/15 via-[#C69C45]/5 to-transparent dark:from-[#C69C45]/20 dark:via-[#C69C45]/10 dark:to-transparent p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#9A7328] text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                    رخصة فال للوساطة والتسويق العقاري معتمدة وسارية
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300/40 dark:border-amber-700/50">
                    <FileCheck2 className="w-3 h-3" />
                    <span>معتمد نظامياً</span>
                  </span>
                </div>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                  حسابك مؤهل نظامياً لإضافة العقارات واستقبال عروض المشترين وفق اشتراطات وضوابط الهيئة العامة للعقار (REGA).
                </p>
              </div>
            </div>
            <Link href="/app/marketer/fal-license" className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="border-[#C69C45]/60 hover:bg-[#C69C45]/10 text-ink-primary dark:text-dark-ink-primary text-xs font-semibold px-3.5 py-2 gap-1.5 rounded-xl shadow-xs"
              >
                <span>تفاصيل الرخصة والامتثال</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: العقارات المعروضة */}
        <Link href="/app/marketer" className="group block focus:outline-none">
          <div className="relative overflow-hidden rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/40">
            {/* Top color accent line */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80" />

            {/* Header: Title + Icon + Action Arrow */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-110">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    العقارات المعروضة
                  </h3>
                  <span className="text-[11px] text-ink-muted">المحفظة النشطة</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-ink-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <ArrowUpLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Metric Value + Badge */}
            <div className="flex items-baseline justify-between mt-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono tracking-tight">
                  {activeCount}
                </span>
                <span className="text-xs font-semibold text-ink-muted">عقار</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>نشطة ومعتمدة</span>
              </span>
            </div>

            {/* Footer sub-stats */}
            <div className="mt-4 pt-3 border-t border-surface-border/60 dark:border-dark-surface-border/60 flex items-center justify-between text-xs text-ink-muted">
              <span>إجمالي العقارات المسجلة</span>
              <span className="font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
                {myListings.length} عقارات
              </span>
            </div>
          </div>
        </Link>

        {/* Card 2: إجمالي التفاعل والمشاهدات */}
        <Link href="/app/marketer" className="group block focus:outline-none">
          <div className="relative overflow-hidden rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/5 hover:border-sky-500/40">
            {/* Top color accent line */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500 opacity-80" />

            {/* Header: Title + Icon + Action Arrow */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-110">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    المشاهدات والتفاعل
                  </h3>
                  <span className="text-[11px] text-ink-muted">إقبال المشترين</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-ink-muted group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                <ArrowUpLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Metric Value + Badge */}
            <div className="flex items-baseline justify-between mt-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono tracking-tight">
                  {totalViews.toLocaleString('en-US')}
                </span>
                <span className="text-xs font-semibold text-ink-muted">مشاهدة</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800">
                <TrendingUp className="w-3 h-3 text-sky-500" />
                <span>إجمالي الزيارات</span>
              </span>
            </div>

            {/* Footer sub-stats: Impressions & Favorites Chips */}
            <div className="mt-4 pt-3 border-t border-surface-border/60 dark:border-dark-surface-border/60 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary text-[11px] font-medium border border-surface-border/60 dark:border-dark-surface-border/60">
                <BarChart2 className="w-3 h-3 text-sky-500" />
                <span className="font-mono font-bold">{totalImpressions.toLocaleString('en-US')}</span> ظهور
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary text-[11px] font-medium border border-surface-border/60 dark:border-dark-surface-border/60">
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20" />
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {totalFavorites.toLocaleString('en-US')}
                </span>{' '}
                مفضلة
              </span>
            </div>
          </div>
        </Link>

        {/* Card 3: استفسارات المشترين */}
        <Link href="/app/marketer/inquiries" className="group block focus:outline-none">
          <div className="relative overflow-hidden rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-500/40">
            {/* Top color accent line */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80" />

            {/* Header: Title + Icon + Action Arrow */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-110">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    استفسارات المشترين
                  </h3>
                  <span className="text-[11px] text-ink-muted">طلبات ومحادثات</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-ink-muted group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <ArrowUpLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Metric Value + Badge */}
            <div className="flex items-baseline justify-between mt-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono tracking-tight">
                  0
                </span>
                <span className="text-xs font-semibold text-ink-muted">محادثة</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>محادثات فورية</span>
              </span>
            </div>

            {/* Footer description */}
            <div className="mt-4 pt-3 border-t border-surface-border/60 dark:border-dark-surface-border/60 flex items-center justify-between text-xs text-ink-muted">
              <span>استفسارات عبر المنصة</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline">
                فتح المحادثات
              </span>
            </div>
          </div>
        </Link>

        {/* Card 4: الصفقات والعمولات */}
        <Link href="/app/settings/payout" className="group block focus:outline-none">
          <div className="relative overflow-hidden rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 hover:border-amber-500/40">
            {/* Top color accent line */}
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-[#D4AF37] opacity-80" />

            {/* Header: Title + Icon + Action Arrow */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-110">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    الصفقات والعمولات
                  </h3>
                  <span className="text-[11px] text-ink-muted">المحفظة المالية</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken flex items-center justify-center text-ink-muted group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                <ArrowUpLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>

            {/* Metric Value + Badge */}
            <div className="flex items-baseline justify-between mt-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono tracking-tight">
                  0
                </span>
                <span className="text-xs font-semibold text-ink-muted">صفقة</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                <Wallet className="w-3 h-3 text-amber-500" />
                <span>0.00 ر.س</span>
              </span>
            </div>

            {/* Footer description */}
            <div className="mt-4 pt-3 border-t border-surface-border/60 dark:border-dark-surface-border/60 flex items-center justify-between text-xs text-ink-muted">
              <span>مستحقات العمولات والصرف</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline">
                بيانات السحب
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Content Area: Listings Section */}
      <div className="space-y-4">
        {/* Section Header with Tabs & Search */}
        <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                العقارات المسوقة وحالة الاعتماد ({myListings.length})
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                قائمة العقارات المرفوعة، نسب التفاعل، وإجراءات الرقابة والمطابقة.
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث بالعقار، المدينة، أو الحي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-8 py-1.5 text-xs rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                  title="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-surface-border dark:border-dark-surface-border pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
              }`}
            >
              الكل ({myListings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>معتمد ومنشور ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد المراجعة ({pendingCount})</span>
            </button>
            {alertsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'alerts'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>ملاحظات وتنبيهات ({alertsCount})</span>
              </button>
            )}
            {archivedCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('archived')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'archived'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>المؤرشفة ({archivedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border animate-pulse flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2 w-1/2">
                    <div className="h-4 bg-surface-border dark:bg-dark-surface-border rounded w-1/4"></div>
                    <div className="h-5 bg-surface-border dark:bg-dark-surface-border rounded w-3/4"></div>
                  </div>
                  <div className="h-8 bg-surface-border dark:bg-dark-surface-border rounded w-24"></div>
                </div>
                <div className="h-10 bg-surface-border dark:bg-dark-surface-border rounded-xl w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Listings List */}
        {!loading && filteredListings.length > 0 && (
          <div className="space-y-3">
            {filteredListings.map((item) => (
              <div
                key={item.id}
                className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-5 sm:p-6 shadow-xs hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-200 flex flex-col gap-4"
              >
                {/* Top Row: Info + Price & Status */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Icon Thumbnail + Details */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                          {PROPERTY_TYPE_LABELS[item.propertyType] || item.propertyType || 'عقار'}
                        </span>
                        <h3
                          className="text-base font-bold text-ink-primary dark:text-dark-ink-primary truncate max-w-xl"
                          title={item.title}
                        >
                          {item.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>
                            {item.cityName ? `${item.cityName} — حي ${item.districtName || ''}` : 'الموقع محدد'}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="font-mono bg-surface-sunken dark:bg-dark-surface-sunken px-2 py-0.5 rounded-md border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary font-semibold">
                          {Number(item.areaSquareMeters || 0).toLocaleString('en-US')} م²
                        </span>
                        {item.status === ListingStatus.ACTIVE && (
                          <>
                            <span>•</span>
                            <Link
                              href={`/properties/${item.id}`}
                              target="_blank"
                              className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <span>معاينة في السوق</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price + Status Badge + Actions */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-surface-border dark:border-dark-surface-border">
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] text-ink-muted uppercase font-medium">
                        السعر المطلوب
                      </span>
                      <div
                        dir="ltr"
                        className="font-mono font-extrabold text-base sm:text-lg text-[#1B4332] dark:text-emerald-400"
                      >
                        {`${Number(item.askPrice || 0).toLocaleString('en-US')} SAR`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                </div>

                {/* Listing Engagement & Conversion Analytics */}
                <div className="bg-surface-sunken/50 dark:bg-dark-surface-sunken/40 rounded-xl p-3 border border-surface-border/60 dark:border-dark-surface-border/60">
                  <SellerListingEngagement
                    listingId={item.id}
                    totalViews={item.totalViews}
                    totalImpressions={item.totalImpressions}
                    totalFavorites={item.totalFavorites}
                    offersCount={item.offersCount}
                  />
                </div>

                {/* Compliance Warnings & Notices */}
                {(item.status === ListingStatus.SUSPENDED ||
                  item.status === ListingStatus.UNDER_COMPLIANCE_REVIEW) &&
                  item.complianceReason && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>إعلان موقوف مؤقتاً للامتثال والرقابة:</span>
                          {item.complianceCategory && (
                            <span className="font-mono font-semibold bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.2 rounded text-[11px]">
                              {item.complianceCategory}
                            </span>
                          )}
                          <span className="font-mono font-semibold bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.2 rounded text-[11px]">
                            {item.complianceReason}
                          </span>
                        </div>
                        <p className="text-ink-secondary dark:text-dark-ink-secondary text-[11px] leading-relaxed">
                          تم إخفاء هذا الإعلان مؤقتاً من نتائج البحث العام لحين استيفاء المتطلبات النظامية وتعديل الملاحظات.
                        </p>
                      </div>
                    </div>
                  )}

                {item.status === ListingStatus.BLOCKED && item.complianceReason && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200 text-xs flex items-start gap-3">
                    <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold">إعلان محظور نهائياً بموجب قرار الامتثال:</span>
                        <span className="font-mono font-semibold bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 px-2 py-0.5 rounded text-[11px] break-all">
                          {item.complianceReason}
                        </span>
                      </div>
                      <p className="text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed">
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
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200 text-xs">
                    <span className="font-bold">سبب الرفض من الإدارة: </span>
                    <span>{item.rejectionReason}</span>
                  </div>
                )}

                {/* Price Suggestion Banner if any */}
                {item.activePriceSuggestion && (
                  <div className="mt-1">
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
          </div>
        )}

        {/* Empty Search/Filter State */}
        {!loading && myListings.length > 0 && filteredListings.length === 0 && (
          <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken mx-auto flex items-center justify-center text-ink-muted">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
              لا توجد عقارات مطابقة للبحث أو التصفية
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary max-w-sm mx-auto">
              جرب تغيير معايير البحث أو اختيار تبويب تصفية آخر لعرض العقارات المسجلة.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab('all');
                setSearchQuery('');
              }}
              className="text-xs"
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        )}

        {/* Global Empty State (when user has 0 listings) */}
        {!loading && myListings.length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-8">
              <EmptyState
                title="لا توجد عقارات مضافة في محفظتك"
                description={
                  isRestricted
                    ? 'تم تقييد حسابك لانتهاء صلاحية رخصة فال. يرجى تجديد الرخصة لتمكين إضافة الإعلانات العقارية.'
                    : 'ابدأ بإضافة أول عقار مسوق لديك، مع إرفاق ترخيص الإعلان وبيانات الصك للنشر المباشر.'
                }
                icon={<Building className="w-8 h-8" />}
                actionLabel={isRestricted ? 'تجديد رخصة فال' : 'إضافة عقار جديد'}
                actionHref={isRestricted ? '/app/marketer/fal-license' : '/app/marketer/listings/new'}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
