import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { VerifyEmailView } from '../verify-email-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams('token=sample-test-token')
}));

describe('VerifyEmailView Component (Story 1.8 Email Verification Landing Page) (AC: 7)', () => {
  it('renders loading state with institutional indicator', () => {
    const html = renderToString(
      React.createElement(VerifyEmailView, {
        state: 'loading'
      })
    );

    expect(html).toContain('جاري التحقق من صلاحية رابط البريد الإلكتروني');
  });

  it('renders success milestone state with verified badge and navigation to profile settings', () => {
    const html = renderToString(
      React.createElement(VerifyEmailView, {
        state: 'success',
        verifiedEmail: 'confirmed.user@domain.sa'
      })
    );

    expect(html).toContain('تم تأكيد البريد الإلكتروني بنجاح');
    expect(html).toContain('أصبح بريدك الإلكتروني الجديد معتمداً ورسمياً لاستلام إشعارات الصفقات والوثائق التعاقدية');
    expect(html).toContain('/app/settings/profile');
    expect(html).toContain('الذهاب إلى إعدادات الحساب');
  });

  it('renders error state with explanatory message and action buttons', () => {
    const html = renderToString(
      React.createElement(VerifyEmailView, {
        state: 'error',
        errorMessage: 'انتهت صلاحية رابط التحقق (24 ساعة). يرجى تسجيل الدخول وطلب رابط جديد من إعدادات الحساب'
      })
    );

    expect(html).toContain('تعذر التحقق من البريد الإلكتروني');
    expect(html).toContain('انتهت صلاحية رابط التحقق (24 ساعة)');
    expect(html).toContain('العودة إلى إعدادات الحساب');
  });
});

