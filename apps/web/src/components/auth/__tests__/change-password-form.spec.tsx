import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChangePasswordForm } from '../change-password-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('ChangePasswordForm Component (AC: 6)', () => {
  it('renders current password, new password, confirm password and advisory banner', () => {
    const html = renderToString(React.createElement(ChangePasswordForm));

    expect(html).toContain('كلمة المرور الحالية');
    expect(html).toContain('كلمة المرور الجديدة');
    expect(html).toContain('تأكيد كلمة المرور الجديدة');
    expect(html).toContain('تنبيه أمني: تغيير كلمة المرور سيؤدي إلى إنهاء كافة الجلسات النشطة على أجهزتك الأخرى باستثناء هذا المتصفح');
    expect(html).toContain('حفظ كلمة المرور الجديدة');
  });

  it('renders link to forgot password route', () => {
    const html = renderToString(React.createElement(ChangePasswordForm));

    expect(html).toContain('/auth/forgot-password');
  });
});

