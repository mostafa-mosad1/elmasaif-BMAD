import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ForgotPasswordForm } from '../forgot-password-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('ForgotPasswordForm Component (AC: 5)', () => {
  it('renders step 1 with phone input, helper text, and submit button', () => {
    const html = renderToString(React.createElement(ForgotPasswordForm));

    expect(html).toContain('رقم الجوال');
    expect(html).toContain('إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور');
    expect(html).toContain('إرسال رمز التحقق');
  });

  it('renders link to login route', () => {
    const html = renderToString(React.createElement(ForgotPasswordForm));

    expect(html).toContain('/auth/login');
  });
});

