import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublicFaqPage from '../page';

vi.mock('../../../../components/layout/layout-shell', () => ({
  LayoutShell: ({ children }: { children: React.ReactNode }) => <div data-testid="layout-shell">{children}</div>,
}));

vi.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

describe('PublicFaqPage - Single Open Accordion & UX', () => {
  it('renders the luxury FAQ page with categories and search input', () => {
    const html = renderToString(<PublicFaqPage />);

    expect(html).toContain('الأسئلة الشائعة والإرشادات النظامية');
    expect(html).toContain('ابحث بكلمات مثل');
    expect(html).toContain('جميع الأسئلة');
    expect(html).toContain('كيف تضمن المنصة حقوق الأطراف');
    expect(html).toContain('حاسبة السعي 2.5%');
  });

  it('renders category filters for buyer, owner, marketer, and deals', () => {
    const html = renderToString(<PublicFaqPage />);

    expect(html).toContain('المشترون');
    expect(html).toContain('ملاك العقارات');
    expect(html).toContain('الوسطاء المرخصون');
    expect(html).toContain('الصفقات والمالية');
  });

  it('renders with first question open and grid-template-rows animation classes', () => {
    const html = renderToString(<PublicFaqPage />);

    expect(html).toContain('grid-rows-[1fr]');
    expect(html).toContain('rotate-180');
  });
});
