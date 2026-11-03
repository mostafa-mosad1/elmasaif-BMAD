import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminListingsAnalyticsPage from '../analytics/page';
import * as apiClientModule from '../../../../lib/api-client';
import { PropertyType } from '@elmasaif/shared';

describe('Admin Listings Engagement Analytics Dashboard (Story 2.7 / AC #4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header banner, back button to moderation queue, and analytics title', () => {
    vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue({
      statusCode: 200,
      data: {
        totalActiveListings: 15,
        totalLifetimeImpressions: 50000,
        totalLifetimeViews: 8500,
        totalLifetimeFavorites: 420,
        averageConversionRatio: 2.5,
        topListings: [
          {
            id: 'prop-1',
            title: 'قصر فاخر حطين',
            propertyType: PropertyType.VILLA,
            cityName: 'الرياض',
            askPrice: 12000000,
            views: 1200,
            favorites: 95,
          },
        ],
        dailyTrends: [
          {
            date: '2026-11-03',
            impressions: 1500,
            detailViews: 350,
            favorites: 25,
          },
        ],
      },
    });

    const html = renderToString(<AdminListingsAnalyticsPage />);

    expect(html).toContain('تحليلات تفاعل ومؤشرات السوق العقاري');
    expect(html).toContain('العودة لطابور المراجعة');
    expect(html).toContain('/admin/listings');
  });
});

