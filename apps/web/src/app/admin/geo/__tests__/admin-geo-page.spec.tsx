import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminGeoPage from '../page';
import { AdminCityListItem, AdminDistrictListItem } from '@elmasaif/shared';

const mockCities: AdminCityListItem[] = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    nameAr: 'الرياض',
    nameEn: 'Riyadh',
    isActive: true,
    createdAt: new Date().toISOString(),
    _count: { districts: 2 },
    activeDistrictsCount: 2,
    inactiveDistrictsCount: 0
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    nameAr: 'جدة',
    nameEn: 'Jeddah',
    isActive: false,
    createdAt: new Date().toISOString(),
    _count: { districts: 0 },
    activeDistrictsCount: 0,
    inactiveDistrictsCount: 0
  }
];

const mockDistricts: AdminDistrictListItem[] = [
  {
    id: '22222222-0001-4000-8000-000000000001',
    cityId: '11111111-0000-4000-8000-000000000001',
    nameAr: 'الملقا',
    nameEn: 'Al-Malqa',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: '22222222-0001-4000-8000-000000000002',
    cityId: '11111111-0000-4000-8000-000000000001',
    nameAr: 'النرجس',
    nameEn: 'Al-Narjis',
    isActive: false,
    createdAt: new Date().toISOString()
  }
];

describe('AdminGeoPage Component (Story 2.1) (AC: 1, AC: 3)', () => {
  it('renders page header, title, and breadcrumb navigation', () => {
    const html = renderToString(<AdminGeoPage initialCities={mockCities} />);

    expect(html).toContain('إدارة البيانات الجغرافية الرئيسية (المناطق، المدن، والأحياء)');
    expect(html).toContain('لوحة التحكم الإدارية');
    expect(html).toContain('البيانات الأساسية');
    expect(html).toContain('إدارة المدن والأحياء');
  });

  it('renders cities master table with "+ إضافة مدينة جديدة" button and search input', () => {
    const html = renderToString(<AdminGeoPage initialCities={mockCities} />);

    expect(html).toContain('إضافة مدينة جديدة');
    expect(html).toContain('البحث في المدن...');
    expect(html).toContain('الرياض');
    expect(html).toContain('Riyadh');
    expect(html).toContain('جدة');
    expect(html).toContain('Jeddah');
    expect(html).toContain('نشط');
    expect(html).toContain('معطل');
    expect(html).toContain('aria-label="تغيير حالة تفعيل مدينة الرياض"');
  });

  it('renders empty district prompt when no city is selected', () => {
    const html = renderToString(<AdminGeoPage initialCities={mockCities} />);

    expect(html).toContain('اختر مدينة من القائمة لعرض وإدارة أحيائها');
  });

  it('renders districts detail table when a city is selected', () => {
    const html = renderToString(
      <AdminGeoPage
        initialCities={mockCities}
        initialSelectedCityId="11111111-0000-4000-8000-000000000001"
        initialDistricts={mockDistricts}
      />
    );

    expect(html).toContain('أحياء مدينة الرياض');
    expect(html).toContain('إضافة حي جديد');
    expect(html).toContain('الملقا');
    expect(html).toContain('Al-Malqa');
    expect(html).toContain('النرجس');
    expect(html).toContain('Al-Narjis');
    expect(html).toContain('إجمالي الأحياء: 2');
    expect(html).toContain('النشطة: 1');
    expect(html).toContain('aria-label="تغيير حالة تفعيل حي الملقا"');
  });

  it('renders empty message when selected city has no districts', () => {
    const html = renderToString(
      <AdminGeoPage
        initialCities={mockCities}
        initialSelectedCityId="11111111-0000-4000-8000-000000000002"
        initialDistricts={[]}
      />
    );

    expect(html).toContain('أحياء مدينة جدة');
    expect(html).toContain('لا توجد أحياء مسجلة لهذه المدينة حالياً');
  });
});
