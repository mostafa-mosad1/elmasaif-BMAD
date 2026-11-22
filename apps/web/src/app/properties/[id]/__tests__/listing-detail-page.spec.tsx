import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ListingDetailView,
  formatDetailNumber,
  isSellerFalVerified,
  resolveCta,
  toDetailError,
  unwrapDetailResponse,
  type ListingDetailViewProps,
} from '../listing-detail-view';
import { CommissionCalculator, calculateCommission } from '../../../../components/listings';
import { ApiError } from '../../../../lib/api-client';
import { ListingDetailItem, ListingStatus, PropertyType, UserRole } from '@elmasaif/shared';

// The page fetches through apiClient; the view is rendered statically here.
vi.mock('../../../../lib/api-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../lib/api-client')
  >('../../../../lib/api-client');
  return {
    ...actual,
    apiClient: Object.assign(
      () => Promise.resolve({}),
      {
        get: vi.fn(() => Promise.resolve({ statusCode: 200, data: null })),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
    ),
  };
});

/** Buyer-facing payload as `GET /api/v1/listings/:id` returns it, plus fields the UI must never leak. */
const detail = (overrides: Partial<ListingDetailItem> = {}): ListingDetailItem =>
  ({
    id: 'listing-1042',
    title: 'فيلا مودرن مع مسبح في حي النرجس',
    description: 'فيلا مستقلة راقية بموقع ممتاز وتشطيبات سوبر ديلوكس.',
    propertyType: PropertyType.VILLA,
    status: ListingStatus.ACTIVE,
    cityName: 'الرياض',
    districtName: 'النرجس',
    streetName: 'شارع رقم 10',
    latitude: 24.7136,
    longitude: 46.6753,
    askPrice: 3100000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2023,
    sellerProfile: {
      id: 'profile-1',
      role: UserRole.MARKETER,
      user: { id: 'user-1', fullName: 'فهد السعيد', username: 'fahad_sa' },
    },
    photos: [
      { id: 'p1', fileUrl: 'https://s3.local/photo1.jpg?signed=true', mimeType: 'image/jpeg' },
      { id: 'p2', fileUrl: 'https://s3.local/photo2.jpg?signed=true', mimeType: 'image/jpeg' },
    ],
    documents: [],
    totalViews: 12,
    totalFavorites: 3,
    isFavorited: false,
    offersCount: 0,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
    // Private-viewer fields a buyer must never receive or render
    payoutIban: 'SA0380000000608010167519',
    mobileNumber: '+966501234567',
    email: 'fahad@example.com',
    nationalId: '1010101010',
    ...overrides,
  } as unknown as ListingDetailItem);

function renderView(overrides: Partial<ListingDetailViewProps> = {}) {
  const full: ListingDetailViewProps = {
    detail: detail(),
    loading: false,
    error: null,
    ...overrides,
  };
  return renderToString(<ListingDetailView {...full} />);
}

describe('Listing detail helpers (Story 3.3)', () => {
  describe('resolveCta', () => {
    it('offers a backup offer on a reserved listing and a submit offer on an active one (AC#5)', () => {
      expect(resolveCta(ListingStatus.RESERVED).label).toBe('عرض احتياطي (Backup Offer)');
      expect(resolveCta(ListingStatus.ACTIVE).label).toBe('تقديم عرض (Submit Offer)');
    });
  });

  describe('isSellerFalVerified', () => {
    it('treats a marketer seller as Fal-verified', () => {
      expect(isSellerFalVerified(detail())).toBe(true);
    });

    it('treats a direct owner as not Fal-verified', () => {
      const owner = detail({
        sellerProfile: {
          id: 'profile-2',
          role: UserRole.OWNER,
          user: { id: 'user-2', fullName: 'سارة', username: 'sara' },
        },
      });
      expect(isSellerFalVerified(owner)).toBe(false);
    });

    it('returns false when there is no seller profile', () => {
      expect(isSellerFalVerified(detail({ sellerProfile: null }))).toBe(false);
    });
  });

  it('formats money LTR with thousand separators', () => {
    expect(formatDetailNumber(3100000)).toBe('3,100,000');
  });

  it('reads the detail payload whether the endpoint returns it bare or wrapped', () => {
    const item = detail();
    expect(unwrapDetailResponse(item)?.id).toBe('listing-1042');
    expect(unwrapDetailResponse({ data: item })?.id).toBe('listing-1042');
    expect(unwrapDetailResponse(null)).toBeNull();
  });
});

describe('Commission calculator widget (AC#3)', () => {
  it('derives commission and total from the ask price using the shared 2.5% rate', () => {
    expect(calculateCommission(3100000)).toBe(77500);
    expect(calculateCommission(1850000)).toBe(46250);
    expect(calculateCommission(0)).toBe(0);
  });

  it('renders ask price, commission, and total for PRD Journey 1 figures', () => {
    const html = renderToString(<CommissionCalculator askPrice={3100000} />);
    expect(html).toContain('3,100,000 ر.س');
    expect(html).toContain('77,500 ر.س');
    expect(html).toContain('3,177,500 ر.س');
    expect(html).toContain('(2.5%)');
    expect(html).toContain('data-testid="commission-calculator"');
  });

  it('recomputes when the listing price changes (no hardcoded numbers)', () => {
    const html = renderToString(<CommissionCalculator askPrice={2000000} />);
    expect(html).toContain('2,000,000 ر.س');
    expect(html).toContain('50,000 ر.س');
    expect(html).toContain('2,050,000 ر.س');
    expect(html).not.toContain('77,500');
  });
});

describe('ListingDetailView rendering (Story 3.3)', () => {
  it('renders gallery, title, description, specs, location, and ask price (AC#1)', () => {
    const html = renderView();
    expect(html).toContain('فيلا مودرن مع مسبح في حي النرجس');
    expect(html).toContain('https://s3.local/photo1.jpg?signed=true');
    expect(html).toContain('فيلا مستقلة راقية بموقع ممتاز');
    expect(html).toContain('حي النرجس، الرياض');
    expect(html).toContain('شارع رقم 10');
    expect(html).toContain('450 م²');
    expect(html).toContain('فيلا');
    expect(html).toContain('3,100,000');
    expect(html).toContain('معلن مرخص (فال)');
  });

  it('renders the build year as a plain year, not a thousands-separated number', () => {
    const html = renderView({ detail: detail({ yearBuilt: 1995 }) });
    expect(html).toContain('سنة البناء');
    expect(html).toContain('>1995<');
    expect(html).not.toContain('1,995');
  });

  it('omits bedrooms and year built when the schema has no values', () => {
    const html = renderView({ detail: detail({ bedrooms: null, yearBuilt: null }) });
    expect(html).toContain('المساحة');
    expect(html).not.toContain('غرف النوم');
    expect(html).not.toContain('سنة البناء');
  });

  it('never fabricates amenities or bathrooms that the data model lacks', () => {
    const html = renderView();
    expect(html).not.toContain('دورات المياه');
    expect(html).not.toContain('المرافق');
  });

  it('shows a neutral rating placeholder instead of a fabricated broker rating', () => {
    const html = renderView();
    expect(html).toContain('التقييم قريباً');
    expect(html).not.toContain('data-testid="seller-rating-stars"');
  });

  it('renders the contact-shielding callout and no direct contact data (AC#4)', () => {
    const html = renderView();
    expect(html).toContain('data-testid="contact-shielding-callout"');
    expect(html).toContain('تبقى بيانات التواصل المباشرة للبائع');
    expect(html).not.toContain('+966501234567');
    expect(html).not.toContain('fahad@example.com');
    expect(html).not.toContain('1010101010');
    expect(html).not.toContain('SA0380000000608010167519');
  });

  it('swaps the primary CTA to a backup offer for reserved listings (AC#5)', () => {
    const reserved = renderView({ detail: detail({ status: ListingStatus.RESERVED }) });
    expect(reserved).toContain('عرض احتياطي (Backup Offer)');
    expect(reserved).not.toContain('تقديم عرض (Submit Offer)');

    const active = renderView({ detail: detail({ status: ListingStatus.ACTIVE }) });
    expect(active).toContain('تقديم عرض (Submit Offer)');
    expect(active).not.toContain('عرض احتياطي (Backup Offer)');
  });

  it('renders a loading skeleton while the detail read is pending (AC#1)', () => {
    const html = renderView({ detail: null, loading: true });
    expect(html).toContain('aria-busy="true"');
  });

  it('renders a structured not-found state on 404 instead of crashing (AC#7)', () => {
    const html = renderView({ detail: null, error: 'not-found' });
    expect(html).toContain('لم نتمكن من العثور على هذا العقار');
    expect(html).toContain('العودة إلى البحث');
    expect(html).not.toContain('حاسبة التكلفة الإجمالية');
  });

  it('renders a structured error state when the read fails for another reason', () => {
    const html = renderView({ detail: null, error: 'failed' });
    expect(html).toContain('تعذر تحميل تفاصيل هذا العقار');
  });

  it('maps the API error envelope to the structured failure state (AC#7)', () => {
    expect(toDetailError(new ApiError(404, 'LISTING_NOT_FOUND', 'غير موجود'))).toBe('not-found');
    expect(toDetailError(new ApiError(500, 'INTERNAL_ERROR', 'خطأ'))).toBe('failed');
    expect(toDetailError(new Error('network'))).toBe('failed');
  });

  it('links the seller section to the public broker profile page (Story 6.5 / AC: #9)', () => {
    const html = renderView({
      detail: detail({
        sellerProfile: {
          id: 'profile-marketer-99',
          role: UserRole.MARKETER,
          user: { id: 'user-99', fullName: 'عبدالله الشمري', username: 'abdullah' },
        },
      }),
    });

    expect(html).toContain('data-testid="broker-profile-link"');
    expect(html).toContain('href="/brokers/profile-marketer-99"');
    expect(html).toContain('عبدالله الشمري');
  });

  it('renders thumbnail strip and desktop sticky rail for pricing and CTA', () => {
    const html = renderView();
    expect(html).toContain('data-testid="carousel-thumbnails"');
    expect(html).toContain('lg:sticky');
  });
});
