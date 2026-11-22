'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  Building,
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
  FileText,
  ArrowLeft,
  XCircle,
  Eye,
  HandCoins,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import {
  ListingStatus,
  PropertyType,
  OwnerListingRequestStatus,
  OwnerContractStatus,
  type OwnerListingRequestItem,
} from '@elmasaif/shared';
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

type FilterTab = 'all' | 'active' | 'requests' | 'pending' | 'alerts' | 'archived';

interface ListingItem {
  id: string;
  title: string;
  propertyType: PropertyType;
  cityName?: string | null;
  districtName?: string | null;
  areaSquareMeters?: number;
  bedrooms?: number | null;
  yearBuilt?: number | null;
  askPrice?: number;
  status: ListingStatus;
  primaryPhotoUrl?: string | null;
  photos?: string[];
  archiveReason?: string | null;
  rejectionReason?: string | null;
  complianceReason?: string | null;
  complianceCategory?: string | null;
  totalViews?: number;
  totalImpressions?: number;
  totalFavorites?: number;
  offersCount?: number;
  activePriceSuggestion?: Parameters<typeof SellerPriceSuggestionCard>[0]['suggestion'];
  createdAt?: string;
}

export default function OwnerListingsPage() {
  const [myListings, setMyListings] = useState<ListingItem[]>([]);
  const [listingRequests, setListingRequests] = useState<OwnerListingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiClient
        .get<{ statusCode: number; data: { items: ListingItem[] } }>('/listings/my')
        .catch(() => null),
      apiClient
        .get<OwnerListingRequestItem[]>('/owner/listing-requests')
        .catch(() => []),
    ])
      .then(([listingsRes, requestsRes]) => {
        if (listingsRes?.data?.items) {
          setMyListings(listingsRes.data.items);
        }
        if (Array.isArray(requestsRes)) {
          setListingRequests(requestsRes);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingSignatureRequest = listingRequests.find(
    (r) =>
      r.status === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ||
      r.contractStatus === OwnerContractStatus.PENDING_SIGNATURE,
  );

  const pendingFeeRequest = listingRequests.find(
    (r) => r.contractStatus === OwnerContractStatus.PENDING_FEE,
  );

  // Counters
  const activeCount =
    myListings.filter((l) => l.status === ListingStatus.ACTIVE).length +
    listingRequests.filter(
      (r) =>
        (r.status === OwnerListingRequestStatus.COMPLETED ||
          (r.status as string) === 'COMPLETED' ||
          r.contractStatus === OwnerContractStatus.ACTIVE) &&
        !myListings.some((l) => l.id === r.listingId),
    ).length;

  const requestsCount = listingRequests.length;
  const pendingCount =
    myListings.filter(
      (l) =>
        !l.status ||
        (l.status as string) === 'PENDING' ||
        (l.status as string) === 'PENDING_REVIEW' ||
        (l.status as string) === 'PENDING_FEE',
    ).length +
    listingRequests.filter(
      (r) =>
        (r.status === OwnerListingRequestStatus.PENDING ||
          r.status === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ||
          r.contractStatus === OwnerContractStatus.PENDING_SIGNATURE ||
          r.contractStatus === OwnerContractStatus.PENDING_FEE) &&
        r.status !== OwnerListingRequestStatus.COMPLETED &&
        (r.status as string) !== 'COMPLETED' &&
        r.contractStatus !== OwnerContractStatus.ACTIVE &&
        !myListings.some((l) => l.id === r.listingId),
    ).length;

  const alertsCount =
    myListings.filter((l) =>
      [
        ListingStatus.SUSPENDED,
        ListingStatus.UNDER_COMPLIANCE_REVIEW,
        ListingStatus.BLOCKED,
        ListingStatus.REJECTED,
      ].includes(l.status),
    ).length +
    listingRequests.filter(
      (r) =>
        r.status === OwnerListingRequestStatus.REJECTED ||
        r.status === OwnerListingRequestStatus.MODIFICATION_REQUESTED,
    ).length;

  const archivedCount = myListings.filter((l) => l.status === ListingStatus.ARCHIVED).length;
  const totalViews = myListings.reduce((sum, l) => sum + (l.totalViews || 0), 0);
  const totalOffers = myListings.reduce((sum, l) => sum + (l.offersCount || 0), 0);
  const totalPortfolioItems = myListings.length + listingRequests.length;

  // Filter listings
  const filteredListings = useMemo(() => {
    return myListings.filter((item) => {
      if (activeTab === 'requests') return false;
      if (activeTab === 'active' && item.status !== ListingStatus.ACTIVE) return false;
      if (
        activeTab === 'pending' &&
        item.status &&
        (item.status as string) !== 'PENDING' &&
        (item.status as string) !== 'PENDING_REVIEW' &&
        (item.status as string) !== 'PENDING_FEE'
      ) {
        return false;
      }
      if (
        activeTab === 'alerts' &&
        ![
          ListingStatus.SUSPENDED,
          ListingStatus.UNDER_COMPLIANCE_REVIEW,
          ListingStatus.BLOCKED,
          ListingStatus.REJECTED,
        ].includes(item.status)
      ) {
        return false;
      }
      if (activeTab === 'archived' && item.status !== ListingStatus.ARCHIVED) return false;

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

  // Filter direct requests
  const filteredRequests = useMemo(() => {
    return listingRequests.filter((item) => {
      const isCompleted =
        item.status === OwnerListingRequestStatus.COMPLETED ||
        (item.status as string) === 'COMPLETED' ||
        item.contractStatus === OwnerContractStatus.ACTIVE;

      if (activeTab === 'archived') return false;
      if (activeTab === 'active') {
        return isCompleted && !myListings.some((l) => l.id === item.listingId);
      }
      if (
        activeTab === 'pending' &&
        (isCompleted ||
          (item.status !== OwnerListingRequestStatus.PENDING &&
            item.status !== OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE &&
            item.contractStatus !== OwnerContractStatus.PENDING_SIGNATURE &&
            item.contractStatus !== OwnerContractStatus.PENDING_FEE))
      ) {
        return false;
      }
      if (
        activeTab === 'alerts' &&
        item.status !== OwnerListingRequestStatus.REJECTED &&
        item.status !== OwnerListingRequestStatus.MODIFICATION_REQUESTED
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = (item.propertyTitle || '').toLowerCase().includes(query);
        const cityMatch = (item.cityName || '').toLowerCase().includes(query);
        const districtMatch = (item.districtName || '').toLowerCase().includes(query);
        const typeMatch = (PROPERTY_TYPE_LABELS[item.propertyType] || '')
          .toLowerCase()
          .includes(query);
        return titleMatch || cityMatch || districtMatch || typeMatch;
      }

      return true;
    });
  }, [listingRequests, myListings, activeTab, searchQuery]);

  const hasAnyItems = filteredListings.length > 0 || filteredRequests.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
        <Link href="/app/owner" className="hover:text-primary transition-colors">
          لوحة تحكم المالك
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
          إدارة العقارات
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-base dark:bg-dark-surface-base p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
                  إدارة العقارات والمحفظة
                </h1>
                <Badge variant="verified" size="sm">
                  مالك مباشر
                </Badge>
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1">
                استعراض عقاراتك المسجلة، متابعة حالة الاعتماد والنشر، طلبات الإدراج المباشر، وتوقيع عقود الوساطة.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/app/owner/listings/new">
            <Button
              variant="primary"
              className="gap-2 shadow-xs hover:shadow-sm transition-all font-bold px-4 py-2.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>طلب عرض عقار مباشر</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Prominent Pending Signature Banner */}
      {pendingSignatureRequest && (
        <div className="p-5 sm:p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                عقد وساطة رسمي جاهز للتوقيع الإلكتروني!
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                أرسلت الإدارة عقد وساطة للعقار ({pendingSignatureRequest.propertyTitle}). يرجى مراجعة البنود وإتمام التوقيع لنشر العقار فوراً.
              </p>
            </div>
          </div>
          <Link href={`/app/owner/contracts/${pendingSignatureRequest.contractId || pendingSignatureRequest.id}`}>
            <Button size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs font-bold gap-2 whitespace-nowrap shadow-sm">
              <span>مراجعة وتوقيع العقد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Prominent Pending Fee Banner */}
      {!pendingSignatureRequest && pendingFeeRequest && (
        <div className="p-5 sm:p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">
                تم توقيع العقد بنجاح — بانتظار سداد رسوم النشر
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                تم توقيع عقد الوساطة للعقار ({pendingFeeRequest.propertyTitle}). يرجى إرفاق إيصال سداد الرسوم لنشر العقار مباشرة في المعرض.
              </p>
            </div>
          </div>
          <Link href={`/app/owner/contracts/${pendingFeeRequest.contractId || pendingFeeRequest.id}`}>
            <Button size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs font-bold gap-2 whitespace-nowrap shadow-sm">
              <span>سداد رسوم النشر</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-primary/30 transition-all flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">إجمالي العقارات والطلبات</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
              {totalPortfolioItems}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              في محفظتك العقارية
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-emerald-500/30 transition-all flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">معتمد ومنشور</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {activeCount}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              متاح للجمهور والمشترين
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-amber-500/30 transition-all flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">قيد المراجعة والعقود</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {pendingCount}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              بانتظار التدقيق أو التوقيع
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs hover:border-blue-500/30 transition-all flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">المشاهدات الكلية</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {totalViews.toLocaleString('en-US')}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              {totalOffers > 0 ? `${totalOffers} عروض شراء مستلمة` : 'تفاعل وإقبال المشترين'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Section Header with Tabs & Search */}
        <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                قائمة العقارات والطلبات ({filteredListings.length + filteredRequests.length})
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                تصفية عقاراتك، متابعة طلبات العرض المباشر، وتحديث الأسعار وحالة العقود.
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
              الكل ({totalPortfolioItems})
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
            {requestsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'requests'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>طلبات العرض المباشر ({requestsCount})</span>
              </button>
            )}
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
        {!loading && !hasAnyItems && (
          <div className="bg-surface-base dark:bg-dark-surface-base rounded-2xl border border-surface-border dark:border-dark-surface-border p-8">
            <EmptyState
              title={searchQuery ? 'لا توجد عقارات تطابق البحث' : 'لا توجد عقارات في هذا التصنيف'}
              description={
                searchQuery
                  ? 'جرب البحث بكلمة مفتاحية مختلفة أو إزالة عوامل التصفية.'
                  : 'لم تقم بإضافة عقارات في هذا القسم بعد. يمكنك إرسال طلب عرض مباشر للبدء.'
              }
              icon={<Building className="w-8 h-8 text-primary" />}
              actionLabel="طلب عرض عقار مباشر"
              actionHref="/app/owner/listings/new"
            />
          </div>
        )}

        {/* Items Listing */}
        {!loading && hasAnyItems && (
          <div className="space-y-4">
            {/* Direct Listing Requests Section */}
            {filteredRequests.length > 0 && (
              <Card className="rounded-xl border overflow-hidden">
                <CardHeader className="p-4 border-b bg-surface-sunken/40">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>طلبات الإدراج المباشر ومتابعة العقود ({filteredRequests.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {filteredRequests.map((req) => {
                    const isCompleted =
                      req.status === OwnerListingRequestStatus.COMPLETED ||
                      (req.status as string) === 'COMPLETED' ||
                      req.contractStatus === OwnerContractStatus.ACTIVE;
                    const isPendingFee =
                      req.contractStatus === OwnerContractStatus.PENDING_FEE;
                    const isApproved =
                      req.status === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ||
                      req.contractStatus === OwnerContractStatus.PENDING_SIGNATURE;
                    const isRejected = req.status === OwnerListingRequestStatus.REJECTED;
                    const isModification = req.status === OwnerListingRequestStatus.MODIFICATION_REQUESTED;

                    return (
                      <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-sunken/20 transition-colors">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold">
                              {PROPERTY_TYPE_LABELS[req.propertyType] || req.propertyType}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[11px] font-semibold">
                              طلب مباشر
                            </span>
                            <h4 className="text-sm font-bold text-foreground">
                              {req.propertyTitle}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{req.cityName} — حي {req.districtName}</span>
                            <span>•</span>
                            <span className="font-mono font-semibold text-primary">
                              {Number(req.askPrice).toLocaleString('en-US')} ر.س
                            </span>
                            <span>•</span>
                            <span>{new Date(req.createdAt).toLocaleDateString('ar-SA')}</span>
                          </div>

                          {isRejected && req.rejectionReason && (
                            <div className="p-2 rounded-lg bg-rose-50 text-rose-800 text-xs border border-rose-200 mt-1">
                              <span className="font-bold">سبب الرفض: </span>
                              <span>{req.rejectionReason}</span>
                            </div>
                          )}

                          {isModification && req.modificationNotes && (
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-800 text-xs border border-blue-200 mt-1">
                              <span className="font-bold">الملاحظات المطلوبة: </span>
                              <span>{req.modificationNotes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>معتمد ومنشور في السوق</span>
                              </span>
                              {req.listingId && (
                                <Link href={`/properties/${req.listingId}`} target="_blank">
                                  <Button size="sm" variant="outline" className="text-xs font-semibold gap-1.5 h-8">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>معاينة في السوق</span>
                                  </Button>
                                </Link>
                              )}
                              {(req.contractId || req.id) && (
                                <Link href={`/app/owner/contracts/${req.contractId || req.id}`}>
                                  <Button size="sm" variant="ghost" className="text-xs font-medium gap-1 h-8">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>العقد</span>
                                  </Button>
                                </Link>
                              )}
                            </div>
                          ) : isPendingFee ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                                <CreditCard className="w-3 h-3 text-blue-600" />
                                <span>بانتظار سداد الرسوم</span>
                              </span>
                              <Link href={`/app/owner/contracts/${req.contractId || req.id}`}>
                                <Button size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs font-bold gap-1.5 h-8">
                                  <span>سداد رسوم النشر</span>
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            </div>
                          ) : isApproved ? (
                            <Link href={`/app/owner/contracts/${req.contractId || req.id}`}>
                              <Button size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs font-bold gap-1.5 h-8">
                                <span>مراجعة وتوقيع العقد</span>
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>طلب مرفوض</span>
                            </span>
                          ) : isModification ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                              <AlertTriangle className="w-3 h-3 text-blue-600" />
                              <span>مطلوب تعديلات</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>قيد المراجعة الإدارية</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Published & Moderated Listings Section */}
            {filteredListings.length > 0 && (
              <Card className="rounded-xl border overflow-hidden">
                <CardHeader className="p-4 border-b bg-surface-sunken/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Building className="w-4 h-4 text-primary" />
                      <span>العقارات المسجلة بالمحفظة ({filteredListings.length})</span>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      متابعة الأسعار والتفاعل وحالة النشر
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {filteredListings.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col gap-3 hover:bg-surface-sunken/20 transition-colors">
                      {/* Main Compact Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Info with Small Thumbnail */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center">
                            {item.primaryPhotoUrl ? (
                              <img
                                src={item.primaryPhotoUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Building className="w-5 h-5 text-primary" />
                            )}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold">
                                {PROPERTY_TYPE_LABELS[item.propertyType] || item.propertyType}
                              </span>
                              <h4 className="text-sm font-bold text-foreground truncate max-w-md" title={item.title}>
                                {item.title}
                              </h4>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-primary shrink-0" />
                                <span>{item.cityName || 'غير محدد'} — حي {item.districtName || 'غير محدد'}</span>
                              </span>
                              {item.areaSquareMeters && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{item.areaSquareMeters} م²</span>
                                </>
                              )}
                              {item.bedrooms && (
                                <>
                                  <span>•</span>
                                  <span>{item.bedrooms} غرف</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price, Status Badge & Actions */}
                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div dir="ltr" className="font-mono font-bold text-sm sm:text-base text-primary">
                            {`${Number(item.askPrice || 0).toLocaleString('en-US')} SAR`}
                          </div>

                          <ListingStatusBadge status={item.status} className="!text-[11px] !py-0.5 !px-2.5" />

                          <div className="flex items-center gap-1.5">
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
                                href={`/properties/${item.id}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2 py-1 rounded-md hover:bg-primary/5"
                              >
                                <span>معاينة في السوق</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}

                            {item.status === ListingStatus.PENDING_FEE && (
                              <Link href="/app/owner/contracts">
                                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1 h-8 px-3">
                                  <FileText className="w-3 h-3" />
                                  <span>سداد الرسوم</span>
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pending Fee Compact Note */}
                      {item.status === ListingStatus.PENDING_FEE && (
                        <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>العقد بانتظار سداد الرسوم • لن يظهر العقار في السوق حتى تأكيد التحويل من الإدارة المالية.</span>
                          </div>
                          <Link href="/app/owner/contracts" className="text-amber-900 font-bold underline whitespace-nowrap text-xs">
                            إكمال السداد الآن
                          </Link>
                        </div>
                      )}

                      {/* Interactive Engagement Analytics */}
                      <SellerListingEngagement
                        listingId={item.id}
                        totalViews={item.totalViews}
                        totalImpressions={item.totalImpressions}
                        totalFavorites={item.totalFavorites}
                        offersCount={item.offersCount}
                      />

                      {/* Compliance & Moderation Notes */}
                      {item.status === ListingStatus.SUSPENDED && item.complianceReason && (
                        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-900 text-xs border border-amber-200">
                          <span className="font-bold">إعلان موقوف مؤقتاً: </span>
                          <span>{item.complianceReason}</span>
                        </div>
                      )}

                      {item.status === ListingStatus.BLOCKED && item.complianceReason && (
                        <div className="p-2.5 rounded-lg bg-red-50 text-red-900 text-xs border border-red-200">
                          <span className="font-bold">إعلان محظور: </span>
                          <span>{item.complianceReason}</span>
                        </div>
                      )}

                      {item.status === ListingStatus.ARCHIVED && item.archiveReason && (
                        <div className="p-2.5 rounded-lg bg-surface-sunken border text-xs">
                          <span className="font-bold">سبب الأرشفة: </span>
                          <span>{item.archiveReason}</span>
                        </div>
                      )}

                      {item.status === ListingStatus.REJECTED && item.rejectionReason && (
                        <div className="p-2.5 rounded-lg bg-red-50 text-red-900 text-xs border border-red-200">
                          <span className="font-bold">سبب الرفض: </span>
                          <span>{item.rejectionReason}</span>
                        </div>
                      )}

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
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
