'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, SlidersHorizontal, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PropertyType,
  ListingSearchSort,
  ListingSummaryItem,
  SearchListingsResponse,
  PROPERTY_TYPE_LABELS_AR,
  DEFAULT_PAGE_SIZE,
} from '@elmasaif/shared';
import { LayoutShell } from '../../components/layout';
import { Card, Button, EmptyState } from '../../components/ui';
import { PropertyCard } from '../../components/listings';
import { CityDistrictSelector } from '../../components/geo';
import { apiClient } from '../../lib/api-client';
import { PropertiesSplitView } from './properties-split-view';

export type Filters = {
  q: string;
  cityId: string | null;
  districtId: string | null;
  propertyType: PropertyType | null;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  bedroomsMin: string;
  falOnly: boolean;
  sort: ListingSearchSort;
  page: number;
  limit: number;
};

const DEFAULT_FILTERS: Filters = {
  q: '',
  cityId: null,
  districtId: null,
  propertyType: null,
  priceMin: '',
  priceMax: '',
  areaMin: '',
  areaMax: '',
  bedroomsMin: '',
  falOnly: false,
  sort: ListingSearchSort.NEWEST,
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

const SORT_LABELS_AR: Record<ListingSearchSort, string> = {
  [ListingSearchSort.NEWEST]: 'الأحدث أولاً',
  [ListingSearchSort.PRICE_ASC]: 'السعر: من الأقل للأعلى',
  [ListingSearchSort.PRICE_DESC]: 'السعر: من الأعلى للأقل',
};

/** Builds the query string, sending only non-empty criteria. */
export function buildSearchQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.cityId) params.set('cityId', filters.cityId);
  if (filters.districtId) params.set('districtId', filters.districtId);
  if (filters.propertyType) params.set('propertyType', filters.propertyType);
  if (filters.priceMin) params.set('priceMin', filters.priceMin);
  if (filters.priceMax) params.set('priceMax', filters.priceMax);
  if (filters.areaMin) params.set('areaMin', filters.areaMin);
  if (filters.areaMax) params.set('areaMax', filters.areaMax);
  if (filters.bedroomsMin) params.set('bedroomsMin', filters.bedroomsMin);
  if (filters.falOnly) params.set('falOnly', 'true');
  if (filters.sort !== ListingSearchSort.NEWEST) params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(filters.limit));
  return params.toString();
}

/** Reads filters from URL search params so a shared link reproduces the same result set. */
export function parseFiltersFromParams(raw: URLSearchParams): Filters {
  const sortParam = raw.get('sort') as ListingSearchSort | null;
  return {
    q: raw.get('q') ?? '',
    cityId: raw.get('cityId') || null,
    districtId: raw.get('districtId') || null,
    propertyType: (raw.get('propertyType') as PropertyType) || null,
    priceMin: raw.get('priceMin') ?? '',
    priceMax: raw.get('priceMax') ?? '',
    areaMin: raw.get('areaMin') ?? '',
    areaMax: raw.get('areaMax') ?? '',
    bedroomsMin: raw.get('bedroomsMin') ?? '',
    falOnly: raw.get('falOnly') === 'true',
    sort:
      sortParam && Object.values(ListingSearchSort).includes(sortParam)
        ? sortParam
        : ListingSearchSort.NEWEST,
    page: Math.max(1, Number(raw.get('page')) || 1),
    limit: Math.min(100, Math.max(1, Number(raw.get('limit')) || DEFAULT_PAGE_SIZE)),
  };
}

export interface PropertiesSearchViewProps {
  filters: Filters;
  queryValue: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  items: ListingSummaryItem[];
  meta: SearchListingsResponse['meta'] | null;
  onFilterChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
  onCardHover?: (id: string | null) => void;
}

const inputClass =
  'w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-DEFAULT px-3 py-2 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function PropertiesSearchView({
  filters,
  queryValue,
  onQueryChange,
  loading,
  items,
  meta,
  onFilterChange,
  onReset,
  onPageChange,
  onCardHover,
}: PropertiesSearchViewProps) {
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 0;
  const currentPage = meta?.page ?? filters.page;

  return (
    <div className="py-6 sm:py-8 text-start" dir="rtl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary dark:text-primary-light text-sm font-semibold mb-1">
          <SlidersHorizontal className="w-4 h-4 text-accent" />
          <span>بحث واكتشاف العقارات</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-primary dark:text-dark-ink-primary">
          استعرض عقارات البيع النشطة حسب معاييرك
        </h1>
      </div>

      {/* Filter Panel */}
      <Card className="p-4 sm:p-6 mb-8">
        <div className="space-y-5">
          {/* Free text + sort */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                بحث حر (عنوان أو وصف)
              </label>
              <input
                type="text"
                value={queryValue}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="ابحث باسم العقار أو في الوصف..."
                className={inputClass}
                aria-label="بحث حر"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                ترتيب النتائج
              </label>
              <select
                value={filters.sort}
                onChange={(e) =>
                  onFilterChange({ sort: e.target.value as ListingSearchSort, page: 1 })
                }
                className={inputClass}
                aria-label="ترتيب النتائج"
              >
                {Object.values(ListingSearchSort).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS_AR[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <CityDistrictSelector
            selectedCityId={filters.cityId}
            selectedDistrictId={filters.districtId}
            onCityChange={(cityId) => onFilterChange({ cityId, districtId: null, page: 1 })}
            onDistrictChange={(districtId) => onFilterChange({ districtId, page: 1 })}
            cityLabel="المدينة"
            districtLabel="الحي"
          />

          {/* Property type chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
              نوع العقار
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onFilterChange({ propertyType: null, page: 1 })}
                className={`px-3 py-1.5 rounded-DEFAULT text-xs font-semibold transition-colors ${
                  filters.propertyType === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-border'
                }`}
              >
                الكل
              </button>
              {Object.values(PropertyType).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      propertyType: filters.propertyType === pt ? null : pt,
                      page: 1,
                    })
                  }
                  className={`px-3 py-1.5 rounded-DEFAULT text-xs font-semibold transition-colors ${
                    filters.propertyType === pt
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-border'
                  }`}
                >
                  {PROPERTY_TYPE_LABELS_AR[pt]}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric ranges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                أقل سعر
              </label>
              <input
                type="number"
                min="0"
                value={filters.priceMin}
                onChange={(e) => onFilterChange({ priceMin: e.target.value, page: 1 })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                أعلى سعر
              </label>
              <input
                type="number"
                min="0"
                value={filters.priceMax}
                onChange={(e) => onFilterChange({ priceMax: e.target.value, page: 1 })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                أقل مساحة (م²)
              </label>
              <input
                type="number"
                min="0"
                value={filters.areaMin}
                onChange={(e) => onFilterChange({ areaMin: e.target.value, page: 1 })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                أعلى مساحة (م²)
              </label>
              <input
                type="number"
                min="0"
                value={filters.areaMax}
                onChange={(e) => onFilterChange({ areaMax: e.target.value, page: 1 })}
                className={inputClass}
              />
            </div>
          </div>

          {/* Bedrooms + Fal toggle + reset */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                الحد الأدنى لعدد الغرف
              </label>
              <input
                type="number"
                min="0"
                value={filters.bedroomsMin}
                onChange={(e) => onFilterChange({ bedroomsMin: e.target.value, page: 1 })}
                className={`${inputClass} w-32`}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.falOnly}
                onChange={(e) => onFilterChange({ falOnly: e.target.checked, page: 1 })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
                رخصة فال فقط
              </span>
            </label>
            <Button variant="outline" size="sm" className="mb-0.5" onClick={onReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة تعيين الفلاتر</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
          {loading
            ? 'جاري البحث...'
            : `${total.toLocaleString('en-US')} نتيجة مطابقة`}
        </p>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-card border border-surface-border dark:border-dark-surface-border bg-surface-base dark:bg-dark-surface-base overflow-hidden"
            >
              <div className="aspect-video w-full animate-pulse bg-surface-sunken dark:bg-dark-surface-sunken" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-2/3 rounded animate-pulse bg-surface-sunken dark:bg-dark-surface-sunken" />
                <div className="h-3 w-1/2 rounded animate-pulse bg-surface-sunken dark:bg-dark-surface-sunken" />
                <div className="h-3 w-full rounded animate-pulse bg-surface-sunken dark:bg-dark-surface-sunken" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="لا توجد عقارات مطابقة للمعايير الحالية"
          description="لم نتمكن من العثور على أي عقارات تطابق محددات البحث. جرّب توسيع النطاق أو إعادة تعيين الفلاتر."
          actionLabel="إعادة تعيين الفلاتر"
          onAction={onReset}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              onMouseEnter={() => onCardHover?.(item.id)}
              onMouseLeave={() => onCardHover?.(null)}
            >
              <PropertyCard listing={item} href={`/properties/${item.id}`} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronRight className="w-4 h-4" />
            <span>السابق</span>
          </Button>
          <span className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            صفحة {currentPage} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <span>التالي</span>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PropertiesSearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialFilters = useMemo<Filters>(
    () => (searchParams ? parseFiltersFromParams(new URLSearchParams(searchParams.toString())) : DEFAULT_FILTERS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [queryValue, setQueryValue] = useState<string>(initialFilters.q);
  const [items, setItems] = useState<ListingSummaryItem[]>([]);
  const [meta, setMeta] = useState<SearchListingsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  // Free text is committed with a 300ms debounce; the input itself is uncontrolled-fast.
  const handleQueryChange = useCallback((value: string) => {
    setQueryValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: value, page: 1 }));
    }, 300);
  }, []);

  const resetFilters = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQueryValue('');
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const changePage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page: Math.max(1, page) }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setActiveListingId(id);
    // Scroll the matching card into view
    const el = document.querySelector(`[data-listing-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Fetch whenever committed filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = buildSearchQuery(filters);
    apiClient
      .get<{ statusCode: number; data: SearchListingsResponse }>(
        `/listings/search${qs ? `?${qs}` : ''}`,
      )
      .then((res) => {
        if (cancelled) return;
        setItems(res?.data?.items ?? []);
        setMeta(res?.data?.meta ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setMeta({ total: 0, page: filters.page, limit: filters.limit, totalPages: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // Sync committed filters to the URL (shareable + back/forward friendly).
  useEffect(() => {
    const qs = buildSearchQuery(filters);
    const target = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    if (target !== current && typeof router?.replace === 'function') {
      router.replace(target, { scroll: false });
    }
  }, [filters, pathname, searchParams, router]);

  return (
    <LayoutShell>
      <PropertiesSplitView
        filters={filters}
        activeListingId={activeListingId}
        onMarkerClick={handleMarkerClick}
      >
        <PropertiesSearchView
          filters={filters}
          queryValue={queryValue}
          onQueryChange={handleQueryChange}
          loading={loading}
          items={items}
          meta={meta}
          onFilterChange={updateFilters}
          onReset={resetFilters}
          onPageChange={changePage}
          onCardHover={setActiveListingId}
        />
      </PropertiesSplitView>
    </LayoutShell>
  );
}
