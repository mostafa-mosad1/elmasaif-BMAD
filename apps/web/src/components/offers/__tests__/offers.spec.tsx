import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ListingStatus, OfferStatus, PropertyType } from '@elmasaif/shared';
import { unwrapOffersPayload, countActiveOffers } from '../offers-view';
import { BuyerOffersList } from '../buyer-offers-list';
import { OfferStatusBadge } from '../offer-status-badge';
import { OfferSubmitForm } from '../offer-submit-form';
import { unwrapOfferThreadPayload, resolveOfferActions } from '../offer-negotiation-view';
import { OfferNegotiationTimeline } from '../offer-negotiation-timeline';
import { SellerOffersList } from '../seller-offers-list';
import type { OfferHistoryEntry, OfferItem, OfferThreadItem, OfferThreadSummary } from '@elmasaif/shared';

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

// ---------------------------------------------------------------------------------------------
// Story 4.2 — mediated counter-offer rounds & seller responses (FR-26, FR-55, AC#8, AC#10)
// ---------------------------------------------------------------------------------------------

const historyEntry = (overrides: Partial<OfferHistoryEntry> = {}): OfferHistoryEntry => ({
  id: 'history-1',
  action: 'OFFER_SUBMITTED',
  actorRole: 'BUYER',
  actorName: 'مشتري',
  priceSnapshot: 1150000,
  notes: null,
  roundNumber: 0,
  createdAt: inDays(0),
  ...overrides,
});

const threadItem = (overrides: Partial<OfferThreadItem> = {}): OfferThreadItem => ({
  id: 'offer-1',
  status: OfferStatus.RELAYED_TO_SELLER,
  offerPrice: 1150000,
  askPrice: ASK_PRICE,
  isBackup: false,
  isLowPrice: false,
  negotiationRound: 1,
  maxCounterRounds: 5,
  awaitingParty: 'SELLER',
  expiresAt: inDays(7),
  createdAt: inDays(0),
  buyerName: 'مشتري العرض',
  sellerName: 'وسيط معتمد',
  rejectionReason: null,
  rejectionNote: null,
  listing: offerItem().listing,
  history: [historyEntry()],
  ...overrides,
});

const sellerSummary = (overrides: Partial<OfferThreadSummary> = {}): OfferThreadSummary => ({
  ...threadItem(),
  ...overrides,
});

describe('unwrapOfferThreadPayload (Story 4.2 / AC#8)', () => {
  it('reads the enveloped `{ statusCode, data }` body', () => {
    const thread = threadItem();
    expect(unwrapOfferThreadPayload({ statusCode: 200, data: thread })).toEqual(thread);
  });

  it('reads a bare thread body', () => {
    const thread = threadItem();
    expect(unwrapOfferThreadPayload(thread)).toEqual(thread);
  });

  it('is nullish-safe and rejects bodies without a history array', () => {
    expect(unwrapOfferThreadPayload(null)).toBeNull();
    expect(unwrapOfferThreadPayload(undefined)).toBeNull();
    expect(unwrapOfferThreadPayload({})).toBeNull();
    expect(unwrapOfferThreadPayload('not-an-object')).toBeNull();
    expect(unwrapOfferThreadPayload({ id: 'offer-1' })).toBeNull();
  });
});

describe('resolveOfferActions (Story 4.2 / AC#2, AC#3)', () => {
  it('gives the seller accept, reject and counter while the offer waits on them', () => {
    expect(
      resolveOfferActions(
        { awaitingParty: 'SELLER', negotiationRound: 1, maxCounterRounds: 5 },
        'SELLER',
      ),
    ).toEqual({ canAccept: true, canReject: true, canCounter: true });
  });

  it('never lets the buyer reject (silence is handled by expiry, not a veto)', () => {
    expect(
      resolveOfferActions(
        { awaitingParty: 'BUYER', negotiationRound: 1, maxCounterRounds: 5 },
        'BUYER',
      ),
    ).toEqual({ canAccept: true, canReject: false, canCounter: true });
  });

  it('offers nothing while the message is with the administration', () => {
    expect(
      resolveOfferActions(
        { awaitingParty: 'ADMIN', negotiationRound: 1, maxCounterRounds: 5 },
        'SELLER',
      ),
    ).toEqual({ canAccept: false, canReject: false, canCounter: false });
  });

  it('keeps acceptance open at the round cap but drops the counter-offer', () => {
    expect(
      resolveOfferActions(
        { awaitingParty: 'BUYER', negotiationRound: 5, maxCounterRounds: 5 },
        'BUYER',
      ),
    ).toEqual({ canAccept: true, canReject: false, canCounter: false });
  });

  it('offers nothing on a terminal offer (awaitingParty === null)', () => {
    expect(
      resolveOfferActions(
        { awaitingParty: null, negotiationRound: 3, maxCounterRounds: 5 },
        'SELLER',
      ),
    ).toEqual({ canAccept: false, canReject: false, canCounter: false });
    expect(resolveOfferActions(null, 'BUYER')).toEqual({
      canAccept: false,
      canReject: false,
      canCounter: false,
    });
  });
});

describe('OfferNegotiationTimeline (Story 4.2 / AC#8)', () => {
  it('renders every action label, actor chip, round chip and price snapshot', () => {
    const html = renderToString(
      <OfferNegotiationTimeline
        history={[
          historyEntry({ id: 'h-1', action: 'OFFER_SUBMITTED', notes: 'جاهز للتفاوض' }),
          historyEntry({
            id: 'h-2',
            action: 'OFFER_COUNTER_BY_SELLER',
            actorRole: 'SELLER',
            priceSnapshot: 1180000,
            roundNumber: 1,
          }),
          historyEntry({
            id: 'h-3',
            action: 'OFFER_RELAYED_TO_BUYER',
            actorRole: 'ADMIN',
            priceSnapshot: 1180000,
            roundNumber: 1,
          }),
        ]}
      />,
    );

    expect(html).toContain('تقديم العرض');
    expect(html).toContain('عرض مقابل من البائع');
    expect(html).toContain('إحالة العرض المضاد إلى المشتري');
    expect(html).toContain('المشتري');
    expect(html).toContain('البائع');
    expect(html).toContain('إدارة المنصة');
    expect(html).toContain('الجولة 1 من 5');
    expect(html).toContain('جاهز للتفاوض');
    expect(html).toContain('1,180,000');
    expect(html).toContain('offer-timeline-entry-h-2');
  });

  it('renders the empty placeholder before the first round', () => {
    const html = renderToString(<OfferNegotiationTimeline history={[]} />);
    expect(html).toContain('لم يبدأ التفاوض بعد');
    expect(html).toContain('data-empty="true"');
  });
});

describe('SellerOffersList (Story 4.2 / AC#10)', () => {
  it('renders the buyer, prices, round counter, expiry and the «بانتظار ردك» chip', () => {
    const html = renderToString(
      <SellerOffersList
        offers={[sellerSummary({ id: 'offer-9', awaitingParty: 'SELLER', negotiationRound: 2 })]}
        detailHrefBase="/app/marketer/offers"
      />,
    );

    expect(html).toContain('فيلا شمال الطائف');
    expect(html).toContain('مشتري العرض');
    expect(html).toContain('1,150,000');
    expect(html).toContain('جولة 2 من 5');
    expect(html).toContain('بانتظار ردك');
    expect(html).toContain('متبقي');
    expect(html).toContain('/app/marketer/offers/offer-9');
    expect(html).toContain('فتح التفاوض');
  });

  it('shows the awaiting-administration label instead of the reply chip', () => {
    const html = renderToString(
      <SellerOffersList offers={[sellerSummary({ awaitingParty: 'ADMIN' })]} />,
    );
    expect(html).not.toContain('بانتظار ردك');
    expect(html).toContain('بانتظار الإدارة');
    expect(html).not.toContain('فتح التفاوض');
  });

  it('renders the empty state when no offer has been received', () => {
    const html = renderToString(<SellerOffersList offers={[]} />);
    expect(html).toContain('لا توجد عروض واردة بعد');
  });
});

describe('BuyerOffersList — Story 4.2 additions', () => {
  it('renders the round counter, the reply chip and the opt-in detail link', () => {
    const html = renderToString(
      <BuyerOffersList
        offers={[offerItem({ id: 'offer-7', awaitingParty: 'BUYER', negotiationRound: 3 })]}
        detailHrefBase="/app/buyer/offers"
      />,
    );

    expect(html).toContain('بانتظار ردك');
    expect(html).toContain('جولة 3 من 5');
    expect(html).toContain('/app/buyer/offers/offer-7');
  });

  it('omits the link and the new chips when the 4.1 props are all that is passed', () => {
    const html = renderToString(<BuyerOffersList offers={[offerItem()]} />);
    expect(html).not.toContain('فتح التفاوض');
    expect(html).not.toContain('بانتظار ردك');
    expect(html).not.toContain('جولة ');
  });
});

// ---------------------------------------------------------------------------------------------
// Story 4.3 — backup offer legibility on the buyer & seller surfaces (FR-27, AC#10)
// ---------------------------------------------------------------------------------------------

describe('OfferStatusBadge — CLOSED_BACKUP (Story 4.3 / AC#10)', () => {
  it('renders the closed-backup label instead of a blank badge', () => {
    const html = renderToString(<OfferStatusBadge status={OfferStatus.CLOSED_BACKUP} />);
    expect(html).toContain('مغلق — اكتملت الصفقة الأساسية');
  });
});

describe('BuyerOffersList — backup chips (Story 4.3 / AC#10)', () => {
  it('marks an activated backup separately from a reserve bid', () => {
    const html = renderToString(
      <BuyerOffersList
        offers={[
          offerItem({ id: 'offer-b1', isBackup: true, activatedAt: null }),
          offerItem({ id: 'offer-b2', isBackup: true, activatedAt: inDays(1) }),
        ]}
      />,
    );

    expect(html).toContain('data-testid="buyer-offer-backup-offer-b1"');
    expect(html).not.toContain('buyer-offer-backup-activated-offer-b1');
    expect(html).toContain('data-testid="buyer-offer-backup-activated-offer-b2"');
    expect(html).toContain('عرض احتياطي مُفعَّل');
  });

  it('never shows an activated chip on a regular offer', () => {
    const html = renderToString(
      <BuyerOffersList offers={[offerItem({ activatedAt: inDays(1) })]} />,
    );
    expect(html).not.toContain('buyer-offer-backup-activated');
  });
});

describe('SellerOffersList — backup chip (Story 4.3 / AC#10)', () => {
  it('tells a reserve bid from an activated one', () => {
    const reserve = renderToString(
      <SellerOffersList offers={[sellerSummary({ id: 'offer-s1', isBackup: true })]} />,
    );
    expect(reserve).toContain('data-testid="seller-offer-backup-offer-s1"');
    expect(reserve).toContain('عرض احتياطي');
    expect(reserve).not.toContain('عرض احتياطي مُفعَّل');

    const activated = renderToString(
      <SellerOffersList
        offers={[sellerSummary({ id: 'offer-s2', isBackup: true, activatedAt: inDays(1) })]}
      />,
    );
    expect(activated).toContain('عرض احتياطي مُفعَّل');
  });

  it('omits the chip for a regular offer', () => {
    const html = renderToString(<SellerOffersList offers={[sellerSummary()]} />);
    expect(html).not.toContain('seller-offer-backup');
  });
});

describe('OfferNegotiationTimeline — backup history rows (Story 4.3 / AC#10)', () => {
  it('labels the backup activation and closure instead of rendering a blank row', () => {
    const html = renderToString(
      <OfferNegotiationTimeline
        history={[
          historyEntry({ id: 'h-10', action: 'OFFER_BACKUP_ACTIVATED', actorRole: 'ADMIN' }),
          historyEntry({
            id: 'h-11',
            action: 'OFFER_BACKUP_CLOSED',
            actorRole: 'SYSTEM',
            actorName: null,
            notes: 'PRIMARY_DEAL_COMPLETED',
          }),
        ]}
      />,
    );

    expect(html).toContain('تفعيل عرض احتياطي');
    expect(html).toContain('إغلاق عرض احتياطي بعد اكتمال الصفقة الأساسية');
    expect(html).toContain('offer-timeline-entry-h-10');
    expect(html).toContain('offer-timeline-entry-h-11');
    expect(html).not.toContain('غير معروف');
  });
});

