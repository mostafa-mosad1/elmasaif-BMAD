import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ListingStatus, OfferStatus, PropertyType } from '@elmasaif/shared';
import { unwrapOffersPayload, countActiveOffers } from '../offers-view';
import { BuyerOffersList } from '../buyer-offers-list';
import { OfferStatusBadge } from '../offer-status-badge';
import { OfferSubmitForm } from '../offer-submit-form';
import type { OfferItem } from '@elmasaif/shared';

vi.mock('../../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/api-client')>(
    '../../../lib/api-client',
  );
  return {
    ...actual,
    apiClient: Object.assign(
      () => Promise.resolve({}),
      {
        get: vi.fn(() => Promise.resolve({ statusCode: 200, data: { items: [] } })),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      },
    ),
  };
});

const ASK_PRICE = 1200000;
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const offerItem = (overrides: Partial<OfferItem> = {}): OfferItem => ({
  id: 'offer-1',
  listingId: 'listing-1',
  status: OfferStatus.PENDING_ADMIN_REVIEW,
  offerPrice: 1150000,
  askPrice: ASK_PRICE,
  isBackup: false,
  isLowPrice: false,
  note: null,
  expiresAt: inDays(7),
  createdAt: new Date().toISOString(),
  listing: {
    id: 'listing-1',
    title: 'فيلا شمال الطائف',
    propertyType: PropertyType.VILLA,
    cityName: 'الطائف',
    districtName: 'الشهداء الشمالية',
    askPrice: ASK_PRICE,
    areaSquareMeters: 300,
    status: ListingStatus.ACTIVE,
  },
  ...overrides,
});

describe('unwrapOffersPayload (Story 4.1 / AC#7)', () => {
  it('reads the enveloped `{ statusCode, data: { items } }` shape', () => {
    const items = [offerItem()];
    expect(unwrapOffersPayload({ statusCode: 200, data: { items } })).toHaveLength(1);
  });

  it('reads a bare `{ items }` body', () => {
    expect(unwrapOffersPayload({ items: [offerItem(), offerItem({ id: 'offer-2' })] })).toHaveLength(
      2,
    );
  });

  it('is nullish-safe and never throws on junk', () => {
    expect(unwrapOffersPayload(null)).toEqual([]);
    expect(unwrapOffersPayload(undefined)).toEqual([]);
    expect(unwrapOffersPayload({})).toEqual([]);
    expect(unwrapOffersPayload('not-an-object')).toEqual([]);
  });
});

describe('countActiveOffers (Story 4.1 / AC#7 dashboard counter)', () => {
  it('counts only non-terminal, unexpired offers', () => {
    const items = [
      offerItem({ id: 'a', status: OfferStatus.PENDING_ADMIN_REVIEW, expiresAt: inDays(7) }),
      offerItem({ id: 'b', status: OfferStatus.RELAYED_TO_SELLER, expiresAt: inDays(1) }),
      offerItem({ id: 'c', status: OfferStatus.EXPIRED, expiresAt: inDays(7) }),
      offerItem({ id: 'd', status: OfferStatus.WITHDRAWN, expiresAt: inDays(7) }),
      // Active status but lapsed: must NOT be reported as «نشط».
      offerItem({ id: 'e', status: OfferStatus.IN_REVIEW, expiresAt: inDays(-1) }),
    ];

    expect(countActiveOffers(items)).toBe(2);
  });

  it('returns 0 for an empty or malformed list', () => {
    expect(countActiveOffers([])).toBe(0);
    expect(countActiveOffers(undefined as unknown as OfferItem[])).toBe(0);
  });
});

describe('OfferStatusBadge (Story 4.1 / AC#10)', () => {
  it('renders the Arabic label for each intake-relevant status', () => {
    expect(renderToString(<OfferStatusBadge status={OfferStatus.PENDING_ADMIN_REVIEW} />)).toContain(
      'قيد المراجعة الإدارية',
    );
    expect(renderToString(<OfferStatusBadge status={OfferStatus.EXPIRED} />)).toContain(
      'منتهي الصلاحية',
    );
  });
});

describe('BuyerOffersList (Story 4.1 / AC#7, AC#10)', () => {
  it('renders the listing, both prices, the status label and the backup chip', () => {
    const html = renderToString(
      <BuyerOffersList offers={[offerItem({ isBackup: true, note: 'جاهز للتسجيل' })]} />,
    );

    expect(html).toContain('فيلا شمال الطائف');
    expect(html).toContain('1,150,000');
    expect(html).toContain('1,200,000');
    expect(html).toContain('قيد المراجعة الإدارية');
    expect(html).toContain('عرض احتياطي');
    expect(html).toContain('جاهز للتسجيل');
    expect(html).toContain('متبقي');
  });

  it('omits the backup chip for a regular offer', () => {
    const html = renderToString(<BuyerOffersList offers={[offerItem()]} />);
    expect(html).not.toContain('عرض احتياطي');
  });

  it('renders the empty state when the buyer has no offers', () => {
    const html = renderToString(<BuyerOffersList offers={[]} />);
    expect(html).toContain('لا توجد عروض شراء بعد');
  });
});

describe('OfferSubmitForm (Story 4.1 / AC#3, AC#4, AC#10)', () => {
  it('renders the price input and the ask price reference', () => {
    const html = renderToString(
      <OfferSubmitForm listingId="listing-1" askPrice={ASK_PRICE} listingStatus={ListingStatus.ACTIVE} />,
    );

    expect(html).toContain('offer-price');
    expect(html).toContain('تقديم عرض شراء');
    expect(html).toContain('1,200,000');
    expect(html).not.toContain('offer-low-price-confirm');
  });

  it('gates a sub-50% price behind the explicit acknowledgement checkbox (BR-11)', () => {
    const html = renderToString(
      <OfferSubmitForm
        listingId="listing-1"
        askPrice={ASK_PRICE}
        listingStatus={ListingStatus.ACTIVE}
        initialPrice={String(Math.round(ASK_PRICE * 0.4))}
      />,
    );

    expect(html).toContain('offer-low-price-gate');
    expect(html).toContain('offer-low-price-confirm');
    expect(html).toContain('أقل من نصف سعر الطلب');
  });

  it('uses the backup-offer framing on a RESERVED listing (AC#4)', () => {
    const html = renderToString(
      <OfferSubmitForm
        listingId="listing-1"
        askPrice={ASK_PRICE}
        listingStatus={ListingStatus.RESERVED}
      />,
    );

    expect(html).toContain('تقديم عرض احتياطي');
    expect(html).toContain('إرسال العرض الاحتياطي');
  });
});
