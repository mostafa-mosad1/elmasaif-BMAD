import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  PropertiesSearchView,
  buildSearchQuery,
  parseFiltersFromParams,
  type PropertiesSearchViewProps,
} from '../page';
import { PropertyType, ListingSearchSort, ListingStatus, UserRole, ListingSummaryItem } from '@elmasaif/shared';

// CityDistrictSelector fetches cities via apiClient on mount; stub it out for static render.
vi.mock('../../../lib/api-client', () => ({
  apiClient: Object.assign(
    (url: string, opts?: any) => Promise.resolve({}),
    {
      get: vi.fn(() => Promise.resolve({ statusCode: 200, data: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } } })),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  ),
}));

const filters = (overrides: Partial<any> = {}) => ({
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
  limit: 20,
  ...overrides,
});

const sampleItem = {
  id: 'listing-1',
  title: 'فيلا مودرن مع مسبح',
  propertyType: PropertyType.VILLA,
  cityId: 'c1',
  districtId: 'd1',
  cityName: 'الرياض',
  districtName: 'النرجس',
  askPrice: 3200000,
  areaSquareMeters: 450,
  bedrooms: 5,
  status: ListingStatus.ACTIVE,
  sellerRole: UserRole.MARKETER,
  isFalVerified: true,
  photos: [],
  photoCount: 1,
  createdAt: '2026-11-01T10:00:00.000Z',
} as unknown as ListingSummaryItem;

function renderView(props: Partial<PropertiesSearchViewProps>) {
  const full: PropertiesSearchViewProps = {
    filters: filters(),
    queryValue: '',
    onQueryChange: () => {},
    loading: false,
    items: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    onFilterChange: () => {},
    onReset: () => {},
    onPageChange: () => {},
    ...props,
  };
  return renderToString(<PropertiesSearchView {...full} />);
}

describe('Properties search page helpers (Story 3.1)', () => {
  describe('buildSearchQuery', () => {
    it('sends only non-empty criteria and omits defaults', () => {
      const qs = buildSearchQuery(filters());
      expect(qs).toBe('');
    });

    it('includes trimmed free text, ranges, fal flag, sort, and pagination', () => {
      const qs = buildSearchQuery(
        filters({ q: '  فيلا  ', priceMin: '500000', falOnly: true, sort: ListingSearchSort.PRICE_ASC, page: 2 }),
      );
      const params = new URLSearchParams(qs);
      expect(params.get('q')).toBe('فيلا');
      expect(params.get('priceMin')).toBe('500000');
      expect(params.get('falOnly')).toBe('true');
      expect(params.get('sort')).toBe(ListingSearchSort.PRICE_ASC);
      expect(params.get('page')).toBe('2');
      // default limit must not leak into the query
      expect(params.get('limit')).toBeNull();
    });
  });

  describe('parseFiltersFromParams', () => {
    it('falls back to safe defaults for empty params', () => {
      const parsed = parseFiltersFromParams(new URLSearchParams(''));
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort).toBe(ListingSearchSort.NEWEST);
      expect(parsed.falOnly).toBe(false);
    });

    it('reads and clamps values from the URL', () => {
      const parsed = parseFiltersFromParams(
        new URLSearchParams('q=%D9%81%D9%8A%D9%84%D8%A7&cityId=c1&falOnly=true&sort=price_desc&page=3&limit=500'),
      );
      expect(parsed.cityId).toBe('c1');
      expect(parsed.falOnly).toBe(true);
      expect(parsed.sort).toBe(ListingSearchSort.PRICE_DESC);
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(100);
    });

    it('ignores an unknown sort token', () => {
      const parsed = parseFiltersFromParams(new URLSearchParams('sort=relevance'));
      expect(parsed.sort).toBe(ListingSearchSort.NEWEST);
    });
  });
});

describe('PropertiesSearchView rendering (Story 3.1)', () => {
  it('renders the filter panel controls', () => {
    const html = renderView({});
    expect(html).toContain('بحث حر');
    expect(html).toContain('ترتيب النتائج');
    expect(html).toContain('نوع العقار');
    expect(html).toContain('رخصة فال فقط');
    expect(html).toContain('إعادة تعيين الفلاتر');
  });

  it('renders a loading skeleton state (AC#4 web)', () => {
    const html = renderView({ loading: true });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('جاري البحث...');
  });

  it('renders the institutional empty state on zero results (AC#1 web)', () => {
    const html = renderView({ loading: false, items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    expect(html).toContain('لا توجد عقارات مطابقة للمعايير الحالية');
  });

  it('renders result cards from items', () => {
    const html = renderView({ loading: false, items: [sampleItem], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } });
    expect(html).toContain('فيلا مودرن مع مسبح');
    expect(html).toContain('1 نتيجة مطابقة');
  });

  it('renders pagination controls when there is more than one page', () => {
    const html = renderView({ loading: false, items: [sampleItem], meta: { total: 45, page: 2, limit: 20, totalPages: 3 } });
    expect(html).toContain('صفحة');
    expect(html).toContain('التالي');
    expect(html).toContain('السابق');
  });
});
