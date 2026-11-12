import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  PaginatedAuditLogsDto,
  AuditLogDetailDto,
} from '@elmasaif/shared';
import { AuditLogWorkspace } from '../audit-log-workspace';
import { AuditLogDetailModal } from '../audit-log-detail-modal';

const mockLogsData: PaginatedAuditLogsDto = {
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
  items: [
    {
      id: 'audit-log-1',
      actorId: 'admin-super-1',
      actorType: 'ADMIN',
      actorName: 'سعود المشرف',
      actorRole: 'SUPER_ADMIN',
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PlatformSetting',
      entityId: 'default',
      ipAddress: '192.168.1.1',
      createdAt: '2026-11-12T10:00:00.000Z',
      justificationReason: 'تعديل عمولة المنصة بقرار مجلس الإدارة',
      hasSnapshots: true,
    },
    {
      id: 'audit-log-2',
      actorId: 'sys-cron',
      actorType: 'SYSTEM',
      actorName: 'النظام (System)',
      actorRole: 'SYSTEM',
      action: 'DEAL_TIMEOUT',
      entityType: 'Deal',
      entityId: 'deal-uuid-999',
      ipAddress: null,
      createdAt: '2026-11-12T11:00:00.000Z',
      justificationReason: 'انقضاء مهلة سداد الـ 48 ساعة دون رفع الإشعار',
      hasSnapshots: false,
    },
  ],
};

const mockDetailLog: AuditLogDetailDto = {
  id: 'audit-log-1',
  actorId: 'admin-super-1',
  actorType: 'ADMIN',
  actorName: 'سعود المشرف',
  actorRole: 'SUPER_ADMIN',
  action: 'PLATFORM_SETTINGS_UPDATED',
  entityType: 'PlatformSetting',
  entityId: 'default',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0 Chrome/120',
  createdAt: '2026-11-12T10:00:00.000Z',
  justificationReason: 'تعديل عمولة المنصة بقرار مجلس الإدارة',
  beforeSnapshot: { commissionRate: 0.025 },
  afterSnapshot: { commissionRate: 0.020 },
  changedKeys: ['commissionRate'],
  metadata: { reasonCategory: 'REGULATORY' },
};

describe('AuditLogWorkspace SSR & Rendering (Story 8.7 / AC6, AC7)', () => {
  it('renders workspace title, immutability badge, and filter controls', () => {
    const html = renderToString(<AuditLogWorkspace initialData={mockLogsData} />);

    expect(html).toContain('سجل التدقيق والرقابة (Audit Log)');
    expect(html).toContain('سجل غير قابل للتعديل (Append-Only)');
    expect(html).toContain('فلاتر البحث والاستعلام المتقدم');
    expect(html).toContain('بحث في الإجراء، المنفذ، أو المبرر...');
    expect(html).toContain('جميع الكيانات (All Entities)');
    expect(html).toContain('جميع المنفذين (All Actors)');
    expect(html).toContain('إعادة تعيين الفلاتر');
  });

  it('renders audit entries with action badges, entity type/id, and actor details', () => {
    const html = renderToString(<AuditLogWorkspace initialData={mockLogsData} />);

    // Row 1
    expect(html).toContain('تحديث إعدادات المنصة والعمولات');
    expect(html).toContain('PlatformSetting');
    expect(html).toContain('default');
    expect(html).toContain('سعود المشرف');
    expect(html).toContain('SUPER_ADMIN');
    expect(html).toContain('192.168.1.1');
    expect(html).toContain('تعديل عمولة المنصة بقرار مجلس الإدارة');

    // Row 2
    expect(html).toContain('انتهاء مهلة السداد للصفقة');
    expect(html).toContain('Deal');
    expect(html).toContain('deal-uuid-999');
    expect(html).toContain('النظام (System)');
    expect(html).toContain('عرض التفاصيل');
  });

  it('renders empty state when items list is empty', () => {
    const emptyData: PaginatedAuditLogsDto = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    const html = renderToString(<AuditLogWorkspace initialData={emptyData} />);

    expect(html).toContain('لا توجد سجلات تدقيق تطابق معايير البحث الحالية.');
  });

  it('strictly adheres to read-only guarantees: zero edit, delete, or mutation controls', () => {
    const html = renderToString(<AuditLogWorkspace initialData={mockLogsData} />);

    // Verify absence of mutation actions
    expect(html).not.toContain('تعديل السجل');
    expect(html).not.toContain('حذف السجل');
    expect(html).not.toContain('تراجع عن الإجراء');
    expect(html).not.toContain('مسح السجلات');
  });
});

describe('AuditLogDetailModal SSR & Inspection (Story 8.7 / AC6)', () => {
  it('renders complete forensic detail with before/after snapshots and diff highlights', () => {
    const html = renderToString(
      <AuditLogDetailModal
        isOpen={true}
        onClose={() => {}}
        log={mockDetailLog}
      />,
    );

    expect(html).toContain('تفاصيل سجل التدقيق الرقابي');
    expect(html).toContain('سجل غير قابل للتعديل (Append-Only)');
    expect(html).toContain('معرف السجل:');
    expect(html).toContain('audit-log-1');
    expect(html).toContain('سعود المشرف');
    expect(html).toContain('تعديل عمولة المنصة بقرار مجلس الإدارة');
    expect(html).toContain('الحقول المعدلة في هذه العملية');
    expect(html).toContain('commissionRate');
    expect(html).toContain('الحالة السابقة (Before)');
    expect(html).toContain('الحالة الجديدة (After)');
    expect(html).toContain('نسخ السجل (JSON)');
    expect(html).toContain('0.025');
    expect(html).toContain('0.02');
  });

  it('modal strictly excludes any edit or purge buttons', () => {
    const html = renderToString(
      <AuditLogDetailModal
        isOpen={true}
        onClose={() => {}}
        log={mockDetailLog}
      />,
    );

    expect(html).not.toContain('حذف السجل');
    expect(html).not.toContain('تعديل السجل');
    expect(html).not.toContain('استعادة السجل');
    expect(html).not.toContain('حفظ التعديل');
    expect(html).toContain('سجل تدقيق رقابي غير قابل للتعديل بموجب لائحة الهيئة العامة للعقار (REGA)');
  });
});
