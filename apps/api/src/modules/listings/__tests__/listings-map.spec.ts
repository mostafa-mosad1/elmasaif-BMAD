import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import {
  UserRole,
  PropertyType,
  ListingStatus,
  ListingMapQuery,
  MAX_MAP_RESULTS,
} from '@elmasaif/shared';

describe('ListingsService.getListingsForMap (Story 3.2)', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const mockCityId = '11111111-1111-1111-1111-111111111111';
  const mockDistrictId = '22222222-2222-2222-2222-222222222222';

  const baseMapQuery: ListingMapQuery = {
    swLat: 20,
    swLng: 40,
    neLat: 26,
    neLng: 50,
    falOnly: false,
  };

  const mockListing = (overrides: Partial<any> = {}) => ({
    id: 'listing-1',
    title: 'فيلا مودرن في النرجس',
    propertyType: PropertyType.VILLA,
    latitude: 24.7,
    longitude: 46.6,
    askPrice: '3200000.00',
    areaSquareMeters: 450,
    status: ListingStatus.ACTIVE,
    sellerProfile: { role: UserRole.MARKETER },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn(),
      },
    };

    clockService = {
      now: jest.fn(() => new Date('2026-11-02T12:00:00.000Z')),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(),
    };

    quarantineService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: quarantineService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  const lastArgs = () => prisma.listing.findMany.mock.calls[0][0];
  const lastWhere = () => lastArgs().where;

  it('AC#7: always gates status to ACTIVE + RESERVED', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({ ...baseMapQuery });

    expect(lastWhere().status).toEqual({ in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] });
  });

  it('AC#7: builds bounding-box query with latitude/longitude gte/lte', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({ ...baseMapQuery });

    expect(lastWhere().latitude).toEqual({ gte: 20, lte: 26 });
    expect(lastWhere().longitude).toEqual({ gte: 40, lte: 50 });
  });

  it('AC#7: caps results at MAX_MAP_RESULTS (take: 200)', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({ ...baseMapQuery });

    expect(lastArgs().take).toBe(MAX_MAP_RESULTS);
  });

  it('AC#7: presigns primary photo when documents are present', async () => {
    prisma.listing.findMany.mockResolvedValue([
      mockListing({ documents: [{ fileUrl: 'listings/u1/p1.jpg' }] }),
    ]);
    storageService.getPresignedDownloadUrl.mockResolvedValue('https://s3.local/signed.jpg');

    const result = await service.getListingsForMap({ ...baseMapQuery });

    expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith('listings/u1/p1.jpg', 300);
    expect(result.items[0].primaryPhotoUrl).toBe('https://s3.local/signed.jpg');
  });

  it('AC#7: maps raw listing to MapListingItem with Number(askPrice) and null photo when no docs', async () => {
    prisma.listing.findMany.mockResolvedValue([mockListing({ documents: [] })]);

    const result = await service.getListingsForMap({ ...baseMapQuery });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 'listing-1',
      title: 'فيلا مودرن في النرجس',
      propertyType: PropertyType.VILLA,
      latitude: 24.7,
      longitude: 46.6,
      askPrice: 3200000,
      areaSquareMeters: 450,
      status: ListingStatus.ACTIVE,
      isFalVerified: true,
      primaryPhotoUrl: null,
    });
  });

  it('AC#7: isFalVerified is false for OWNER role', async () => {
    prisma.listing.findMany.mockResolvedValue([
      mockListing({ sellerProfile: { role: UserRole.OWNER } }),
    ]);

    const result = await service.getListingsForMap({ ...baseMapQuery });

    expect(result.items[0].isFalVerified).toBe(false);
  });

  it('applies optional filters: cityId, districtId, propertyType', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({
      ...baseMapQuery,
      cityId: mockCityId,
      districtId: mockDistrictId,
      propertyType: PropertyType.APARTMENT,
    });

    const where = lastWhere();
    expect(where.cityId).toBe(mockCityId);
    expect(where.districtId).toBe(mockDistrictId);
    expect(where.propertyType).toBe(PropertyType.APARTMENT);
  });

  it('applies price and area range filters', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({
      ...baseMapQuery,
      priceMin: 500000,
      priceMax: 3000000,
      areaMin: 100,
      areaMax: 1000,
    });

    const where = lastWhere();
    expect(where.askPrice).toEqual({ gte: 500000, lte: 3000000 });
    expect(where.areaSquareMeters).toEqual({ gte: 100, lte: 1000 });
  });

  it('applies bedroomsMin and falOnly filters', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({
      ...baseMapQuery,
      bedroomsMin: 3,
      falOnly: true,
    });

    const where = lastWhere();
    expect(where.bedrooms).toEqual({ gte: 3 });
    expect(where.sellerProfile).toEqual({ is: { role: UserRole.MARKETER } });
  });

  it('applies free-text q as OR title/description', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({ ...baseMapQuery, q: 'فيلا' });

    expect(lastWhere().OR).toEqual([
      { title: { contains: 'فيلا', mode: 'insensitive' } },
      { description: { contains: 'فيلا', mode: 'insensitive' } },
    ]);
  });

  it('returns empty items array when no listings match', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    const result = await service.getListingsForMap({ ...baseMapQuery });

    expect(result).toEqual({ items: [] });
  });

  it('uses select to limit fields (only fileUrl from first photo)', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await service.getListingsForMap({ ...baseMapQuery });

    const select = lastArgs().select;
    expect(select).toBeDefined();
    expect(select.id).toBe(true);
    expect(select.latitude).toBe(true);
    expect(select.longitude).toBe(true);
    expect(select.askPrice).toBe(true);
    // Documents: only selects fileUrl, take: 1, PUBLIC PHOTOs
    expect(select.documents).toBeDefined();
    expect(select.documents.take).toBe(1);
    expect(select.documents.select).toEqual({ fileUrl: true });
    expect(select.documents.where).toEqual({
      documentType: 'PHOTO',
      visibility: 'PUBLIC',
    });
  });
});
