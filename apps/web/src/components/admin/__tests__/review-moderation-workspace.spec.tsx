import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  AdminReviewModerationQueueResponseDto,
  AdminReviewModerationDetailDto,
} from '@elmasaif/shared';
import { ReviewModerationWorkspace } from '../review-moderation-workspace';

const mockQueueData: AdminReviewModerationQueueResponseDto = {
  serverTimestamp: '2026-11-12T10:00:00.000Z',
  counts: {
    totalReviews: 18,
    visibleReviews: 14,
    hiddenReviews: 4,
    lowScoreVisibleReviews: 2,
  },
  meta: {
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
  items: [
    {
      id: 'rating-visible-1',
      dealId: 'deal-101',
      dealNumber: 'ELM-2026-00101',
      dealReferenceCode: 'REF-00101',
      listingId: 'listing-101',
      listingTitle: 'فيلا فاخرة مطلة في الهدا — الطائف',
      score: 5,
      comment: 'وسيط محترف وصادق في كافة تفاصيل العقار والإفراغ السريع',
      createdAt: '2026-11-10T14:30:00.000Z',
      isHidden: false,
      hiddenByAdminId: null,
      hiddenByAdminName: null,
      hiddenAt: null,
      hiddenReason: null,
      rater: {
        id: 'buyer-1',
        fullName: 'طارق بن عبدالله الشمري',
        maskedName: 'ط*** ش***',
      },
      targetBroker: {
        userId: 'broker-user-1',
        profileId: 'broker-profile-1',
        fullName: 'محمد بن سالم القحطاني',
        commercialName: 'مؤسسة الأفق العقارية المعتمدة',
        licenseNumber: '1200098765',
        isFalVerified: true,
        publicAverageRating: 4.8,
        publicVisibleReviewsCount: 14,
      },
    },
    {
      id: 'rating-hidden-2',
      dealId: 'deal-102',
      dealNumber: 'ELM-2026-00102',
      dealReferenceCode: 'REF-00102',
      listingId: 'listing-102',
      listingTitle: 'شاليه سياحي في الشفا',
      score: 1,
      comment: 'تعليق يحتوي على ألفاظ مسيئة واتهامات غير موثقة خارج نطاق الصفقة',
      createdAt: '2026-11-11T09:15:00.000Z',
      isHidden: true,
      hiddenByAdminId: 'admin-mod-1',
      hiddenByAdminName: 'سعد بن فهد السديري',
      hiddenAt: '2026-11-11T11:00:00.000Z',
      hiddenReason: 'ألفاظ مسيئة أو تشهير غير نظامي',
      rater: {
        id: 'buyer-2',
        fullName: 'سالم بن راشد الدوسري',
        maskedName: 'س*** د***',
      },
      targetBroker: {
        userId: 'broker-user-1',
        profileId: 'broker-profile-1',
        fullName: 'محمد بن سالم القحطاني',
        commercialName: 'مؤسسة الأفق العقارية المعتمدة',
        licenseNumber: '1200098765',
        isFalVerified: true,
        publicAverageRating: 4.8,
        publicVisibleReviewsCount: 14,
      },
    },
  ],
};

const mockSelectedDetail: AdminReviewModerationDetailDto = {
  ...mockQueueData.items[1],
  auditTrail: [
    {
      id: 'audit-log-99',
      action: 'REVIEW_HIDDEN',
      actorId: 'admin-mod-1',
      actorName: 'سعد بن فهد السديري',
      reason: 'ألفاظ مسيئة أو تشهير غير نظامي',
      previousIsHidden: false,
      isHidden: true,
      createdAt: '2026-11-11T11:00:00.000Z',
      ipAddress: '10.10.0.21',
    },
  ],
};

describe('ReviewModerationWorkspace (Story 8.4 / DESIGN.md #9, FR-19, FR-52)', () => {
  it('renders KPI summary cards, visibility filter tabs, and star rating pills', () => {
    const html = renderToString(
      <ReviewModerationWorkspace initialQueueData={mockQueueData} />,
    );

    expect(html).toContain('إجمالي التقييمات المسجلة');
    expect(html).toContain('مُدرجة في العرض العام ومتوسط التقييم');
    expect(html).toContain('محجوبة إدارياً ومستبعدة من المتوسط');
    expect(html).toContain('تقييمات منخفضة (1-2 ★) معروضة');
    expect(html).toContain('18');
    expect(html).toContain('14');
    expect(html).toContain('4');

    // Filter tabs & star pills
    expect(html).toContain('الكل');
    expect(html).toContain('معروضة للعموم (نشطة)');
    expect(html).toContain('محجوبة إدارياً');
    expect(html).toContain('تقييمات منخفضة (1-2 نجوم)');
    expect(html).toContain('5 ★');
    expect(html).toContain('1 ★');
  });

  it('renders DESIGN.md #9 Review Moderation Cards with inclusion/exclusion badges, buyer identities, and broker reputation context', () => {
    const html = renderToString(
      <ReviewModerationWorkspace initialQueueData={mockQueueData} />,
    );

    // Visible review card & inclusion badge
    expect(html).toContain('ELM-2026-00101');
    expect(html).toContain('فيلا فاخرة مطلة في الهدا — الطائف');
    expect(html).toContain('طارق بن عبدالله الشمري');
    expect(html).toContain('ط*** ش***');
    expect(html).toContain('مؤسسة الأفق العقارية المعتمدة');
    expect(html).toContain('4.8');
    expect(html).toContain('مُدرج في التقييم العام ومتوسط الوسيط');
    expect(html).toContain('إخفاء التقييم');

    // Hidden review card & exclusion badge
    expect(html).toContain('ELM-2026-00102');
    expect(html).toContain('محجوب إدارياً — مستبعد من العرض العام ومتوسط التقييم');
    expect(html).toContain('سعد بن فهد السديري');
    expect(html).toContain('ألفاظ مسيئة أو تشهير غير نظامي');
    expect(html).toContain('استعادة التقييم');
    expect(html).toContain('/brokers/broker-profile-1');
  });

  it('renders mandatory justification modal with preset regulatory reason chips and immutable AuditLog side panel', () => {
    const html = renderToString(
      <ReviewModerationWorkspace
        initialQueueData={mockQueueData}
        initialSelectedDetail={mockSelectedDetail}
        initialModalMode="HIDE"
        initialModalTarget={mockQueueData.items[0]}
      />,
    );

    // Modal elements
    expect(html).toContain('تأكيد حجب التقييم من العرض العام');
    expect(html).toContain('ألفاظ مسيئة أو تشهير غير نظامي');
    expect(html).toContain('محتوى كيدي أو غير مرتبط بالصفقة العقارية');
    expect(html).toContain('تضمن بيانات تواصل شخصية مخالفة');

    // Immutable AuditLog side panel
    expect(html).toContain('سجل التدقيق غير القابل للتعديل (AuditLog)');
    expect(html).toContain('audit-log-99');
    expect(html).toContain('REVIEW_HIDDEN');
    expect(html).toContain('سعد بن فهد السديري');
  });
});

