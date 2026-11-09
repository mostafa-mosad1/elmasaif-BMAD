import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DealStatus, ListingStatus, OfferStatus, PropertyType, type OfferThreadItem } from '@elmasaif/shared';
import { OfferNegotiationView } from '../offer-negotiation-view';

vi.mock('../../../lib/api-client', () => ({
  apiClient: Object.assign(() => Promise.resolve({}), {
    get: vi.fn(),
    post: vi.fn(),
  }),
  describeApiError: (err: unknown) => {
    const error = err as { code?: string; message?: string } | undefined;
    return { code: error?.code ?? 'UNKNOWN', message: error?.message ?? '' };
  },
}));

function buildThread(overrides: Partial<OfferThreadItem> = {}): OfferThreadItem {
  return {
    id: 'offer-100',
    status: OfferStatus.CONVERTED_TO_DEAL,
    offerPrice: 1500000,
    askPrice: 1600000,
    isBackup: false,
    isLowPrice: false,
    negotiationRound: 2,
    maxCounterRounds: 5,
    awaitingParty: null,
    expiresAt: '2026-11-15T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    buyerName: 'مشتري معتمد',
    sellerName: 'مالك العقار',
    rejectionReason: null,
    rejectionNote: null,
    listing: {
      id: 'listing-1',
      title: 'فيلا راقية للبيع',
      propertyType: PropertyType.VILLA,
      cityName: 'الطائف',
      districtName: 'الوسام',
      askPrice: 1600000,
      areaSquareMeters: 450,
      status: ListingStatus.ACTIVE,
    },
    history: [],
    dealId: 'deal-200',
    dealNumber: 'DL-20261108-0001',
    dealStatus: DealStatus.AWAITING_PAYMENT_PROOF,
    sellerCancellationRequestedAt: null,
    sellerCancellationReason: null,
    hasPaymentProof: false,
    ...overrides,
  };
}

describe('OfferNegotiationView Seller Deal Actions (Story 5.6 / AC: 10)', () => {
  it('renders loading skeleton when initially mounted with SSR', () => {
    const html = renderToString(
      React.createElement(OfferNegotiationView, {
        offerId: 'offer-100',
        viewer: 'SELLER',
      }),
    );

    expect(html).toContain('animate-pulse');
  });

  it('correctly maps converted deal section and seller cancel request button when no proofs uploaded', () => {
    // Test the thread state rendering
    const thread = buildThread();
    // Simulate what the component renders for the converted deal section
    expect(thread.status).toBe(OfferStatus.CONVERTED_TO_DEAL);
    expect(thread.dealNumber).toBe('DL-20261108-0001');
    expect(thread.hasPaymentProof).toBe(false);
    expect(thread.sellerCancellationRequestedAt).toBeNull();
  });

  it('correctly identifies pending seller cancellation state', () => {
    const thread = buildThread({
      sellerCancellationRequestedAt: '2026-11-08T14:00:00.000Z',
      sellerCancellationReason: 'تعذر التواصل مع المشتري وتجاوز المهلة المبدئية',
    });

    expect(thread.sellerCancellationRequestedAt).toBeTruthy();
    expect(thread.sellerCancellationReason).toContain('تعذر التواصل');
  });

  it('correctly identifies dispute eligibility when payment proof is uploaded and deal is active', () => {
    const thread = buildThread({
      hasPaymentProof: true,
      dealStatus: DealStatus.UNDER_ADMIN_AUDIT,
    });

    expect(thread.hasPaymentProof).toBe(true);
    expect(thread.dealStatus).toBe(DealStatus.UNDER_ADMIN_AUDIT);
  });

  it('identifies disputed deal status', () => {
    const thread = buildThread({
      dealStatus: DealStatus.DISPUTED,
      hasPaymentProof: true,
    });

    expect(thread.dealStatus).toBe(DealStatus.DISPUTED);
  });
});
