import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PriceSuggestionItem, PriceSuggestionStatus } from '@elmasaif/shared';
import { SellerPriceSuggestionCard } from '../seller-price-suggestion-card';

describe('SellerPriceSuggestionCard SSR (Story 2.5)', () => {
  const pendingSuggestion: PriceSuggestionItem = {
    id: 'sug-100',
    listingId: 'listing-55',
    currentAskPrice: 5000000,
    suggestedPrice: 4500000,
    reason: 'تحليل مقارن لمتوسط أسعار الصفقات المنفذة في الحي للفلل المماثلة',
    status: PriceSuggestionStatus.PENDING,
    suggestedByAdminId: 'admin-mod-1',
    suggestedByAdminName: 'أحمد المراجع العقاري',
    sellerResponseNote: null,
    respondedAt: null,
    createdAt: '2026-11-03T10:00:00.000Z',
  };

  it('renders pending price suggestion card with prices, rationale, and interactive accept/decline action buttons', () => {
    const html = renderToString(
      <SellerPriceSuggestionCard
        listingId="listing-55"
        suggestion={pendingSuggestion}
      />,
    );

    expect(html).toContain('مقترح تعديل السعر الاسترشادي من إدارة التقييم العقاري (FR-57)');
    expect(html).toContain('أحمد المراجع العقاري');
    expect(html).toContain('بانتظار رد البائع');
    expect(html).toContain('5,000,000 SAR');
    expect(html).toContain('4,500,000 SAR');
    expect(html).toContain('-10.0%');
    expect(html).toContain('تحليل مقارن لمتوسط أسعار الصفقات المنفذة في الحي للفلل المماثلة');
    expect(html).toContain('قبول السعر المقترح وتحديث الإعلان');
    expect(html).toContain('رفض المقترح والاحتفاظ بالسعر الحالي');
  });

  it('renders accepted status badge and sellerResponseNote without action buttons when status is ACCEPTED', () => {
    const acceptedSuggestion: PriceSuggestionItem = {
      ...pendingSuggestion,
      status: PriceSuggestionStatus.ACCEPTED,
      sellerResponseNote: 'موافق على المقترح لتسريع عملية البيع',
      respondedAt: '2026-11-03T11:00:00.000Z',
    };

    const html = renderToString(
      <SellerPriceSuggestionCard
        listingId="listing-55"
        suggestion={acceptedSuggestion}
      />,
    );

    expect(html).toContain('تم قبول السعر المقترح');
    expect(html).toContain('موافق على المقترح لتسريع عملية البيع');
    expect(html).not.toContain('قبول السعر المقترح وتحديث الإعلان');
  });

  it('renders declined status badge and sellerResponseNote when status is DECLINED', () => {
    const declinedSuggestion: PriceSuggestionItem = {
      ...pendingSuggestion,
      status: PriceSuggestionStatus.DECLINED,
      sellerResponseNote: 'أفضل التمسك بالسعر الحالي لمميزات العقار الحصرية',
      respondedAt: '2026-11-03T11:30:00.000Z',
    };

    const html = renderToString(
      <SellerPriceSuggestionCard
        listingId="listing-55"
        suggestion={declinedSuggestion}
      />,
    );

    expect(html).toContain('تم رفض المقترح');
    expect(html).toContain('أفضل التمسك بالسعر الحالي لمميزات العقار الحصرية');
    expect(html).not.toContain('رفض المقترح والاحتفاظ بالسعر الحالي</button>');
  });
});

