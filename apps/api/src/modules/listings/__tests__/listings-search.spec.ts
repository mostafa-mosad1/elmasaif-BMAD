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
  DocumentVisibility,
  ListingSearchSort,
  ListingSearchQuery,
} from '@elmasaif/shared';

describe('ListingsService.searchListings (Story 3.1)', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const mockCityId = '11111111-1111-1111-1111-111111111111';
  const mockDistrictId = '22222222-2222-2222-2222-222222222222';

  const baseQuery: ListingSearchQuery = {
    page: 1,
    limit: 20,
    sort: ListingSearchSort.NEWEST,
    falOnly: false,
  };

  const rawListing = (overrides: Partial<any> = {}) => ({
    id: 'listing-1',
    title: 'فيلا مودرن في النرجس',
    description: 'فيلا بتصميم حديث',
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    city: { nameAr: 'الرياض' },
    district: { nameAr: 'النرجس' },
    askPrice: 3200000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2025,
    status: ListingStatus.ACTIVE,
    sellerProfile: { id: 'profile-1', role: UserRole.MARKETER },
    documents: [
      { id: 'p1', documentType: 'PHOTO', fileUrl: 'listings/u1/p1.jpg', visibility: DocumentVisibility.PUBLIC },
    ],
    _count: { offers: 2 },
    totalViews: 10,
    totalImpressions: 100,
    totalFavorites: 4,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      listingFavorite: {
        findMany: jest.fn(),
      },
    };

    clockService = {
      now: jest.fn(() => new Date('2026-11-02T12:00:00.000Z')),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (key: string) => `https://s3.local/${key}?signed=true`),
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

  const lastWhere = () => prisma.listing.findMany.mock.calls[0][0].where;

  it('AC#2: always gates to ACTIVE + RESERVED and excludes all other statuses', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery });

    expect(lastWhere().status).toEqual({ in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] });
    expect(prisma.listing.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] } }) }),
    );
  });

  it('AC#1: applies city, district, and propertyType filters together (AND)', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({
      ...baseQuery,
      cityId: mockCityId,
      districtId: mockDistrictId,
      propertyType: PropertyType.VILLA,
    });

    const where = lastWhere();
    expect(where.cityId).toBe(mockCityId);
    expect(where.districtId).toBe(mockDistrictId);
    expect(where.propertyType).toBe(PropertyType.VILLA);
    expect(where.status).toEqual({ in: [ListingStatus.ACTIVE, ListingStatus.RESERVED] });
  });

  it('AC#1: builds price and area ranges with gte/lte, and bedroomsMin with gte', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({
      ...baseQuery,
      priceMin: 500000,
      priceMax: 3000000,
      areaMin: 150,
      areaMax: 900,
      bedroomsMin: 4,
    });

    const where = lastWhere();
    expect(where.askPrice).toEqual({ gte: 500000, lte: 3000000 });
    expect(where.areaSquareMeters).toEqual({ gte: 150, lte: 900 });
    expect(where.bedrooms).toEqual({ gte: 4 });
  });

  it('AC#1: only the provided side of a range is applied', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery, priceMax: 2000000 });
    expect(lastWhere().askPrice).toEqual({ lte: 2000000 });
  });

  it('AC#5: free text matches title OR description case-insensitively', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery, q: 'فيلا' });

    expect(lastWhere().OR).toEqual([
      { title: { contains: 'فيلا', mode: 'insensitive' } },
      { description: { contains: 'فيلا', mode: 'insensitive' } },
    ]);
  });

  it('does not add an OR clause when free text is absent', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery });
    expect(lastWhere().OR).toBeUndefined();
  });

  it('falOnly filters seller role to MARKETER; default omits it', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery, falOnly: true });
    expect(lastWhere().sellerProfile).toEqual({ is: { role: UserRole.MARKETER } });

    prisma.listing.findMany.mockClear();
    prisma.listing.count.mockResolvedValue(0);
    await service.searchListings({ ...baseQuery, falOnly: false });
    expect(lastWhere().sellerProfile).toBeUndefined();
  });

  it('AC#4: maps each sort token to the correct orderBy with a stable id tie-break', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    await service.searchListings({ ...baseQuery, sort: ListingSearchSort.NEWEST });
    expect(prisma.listing.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);

    await service.searchListings({ ...baseQuery, sort: ListingSearchSort.PRICE_ASC });
    expect(prisma.listing.findMany.mock.calls[1][0].orderBy).toEqual([{ askPrice: 'asc' }, { id: 'asc' }]);

    await service.searchListings({ ...baseQuery, sort: ListingSearchSort.PRICE_DESC });
    expect(prisma.listing.findMany.mock.calls[2][0].orderBy).toEqual([{ askPrice: 'desc' }, { id: 'asc' }]);
  });

  it('AC#3: computes pagination meta and skip from page/limit', async () => {
    prisma.listing.count.mockResolvedValue(95);
    prisma.listing.findMany.mockResolvedValue([]);

    const res = await service.searchListings({ ...baseQuery, page: 3, limit: 20 });

    expect(prisma.listing.findMany.mock.calls[0][0].skip).toBe(40);
    expect(prisma.listing.findMany.mock.calls[0][0].take).toBe(20);
    expect(res.meta).toEqual({ total: 95, page: 3, limit: 20, totalPages: 5 });
  });

  it('AC#3: empty result set yields total 0 and totalPages 0', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    const res = await service.searchListings({ ...baseQuery });
    expect(res.items).toEqual([]);
    expect(res.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
  });

  it('AC#3: clamps an out-of-range limit at the service boundary', async () => {
    prisma.listing.count.mockResolvedValue(0);
    prisma.listing.findMany.mockResolvedValue([]);

    const res = await service.searchListings({ ...baseQuery, limit: 500 } as ListingSearchQuery);
    expect(res.meta.limit).toBe(100);
    expect(prisma.listing.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('reuses the shared mapper: presigned photos, Fal badge, and favorite flag', async () => {
    prisma.listing.count.mockResolvedValue(1);
    prisma.listing.findMany.mockResolvedValue([rawListing()]);
    prisma.listingFavorite.findMany.mockResolvedValue([{ listingId: 'listing-1' }]);

    const res = await service.searchListings({ ...baseQuery }, 'user-1');

    const item = res.items[0];
    expect(item.photos).toEqual(['https://s3.local/listings/u1/p1.jpg?signed=true']);
    expect(item.primaryPhotoUrl).toBe('https://s3.local/listings/u1/p1.jpg?signed=true');
    expect(item.photoCount).toBe(1);
    expect(item.askPrice).toBe(3200000);
    expect(Number.isFinite(item.askPrice)).toBe(true);
    expect(item.isFalVerified).toBe(true);
    expect(item.sellerRole).toBe(UserRole.MARKETER);
    expect(item.isFavorited).toBe(true);
  });

  it('keeps getPublicActiveListings (home feed) working after mapper extraction (AC#7)', async () => {
    prisma.listing.findMany.mockResolvedValue([rawListing({ id: 'home-1' })]);

    const res = await service.getPublicActiveListings(12);

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ListingStatus.ACTIVE },
        take: 12,
      }),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].photos).toEqual(['https://s3.local/listings/u1/p1.jpg?signed=true']);
    expect(res.items[0].isFalVerified).toBe(true);
  });
});
