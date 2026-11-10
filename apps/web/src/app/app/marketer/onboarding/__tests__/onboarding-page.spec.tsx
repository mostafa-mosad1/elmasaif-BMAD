import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import MarketerOnboardingPage from '../page';
import { ProfileStatus } from '@elmasaif/shared';

describe('MarketerOnboardingPage', () => {
  it('renders initial form with inputs and certificate upload section', () => {
    const html = renderToString(<MarketerOnboardingPage initialLoading={false} />);
    expect(html).toContain('رخصة فال');
    expect(html).toContain('الاسم التجاري');
    expect(html).toContain('السجل التجاري');
    expect(html).toContain('تاريخ انتهاء الرخصة');
    expect(html).toContain('إرسال طلب الاعتماد');
  });

  it('renders under-review state card when application is pending', () => {
    const html = renderToString(
      <MarketerOnboardingPage
        initialLoading={false}
        initialLicense={{
          status: ProfileStatus.UNDER_REVIEW,
          licenseNumber: '1200055555',
          commercialName: 'مكتب الوئام',
          crNumber: '1010123456',
        }}
      />,
    );
    expect(html).toContain('طلبك قيد المراجعة والتدقيق الإداري');
    expect(html).toContain('1200055555');
    expect(html).toContain('مكتب الوئام');
  });

  it('renders active verified card when license is approved', () => {
    const html = renderToString(
      <MarketerOnboardingPage
        initialLoading={false}
        initialLicense={{
          status: ProfileStatus.ACTIVE,
          licenseNumber: '1200055555',
          commercialName: 'مكتب الوئام',
          crNumber: '1010123456',
        }}
      />,
    );
    expect(html).toContain('تم اعتماد رخصة فال بنجاح');
    expect(html).toContain('الانتقال إلى مساحة المسوق');
  });

  it('renders rejection notice when previous application was rejected', () => {
    const html = renderToString(
      <MarketerOnboardingPage
        initialLoading={false}
        initialLicense={{
          status: ProfileStatus.REJECTED,
          licenseNumber: '1200055555',
          commercialName: 'مكتب الوئام',
          crNumber: '1010123456',
          rejectionReason: 'شهادة الترخيص غير واضحة ويجب إعادة رفعها',
        }}
      />,
    );
    expect(html).toContain('تم رفض طلب الاعتماد السابق');
    expect(html).toContain('شهادة الترخيص غير واضحة ويجب إعادة رفعها');
    expect(html).toContain('إعادة تقديم طلب اعتماد رخصة فال');
  });
});
