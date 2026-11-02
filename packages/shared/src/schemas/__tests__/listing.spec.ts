import { describe, it, expect } from 'vitest';
import {
  createListingSchema,
  listingPhotoItemSchema,
  listingDocumentItemSchema,
  LISTING_NOT_FOUND,
  LISTING_TITLE_INVALID,
  LISTING_PRICE_OUT_OF_RANGE,
  LISTING_AREA_INVALID,
  LISTING_MIN_PHOTOS_REQUIRED,
  LISTING_MAX_PHOTOS_EXCEEDED,
  LISTING_PRIMARY_PHOTO_REQUIRED,
  LISTING_MARKETER_AUTH_DOC_REQUIRED,
  LISTING_OWNER_DEED_REQUIRED,
  LISTING_INVALID_IBAN,
  LISTING_COORDINATES_INVALID,
  LISTING_ROLE_UNAUTHORIZED,
  LISTING_FAL_LICENSE_REQUIRED,
  LISTING_DOCUMENT_ACCESS_DENIED,
  LISTING_MALWARE_DETECTED,
  MIN_LISTING_PRICE_SAR,
  MAX_LISTING_PRICE_SAR,
  MIN_LISTING_PHOTOS,
  MAX_LISTING_PHOTOS,
  MAX_LISTING_FILE_SIZE_BYTES,
  SAUDI_BOUNDS,
  PropertyType,
  DocumentVisibility,
} from '../../../src';

describe('Listing Constants', () => {
  it('should export all standardized listing error constants', () => {
    expect(LISTING_NOT_FOUND).toBe('LISTING_NOT_FOUND');
    expect(LISTING_TITLE_INVALID).toBe('LISTING_TITLE_INVALID');
    expect(LISTING_PRICE_OUT_OF_RANGE).toBe('LISTING_PRICE_OUT_OF_RANGE');
    expect(LISTING_AREA_INVALID).toBe('LISTING_AREA_INVALID');
    expect(LISTING_MIN_PHOTOS_REQUIRED).toBe('LISTING_MIN_PHOTOS_REQUIRED');
    expect(LISTING_MAX_PHOTOS_EXCEEDED).toBe('LISTING_MAX_PHOTOS_EXCEEDED');
    expect(LISTING_PRIMARY_PHOTO_REQUIRED).toBe('LISTING_PRIMARY_PHOTO_REQUIRED');
    expect(LISTING_MARKETER_AUTH_DOC_REQUIRED).toBe('LISTING_MARKETER_AUTH_DOC_REQUIRED');
    expect(LISTING_OWNER_DEED_REQUIRED).toBe('LISTING_OWNER_DEED_REQUIRED');
    expect(LISTING_INVALID_IBAN).toBe('LISTING_INVALID_IBAN');
    expect(LISTING_COORDINATES_INVALID).toBe('LISTING_COORDINATES_INVALID');
    expect(LISTING_ROLE_UNAUTHORIZED).toBe('LISTING_ROLE_UNAUTHORIZED');
    expect(LISTING_FAL_LICENSE_REQUIRED).toBe('LISTING_FAL_LICENSE_REQUIRED');
    expect(LISTING_DOCUMENT_ACCESS_DENIED).toBe('LISTING_DOCUMENT_ACCESS_DENIED');
    expect(LISTING_MALWARE_DETECTED).toBe('LISTING_MALWARE_DETECTED');
  });

  it('should export correct numerical and bounding limits', () => {
    expect(MIN_LISTING_PRICE_SAR).toBe(1);
    expect(MAX_LISTING_PRICE_SAR).toBe(50_000_000);
    expect(MIN_LISTING_PHOTOS).toBe(3);
    expect(MAX_LISTING_PHOTOS).toBe(20);
    expect(MAX_LISTING_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(SAUDI_BOUNDS).toEqual({
      minLat: 16.0,
      maxLat: 32.5,
      minLng: 34.5,
      maxLng: 55.7,
    });
  });
});

describe('createListingSchema', () => {
  const validUUIDCity = 'a0000000-0000-0000-0000-000000000001';
  const validUUIDDistrict = 'b0000000-0000-0000-0000-000000000002';
  const validIban = 'SA0380000000608010167519';

  const validPhotos = [
    {
      fileUrl: 'listings/user-1/photo1.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024 * 500,
      isPrimary: true,
    },
    {
      fileUrl: 'listings/user-1/photo2.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024 * 500,
      isPrimary: false,
    },
    {
      fileUrl: 'listings/user-1/photo3.png',
      mimeType: 'image/png',
      fileSize: 1024 * 500,
      isPrimary: false,
    },
  ];

  const validDocuments = [
    {
      documentType: 'TITLE_DEED',
      fileUrl: 'listings/user-1/deed.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024 * 1000,
      visibility: DocumentVisibility.ADMIN_ONLY,
    },
  ];

  const validListingPayload = {
    title: 'فيلا فاخرة للبيع بحي النرجس',
    description: 'فيلا مودرن بتصميم عصري وتشطيبات فاخرة متكاملة الخدمات والمرافق',
    propertyType: PropertyType.VILLA,
    cityId: validUUIDCity,
    districtId: validUUIDDistrict,
    streetName: 'شارع الأمير فيصل بن بندر',
    latitude: 24.7136,
    longitude: 46.6753,
    askPrice: 3500000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2023,
    payoutIban: validIban,
    photos: validPhotos,
    documents: validDocuments,
  };

  it('should accept a completely valid listing creation payload', () => {
    const result = createListingSchema.safeParse(validListingPayload);
    expect(result.success).toBe(true);
  });

  it('should reject askPrice below 1 SAR or above 50,000,000 SAR', () => {
    expect(createListingSchema.safeParse({ ...validListingPayload, askPrice: 0 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...validListingPayload, askPrice: -100 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...validListingPayload, askPrice: 50000001 }).success).toBe(false);
  });

  it('should reject photos array with fewer than 3 items', () => {
    const twoPhotos = validPhotos.slice(0, 2);
    expect(createListingSchema.safeParse({ ...validListingPayload, photos: twoPhotos }).success).toBe(false);
  });

  it('should reject photos array with more than 20 items', () => {
    const twentyOnePhotos = Array(21).fill(validPhotos[0]);
    expect(createListingSchema.safeParse({ ...validListingPayload, photos: twentyOnePhotos }).success).toBe(false);
  });

  it('should reject coordinates outside Saudi Arabia bounding box', () => {
    // Lat out of range
    expect(createListingSchema.safeParse({ ...validListingPayload, latitude: 15.9 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...validListingPayload, latitude: 32.6 }).success).toBe(false);
    // Lng out of range
    expect(createListingSchema.safeParse({ ...validListingPayload, longitude: 34.4 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...validListingPayload, longitude: 55.8 }).success).toBe(false);
  });

  it('should reject invalid IBAN checksum or format', () => {
    expect(createListingSchema.safeParse({ ...validListingPayload, payoutIban: 'SA0000000000000000000000' }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...validListingPayload, payoutIban: 'GB82WEST12345698765432' }).success).toBe(false);
  });

  it('should reject missing mandatory fields', () => {
    const missingTitle = { ...validListingPayload };
    delete (missingTitle as any).title;
    expect(createListingSchema.safeParse(missingTitle).success).toBe(false);

    const missingCity = { ...validListingPayload };
    delete (missingCity as any).cityId;
    expect(createListingSchema.safeParse(missingCity).success).toBe(false);

    const missingDistrict = { ...validListingPayload };
    delete (missingDistrict as any).districtId;
    expect(createListingSchema.safeParse(missingDistrict).success).toBe(false);

    const missingArea = { ...validListingPayload };
    delete (missingArea as any).areaSquareMeters;
    expect(createListingSchema.safeParse(missingArea).success).toBe(false);

    const missingDocs = { ...validListingPayload, documents: [] };
    expect(createListingSchema.safeParse(missingDocs).success).toBe(false);
  });

  it('should strictly disallow or ignore bathrooms field per BR-13', () => {
    const parsed = createListingSchema.safeParse({
      ...validListingPayload,
      bathrooms: 4,
    });
    // Even if parsed, bathrooms must not exist on the validated object
    if (parsed.success) {
      expect((parsed.data as any).bathrooms).toBeUndefined();
    }
  });

  it('should validate photo and document items schema independently', () => {
    expect(
      listingPhotoItemSchema.safeParse({
        fileUrl: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        isPrimary: true,
      }).success,
    ).toBe(true);

    // Unsupported photo mime type
    expect(
      listingPhotoItemSchema.safeParse({
        fileUrl: 'photo.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        isPrimary: false,
      }).success,
    ).toBe(false);

    // Document item
    expect(
      listingDocumentItemSchema.safeParse({
        documentType: 'TITLE_DEED',
        fileUrl: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        visibility: DocumentVisibility.ADMIN_ONLY,
      }).success,
    ).toBe(true);
  });
});

