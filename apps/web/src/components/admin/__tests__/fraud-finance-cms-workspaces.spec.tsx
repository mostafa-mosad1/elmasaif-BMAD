import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  FraudStatus,
  FraudSeverity,
  FraudEventType,
  CmsPageCategory,
  AnnouncementBannerType,
  FaqCategory,
  NoteEntityType,
  PaginatedFraudLogsDto,
  FinancialIndicatorsDto,
  PaginatedFinancialTransactionsDto,
  CmsPageDto,
  AnnouncementBannerDto,
  FaqItemDto,
  OperationalInternalNoteDto,
} from '@elmasaif/shared';
import { FraudManagementWorkspace } from '../fraud-management-workspace';
import { FinancialReportsWorkspace } from '../financial-reports-workspace';
import { CmsAnnouncementsWorkspace } from '../cms-announcements-workspace';
import { OperationalInternalNotesCard } from '../operational-internal-notes-card';

// Mock Next navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
  useParams: () => ({ slug: 'terms-of-service' }),
}));

describe('FraudManagementWorkspace SSR (Story 8.9 / AC3)', () => {
  const mockFraudData: PaginatedFraudLogsDto = {
    items: [
      {
        id: 'fraud-log-1',
        caseNumber: 'FRD-2026-0001',
        targetUserId: 'user-suspect-1',
        targetListingId: 'listing-fake-1',
        targetDealId: null,
        eventType: FraudEventType.REPEATED_REJECTED_PROOFS,
        severity: FraudSeverity.CRITICAL,
        status: FraudStatus.OPEN,
        description: 'رفع إيصال تحويل مصرفي مكرر ومعدل بالفوتوشوب',
        reasons: ['مطابقة الصورة في هاش سابق', 'اختلاف الخط في رقم الحساب'],
        penaltyAmountSar: 5000,
        marketerSuspended: true,
        loggedByAdminId: 'admin-1',
        loggedByAdminName: 'عبدالرحمن المشرف',
        resolvedByAdminId: null,
        resolvedByAdminName: null,
        resolutionNotes: null,
        resolvedAt: null,
        createdAt: '2026-11-15T10:00:00.000Z',
        updatedAt: '2026-11-15T10:00:00.000Z',
        targetUser: {
          id: 'user-suspect-1',
          firstName: 'سالم',
          lastName: 'المخالف',
          email: 'salem@example.com',
          phone: '+966500000001',
        },
      },
    ],
    totalCount: 1,
    page: 1,
    limit: 15,
    totalPages: 1,
  };

  it('renders fraud workspace with case numbers, severity, and event type labels', () => {
    const html = renderToString(<FraudManagementWorkspace initialData={mockFraudData} />);

    expect(html).toContain('سجل إدارة مكافحة الاحتيال والأنشطة المشبوهة');
    expect(html).toContain('FRD-2026-0001');
    expect(html).toContain('تكرار رفض إثباتات الدفع');
    expect(html).toContain('حرج جداً (Critical)');
    expect(html).toContain('مفتوحة قيد المتابعة');
    expect(html).toContain('سالم المخالف');
    expect(html).toContain('تسجيل حالة اشتباه');
  });

  it('renders empty state when there are no fraud logs', () => {
    const emptyData: PaginatedFraudLogsDto = {
      items: [],
      totalCount: 0,
      page: 1,
      limit: 15,
      totalPages: 1,
    };

    const html = renderToString(<FraudManagementWorkspace initialData={emptyData} />);
    expect(html).toContain('لا توجد حالات احتيال مسجلة مطابقة للفلاتر');
  });
});

describe('FinancialReportsWorkspace SSR (Story 8.9 / AC4)', () => {
  const mockIndicators: FinancialIndicatorsDto = {
    grossTransactionVolumeSar: 2500000,
    confirmedCommissionsSar: 62500,
    collectedContractFeesSar: 3500,
    totalVatSar: 9900,
    totalNetRevenueSar: 75900,
    completedDealsCount: 5,
    signedContractsCount: 7,
  };

  const mockTransactions: PaginatedFinancialTransactionsDto = {
    items: [
      {
        id: 'deal-tx-1',
        type: 'DEAL_COMMISSION',
        referenceCode: 'COMM-2026-001',
        date: '2026-11-14T12:00:00.000Z',
        propertyTitle: 'فيلا مودرن فاخرة بحي النرجس',
        city: 'الرياض',
        propertyType: 'VILLA',
        grossValueSar: 2000000,
        feeSar: 50000,
        vatSar: 7500,
        totalSar: 57500,
        counterpartyName: 'شركة الأفق للاستثمار',
        status: 'CONFIRMED',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  it('renders financial KPI cards, 15% VAT, and transaction table', () => {
    const html = renderToString(
      <FinancialReportsWorkspace
        initialIndicators={mockIndicators}
        initialTransactions={mockTransactions}
      />,
    );

    expect(html).toContain('المؤشرات المالية وتقارير العمليات المحاسبية');
    expect(html).toContain('تصدير تقرير محاسبي (Excel / CSV)');
    expect(html).toContain('إجمالي حجم المبيعات');
    expect(html).toContain('عمولات السعي المعتمدة');
    expect(html).toContain('رسوم العقود المحصلة');
    expect(html).toContain('ضريبة القيمة المضافة (15%)');
    expect(html).toContain('صافي إيرادات المنصة');
    expect(html).toContain('COMM-2026-001');
    expect(html).toContain('فيلا مودرن فاخرة بحي النرجس');
    expect(html).toContain('الرياض');
    expect(html).toContain('شركة الأفق للاستثمار');
  });
});

describe('CmsAnnouncementsWorkspace SSR (Story 8.9 / AC5)', () => {
  const mockPages: CmsPageDto[] = [
    {
      id: 'page-terms',
      slug: 'terms-of-service',
      title: 'الشروط والأحكام العامة',
      category: CmsPageCategory.LEGAL_TERMS,
      content: '# الشروط والأحكام لمنصة المصايف',
      summary: 'شروط استخدام المنصة والتعاملات العقارية',
      isPublished: true,
      displayOrder: 1,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    },
  ];

  const mockBanners: AnnouncementBannerDto[] = [
    {
      id: 'banner-1',
      title: 'تحديث اشتراطات رخصة فال',
      content: 'نود تذكير الوسطاء بضرورة تجديد ترخيص الهيئة العامة للعقار.',
      bannerType: AnnouncementBannerType.WARNING,
      isActive: true,
      actionUrl: '/pages/guide',
      actionText: 'التفاصيل',
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    },
  ];

  const mockFaqs: FaqItemDto[] = [
    {
      id: 'faq-1',
      questionAr: 'كيف يتم توثيق الهوية الوطنية للمشتري؟',
      answerAr: 'يتم التوثيق عبر النفاذ الوطني الموحد بشكل فوري.',
      category: FaqCategory.BUYER,
      displayOrder: 1,
      isPublished: true,
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
    },
  ];

  it('renders CMS pages tab with title, slug, and publish badge', () => {
    const html = renderToString(
      <CmsAnnouncementsWorkspace
        initialTab="PAGES"
        initialPages={mockPages}
        initialBanners={mockBanners}
        initialFaqs={mockFaqs}
      />,
    );

    expect(html).toContain('نظام إدارة المحتوى (CMS) والتنبيهات');
    expect(html).toContain('الصفحات الثابتة (Static Pages)');
    expect(html).toContain('الشروط والأحكام العامة');
    expect(html).toContain('/pages/terms-of-service');
    expect(html).toContain('منشورة');
  });

  it('renders announcement banners tab with alert type badge and action text', () => {
    const html = renderToString(
      <CmsAnnouncementsWorkspace
        initialTab="BANNERS"
        initialPages={mockPages}
        initialBanners={mockBanners}
        initialFaqs={mockFaqs}
      />,
    );

    expect(html).toContain('أشرطة الإعلانات والتنبيهات (Banners)');
    expect(html).toContain('تحديث اشتراطات رخصة فال');
    expect(html).toContain('تحذير (أصفر)');
    expect(html).toContain('نشط');
  });

  it('renders FAQ tab with question and category', () => {
    const html = renderToString(
      <CmsAnnouncementsWorkspace
        initialTab="FAQ"
        initialPages={mockPages}
        initialBanners={mockBanners}
        initialFaqs={mockFaqs}
      />,
    );

    expect(html).toContain('الأسئلة الشائعة (FAQ)');
    expect(html).toContain('كيف يتم توثيق الهوية الوطنية للمشتري؟');
    expect(html).toContain('المشترون');
  });
});

describe('OperationalInternalNotesCard SSR (Story 8.9 / AC6)', () => {
  it('renders internal staff confidentiality badge and 1000 character limit notice', () => {
    const html = renderToString(
      <OperationalInternalNotesCard
        entityType={NoteEntityType.PAYMENT}
        entityId="payment-12345"
      />,
    );

    expect(html).toContain('الملاحظات التشغيلية الداخلية (Internal Staff Notes)');
    expect(html).toContain('سري - للموظفين فقط');
    expect(html).toContain('1000');
    expect(html).toContain('حرف');
    expect(html).toContain('إضافة الملاحظة');
  });
});
