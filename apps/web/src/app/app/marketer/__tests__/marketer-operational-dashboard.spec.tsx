import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MarketerDashboardPage from '../page';
import { DealStatus, ProfileStatus, PropertyType, SellerDealSummaryDto } from '@elmasaif/shared';

describe('Story 6.4: Marketer Unified Operational Dashboard (AC: 1, 2, 4, 5, 7)', () => {
  const mockDealsSummary: SellerDealSummaryDto = {
    metrics: {
      totalDealsCount: 5,
      activeDealsCount: 2,
      completedDealsCount: 2,
      disputedDealsCount: 0,
      cancelledDealsCount: 1,
      totalCompletedVolume: '5000000.00',
      projectedActiveVolume: '2500000.00',
      earnedCommissionTotal: '125000.00',
      pendingCommissionForecast: '62500.00',
    },
    stageBreakdown: {
      AWAITING_PAYMENT_PROOF: 1,
      UNDER_ADMIN_AUDIT: 1,
      PAYMENT_REJECTED: 0,
      DISPUTED: 0,
      COMPLETED: 2,
      CANCELLED: 1,
      TERMINATED: 0,
    },
    activeDeals: [
      {
        id: 'deal-active-1',
        dealNumber: 'DL-2026-0042',
        dealReferenceCode: 'ELM-042',
        listingId: 'listing-42',
        listingTitle: 'فيلا مودرن في حي النرجس',
        cityName: 'الرياض',
        districtName: 'النرجس',
        dealPrice: '2500000.00',
        platformCommission: '62500.00',
        status: DealStatus.AWAITING_PAYMENT_PROOF,
        paymentDeadline: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
        paymentWindowHours: 48,
        buyer: {
          fullName: 'ط*** ش***',
        },
        sellerCancellationRequestedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'deal-active-2',
        dealNumber: 'DL-2026-0043',
        dealReferenceCode: 'ELM-043',
        listingId: 'listing-43',
        listingTitle: 'شقة فاخرة في حطين',
        cityName: 'الرياض',
        districtName: 'حطين',
        dealPrice: '1200000.00',
        platformCommission: '30000.00',
        status: DealStatus.UNDER_ADMIN_AUDIT,
        paymentDeadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        paymentWindowHours: 48,
        buyer: {
          fullName: 'ف*** د***',
        },
        sellerCancellationRequestedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const mockInquiries = [
    { id: 'inq-1', status: 'RELAYED_TO_SELLER', awaitingParty: 'SELLER' },
    { id: 'inq-2', status: 'RELAYED_TO_SELLER', awaitingParty: 'BUYER' },
    { id: 'inq-3', status: 'PENDING_ADMIN_REVIEW', awaitingParty: null },
  ];

  const mockOffers = [
    { id: 'off-1', status: 'SUBMITTED', awaitingParty: 'SELLER' },
    { id: 'off-2', status: 'COUNTERED_BY_BUYER', awaitingParty: 'SELLER' },
  ];

  const mockListings = [
    {
      id: 'listing-1',
      title: 'فيلا مودرن في حي النرجس',
      status: 'ACTIVE',
      propertyType: PropertyType.VILLA,
      askPrice: '2500000',
      areaSquareMeters: 400,
      cityName: 'الرياض',
      districtName: 'النرجس',
      totalViews: 1250,
      totalImpressions: 5400,
      totalFavorites: 48,
    },
  ];

  describe('KPI Metric Cards & Dynamic Aggregations (AC #1)', () => {
    it('renders dynamic counts for inquiries, offers conversion, and deal pipeline financial metrics', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: {
              id: 'lic-1',
              licenseNumber: 'FAL-12345678',
              status: ProfileStatus.ACTIVE,
              daysRemaining: 180,
            },
          }}
          initialListings={mockListings}
          initialDealsSummary={mockDealsSummary}
          initialInquiries={mockInquiries}
          initialOffers={mockOffers}
        />,
      );

      // Card 1: Active inventory
      expect(html).toContain('العقارات المعروضة');
      expect(html).toContain('نشطة ومعتمدة');

      // Card 2: Engagement & Conversion rate: (2 offers / 1250 views * 100)% = 0.2%
      expect(html).toContain('المشاهدات والتفاعل');
      expect(html).toContain('1,250');
      expect(html).toContain('5,400');
      expect(html).toContain('48');
      expect(html).toContain('0.2');
      expect(html).toContain('تحويل');

      // Card 3: Inquiries count
      expect(html).toContain('استفسارات المشترين');
      expect(html).toContain('data-testid="inquiries-count"');
      expect(html).toContain('>3<'); // 3 inquiries
      expect(html).toContain('/app/marketer/inquiries');

      // Card 4: Deals & Commission totals
      expect(html).toContain('الصفقات والعمولات');
      expect(html).toContain('data-testid="deals-count"');
      expect(html).toContain('>5<'); // 5 total deals
      expect(html).toContain('data-testid="earned-commission-total"');
      expect(html).toContain('125,000'); // earned commission total
    });
  });

  describe('Deal Pipeline Funnel & Stage Tracker (AC #4)', () => {
    it('renders the interactive deal pipeline with operational stage counts and deal cards', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: { id: 'lic-1', status: ProfileStatus.ACTIVE, daysRemaining: 100 },
          }}
          initialListings={mockListings}
          initialDealsSummary={mockDealsSummary}
          initialInquiries={mockInquiries}
          initialOffers={mockOffers}
        />,
      );

      // Pipeline Header & Funnel tabs
      expect(html).toContain('مسار الصفقات والعمليات الجارية');
      expect(html).toContain('بانتظار سداد المشتري');
      expect(html).toContain('قيد التدقيق الإداري');
      expect(html).toContain('مهلة تصحيح / نزاع');

      // Active deals cards
      expect(html).toContain('DL-2026-0042');
      expect(html).toContain('ELM-042');
      expect(html).toContain('فيلا مودرن في حي النرجس');
      expect(html).toContain('ط*** ش***'); // Masked buyer name
      expect(html).toContain('2,500,000');
      expect(html).toContain('62,500');

      // Countdown chip for deal awaiting payment
      expect(html).toContain('data-testid="deal-countdown-chip"');

      // Pre-payment cancellation request action button
      expect(html).toContain('طلب إلغاء الصفقة');
      expect(html).toContain('data-testid="cancel-deal-btn-deal-active-1"');

      // Audit status badge for second active deal
      expect(html).toContain('DL-2026-0043');
      expect(html).toContain('الإيصالات مرفوعة - بانتظار اعتماد الإدارة');
    });
  });

  describe('Quick-Action Shortcuts Bar (AC #5)', () => {
    it('renders action bar shortcuts for offers, inquiries, demands, and payout IBAN', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: { id: 'lic-1', status: ProfileStatus.ACTIVE, daysRemaining: 100 },
          }}
          initialListings={mockListings}
          initialDealsSummary={mockDealsSummary}
          initialInquiries={mockInquiries}
          initialOffers={mockOffers}
        />,
      );

      // Quick action shortcuts bar container
      expect(html).toContain('data-testid="quick-actions-bar"');

      // Offers awaiting response shortcut
      expect(html).toContain('العروض الواردة');
      expect(html).toContain('data-testid="offers-awaiting-badge"');
      expect(html).toContain('بانتظارك');
      expect(html).toContain('/app/marketer/offers');

      // Inquiries inbox shortcut
      expect(html).toContain('صندوق الاستفسارات');
      expect(html).toContain('/app/marketer/inquiries');

      // Market demands shortcut
      expect(html).toContain('طلبات الشراء المطابقة');
      expect(html).toContain('/app/marketer/demands');

      // Payout settings shortcut
      expect(html).toContain('الحساب البنكي للصرف');
      expect(html).toContain('/app/settings/payout');
    });
  });

  describe('Fal Licensing Preventive Guardrails (AC #2)', () => {
    it('renders pulsing amber review banner when status is RENEWAL_UNDER_REVIEW', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: {
              id: 'lic-1',
              status: ProfileStatus.RENEWAL_UNDER_REVIEW,
              daysRemaining: 10,
            },
          }}
          initialListings={[]}
          initialDealsSummary={mockDealsSummary}
        />,
      );

      expect(html).toContain('data-testid="fal-renewal-review-card"');
      expect(html).toContain('طلب تجديد رخصة فال قيد التدقيق الإداري');
      expect(html).toContain('مراجعة إدارية (24 ساعة)');
      expect(html).toContain('متابعة حالة الطلب');
    });

    it('renders golden verified badge when active and license has >30 days remaining', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: {
              id: 'lic-1',
              licenseNumber: 'FAL-99887766',
              status: ProfileStatus.ACTIVE,
              daysRemaining: 120,
            },
          }}
          initialListings={[]}
          initialDealsSummary={mockDealsSummary}
        />,
      );

      expect(html).toContain('رخصة فال للوساطة والتسويق العقاري معتمدة وسارية');
      expect(html).toContain('معتمد نظامياً');
      expect(html).toContain('FAL-99887766');
      expect(html).toContain('تفاصيل الرخصة والامتثال');
      expect(html).toContain('إضافة عقار جديد');
      // Button is enabled (does not have disabled attribute)
      expect(html).not.toContain('disabled=""');
    });
  });

  describe('Empty States & Resilience (AC #7)', () => {
    it('renders institutional empty state for new marketer with 0 deals and 0 listings', () => {
      const html = renderToString(
        <MarketerDashboardPage
          initialLoading={false}
          initialFalData={{
            profile: { id: 'prof-1', status: ProfileStatus.ACTIVE },
            falLicense: { id: 'lic-1', status: ProfileStatus.ACTIVE, daysRemaining: 90 },
          }}
          initialListings={[]}
          initialDealsSummary={{
            metrics: {
              totalDealsCount: 0,
              activeDealsCount: 0,
              completedDealsCount: 0,
              disputedDealsCount: 0,
              cancelledDealsCount: 0,
              totalCompletedVolume: '0.00',
              projectedActiveVolume: '0.00',
              earnedCommissionTotal: '0.00',
              pendingCommissionForecast: '0.00',
            },
            stageBreakdown: {
              AWAITING_PAYMENT_PROOF: 0,
              UNDER_ADMIN_AUDIT: 0,
              PAYMENT_REJECTED: 0,
              DISPUTED: 0,
              COMPLETED: 0,
              CANCELLED: 0,
              TERMINATED: 0,
            },
            activeDeals: [],
          }}
          initialInquiries={[]}
          initialOffers={[]}
        />,
      );

      // Pipeline empty state
      expect(html).toContain('data-testid="empty-deals-pipeline"');
      expect(html).toContain('لا توجد صفقات جارية في هذا المسار');

      // Global listings empty state
      expect(html).toContain('لا توجد عقارات مضافة في محفظتك');
      expect(html).toContain('إضافة عقار جديد');
    });
  });
});
