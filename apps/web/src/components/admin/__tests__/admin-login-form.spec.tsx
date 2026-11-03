import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdminLoginForm } from '../admin-login-form';

describe('AdminLoginForm Component (Story 8.1) (AC: 2, 6, 7)', () => {
  it('renders isolated administrative login form with RTL fields, 8-hour inactivity notice, and Super Admin recovery guidance', () => {
    const html = renderToString(<AdminLoginForm />);

    expect(html).toContain('بوابة الإدارة السيادية');
    expect(html).toContain('اسم المستخدم أو البريد الإلكتروني الإداري');
    expect(html).toContain('كلمة المرور الإدارية');
    expect(html).toContain('تسجيل الدخول إلى بوابة الإدارة');
    expect(html).toContain('8 ساعات');
    expect(html).toContain('المشرف العام (Super Admin)');
  });

  it('renders 15-minute brute-force lockout banner when initialLockoutSeconds > 0', () => {
    const html = renderToString(
      <AdminLoginForm
        initialError="تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة بسبب المحاولات المتكررة الخاطئة"
        initialLockoutSeconds={900}
      />
    );

    expect(html).toContain('تم قفل حساب المشرف مؤقتاً لمدة 15 دقيقة');
    expect(html).toContain('15:00');
  });
});

