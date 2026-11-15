import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminDashboardPage from '../page';
import AdminFraudManagementPage from '../fraud/page';
import AdminFinancialReportsPage from '../finance/page';
import AdminCmsPage from '../cms/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

describe('Admin Story 8.9 Pages SSR', () => {
  it('renders Executive Operations Dashboard page (/admin)', () => {
    const html = renderToString(<AdminDashboardPage />);
    expect(html).toContain('مركز العمليات والرقابة التنفيذية — المصايف');
    expect(html).toContain('لوحة القيادة والعمليات التنفيذية (FR-66)');
    expect(html).toContain('طوابير العمليات والأقفال');
    expect(html).toContain('التقارير المالية');
  });

  it('renders Fraud Management page (/admin/fraud)', () => {
    const html = renderToString(<AdminFraudManagementPage />);
    expect(html).toContain('سجل إدارة مكافحة الاحتيال والأنشطة المشبوهة');
    expect(html).toContain('تسجيل حالة اشتباه');
  });

  it('renders Financial Reports page (/admin/finance)', () => {
    const html = renderToString(<AdminFinancialReportsPage />);
    expect(html).toContain('المؤشرات المالية وتقارير العمليات المحاسبية');
    expect(html).toContain('تصدير تقرير محاسبي (Excel / CSV)');
  });

  it('renders CMS & Announcements page (/admin/cms)', () => {
    const html = renderToString(<AdminCmsPage />);
    expect(html).toContain('نظام إدارة المحتوى (CMS) والتنبيهات');
    expect(html).toContain('الصفحات الثابتة (Static Pages)');
    expect(html).toContain('أشرطة الإعلانات والتنبيهات (Banners)');
    expect(html).toContain('الأسئلة الشائعة (FAQ)');
  });
});
