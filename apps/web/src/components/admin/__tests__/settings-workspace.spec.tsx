import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  PlatformSettingsDto,
  PlatformSettingsAuditEntryDto,
} from '@elmasaif/shared';
import { SettingsWorkspace } from '../settings-workspace';
import { CommissionCalculator } from '../../listings/commission-calculator';

const mockSettings: PlatformSettingsDto = {
  id: 'default',
  commissionRate: 0.025,
  commissionRatePercentage: 2.5,
  fixedFeeAmountSar: 0,
  ownerContractFeeSar: 1000,
  vatRatePercentage: 15,
  platformCollectionIban: 'SA0380000000608010167519',
  platformAccountHolderName: 'شركة المصايف العقارية المحدودة',
  platformBankName: 'البنك الأهلي السعودي',
  paymentWindowHours: 48,
  paymentCorrectionHours: 12,
  contractFeeDeadlineDays: 7,
  coolingOffPeriodDays: 14,
  dealReviewSlaAlertHours: 4,
  dealReviewSlaEscalationHours: 12,
  dealReviewSlaSuperAdminHours: 24,
  ticketSlaFirstResponseHours: 4,
  ticketSlaResolutionHours: 48,
  taskClaimLeaseMinutes: 15,
  taskClaimHeartbeatMinutes: 5,
  fraudRejectedProofThreshold: 3,
  fraudWindowHours: 72,
  updatedByAdminId: 'admin-1',
  updatedByAdminName: 'مدير النظام التنفيذي',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const mockAudit: PlatformSettingsAuditEntryDto[] = [
  {
    id: 'audit-1',
    actorId: 'admin-1',
    actorName: 'سلطان القحطاني',
    action: 'PLATFORM_SETTINGS_UPDATED',
    timestamp: '2026-11-12T10:00:00.000Z',
    justificationReason: 'تحديث هوامش العمليات المالية للربع السنوي الجديد وفق قرار مجلس الإدارة',
    ipAddress: '192.168.1.100',
    previousValues: { commissionRatePercentage: 2.5 },
    newValues: { commissionRatePercentage: 3.0 },
    changedKeys: ['commissionRatePercentage'],
  },
];

describe('SettingsWorkspace SSR & Rendering (Story 8.6 / AC5, AC7)', () => {
  it('renders the workspace with all 5 RTL tabs and header', () => {
    const html = renderToString(
      <SettingsWorkspace
        initialSettings={mockSettings}
        initialAudit={mockAudit}
      />,
    );

    expect(html).toContain('إعدادات المنصة والعمولات');
    expect(html).toContain('الرسوم والعمولات');
    expect(html).toContain('المهل الزمنية وفترات السداد');
    expect(html).toContain('اتفاقيات مستوى الخدمة (SLA)');
    expect(html).toContain('ضوابط الامتثال ومكافحة الاحتيال');
    expect(html).toContain('سجل تدقيق التعديلات');
    expect(html).toContain('حفظ التعديلات');
  });

  it('renders fee parameters and live commission simulator', () => {
    const html = renderToString(
      <SettingsWorkspace
        initialSettings={mockSettings}
        initialAudit={mockAudit}
      />,
    );

    expect(html).toContain('نسبة عمولة المنصة (%)');
    expect(html).toContain('رسوم عقد المالك المباشر القياسية (ر.س)');
    expect(html).toContain('نسبة ضريبة القيمة المضافة ZATCA (%)');
    expect(html).toContain('حساب المنصة البنكي المعتمد للتحصيل');
    expect(html).toContain('محاكي الاحتساب المباشر للعمولة');
    expect(html).toContain('SA0380000000608010167519');
  });

  it('renders audit entries with actor name and justification reason', () => {
    const html = renderToString(
      <SettingsWorkspace
        initialSettings={mockSettings}
        initialAudit={mockAudit}
      />,
    );

    expect(html).toContain('سجل تدقيق التعديلات');
    expect(html).toContain('1');
  });
});

describe('CommissionCalculator Dynamic Integration (Story 8.6 / AC6)', () => {
  it('calculates with default 2.5% platform commission', () => {
    const html = renderToString(
      <CommissionCalculator askPrice={2000000} />,
    );

    expect(html).toContain('حاسبة التكلفة الإجمالية');
    expect(html).toContain('2,000,000 ر.س');
    expect(html).toContain('50,000 ر.س'); // 2,000,000 * 2.5% = 50,000
    expect(html).toContain('2,050,000 ر.س');
    expect(html).toContain('2.5%');
  });

  it('calculates with dynamic commission rate prop (e.g. 3.0%)', () => {
    const html = renderToString(
      <CommissionCalculator askPrice={2000000} commissionRate={0.03} />,
    );

    expect(html).toContain('2,000,000 ر.س');
    expect(html).toContain('60,000 ر.س'); // 2,000,000 * 3.0% = 60,000
    expect(html).toContain('2,060,000 ر.س');
    expect(html).toContain('3%');
  });
});
