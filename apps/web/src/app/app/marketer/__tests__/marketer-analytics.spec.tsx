import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SellerListingEngagement } from '../../../../components/listings/seller-listing-engagement';

describe('Marketer Listing Engagement & Analytics UI (Story 2.7 / AC #3)', () => {
  it('renders all four engagement metric chips with formatted numbers and conversion ratio', () => {
    const html = renderToString(
      <SellerListingEngagement
        listingId="listing-test-1"
        totalViews={250}
        totalImpressions={1200}
        totalFavorites={35}
        offersCount={10}
      />,
    );

    // Views chip
    expect(html).toContain('المشاهدات:');
    expect(html).toContain('250');

    // Impressions chip
    expect(html).toContain('الظهور:');
    expect(html).toContain('1,200');

    // Bookmarks chip
    expect(html).toContain('المفضلة:');
    expect(html).toContain('35');

    // Conversion ratio chip: (10 / 250) * 100 = 4.0%
    expect(html).toContain('نسبة التفاعل:');
    expect(html).toContain('4.0%');

    // Toggle button for 7-day trend
    expect(html).toContain('تحليل التفاعل (7 أيام)');
  });

  it('renders 0% conversion ratio when totalViews is 0', () => {
    const html = renderToString(
      <SellerListingEngagement
        listingId="listing-test-2"
        totalViews={0}
        totalImpressions={50}
        totalFavorites={0}
        offersCount={0}
      />,
    );

    expect(html).toContain('0%');
  });
});

