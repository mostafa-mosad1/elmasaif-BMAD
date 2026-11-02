import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PreferencesEditor } from '../preferences-editor';
import { DirectionProvider } from '../../providers/direction-provider';
import { ThemeProvider } from '../../providers/theme-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

describe('PreferencesEditor Component (Story 1.10) (AC: 1, 2, 3, 4, 6)', () => {
  const mockInitialPreferences = {
    preferredLanguage: 'ar' as const,
    themeMode: 'light' as const,
    emailNotifications: true,
    smsNotifications: true,
    marketingAlerts: false,
    inquiryAlerts: true,
    criticalAlertsMandatory: true,
    updatedAt: '2026-11-02T09:30:00Z'
  };

  it('renders language selection tiles with Arabic and English options', () => {
    const html = renderToString(
      <DirectionProvider>
        <ThemeProvider>
          <PreferencesEditor initialPreferences={mockInitialPreferences} />
        </ThemeProvider>
      </DirectionProvider>
    );

    expect(html).toContain('لغة الواجهة والاتجاه');
    expect(html).toContain('العربية');
    expect(html).toContain('English');
    expect(html).toContain('RTL');
    expect(html).toContain('LTR');
  });

  it('renders theme mode selection tiles with light, dark, and system options', () => {
    const html = renderToString(
      <DirectionProvider>
        <ThemeProvider>
          <PreferencesEditor initialPreferences={mockInitialPreferences} />
        </ThemeProvider>
      </DirectionProvider>
    );

    expect(html).toContain('المظهر ونمط العرض');
    expect(html).toContain('الوضع الفاتح');
    expect(html).toContain('الوضع الداكن');
    expect(html).toContain('حسب إعدادات النظام');
  });

  it('renders optional notification channel toggles with save button', () => {
    const html = renderToString(
      <DirectionProvider>
        <ThemeProvider>
          <PreferencesEditor initialPreferences={mockInitialPreferences} />
        </ThemeProvider>
      </DirectionProvider>
    );

    expect(html).toContain('قنوات الإشعارات الاختيارية');
    expect(html).toContain('إشعارات البريد الإلكتروني');
    expect(html).toContain('الرسائل النصية القصيرة');
    expect(html).toContain('تنبيهات الاستفسارات ومطابقة الطلبات');
    expect(html).toContain('النشرات الإعلانية والتسويقية');
    expect(html).toContain('حفظ تفضيلات الإشعارات');
  });

  it('renders mandatory regulatory & security alerts card with statutory disclosure and locked state', () => {
    const html = renderToString(
      <DirectionProvider>
        <ThemeProvider>
          <PreferencesEditor initialPreferences={mockInitialPreferences} />
        </ThemeProvider>
      </DirectionProvider>
    );

    expect(html).toContain('التنبيهات النظامية والأمنية الإلزامية');
    expect(html).toContain('إلزامي ونظامي');
    expect(html).toContain('الهيئة العامة للعقار');
    expect(html).toContain('48 ساعة');
    expect(html).toContain('محطات الصفقات والتسوية المالية');
    expect(html).toContain('مهلة السداد المالي');
    expect(html).toContain('أمان الحساب والتحقق');
    expect(html).toContain('الامتثال والتراخيص العقارية');
    expect(html).toContain('مفعل دائماً');
  });
});

