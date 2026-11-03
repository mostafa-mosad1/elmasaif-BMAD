import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PropertyCard } from '../property-card';
import { PropertyType, ListingStatus, UserRole } from '@elmasaif/shared';
import {
  enqueueImpression,
  enqueueDetailView,
  flushQueueSyncOrAsync,
  clearEventQueue,
  getEventQueue,
} from '../../../hooks/use-listing-analytics';

const mockListing: any = {
  id: 'listing-uuid-1',
  title: 'فيلا فاخرة للبيع',
  propertyType: PropertyType.VILLA,
  status: ListingStatus.ACTIVE,
  cityId: 'city-1',
  districtId: 'dist-1',
  cityName: 'الرياض',
  districtName: 'النرجس',
  askPrice: 2500000,
  areaSquareMeters: 350,
  bedrooms: 4,
  sellerRole: UserRole.MARKETER,
  isFalVerified: true,
  totalViews: 150,
  totalImpressions: 600,
  totalFavorites: 12,
  isFavorited: false,
};

describe('PropertyCard & useListingAnalytics (Story 2.7 / AC #1, #2, #5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearEventQueue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('useListingAnalytics Buffer & Ingestion Pipeline', () => {
    it('buffers impression and detail view events and flushes via fetch', () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchSpy as any;

      enqueueImpression('listing-1');
      enqueueImpression('listing-1');
      enqueueDetailView('listing-2');

      expect(getEventQueue()).toHaveLength(3);

      flushQueueSyncOrAsync();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/listings/analytics/events'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            events: [
              { listingId: 'listing-1', eventType: 'IMPRESSION', count: 1 },
              { listingId: 'listing-1', eventType: 'IMPRESSION', count: 1 },
              { listingId: 'listing-2', eventType: 'DETAIL_VIEW', count: 1 },
            ],
          }),
        }),
      );
      expect(getEventQueue()).toHaveLength(0);
    });

    it('uses navigator.sendBeacon when available on pagehide flush', () => {
      const sendBeaconMock = vi.fn().mockReturnValue(true);
      const originalSendBeacon = (globalThis.navigator as any)?.sendBeacon;

      Object.defineProperty(globalThis.navigator, 'sendBeacon', {
        value: sendBeaconMock,
        configurable: true,
        writable: true,
      });

      enqueueImpression('listing-beacon-1');
      flushQueueSyncOrAsync();

      expect(sendBeaconMock).toHaveBeenCalledWith(
        expect.stringContaining('/listings/analytics/events'),
        expect.any(Blob),
      );

      if (originalSendBeacon) {
        Object.defineProperty(globalThis.navigator, 'sendBeacon', {
          value: originalSendBeacon,
          configurable: true,
        });
      }
    });
  });

  describe('PropertyCard SSR & Favorite Rendering', () => {
    it('renders favorite button with "إضافة إلى المفضلة" when isFavorited is false', () => {
      const html = renderToString(
        <PropertyCard listing={mockListing} isFavorited={false} />,
      );

      expect(html).toContain('aria-label="إضافة إلى المفضلة"');
      expect(html).toContain('فيلا فاخرة للبيع');
    });

    it('renders favorite button with "إزالة من المفضلة" and red fill when isFavorited is true', () => {
      const html = renderToString(
        <PropertyCard
          listing={{ ...mockListing, isFavorited: true }}
          isFavorited={true}
        />,
      );

      expect(html).toContain('aria-label="إزالة من المفضلة"');
      expect(html).toContain('fill-red-500');
    });
  });
});
