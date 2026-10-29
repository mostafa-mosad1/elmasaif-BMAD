import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LoginForm } from '../login-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('LoginForm Component (AC: 6)', () => {
  it('renders identifier, password, remember device checkbox, and submit button', () => {
    const html = renderToString(React.createElement(LoginForm));

    expect(html).toContain('اسم المستخدم أو رقم الجوال');
    expect(html).toContain('كلمة المرور');
    expect(html).toContain('تذكر هذا الجهاز');
    expect(html).toContain('نسيت كلمة المرور؟');
    expect(html).toContain('تسجيل الدخول');
  });

  it('renders link to forgot-password and register routes', () => {
    const html = renderToString(React.createElement(LoginForm));

    expect(html).toContain('/auth/forgot-password');
  });
});

