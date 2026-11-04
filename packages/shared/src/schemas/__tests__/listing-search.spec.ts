import { describe, it, expect } from 'vitest';
import {
  listingSearchQuerySchema,
  ListingSearchSort,
  PropertyType,
} from '../../index';

describe('listingSearchQuerySchema (Story 3.1)', () => {
  describe('defaults', () => {
    it('applies pagination, sort, and falOnly defaults when given an empty query', () => {
      const parsed = listingSearchQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sort).toBe(ListingSearchSort.NEWEST);
      expect(parsed.falOnly).toBe(false);
      expect(parsed.q).toBeUndefined();
      expect(parsed.cityId).toBeUndefined();
      expect(parsed.propertyType).toBeUndefined();
    });

    it('coerces an empty free-text string to undefined (index-safe)', () => {
      const parsed = listingSearchQuerySchema.parse({ q: '   ' });
      expect(parsed.q).toBeUndefined();
    });

    it('trims and preserves a non-empty free-text query', () => {
      const parsed = listingSearchQuerySchema.parse({ q: '  فيلا النرجس  ' });
      expect(parsed.q).toBe('فيلا النرجس');
    });
  });

  describe('range & filter coercion', () => {
    it('coerces numeric price/area/bedrooms filters from strings', () => {
      const parsed = listingSearchQuerySchema.parse({
        priceMin: '500000',
        priceMax: '3000000',
        areaMin: '150',
        areaMax: '900',
        bedroomsMin: '4',
      });
      expect(parsed.priceMin).toBe(500000);
      expect(parsed.priceMax).toBe(3000000);
      expect(parsed.areaMin).toBe(150);
      expect(parsed.areaMax).toBe(900);
      expect(parsed.bedroomsMin).toBe(4);
    });

    it('accepts valid city/district UUIDs and property type', () => {
      const parsed = listingSearchQuerySchema.parse({
        cityId: '550e8400-e29b-41d4-a716-446655440000',
        districtId: '660e8400-e29b-41d4-a716-446655440000',
        propertyType: PropertyType.VILLA,
      });
      expect(parsed.cityId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(parsed.districtId).toBe('660e8400-e29b-41d4-a716-446655440000');
      expect(parsed.propertyType).toBe(PropertyType.VILLA);
    });
  });

  describe('falOnly boolean coercion', () => {
    it('maps "true"/"false" query strings to real booleans', () => {
      expect(listingSearchQuerySchema.parse({ falOnly: 'true' }).falOnly).toBe(true);
      expect(listingSearchQuerySchema.parse({ falOnly: 'false' }).falOnly).toBe(false);
      expect(listingSearchQuerySchema.parse({ falOnly: true }).falOnly).toBe(true);
    });
  });

  describe('sort values', () => {
    it('accepts the three supported sort tokens', () => {
      expect(listingSearchQuerySchema.parse({ sort: 'newest' }).sort).toBe(ListingSearchSort.NEWEST);
      expect(listingSearchQuerySchema.parse({ sort: 'price_asc' }).sort).toBe(ListingSearchSort.PRICE_ASC);
      expect(listingSearchQuerySchema.parse({ sort: 'price_desc' }).sort).toBe(ListingSearchSort.PRICE_DESC);
    });

    it('rejects an unknown sort value', () => {
      const result = listingSearchQuerySchema.safeParse({ sort: 'relevance' });
      expect(result.success).toBe(false);
    });
  });

  describe('clamping & rejection bounds', () => {
    it('rejects page below 1', () => {
      expect(() => listingSearchQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('rejects limit above MAX_PAGE_SIZE (100) and below 1', () => {
      expect(() => listingSearchQuerySchema.parse({ limit: 500 })).toThrow();
      expect(() => listingSearchQuerySchema.parse({ limit: 0 })).toThrow();
    });

    it('accepts the boundary limit of 100', () => {
      expect(listingSearchQuerySchema.parse({ limit: 100 }).limit).toBe(100);
    });
  });

  describe('uuid & enum rejection', () => {
    it('rejects a non-UUID cityId', () => {
      const result = listingSearchQuerySchema.safeParse({ cityId: 'not-a-uuid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('معرف المدينة يجب أن يكون بصيغة UUID صالحة');
      }
    });

    it('rejects an invalid property type', () => {
      const result = listingSearchQuerySchema.safeParse({ propertyType: 'OFFICE' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('نوع العقار غير صالح');
      }
    });
  });
});
