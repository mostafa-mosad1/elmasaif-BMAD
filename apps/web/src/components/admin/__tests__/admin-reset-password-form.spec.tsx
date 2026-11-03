import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdminResetPasswordForm } from '../admin-reset-password-form';

describe('AdminResetPasswordForm Component (Story 8.1) (AC: 5, 6, 7)', () => {
  it('renders single-use password reset form with complexity requirements when token is provided', () => {
    const html = renderToString(
      <AdminResetPasswordForm token="valid-single-use-reset-token" />
    );

    expect(html).toContain('تعيين كلمة مرور إدارية جديدة');
    expect(html).toContain('كلمة المرور الإدارية الجديدة');
    expect(html).toContain('تأكيد كلمة المرور الجديدة');
    expect(html).toContain('8 خانات على الأقل');
    expect(html).toContain('حرف أبجدي واحد على الأقل');
    expect(html).toContain('رقم واحد على الأقل');
    expect(html).toContain('صالح للاستخدام مرة واحدة فقط ولمدة 15 دقيقة');
  });

  it('renders invalid/missing token warning when token is empty', () => {
    const html = renderToString(<AdminResetPasswordForm token="" />);

    expect(html).toContain('رابط إعادة التعيين غير مكتمل أو غير صالح');
    expect(html).toContain('العودة إلى بوابة دخول المشرفين');
  });
});

