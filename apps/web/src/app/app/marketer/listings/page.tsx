'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  Building,
  Building2,
  PlusCircle,
  MapPin,
  CheckCircle2,
  Clock,
  Ban,
  Archive,
  Search,
  ExternalLink,
  ChevronLeft,
  X,
  AlertTriangle,
} from 'lucide-react';
import { ListingStatus, PropertyType, ProfileStatus } from '@elmasaif/shared';
import { apiClient } from '../../../../lib/api-client';
import { SellerPriceSuggestionCard } from '../../../../components/listings/seller-price-suggestion-card';
import {
  SellerListingArchiveActions,
  ListingStatusBadge,
  SellerListingEngagement,
} from '../../../../components/listings';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  [PropertyType.VILLA]: 'فيلا',
  [PropertyType.LAND]: 'أرض',
  [PropertyType.APARTMENT]: 'شقة',
  [PropertyType.BUILDING]: 'عمارة',
  [PropertyType.COMMERCIAL]: 'تجاري',
  [PropertyType.FARM]: 'مزرعة / استراحة',
};

type FilterTab = 'all' | 'active' | 'pending' | 'alerts' | 'archived';

interface ListingItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityName?: string | null;
  districtName?: string | null;
  areaSquareMeters?: number;
  askPrice?: number;
  status: ListingStatus;
  archiveReason?: string | null;
  rejectionReason?: string | null;
  complianceReason?: string | null;
  complianceCategory?: string | null;
  totalViews?: number;
  totalImpressions?: number;
  totalFavorites?: number;
  offersCount?: number;
  activePriceSuggestion?: Parameters<typeof SellerPriceSuggestionCard>[0]['suggestion'];
}

interface FalLicenseSummary {
  status: ProfileStatus | string;
  licenseNumber?: string | null;
  daysRemaining?: number | null;
}

interface FalProfilePayload {
  profile?: { status: ProfileStatus | string } | null;
  falLicense?: FalLicenseSummary | null;
}

export default function MarketerListingsPage() {
  const [myListings, setMyListings] = useState<ListingItem[]>([]);
  const [falData, setFalData] = useState<FalProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchListings = () => {
    setLoading(true);
    Promise.all([
      apiClient
        .get<{ statusCode: number; data: { items: ListingItem[] } }>('/listings/my')
        .then((res) => {
          if (res?.data?.items) {
            setMyListings(res.data.items);
          }
        })
        .catch(() => {}),
      apiClient
        .get<{ statusCode?: number; profile?: { status: string }; falLicense?: FalLicenseSummary } | { data: FalProfilePayload }>('/users/fal-license')
        .then((res) => {
          const payload = (res as { data?: FalProfilePayload })?.data || (res as FalProfilePayload);
          if (payload?.falLicense || payload?.profile) {
            setFalData(payload);
          }
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const falLicense = falData?.falLicense;
  const profileStatus = falData?.profile?.status;
  const isRestricted =
    falLicense?.status === ProfileStatus.COMPLIANCE_RESTRICTED ||
    profileStatus === ProfileStatus.COMPLIANCE_RESTRICTED;

  const activeCount = myListings.filter((l) => l.status === ListingStatus.ACTIVE).length;
  const pendingCount = myListings.filter(
    (l) => !l.status || (l.status as string) === 'PENDING' || (l.status as string) === 'PENDING_REVIEW'
  ).length;
  const alertsCount = myListings.filter((l) =>
    [
      ListingStatus.SUSPENDED,
      ListingStatus.UNDER_COMPLIANCE_REVIEW,
      ListingStatus.BLOCKED,
      ListingStatus.REJECTED,
    ].includes(l.status)
  ).length;
  const archivedCount = myListings.filter((l) => l.status === ListingStatus.ARCHIVED).length;
  const totalViews = myListings.reduce((sum, l) => sum + (l.totalViews || 0), 0);

  // Filter listings based on active tab and search query
  const filteredListings = useMemo(() => {
    return myListings.filter((item) => {
      // Tab filter
      if (activeTab === 'active' && item.status !== ListingStatus.ACTIVE) return false;
      if (
        activeTab === 'pending' &&
        item.status &&
        (item.status as string) !== 'PENDING' &&
        (item.status as string) !== 'PENDING_REVIEW'
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
        <Link href="/app/marketer" className="hover:text-primary transition-colors">
          لوحة تحكم الوسيط
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
          إدارة العقارات
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-base dark:bg-dark-surface-base p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
                إدارة العقارات المسوقة
              </h1>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                متابعة العقارات المعروضة، نسب المشاهدات والتفاعل، وتحديث الأسعار وحالة الاعتماد.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isRestricted ? (
            <Button
              variant="primary"
              disabled
              title="لا يمكن إنشاء إعلانات جديدة نظراً لانتهاء صلاحية رخصة فال وتقييد الحساب للامتثال"
              className="gap-2 shadow-xs font-bold px-4 py-2.5 opacity-50 cursor-not-allowed bg-rose-600 text-white"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة عقار جديد</span>
            </Button>
          ) : (
            <Link href="/app/marketer/listings/new">
              <Button
                variant="primary"
                className="gap-2 shadow-xs hover:shadow-sm transition-all font-bold px-4 py-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إضافة عقار جديد</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-xs space-y-1">
          <span className="text-xs text-ink-muted">إجمالي العقارات</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-mono">
            {myListings.length}
          </p>
          <span className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary block">
            في محفظتك العقارية
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-xs space-y-1">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">معتمد ومنشور</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {activeCount}
          </p>
          <span className="text-[11px] text-ink-muted block">
            متاح للجمهور في المنصة
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-xs space-y-1">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">قيد المراجعة</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {pendingCount}
          </p>
          <span className="text-[11px] text-ink-muted block">
            بانتظار تدقيق الإدارة
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-xs space-y-1">
          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">المشاهدات الكلية</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 font-mono">
            {totalViews.toLocaleString('en-US')}
          </p>
          <span className="text-[11px] text-ink-muted block">
            إقبال واهتمام المشترين
          </span>
        </div>
      </div>

      {/* Main Content Area: Listings Section */}
      <div className="space-y-4">
        {/* Section Header with Tabs & Search */}
        <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                قائمة العقارات ({filteredListings.length})
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                تصفية العقارات والتحكم في ظهورها وإجراءات الرقابة والمطابقة.
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
                className="w-full pr-9 pl-8 py-2 text-xs rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    ? 'bg-primary text-white shadow-xs'
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

        {/* Empty State */}
        {!loading && filteredListings.length === 0 && (
          <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-8">
            <EmptyState
              title={searchQuery ? 'لا توجد عقارات تطابق البحث' : 'لا توجد عقارات في هذا التصنيف'}
              description={
                searchQuery
                  ? 'جرب البحث بكلمة مفتاحية مختلفة أو إزالة عوامل التصفية.'
                  : 'يمكنك إضافة عقار جديد الآن لبدء تسويقه واستقبال طلبات المشترين.'
              }
              actionLabel={!searchQuery && !isRestricted ? 'إضافة عقار جديد' : undefined}
              actionHref={!searchQuery && !isRestricted ? '/app/marketer/listings/new' : undefined}
            />
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
                        className="font-mono font-extrabold text-base sm:text-lg text-primary dark:text-accent-light"
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
                                  : l
                              )
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
                  <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary text-xs">
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
                      suggestion={item.activePriceSuggestion}
                      onAccepted={() => fetchListings()}
                      onRejected={() => fetchListings()}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
