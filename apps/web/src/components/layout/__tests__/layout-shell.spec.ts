import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LayoutShell } from '../layout-shell';
import { Header } from '../header';
import { Footer } from '../footer';
import { AppProviders } from '../../providers';

describe('Layout Shell & Navigation Components', () => {
  it('should render Header with brand logo, REGA badge and action buttons', () => {
    const html = renderToString(
      React.createElement(
        AppProviders,
        null,
        React.createElement(Header, null)
      )
    );

    expect(html).toContain('المصايف');
    expect(html).toContain('مرخص من فال');
    expect(html).toContain('تسجيل الدخول');
  });

  it('should render Footer with regulatory notices and disclaimers', () => {
    const html = renderToString(
      React.createElement(
        AppProviders,
        null,
        React.createElement(Footer, null)
      )
    );

    expect(html).toContain('الهيئة العامة للعقار');
    expect(html).toContain('رخصة فال العقارية');
    expect(html).toContain('المصايف');
  });

  it('should render composite LayoutShell wrapping children with container max-width', () => {
    const html = renderToString(
      React.createElement(
        AppProviders,
        null,
        React.createElement(
          LayoutShell,
          null,
          React.createElement('div', { id: 'page-content' }, 'محتوى الصفحة الرئيسية')
        )
      )
    );

    expect(html).toContain('محتوى الصفحة الرئيسية');
    expect(html).toContain('max-w-7xl');
  });
});
