import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PhoneChangeWizard } from '../phone-change-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('PhoneChangeWizard Component (AC: 6)', () => {
  it('renders initiate state with masked current phone, security notice, input, and submit button', () => {
    const html = renderToString(
      React.createElement(PhoneChangeWizard, {
        initialPhone: '+966512345678',
        hasActiveDeals: false
      })
    );

    expect(html).toContain('+966 5X XXX 5678');
    expect(html).toContain('تم التحقق ✓');
    expect(html).toContain(
      'لأسباب أمنية ولحماية حسابك من الاختراق، يتطلب تغيير رقم الجوال إرسال رمز تحقق إلى رقمك الحالي ورمز تحقق آخر إلى رقمك الجديد'
    );
    expect(html).toContain('رقم الجوال الجديد');
    expect(html).toContain('بدء إجراء التحديث وإرسال الرموز');
  });

  it('renders active deal warning and disables submission when hasActiveDeals is true', () => {
    const html = renderToString(
      React.createElement(PhoneChangeWizard, {
        initialPhone: '+966512345678',
        hasActiveDeals: true
      })
    );

    expect(html).toContain('تحديث رقم الجوال معلق مؤقتاً');
    expect(html).toContain(
      'لا يمكن تغيير رقم الجوال أثناء وجود صفقات نشطة قيد سداد الدفعة أو التدقيق الإداري أو النزاع المفتوح'
    );
    expect(html).toContain('disabled');
  });

  it('renders support assistance callout for users who lost their old phone SIM', () => {
    const html = renderToString(
      React.createElement(PhoneChangeWizard, {
        initialPhone: '+966512345678'
      })
    );

    expect(html).toContain('فقدت الوصول إلى شريحة رقمك القديم؟');
    expect(html).toContain('تواصل مع الدعم الفني لطلب التحديث الإداري بعد التحقق من الهوية');
  });
});

