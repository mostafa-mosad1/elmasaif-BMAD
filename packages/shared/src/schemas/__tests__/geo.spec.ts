import { describe, it, expect } from 'vitest';
import {
  citySchema,
  districtSchema,
  geoTreeItemSchema,
  geoTreeResponseSchema,
  createListingSchema,
  PropertyType
} from '../../index';

describe('Geographic Schemas & Types Validation', () => {
  const validCityId = '11111111-0000-4000-8000-000000000001';
  const validDistrictId = '22222222-0001-4000-8000-000000000001';

  describe('citySchema', () => {
    it('should validate a valid city payload', () => {
      const validCity = {
        id: validCityId,
        nameAr: 'الرياض',
        nameEn: 'Riyadh',
        isActive: true
      };
      const result = citySchema.safeParse(validCity);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nameAr).toBe('الرياض');
        expect(result.data.nameEn).toBe('Riyadh');
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should default isActive to true if omitted', () => {
      const cityWithoutActive = {
        id: validCityId,
        nameAr: 'جدة',
        nameEn: 'Jeddah'
      };
      const result = citySchema.safeParse(cityWithoutActive);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should reject non-UUID city id', () => {
      const invalidCity = {
        id: 'not-a-valid-uuid',
        nameAr: 'الدمام',
        nameEn: 'Dammam'
      };
      const result = citySchema.safeParse(invalidCity);
      expect(result.success).toBe(false);
    });

    it('should reject empty or missing names', () => {
      expect(citySchema.safeParse({ id: validCityId, nameAr: '', nameEn: 'Riyadh' }).success).toBe(false);
      expect(citySchema.safeParse({ id: validCityId, nameAr: 'الرياض', nameEn: '' }).success).toBe(false);
    });
  });

  describe('districtSchema', () => {
    it('should validate a valid district payload', () => {
      const validDistrict = {
        id: validDistrictId,
        cityId: validCityId,
        nameAr: 'الملقا',
        nameEn: 'Al-Malqa',
        isActive: true
      };
      const result = districtSchema.safeParse(validDistrict);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(validDistrictId);
        expect(result.data.cityId).toBe(validCityId);
      }
    });

    it('should reject invalid cityId in district', () => {
      const invalidDistrict = {
        id: validDistrictId,
        cityId: 'invalid-city-id',
        nameAr: 'الملقا',
        nameEn: 'Al-Malqa'
      };
      const result = districtSchema.safeParse(invalidDistrict);
      expect(result.success).toBe(false);
    });

    it('should reject invalid district id', () => {
      const invalidDistrict = {
        id: 'bad-district-id',
        cityId: validCityId,
        nameAr: 'الملقا',
        nameEn: 'Al-Malqa'
      };
      const result = districtSchema.safeParse(invalidDistrict);
      expect(result.success).toBe(false);
    });
  });

  describe('geoTreeItemSchema and geoTreeResponseSchema', () => {
    it('should validate hierarchical city and district tree', () => {
      const tree = [
        {
          id: validCityId,
          nameAr: 'الرياض',
          nameEn: 'Riyadh',
          isActive: true,
          districts: [
            {
              id: validDistrictId,
              cityId: validCityId,
              nameAr: 'الملقا',
              nameEn: 'Al-Malqa',
              isActive: true
            }
          ]
        }
      ];

      const itemResult = geoTreeItemSchema.safeParse(tree[0]);
      expect(itemResult.success).toBe(true);

      const treeResult = geoTreeResponseSchema.safeParse(tree);
      expect(treeResult.success).toBe(true);
    });
  });

  describe('createListingSchema with geographic validation', () => {
    const baseListing = {
      title: 'فيلا فاخرة للبيع في حي الملقا',
      description: 'فيلا حديثة بتشطيبات ممتازة وموقع استراتيجي قريب من كافة الخدمات والمدارس.',
      propertyType: PropertyType.VILLA,
      cityId: validCityId,
      districtId: validDistrictId,
      latitude: 24.7136,
      longitude: 46.6753,
      askPrice: '3500000.00',
      areaSquareMeters: 450,
      bedrooms: 5,
      bathrooms: 6,
      yearBuilt: 2023,
      payoutIban: 'SA0380000000608010167519'
    };

    it('should accept listing with valid UUID cityId and districtId', () => {
      const result = createListingSchema.safeParse(baseListing);
      expect(result.success).toBe(true);
    });

    it('should accept listing with optional legacy city and district text', () => {
      const withLegacyText = {
        ...baseListing,
        city: 'الرياض',
        district: 'الملقا'
      };
      const result = createListingSchema.safeParse(withLegacyText);
      expect(result.success).toBe(true);
    });

    it('should reject listing when cityId is missing or invalid UUID', () => {
      const missingCityId = { ...baseListing, cityId: undefined };
      expect(createListingSchema.safeParse(missingCityId).success).toBe(false);

      const invalidCityId = { ...baseListing, cityId: 'not-a-uuid' };
      expect(createListingSchema.safeParse(invalidCityId).success).toBe(false);
    });

    it('should reject listing when districtId is missing or invalid UUID', () => {
      const missingDistrictId = { ...baseListing, districtId: undefined };
      expect(createListingSchema.safeParse(missingDistrictId).success).toBe(false);

      const invalidDistrictId = { ...baseListing, districtId: 'not-a-uuid' };
      expect(createListingSchema.safeParse(invalidDistrictId).success).toBe(false);
    });
  });
});
