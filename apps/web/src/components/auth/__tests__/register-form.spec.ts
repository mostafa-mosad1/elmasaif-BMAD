import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RegisterForm } from '../register-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('RegisterForm Component (AC: 6)', () => {
  it('renders Step 1 registration inputs and sovereign placeholders', () => {
    const html = renderToString(React.createElement(RegisterForm));

    expect(html).toContain('الاسم الكامل');
    expect(html).toContain('رقم الجوال السعودي');
    expect(html).toContain('+966');
    expect(html).toContain('5XXXXXXXX');
    expect(html).toContain('رقم الهوية الوطنية أو الإقامة');
    expect(html).toContain('1XXXXXXXXX أو 2XXXXXXXXX');
    expect(html).toContain('كلمة المرور');
  });

  it('renders password complexity helper indicators', () => {
    const html = renderToString(React.createElement(RegisterForm));

    expect(html).toContain('8 خانات كحد أدنى');
    expect(html).toContain('حرف هجائي واحد');
    expect(html).toContain('رقم واحد على الأقل');
  });

  it('renders mandatory legal consent checkboxes for Terms and PDPL', () => {
    const html = renderToString(React.createElement(RegisterForm));

    expect(html).toContain('شروط الاستخدام والأحكام العامة لمنصة المصايف');
    expect(html).toContain('سياسة الخصوصية وحماية البيانات الشخصية وفقاً لنظام (PDPL) السعودي');
  });

  it('renders institutional submit button', () => {
    const html = renderToString(React.createElement(RegisterForm));

    expect(html).toContain('المتابعة والتحقق من الجوال');
  });
});

