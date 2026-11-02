import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CityDistrictSelector } from '../city-district-selector';
import { City, District } from '@elmasaif/shared';

const mockCities: City[] = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    nameAr: 'الرياض',
    nameEn: 'Riyadh',
    isActive: true
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    nameAr: 'جدة',
    nameEn: 'Jeddah',
    isActive: true
  }
];

const mockDistricts: District[] = [
  {
    id: '22222222-0001-4000-8000-000000000001',
    cityId: '11111111-0000-4000-8000-000000000001',
    nameAr: 'الملقا',
    nameEn: 'Al-Malqa',
    isActive: true
  },
  {
    id: '22222222-0001-4000-8000-000000000002',
    cityId: '11111111-0000-4000-8000-000000000001',
    nameAr: 'النرجس',
    nameEn: 'Al-Narjis',
    isActive: true
  }
];

describe('CityDistrictSelector Component (AC: 4, AC: 5)', () => {
  it('renders dual dropdowns with disabled district dropdown when no city is selected', () => {
    const handleCityChange = vi.fn();
    const handleDistrictChange = vi.fn();

    const html = renderToString(
      <CityDistrictSelector
        selectedCityId={null}
        selectedDistrictId={null}
        onCityChange={handleCityChange}
        onDistrictChange={handleDistrictChange}
        initialCities={mockCities}
      />
    );

    expect(html).toContain('المدينة');
    expect(html).toContain('الحي');
    expect(html).toContain('اختر المدينة...');
    expect(html).toContain('يرجى اختيار المدينة أولاً');
    expect(html).toContain('disabled');
    expect(html).toContain('role="combobox"');
  });

  it('renders enabled district dropdown when a city is selected', () => {
    const html = renderToString(
      <CityDistrictSelector
        selectedCityId="11111111-0000-4000-8000-000000000001"
        selectedDistrictId={null}
        onCityChange={vi.fn()}
        onDistrictChange={vi.fn()}
        initialCities={mockCities}
        initialDistricts={mockDistricts}
      />
    );

    expect(html).toContain('الرياض');
    expect(html).toContain('اختر الحي...');
    expect(html).toContain('aria-expanded="false"');
  });

  it('displays selected city and district names in triggers', () => {
    const html = renderToString(
      <CityDistrictSelector
        selectedCityId="11111111-0000-4000-8000-000000000001"
        selectedDistrictId="22222222-0001-4000-8000-000000000001"
        onCityChange={vi.fn()}
        onDistrictChange={vi.fn()}
        initialCities={mockCities}
        initialDistricts={mockDistricts}
      />
    );

    expect(html).toContain('الرياض');
    expect(html).toContain('الملقا');
    expect(html).toContain('aria-label="مسح اختيار المدينة"');
    expect(html).toContain('aria-label="مسح اختيار الحي"');
  });

  it('renders validation errors when cityError or districtError is provided', () => {
    const html = renderToString(
      <CityDistrictSelector
        selectedCityId={null}
        selectedDistrictId={null}
        onCityChange={vi.fn()}
        onDistrictChange={vi.fn()}
        cityError="يرجى تحديد المدينة"
        districtError="يرجى تحديد الحي"
      />
    );

    expect(html).toContain('يرجى تحديد المدينة');
    expect(html).toContain('يرجى تحديد الحي');
  });

  it('renders custom labels and required asterisks when configured', () => {
    const html = renderToString(
      <CityDistrictSelector
        selectedCityId={null}
        selectedDistrictId={null}
        onCityChange={vi.fn()}
        onDistrictChange={vi.fn()}
        cityLabel="مدينة العقار"
        districtLabel="حي العقار"
        required={true}
      />
    );

    expect(html).toContain('مدينة العقار');
    expect(html).toContain('حي العقار');
    expect(html).toContain('*');
  });
});
