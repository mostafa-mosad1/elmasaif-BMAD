import { describe, it, expect } from 'vitest';
import {
  listingEngagementEventSchema,
  batchListingEngagementSchema,
  listingAnalyticsQuerySchema,
} from '../listing.schema';
import { ListingEngagementEventType } from '../../enums';

describe('Listing Analytics Schemas', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  describe('listingEngagementEventSchema', () => {
    it('validates a valid impression event with default count', () => {
      const parsed = listingEngagementEventSchema.parse({
        listingId: validUuid,
        eventType: ListingEngagementEventType.IMPRESSION,
      });

      expect(parsed.listingId).toBe(validUuid);
      expect(parsed.eventType).toBe('IMPRESSION');
      expect(parsed.count).toBe(1);
    });

    it('validates a valid detail view event with explicit count', () => {
      const parsed = listingEngagementEventSchema.parse({
        listingId: validUuid,
        eventType: ListingEngagementEventType.DETAIL_VIEW,
        count: 5,
      });

      expect(parsed.count).toBe(5);
    });

    it('rejects invalid UUID for listingId', () => {
      expect(() =>
        listingEngagementEventSchema.parse({
          listingId: 'not-a-uuid',
          eventType: 'IMPRESSION',
        }),
      ).toThrow();
    });

    it('rejects invalid eventType', () => {
      expect(() =>
        listingEngagementEventSchema.parse({
          listingId: validUuid,
          eventType: 'UNKNOWN_TYPE',
        }),
      ).toThrow();
    });

    it('rejects count < 1 or count > 100', () => {
      expect(() =>
        listingEngagementEventSchema.parse({
          listingId: validUuid,
          eventType: 'IMPRESSION',
          count: 0,
        }),
      ).toThrow();

      expect(() =>
        listingEngagementEventSchema.parse({
          listingId: validUuid,
          eventType: 'IMPRESSION',
          count: 101,
        }),
      ).toThrow();
    });
  });

  describe('batchListingEngagementSchema', () => {
    it('validates an array with valid events', () => {
      const parsed = batchListingEngagementSchema.parse({
        events: [
          { listingId: validUuid, eventType: 'IMPRESSION' },
          { listingId: validUuid, eventType: 'DETAIL_VIEW', count: 2 },
        ],
      });

      expect(parsed.events).toHaveLength(2);
      expect(parsed.events[0].count).toBe(1);
      expect(parsed.events[1].count).toBe(2);
    });

    it('rejects an empty events array', () => {
      expect(() =>
        batchListingEngagementSchema.parse({
          events: [],
        }),
      ).toThrow();
    });

    it('rejects more than 50 events in a batch', () => {
      const excessiveEvents = Array.from({ length: 51 }, () => ({
        listingId: validUuid,
        eventType: 'IMPRESSION' as const,
      }));

      expect(() =>
        batchListingEngagementSchema.parse({
          events: excessiveEvents,
        }),
      ).toThrow();
    });
  });

  describe('listingAnalyticsQuerySchema', () => {
    it('applies default days of 30 when omitted', () => {
      const parsed = listingAnalyticsQuerySchema.parse({});
      expect(parsed.days).toBe(30);
    });

    it('coerces string numbers correctly within 1 to 90 days', () => {
      const parsed = listingAnalyticsQuerySchema.parse({ days: '7' });
      expect(parsed.days).toBe(7);
    });

    it('rejects days outside 1-90 range', () => {
      expect(() => listingAnalyticsQuerySchema.parse({ days: 0 })).toThrow();
      expect(() => listingAnalyticsQuerySchema.parse({ days: 91 })).toThrow();
    });
  });
});

