import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  SupportTicketsQueueResponseDto,
  SupportTicketDetailDto,
} from '@elmasaif/shared';
import { SupportTicketsWorkspace } from '../support-tickets-workspace';

const mockQueueData: SupportTicketsQueueResponseDto = {
  counts: {
    total: 12,
    open: 5,
    inProgress: 3,
    resolved: 3,
    closed: 1,
    slaNearingBreach: 2,
    slaBreached: 1,
  },
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
  items: [
    {
      id: 'tik-uuid-1',
      ticketNumber: 'TIK-2026-0001',
      userId: 'user-1',
      contactName: 'عبدالله السبيعي',
      contactEmail: 'abdullah@example.com',
      contactPhone: '0555555555',
      category: 'TECHNICAL_ISSUE',
      priority: 'HIGH',
      subject: 'عطل في تحميل إيصال الحوالة',
      description: 'يظهر خطأ عند النقر على تأكيد رفع إيصال العربون.',
      attachments: ['error.png'],
      status: 'OPEN',
      firstResponseDueAt: '2026-11-12T14:00:00.000Z',
      firstRespondedAt: null,
      resolutionDueAt: '2026-11-14T10:00:00.000Z',
      resolvedAt: null,
      closedAt: null,
      assignedAdminId: null,
      assignedAdminName: null,
      assignedAt: null,
      resolutionSummary: null,
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
      firstResponseSla: {
        state: 'NEARING_BREACH',
        dueAt: '2026-11-12T14:00:00.000Z',
        remainingMinutes: 45,
        isBreached: false,
      },
      resolutionSla: {
        state: 'ON_TRACK',
        dueAt: '2026-11-14T10:00:00.000Z',
        remainingMinutes: 2800,
        isBreached: false,
      },
      messagesCount: 2,
    },
  ],
};

const mockDetailData: SupportTicketDetailDto = {
  ...mockQueueData.items[0],
  signedAttachments: ['https://cdn.elmasaif.sa/signed/error.png'],
  messages: [
    {
      id: 'msg-1',
      ticketId: 'tik-uuid-1',
      authorAdminId: null,
      authorUserId: 'user-1',
      authorType: 'USER',
      authorName: 'عبدالله السبيعي',
      message: 'أرجو حل المشكلة عاجلاً لإتمام الصفقة',
      attachments: [],
      isInternal: false,
      createdAt: '2026-11-12T10:05:00.000Z',
    },
    {
      id: 'msg-2',
      ticketId: 'tik-uuid-1',
      authorAdminId: 'admin-1',
      authorUserId: null,
      authorType: 'ADMIN',
      authorName: 'مشرف الدعم الأول',
      message: 'ملاحظة للمشرفين: جاري فحص ملف الـ S3 مع فريق البنية التحتية',
      attachments: [],
      isInternal: true,
      createdAt: '2026-11-12T10:15:00.000Z',
    },
  ],
  auditTrail: [],
};

describe('SupportTicketsWorkspace SSR (Story 8.5 / AC-6, FR-38)', () => {
  it('renders workspace with KPI counts and SLA warning badges', () => {
    const html = renderToString(
      <SupportTicketsWorkspace initialQueueData={mockQueueData} />,
    );

    expect(html).toContain('طابور تذاكر الدعم الفني وخدمة العملاء');
    expect(html).toContain('تذاكر مفتوحة');
    expect(html).toContain('أوشكت مهلة SLA');
    expect(html).toContain('تجاوزت مهلة SLA');
    expect(html).toContain('TIK-2026-0001');
    expect(html).toContain('عطل في تحميل إيصال الحوالة');
    expect(html).toContain('أوشكت مهلة الرد');
  });

  it('renders detailed ticket thread and internal notes when selected', () => {
    const html = renderToString(
      <SupportTicketsWorkspace
        initialQueueData={mockQueueData}
        initialSelectedDetail={mockDetailData}
        canManageNotes={true}
      />,
    );

    expect(html).toContain('سجل المحادثة والملاحظات');
    expect(html).toContain('أرجو حل المشكلة عاجلاً لإتمام الصفقة');
    expect(html).toContain('ملاحظة داخلية');
    expect(html).toContain('جاري فحص ملف الـ S3 مع فريق البنية التحتية');
    expect(html).toContain('ملاحظة داخلية للمشرفين فقط (غير مرئية للعميل)');
    expect(html).toContain('بدء المعالجة');
    expect(html).toContain('حل التذكرة');
  });
});

