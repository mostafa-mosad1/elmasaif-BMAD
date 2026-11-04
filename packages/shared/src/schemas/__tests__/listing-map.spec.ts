import { describe, it, expect } from 'vitest';
import { listingMapQuerySchema, PropertyType } from '../../index';

// Saudi bounds used throughout these tests
const VALID_BOUNDS = { swLat: 20, swLng: 40, neLat: 26, neLng: 50 };

describe('listingMapQuerySchema (Story 3.2)', () => {
  describe('required bounds', () => {
    it('parses a minimal valid bounding-box query', () => {
      const parsed = listingMapQuerySchema.parse(VALID_BOUNDS);
      expect(parsed.swLat).toBe(20);
      expect(parsed.swLng).toBe(40);
      expect(parsed.neLat).toBe(26);
      expect(parsed.neLng).toBe(50);
      expect(parsed.falOnly).toBe(false); // default
    });

    it('rejects when swLat is missing', () => {
      const { swLat, ...rest } = VALID_BOUNDS;
      expect(() => listingMapQuerySchema.parse(rest)).toThrow();
    });

    it('rejects when neLng is missing', () => {
      const { neLng, ...rest } = VALID_BOUNDS;
      expect(() => listingMapQuerySchema.parse(rest)).toThrow();
    });

    it('coerces string number params to numbers', () => {
      const parsed = listingMapQuerySchema.parse({
        swLat: '20', swLng: '40', neLat: '26', neLng: '50',
      });
      expect(typeof parsed.swLat).toBe('number');
      expect(parsed.neLat).toBe(26);
    });
  });

  describe('Saudi geographic bounds', () => {
    it('rejects swLat below Saudi min (16.0)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 10, swLng: 40, neLat: 26, neLng: 50 }),
      ).toThrow();
    });

    it('rejects neLat above Saudi max (32.5)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 40, neLat: 40, neLng: 50 }),
      ).toThrow();
    });

    it('rejects swLng below Saudi min (34.5)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 30, neLat: 26, neLng: 50 }),
      ).toThrow();
    });

    it('rejects neLng above Saudi max (55.7)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 40, neLat: 26, neLng: 60 }),
      ).toThrow();
    });

    it('accepts coordinates exactly at Saudi boundary limits', () => {
      const parsed = listingMapQuerySchema.parse({
        swLat: 16.0, swLng: 34.5, neLat: 32.5, neLng: 55.7,
      });
      expect(parsed.swLat).toBe(16.0);
      expect(parsed.neLng).toBe(55.7);
    });
  });

  describe('neLat > swLat / neLng > swLng guard', () => {
    it('rejects when neLat equals swLat (zero height)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 40, neLat: 20, neLng: 50 }),
      ).toThrow();
    });

    it('rejects when neLat is less than swLat (inverted)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 26, swLng: 40, neLat: 20, neLng: 50 }),
      ).toThrow();
    });

    it('rejects when neLng equals swLng (zero width)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 40, neLat: 26, neLng: 40 }),
      ).toThrow();
    });

    it('rejects when neLng is less than swLng (inverted)', () => {
      expect(() =>
        listingMapQuerySchema.parse({ swLat: 20, swLng: 50, neLat: 26, neLng: 40 }),
      ).toThrow();
    });
  });

  describe('optional filter fields', () => {
    it('accepts and preserves all optional filter fields', () => {
      const parsed = listingMapQuerySchema.parse({
        ...VALID_BOUNDS,
        q: 'فيلا',
        cityId: '550e8400-e29b-41d4-a716-446655440000',
        districtId: '550e8400-e29b-41d4-a716-446655440001',
        propertyType: PropertyType.VILLA,
        priceMin: 500000,
        priceMax: 3000000,
        areaMin: 100,
        areaMax: 1000,
        bedroomsMin: 3,
        falOnly: true,
      });
      expect(parsed.q).toBe('فيلا');
      expect(parsed.propertyType).toBe(PropertyType.VILLA);
      expect(parsed.priceMin).toBe(500000);
      expect(parsed.falOnly).toBe(true);
    });

    it('transforms a blank free-text string to undefined', () => {
      const parsed = listingMapQuerySchema.parse({ ...VALID_BOUNDS, q: '   ' });
      expect(parsed.q).toBeUndefined();
    });

    it('rejects an invalid UUID for cityId', () => {
      expect(() =>
        listingMapQuerySchema.parse({ ...VALID_BOUNDS, cityId: 'not-a-uuid' }),
      ).toThrow();
    });

    it('rejects an invalid propertyType value', () => {
      expect(() =>
        listingMapQuerySchema.parse({ ...VALID_BOUNDS, propertyType: 'OFFICE' }),
      ).toThrow();
    });

    it('defaults falOnly to false when omitted', () => {
      const parsed = listingMapQuerySchema.parse(VALID_BOUNDS);
      expect(parsed.falOnly).toBe(false);
    });

    it('interprets falOnly="true" query string as boolean true', () => {
      const parsed = listingMapQuerySchema.parse({ ...VALID_BOUNDS, falOnly: 'true' });
      expect(parsed.falOnly).toBe(true);
    });
  });
});
