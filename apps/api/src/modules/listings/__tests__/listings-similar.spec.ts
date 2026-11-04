import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
  LISTING_NOT_FOUND,
  SIMILAR_LISTINGS_MAX,
  SIMILAR_LISTINGS_PRICE_TOLERANCE,
} from '@elmasaif/shared';

describe('ListingsService.getSimilarListings (Story 3.4 / FR-18)', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let quarantineService: any;

  const baseListingId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockCityId = '11111111-1111-1111-1111-111111111111';
  const mockDistrictId = '22222222-2222-2222-2222-222222222222';

  const baseRow = (overrides: Partial<any> = {}) => ({
    id: baseListingId,
    status: ListingStatus.ACTIVE,
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    askPrice: '3000000.00',
    ...overrides,
  });

  const candidateRow = (id: string, overrides: Partial<any> = {}) => ({
    id,
    title: `فيلا ${id}`,
    description: 'وصف',
    propertyType: PropertyType.VILLA,
    cityId: mockCityId,
    districtId: mockDistrictId,
    city: { nameAr: 'الرياض' },
    district: { nameAr: 'النرجس' },
    askPrice: 3100000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2025,
    status: ListingStatus.ACTIVE,
    sellerProfile: { id: 'profile-1', role: UserRole.MARKETER },
    documents: [
      {
        id: `${id}-p1`,
        documentType: 'PHOTO',
        fileUrl: `listings/u1/${id}.jpg`,
        visibility: DocumentVisibility.PUBLIC,
      },
    ],
    _count: { offers: 0 },
    totalViews: 0,
    totalImpressions: 0,
    totalFavorites: 0,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      listingFavorite: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    clockService = {
      now: jest.fn(() => new Date('2026-11-02T12:00:00.000Z')),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (key: string) =>
        `https://s3.local/${key}?signed=true`,
      ),
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

  const calls = () => prisma.listing.findMany.mock.calls.map((c: any) => c[0]);

  it('AC#5: throws LISTING_NOT_FOUND when the base listing is missing', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    await expect(service.getSimilarListings(baseListingId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getSimilarListings(baseListingId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: LISTING_NOT_FOUND }),
    });
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it('AC#5: throws LISTING_NOT_FOUND when the base listing is not ACTIVE (e.g. seller previewing a draft)', async () => {
    prisma.listing.findUnique.mockResolvedValue(
      baseRow({ status: ListingStatus.DRAFT }),
    );

    await expect(service.getSimilarListings(baseListingId)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it('AC#2: builds base where with status ACTIVE-only, same type + city, self-exclusion, and ±20% price band', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce(Array.from({ length: SIMILAR_LISTINGS_MAX }, (_, i) =>
        candidateRow(`district-${i}`),
      ))
      .mockResolvedValueOnce([]);

    await service.getSimilarListings(baseListingId);

    const districtCall = calls()[0];
    // 3,000,000 → 2,400,000 .. 3,600,000
    expect(districtCall.where.askPrice).toEqual({
      gte: 3_000_000 * (1 - SIMILAR_LISTINGS_PRICE_TOLERANCE),
      lte: 3_000_000 * (1 + SIMILAR_LISTINGS_PRICE_TOLERANCE),
    });
    expect(districtCall.where.askPrice).toEqual({ gte: 2_400_000, lte: 3_600_000 });
    expect(districtCall.where.status).toBe(ListingStatus.ACTIVE);
    // NOT `{ in: [...] }` — reserved/sold/archived never leak into the similar engine.
    expect(districtCall.where.status).not.toBeInstanceOf(Object);
    expect(districtCall.where.propertyType).toBe(PropertyType.VILLA);
    expect(districtCall.where.cityId).toBe(mockCityId);
    expect(districtCall.where.id).toEqual({ not: baseListingId });
    expect(districtCall.where.districtId).toBe(mockDistrictId);
  });

  it('AC#2: caps take at SIMILAR_LISTINGS_MAX and orders newest-first with stable id tie-break', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.getSimilarListings(baseListingId);

    const firstCall = calls()[0];
    expect(firstCall.take).toBe(SIMILAR_LISTINGS_MAX);
    expect(firstCall.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(firstCall.include).toBeDefined();
  });

  it('AC#3: skips the city-fallback query when the district pass already fills the cap', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany.mockResolvedValueOnce(
      Array.from({ length: SIMILAR_LISTINGS_MAX }, (_, i) =>
        candidateRow(`district-${i}`),
      ),
    );

    const res = await service.getSimilarListings(baseListingId);

    expect(prisma.listing.findMany).toHaveBeenCalledTimes(1);
    expect(res.items).toHaveLength(SIMILAR_LISTINGS_MAX);
  });

  it('AC#3: fills the remainder from the same city when the district is thin, excluding already-collected ids and the base', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    const districtHits = [candidateRow('d-1'), candidateRow('d-2')];
    const cityHits = [candidateRow('c-1'), candidateRow('c-2'), candidateRow('c-3'), candidateRow('c-4')];
    prisma.listing.findMany
      .mockResolvedValueOnce(districtHits)
      .mockResolvedValueOnce(cityHits);

    const res = await service.getSimilarListings(baseListingId);

    expect(prisma.listing.findMany).toHaveBeenCalledTimes(2);
    const cityCall = calls()[1];
    expect(cityCall.take).toBe(SIMILAR_LISTINGS_MAX - districtHits.length);
    expect(cityCall.where.id).toEqual({
      notIn: [baseListingId, 'd-1', 'd-2'],
    });
    // District matches come first, then city fills.
    expect(res.items.map((item: any) => item.id)).toEqual([
      'd-1',
      'd-2',
      'c-1',
      'c-2',
      'c-3',
      'c-4',
    ]);
  });

  it('AC#3: does not fabricate a minimum-4 empty guard — returns fewer than 4 if that is all the engine found', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany.mockResolvedValueOnce([candidateRow('only-1')]);
    prisma.listing.findMany.mockResolvedValueOnce([]);

    const res = await service.getSimilarListings(baseListingId);
    expect(res.items).toHaveLength(1);
  });

  it('AC#6: photos come presigned via the shared toSummaryItems mapper', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce([candidateRow('with-photo')])
      .mockResolvedValueOnce([]);

    const res = await service.getSimilarListings(baseListingId);

    expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
      'listings/u1/with-photo.jpg',
      300,
    );
    expect(res.items[0].photos).toEqual([
      'https://s3.local/listings/u1/with-photo.jpg?signed=true',
    ]);
    expect(res.items[0].primaryPhotoUrl).toBe(
      'https://s3.local/listings/u1/with-photo.jpg?signed=true',
    );
    expect(res.items[0].isFalVerified).toBe(true);
    expect(res.items[0].sellerRole).toBe(UserRole.MARKETER);
    expect(typeof res.items[0].askPrice).toBe('number');
  });

  it('propagates the isFavorited flag for logged-in buyers via resolveFavoritedListingIds', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce([candidateRow('fav-1'), candidateRow('fav-2')])
      .mockResolvedValueOnce([]);
    prisma.listingFavorite.findMany.mockResolvedValue([
      { listingId: 'fav-2' },
    ]);

    const res = await service.getSimilarListings(baseListingId, 'user-9');

    const byId = Object.fromEntries(res.items.map((i: any) => [i.id, i]));
    expect(byId['fav-1'].isFavorited).toBe(false);
    expect(byId['fav-2'].isFavorited).toBe(true);
    expect(prisma.listingFavorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-9',
          listingId: expect.objectContaining({ in: ['fav-1', 'fav-2'] }),
        }),
      }),
    );
  });

  it('treats an anonymous requester as having zero favorites but still returns 200-shaped data', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce([candidateRow('anon-1')])
      .mockResolvedValueOnce([]);

    const res = await service.getSimilarListings(baseListingId);

    expect(prisma.listingFavorite.findMany).not.toHaveBeenCalled();
    expect(res.items[0].isFavorited).toBe(false);
  });

  it('AC#2: when the base listing has no districtId, skips the district pass and goes straight to city', async () => {
    prisma.listing.findUnique.mockResolvedValue(
      baseRow({ districtId: null }),
    );
    prisma.listing.findMany.mockResolvedValueOnce([candidateRow('c-1')]);

    const res = await service.getSimilarListings(baseListingId);

    // Only the city-fallback pass runs; the districtWhere is never formed.
    expect(prisma.listing.findMany).toHaveBeenCalledTimes(1);
    expect(calls()[0].where.districtId).toBeUndefined();
    expect(calls()[0].where.id).toEqual({ notIn: [baseListingId] });
    expect(res.items.map((i: any) => i.id)).toEqual(['c-1']);
  });

  it('AC#6: does NOT reuse the search/map `{ in: [ACTIVE, RESERVED] }` form — similar is ACTIVE only', async () => {
    prisma.listing.findUnique.mockResolvedValue(baseRow());
    prisma.listing.findMany
      .mockResolvedValueOnce([candidateRow('only-active')])
      .mockResolvedValueOnce([]);

    await service.getSimilarListings(baseListingId);

    const districtWhere = calls()[0].where;
    // A reserved listing must NEVER appear here — AC#2 explicit.
    expect(districtWhere.status).toBe(ListingStatus.ACTIVE);
    expect(districtWhere.status).not.toEqual({
      in: [ListingStatus.ACTIVE, ListingStatus.RESERVED],
    });
  });
});
