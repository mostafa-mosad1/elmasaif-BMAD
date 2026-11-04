import { describe, it, expect } from 'vitest';
import {
  createDemandSchema,
  cancelDemandSchema,
  DemandStatus,
  PropertyType,
} from '../../../src';

const CITY_UUID = '8f14e45f-ceea-467a-9a68-2f4b6c1d0a11';
const DISTRICT_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const validDemand = {
  propertyType: PropertyType.VILLA,
  cityId: CITY_UUID,
  districtId: DISTRICT_UUID,
  minBudget: 800000,
  maxBudget: 1500000,
  minArea: 250,
  maxArea: 450,
  notes: 'فيلا شمال الطائف',
};

describe('createDemandSchema — structured geography (Story 3.6 / FR-21, AD-9)', () => {
  it('accepts a fully structured demand with cityId + districtId UUIDs', () => {
    const result = createDemandSchema.safeParse(validDemand);
    expect(result.success).toBe(true);
  });

  it('treats districtId as optional (omitted or null both pass)', () => {
    const { districtId, ...withoutDistrict } = validDemand;
    expect(districtId).toBeDefined();
    expect(createDemandSchema.safeParse(withoutDistrict).success).toBe(true);
    expect(createDemandSchema.safeParse({ ...validDemand, districtId: null }).success).toBe(true);
  });

  it('coerces SAR budget strings through the listing askPrice idiom', () => {
    const parsed = createDemandSchema.parse({
      ...validDemand,
      minBudget: '800000.00',
      maxBudget: '1500000',
    });
    expect(parsed.minBudget).toBe(800000);
    expect(parsed.maxBudget).toBe(1500000);
  });

  it('rejects a missing or non-UUID cityId', () => {
    const { cityId, ...noCity } = validDemand;
    expect(cityId).toBeDefined();
    expect(createDemandSchema.safeParse(noCity).success).toBe(false);
    expect(createDemandSchema.safeParse({ ...validDemand, cityId: 'riyadh' }).success).toBe(false);
  });

  it('rejects free-text geography payloads (no city / districts text accepted)', () => {
    const freeTextOnly = {
      propertyType: PropertyType.VILLA,
      city: 'الطائف',
      districts: ['حي الشهراء'],
      minBudget: 800000,
      maxBudget: 1500000,
      minArea: 250,
      maxArea: 450,
    };
    const result = createDemandSchema.safeParse(freeTextOnly);
    expect(result.success).toBe(false);
  });

  it('rejects inverted budget and area ranges', () => {
    expect(
      createDemandSchema.safeParse({ ...validDemand, maxBudget: 500000 }).success,
    ).toBe(false);
    expect(
      createDemandSchema.safeParse({ ...validDemand, maxArea: 100 }).success,
    ).toBe(false);
  });

  it('rejects non-positive area and overlong specifications', () => {
    expect(createDemandSchema.safeParse({ ...validDemand, minArea: 0 }).success).toBe(false);
    expect(
      createDemandSchema.safeParse({ ...validDemand, notes: 'ن'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('rejects an invalid propertyType', () => {
    expect(
      createDemandSchema.safeParse({ ...validDemand, propertyType: 'PLOT' }).success,
    ).toBe(false);
  });
});

describe('cancelDemandSchema (Story 3.6 / FR-58)', () => {
  it('requires a reason of at least 5 characters', () => {
    expect(cancelDemandSchema.safeParse({ reason: 'لا' }).success).toBe(false);
    expect(cancelDemandSchema.safeParse({}).success).toBe(false);
    expect(cancelDemandSchema.safeParse({ reason: 'تم الشراء من مصدر آخر' }).success).toBe(true);
  });

  it('caps the reason at 500 characters', () => {
    expect(cancelDemandSchema.safeParse({ reason: 'س'.repeat(501) }).success).toBe(false);
  });
});

describe('Demand lifecycle contract (Story 3.6)', () => {
  it('exposes CANCELLED alongside the pre-existing statuses', () => {
    expect(DemandStatus.CANCELLED).toBe('CANCELLED');
    expect(DemandStatus.ACTIVE).toBe('ACTIVE');
    expect(DemandStatus.MATCHED).toBe('MATCHED');
  });
});
