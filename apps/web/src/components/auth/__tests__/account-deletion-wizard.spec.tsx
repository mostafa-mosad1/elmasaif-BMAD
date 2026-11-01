import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AccountDeletionWizard } from '../account-deletion-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('AccountDeletionWizard Component (Story 1.9) (AC: 7)', () => {
  it('renders PDPL disclosure banner, password step, and submit button for eligible user', () => {
    const html = renderToString(
      React.createElement(AccountDeletionWizard, {
        initialEligible: true,
        initialMode: 'COOLING_OFF'
      })
    );

    // PDPL Disclosure
    expect(html).toContain('حقوق الخصوصية والامتثال لنظام حماية البيانات الشخصية السعودي (PDPL)');
    expect(html).toContain('مهلة نظامية 14 يوماً');
    expect(html).toContain('الاحتفاظ النظامي (BR-18)');

    // Step 1: Password input
    expect(html).toContain('منطقة الحذف والأمان (Danger Zone)');
    expect(html).toContain('كلمة المرور الحالية');
    expect(html).toContain('طلب رمز التحقق لحذف الحساب');
  });

  it('renders blocking alert when user is blocked due to active deals or disputes', () => {
    const html = renderToString(
      React.createElement(AccountDeletionWizard, {
        initialEligible: false,
        initialMode: 'BLOCKED',
        initialBlockedReason: 'لا يمكن حذف أو تعطيل الحساب لوجود صفقات عقارية جارية غير مكتملة'
      })
    );

    expect(html).toContain('طلب حذف أو تعطيل الحساب معلق نظامياً');
    expect(html).toContain('لا يمكن حذف أو تعطيل الحساب لوجود صفقات عقارية جارية غير مكتملة');
    expect(html).toContain('عرض الصفقات العقارية');
    expect(html).toContain('عرض النزاعات المفتوحة');
    // Ensure submission form is not rendered while blocked
    expect(html).not.toContain('طلب رمز التحقق لحذف الحساب');
  });

  it('renders pending owner contract blocking notice', () => {
    const html = renderToString(
      React.createElement(AccountDeletionWizard, {
        initialEligible: false,
        initialMode: 'BLOCKED',
        initialBlockedReason: 'لا يمكن حذف أو تعطيل الحساب لوجود طلبات عقارية أو عقود وساطة معلقة الرسوم'
      })
    );

    expect(html).toContain('طلب حذف أو تعطيل الحساب معلق نظامياً');
    expect(html).toContain('عقود وساطة معلقة الرسوم');
  });
});

