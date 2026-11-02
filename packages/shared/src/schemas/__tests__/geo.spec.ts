import { describe, it, expect } from 'vitest';
import {
  citySchema,
  districtSchema,
  geoTreeItemSchema,
  geoTreeResponseSchema,
  createListingSchema,
  PropertyType,
  createCitySchema,
  updateCitySchema,
  createDistrictSchema,
  updateDistrictSchema,
  toggleGeoActiveSchema,
  adminGeoQuerySchema,
  GEO_CITY_NOT_FOUND,
  GEO_DISTRICT_NOT_FOUND,
  GEO_CITY_INACTIVE,
  GEO_DISTRICT_INACTIVE,
  GEO_CITY_DUPLICATE_NAME,
  GEO_DISTRICT_DUPLICATE_NAME
} from '../../index';

describe('Geographic Schemas & Types Validation', () => {
  const validCityId = '11111111-0000-4000-8000-000000000001';
  const validDistrictId = '22222222-0001-4000-8000-000000000001';

  describe('createCitySchema', () => {
    it('should validate valid city creation input', () => {
      const input = {
        nameAr: 'الرياض',
        nameEn: 'Riyadh',
        isActive: true
      };
      const result = createCitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nameAr).toBe('الرياض');
        expect(result.data.nameEn).toBe('Riyadh');
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should default isActive to true when omitted', () => {
      const input = {
        nameAr: 'جدة',
        nameEn: 'Jeddah'
      };
      const result = createCitySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should reject names shorter than 2 characters or longer than 100 characters', () => {
      expect(createCitySchema.safeParse({ nameAr: 'أ', nameEn: 'Riyadh' }).success).toBe(false);
      expect(createCitySchema.safeParse({ nameAr: 'الرياض', nameEn: 'R' }).success).toBe(false);
      expect(createCitySchema.safeParse({ nameAr: 'أ'.repeat(101), nameEn: 'Riyadh' }).success).toBe(false);
      expect(createCitySchema.safeParse({ nameAr: 'الرياض', nameEn: 'R'.repeat(101) }).success).toBe(false);
    });
  });

  describe('updateCitySchema', () => {
    it('should accept partial updates', () => {
      expect(updateCitySchema.safeParse({ nameAr: 'مكة المكرمة' }).success).toBe(true);
      expect(updateCitySchema.safeParse({ nameEn: 'Makkah' }).success).toBe(true);
      expect(updateCitySchema.safeParse({ isActive: false }).success).toBe(true);
      expect(updateCitySchema.safeParse({}).success).toBe(true);
    });

    it('should enforce min length 2 when name fields are provided', () => {
      expect(updateCitySchema.safeParse({ nameAr: 'أ' }).success).toBe(false);
      expect(updateCitySchema.safeParse({ nameEn: 'A' }).success).toBe(false);
    });
  });

  describe('createDistrictSchema', () => {
    it('should validate valid district creation input', () => {
      const input = {
        cityId: validCityId,
        nameAr: 'النرجس',
        nameEn: 'Al-Narjis',
        isActive: true
      };
      const result = createDistrictSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cityId).toBe(validCityId);
        expect(result.data.nameAr).toBe('النرجس');
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should default isActive to true when omitted', () => {
      const input = {
        cityId: validCityId,
        nameAr: 'النرجس',
        nameEn: 'Al-Narjis'
      };
      const result = createDistrictSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should reject invalid cityId format or missing cityId', () => {
      expect(createDistrictSchema.safeParse({ cityId: 'invalid-uuid', nameAr: 'النرجس', nameEn: 'Al-Narjis' }).success).toBe(false);
      expect(createDistrictSchema.safeParse({ nameAr: 'النرجس', nameEn: 'Al-Narjis' }).success).toBe(false);
    });

    it('should reject names shorter than 2 or longer than 100 characters', () => {
      expect(createDistrictSchema.safeParse({ cityId: validCityId, nameAr: 'ح', nameEn: 'Al-Narjis' }).success).toBe(false);
      expect(createDistrictSchema.safeParse({ cityId: validCityId, nameAr: 'النرجس', nameEn: 'A' }).success).toBe(false);
      expect(createDistrictSchema.safeParse({ cityId: validCityId, nameAr: 'ح'.repeat(101), nameEn: 'Al-Narjis' }).success).toBe(false);
    });
  });

  describe('updateDistrictSchema', () => {
    it('should accept partial updates', () => {
      expect(updateDistrictSchema.safeParse({ nameAr: 'الياسمين' }).success).toBe(true);
      expect(updateDistrictSchema.safeParse({ nameEn: 'Al-Yasmin' }).success).toBe(true);
      expect(updateDistrictSchema.safeParse({ isActive: false }).success).toBe(true);
      expect(updateDistrictSchema.safeParse({}).success).toBe(true);
    });

    it('should enforce length rules when name fields are provided', () => {
      expect(updateDistrictSchema.safeParse({ nameAr: 'ي' }).success).toBe(false);
      expect(updateDistrictSchema.safeParse({ nameEn: 'Y' }).success).toBe(false);
    });
  });

  describe('toggleGeoActiveSchema', () => {
    it('should validate boolean isActive', () => {
      expect(toggleGeoActiveSchema.safeParse({ isActive: true }).success).toBe(true);
      expect(toggleGeoActiveSchema.safeParse({ isActive: false }).success).toBe(true);
      expect(toggleGeoActiveSchema.safeParse({ isActive: 'true' }).success).toBe(false);
      expect(toggleGeoActiveSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('adminGeoQuerySchema', () => {
    it('should validate and coerce includeInactive query parameter', () => {
      const parsed1 = adminGeoQuerySchema.safeParse({ includeInactive: 'true' });
      expect(parsed1.success).toBe(true);
      if (parsed1.success) {
        expect(parsed1.data.includeInactive).toBe(true);
      }

      const parsed2 = adminGeoQuerySchema.safeParse({});
      expect(parsed2.success).toBe(true);
      if (parsed2.success) {
        expect(parsed2.data.includeInactive).toBeUndefined();
      }
    });
  });

  describe('Geographic Error Constants', () => {
    it('should export all standardized geographic error constants', () => {
      expect(GEO_CITY_NOT_FOUND).toBe('GEO_CITY_NOT_FOUND');
      expect(GEO_DISTRICT_NOT_FOUND).toBe('GEO_DISTRICT_NOT_FOUND');
      expect(GEO_CITY_INACTIVE).toBe('GEO_CITY_INACTIVE');
      expect(GEO_DISTRICT_INACTIVE).toBe('GEO_DISTRICT_INACTIVE');
      expect(GEO_CITY_DUPLICATE_NAME).toBe('GEO_CITY_DUPLICATE_NAME');
      expect(GEO_DISTRICT_DUPLICATE_NAME).toBe('GEO_DISTRICT_DUPLICATE_NAME');
    });
  });

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
      payoutIban: 'SA0380000000608010167519',
      photos: [
        { fileUrl: 'p1.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: true },
        { fileUrl: 'p2.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false },
        { fileUrl: 'p3.jpg', mimeType: 'image/jpeg', fileSize: 1000, isPrimary: false }
      ],
      documents: [
        { documentType: 'TITLE_DEED', fileUrl: 'd1.pdf', mimeType: 'application/pdf', fileSize: 2000, visibility: 'ADMIN_ONLY' }
      ]
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
