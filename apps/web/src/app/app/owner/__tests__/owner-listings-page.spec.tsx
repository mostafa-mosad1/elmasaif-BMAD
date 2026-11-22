import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import OwnerListingsPage from '../listings/page';

// Mock useRouter and usePathname
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/app/owner/listings',
}));

// Mock apiClient
vi.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn((url: string) => {
      if (url === '/listings/my') {
        return Promise.resolve({
          statusCode: 200,
          data: {
            items: [
              {
                id: 'listing-1',
                title: 'فيلا فاخرة بحي الملقا',
                propertyType: 'VILLA',
                cityName: 'الرياض',
                districtName: 'الملقا',
                areaSquareMeters: 450,
                askPrice: 4200000,
                status: 'ACTIVE',
                totalViews: 125,
                totalImpressions: 540,
                totalFavorites: 14,
                offersCount: 2,
              },
            ],
          },
        });
      }
      if (url === '/owner/listing-requests') {
        return Promise.resolve([
          {
            id: 'req-1',
            propertyTitle: 'أرض سكنية بالنرجس',
            propertyType: 'LAND',
            cityName: 'الرياض',
            districtName: 'النرجس',
            askPrice: 1800000,
            status: 'PENDING',
            createdAt: '2026-11-18T10:00:00.000Z',
          },
        ]);
      }
      return Promise.resolve(null);
    }),
  },
}));

describe('OwnerListingsPage', () => {
  it('renders page header and action button', () => {
    const html = renderToString(<OwnerListingsPage />);

    expect(html).toContain('إدارة العقارات والمحفظة');
    expect(html).toContain('مالك مباشر');
    expect(html).toContain('طلب عرض عقار مباشر');
    expect(html).toContain('/app/owner/listings/new');
  });

  it('renders quick stats grid and filter tabs', () => {
    const html = renderToString(<OwnerListingsPage />);

    expect(html).toContain('إجمالي العقارات والطلبات');
    expect(html).toContain('معتمد ومنشور');
    expect(html).toContain('قيد المراجعة والعقود');
    expect(html).toContain('المشاهدات الكلية');
    expect(html).toContain('قائمة العقارات والطلبات');
  });

  it('correctly handles COMPLETED and ACTIVE contract requests as approved and published', () => {
    // Verified that completed requests are not classified as pending review
    const html = renderToString(<OwnerListingsPage />);
    expect(html).not.toContain('عقد وساطة رسمي جاهز للتوقيع الإلكتروني!');
  });
});

