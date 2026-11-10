import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SellerDealsPipeline } from '../seller-deals-pipeline';
import { DealStatus, SellerDealItemDto } from '@elmasaif/shared';

describe('SellerDealsPipeline Component (Story 6.4 / AC-4)', () => {
  const activeDeals: SellerDealItemDto[] = [
    {
      id: 'd-1',
      dealNumber: 'DL-001',
      dealReferenceCode: 'REF-001',
      listingId: 'l-1',
      listingTitle: 'فيلا حي النرجس',
      cityName: 'الرياض',
      districtName: 'النرجس',
      dealPrice: '2000000.00',
      platformCommission: '50000.00',
      status: DealStatus.AWAITING_PAYMENT_PROOF,
      paymentDeadline: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
      paymentWindowHours: 48,
      buyer: {
        fullName: 'ط*** ش***',
      },
      sellerCancellationRequestedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'd-2',
      dealNumber: 'DL-002',
      dealReferenceCode: 'REF-002',
      listingId: 'l-2',
      listingTitle: 'شقة حي حطين',
      cityName: 'الرياض',
      districtName: 'حطين',
      dealPrice: '1500000.00',
      platformCommission: '37500.00',
      status: DealStatus.COMPLETED,
      paymentDeadline: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      paymentWindowHours: 48,
      buyer: {
        fullName: 'سعد العتيبي',
        phone: '0551122334',
        email: 'saad@example.com',
      },
      sellerCancellationRequestedAt: null,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders pipeline stages, deal cards, and financial figures', () => {
    const html = renderToString(
      <SellerDealsPipeline
        activeDeals={activeDeals}
        stageBreakdown={{
          AWAITING_PAYMENT_PROOF: 1,
          UNDER_ADMIN_AUDIT: 0,
          PAYMENT_REJECTED: 0,
          DISPUTED: 0,
          COMPLETED: 1,
          CANCELLED: 0,
          TERMINATED: 0,
        }}
        metrics={{
          totalDealsCount: 2,
          activeDealsCount: 1,
          completedDealsCount: 1,
          disputedDealsCount: 0,
          cancelledDealsCount: 0,
          totalCompletedVolume: '1500000.00',
          projectedActiveVolume: '2000000.00',
          earnedCommissionTotal: '37500.00',
          pendingCommissionForecast: '50000.00',
        }}
      />,
    );

    // Section title
    expect(html).toContain('مسار الصفقات والعمليات الجارية');

    // Commission metrics in pipeline header
    expect(html).toContain('50,000');
    expect(html).toContain('37,500');

    // Funnel filter tabs
    expect(html).toContain('بانتظار سداد المشتري');
    expect(html).toContain('الصفقات المنجزة');

    // Deal 1 (Awaiting payment)
    expect(html).toContain('DL-001');
    expect(html).toContain('REF-001');
    expect(html).toContain('فيلا حي النرجس');
    expect(html).toContain('2,000,000');
    expect(html).toContain('طلب إلغاء الصفقة');

    // Deal 2 (Completed)
    expect(html).toContain('DL-002');
    expect(html).toContain('REF-002');
    expect(html).toContain('شقة حي حطين');
    expect(html).toContain('سعد العتيبي');
    expect(html).toContain('0551122334');
    expect(html).toContain('saad@example.com');
  });

  it('renders friendly empty state when active deals list is empty', () => {
    const html = renderToString(<SellerDealsPipeline activeDeals={[]} />);
    expect(html).toContain('لا توجد صفقات جارية في هذا المسار');
    expect(html).toContain('عند قبول عرض شراء وتحويله لصفقة رسمية');
  });
});

