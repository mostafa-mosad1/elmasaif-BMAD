import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  ViolationReportsQueueResponseDto,
  ViolationReportDetailDto,
} from '@elmasaif/shared';
import { ViolationReportsWorkspace } from '../violation-reports-workspace';

const mockQueueData: ViolationReportsQueueResponseDto = {
  counts: {
    total: 10,
    pending: 4,
    underReview: 2,
    resolved: 3,
    dismissed: 1,
  },
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
  items: [
    {
      id: 'rep-uuid-1',
      reportNumber: 'VR-2026-0001',
      reporterUserId: 'user-1',
      reporterName: 'سلمان العتيبي',
      reporterEmail: 'salman@example.com',
      reporterPhone: '0501234567',
      targetType: 'LISTING',
      targetListingId: 'listing-1',
      targetUserId: null,
      category: 'FRAUDULENT_LISTING',
      description: 'هذا الإعلان يحتوي على صك وهمي مكرر وسعر أقل من السوق للنصب.',
      attachments: ['fake-deed.pdf'],
      status: 'PENDING',
      resolutionAction: null,
      resolutionNotes: null,
      assignedAdminId: null,
      assignedAdminName: null,
      assignedAt: null,
      resolvedByAdminId: null,
      resolvedByAdminName: null,
      resolvedAt: null,
      createdAt: '2026-11-12T08:30:00.000Z',
      updatedAt: '2026-11-12T08:30:00.000Z',
      targetPreview: {
        title: 'فيلا فاخرة بمخطط الشروق',
        price: 950000,
        brokerName: 'عقارات الشروق',
        licenseNumber: '1100099887',
      },
    },
  ],
};

const mockDetailData: ViolationReportDetailDto = {
  ...mockQueueData.items[0],
  signedAttachments: ['https://cdn.elmasaif.sa/signed/fake-deed.pdf'],
  auditTrail: [
    {
      id: 'audit-1',
      action: 'VIOLATION_REPORT_CREATED',
      actorAdminName: 'النظام الإداري',
      timestamp: '2026-11-12T08:30:00.000Z',
      details: {},
    },
  ],
};

describe('ViolationReportsWorkspace SSR (Story 8.5 / AC-6, FR-37)', () => {
  it('renders workspace with KPI summary cards and report cards', () => {
    const html = renderToString(
      <ViolationReportsWorkspace initialQueueData={mockQueueData} />,
    );

    expect(html).toContain('طابور بلاغات المخالفات والامتثال');
    expect(html).toContain('إجمالي البلاغات');
    expect(html).toContain('10');
    expect(html).toContain('قيد الانتظار');
    expect(html).toContain('تم اتخاذ إجراء');
    expect(html).toContain('VR-2026-0001');
    expect(html).toContain('إعلان احتيالي / وهمي');
    expect(html).toContain('فيلا فاخرة بمخطط الشروق');
    expect(html).toContain('عقارات الشروق');
    expect(html).toContain('اتخاذ إجراء نظامي');
  });

  it('renders adjudication modal when initialModalMode is ADJUDICATE', () => {
    const html = renderToString(
      <ViolationReportsWorkspace
        initialQueueData={mockQueueData}
        initialModalMode="ADJUDICATE"
        initialModalTarget={mockQueueData.items[0]}
      />,
    );

    expect(html).toContain('اتخاذ إجراء نظامي حيال البلاغ');
    expect(html).toContain('حذف الإعلان المخالف');
    expect(html).toContain('إنذار الوسيط العقاري');
    expect(html).toContain('تجميد حساب المستخدم');
    expect(html).toContain('مبررات وتفاصيل القرار');
  });

  it('renders dismissal modal when initialModalMode is DISMISS', () => {
    const html = renderToString(
      <ViolationReportsWorkspace
        initialQueueData={mockQueueData}
        initialModalMode="DISMISS"
        initialModalTarget={mockQueueData.items[0]}
      />,
    );

    expect(html).toContain('استبعاد البلاغ');
    expect(html).toContain('تأكيد الاستبعاد');
  });

  it('renders detail panel with signed attachments and audit trail', () => {
    const html = renderToString(
      <ViolationReportsWorkspace
        initialQueueData={mockQueueData}
        initialSelectedDetail={mockDetailData}
      />,
    );

    expect(html).toContain('المستندات والأدلة المرفقة');
    expect(html).toContain('https://cdn.elmasaif.sa/signed/fake-deed.pdf');
    expect(html).toContain('سجل الإجراءات والتدقيق (Immutable Audit)');
    expect(html).toContain('VIOLATION_REPORT_CREATED');
  });
});
