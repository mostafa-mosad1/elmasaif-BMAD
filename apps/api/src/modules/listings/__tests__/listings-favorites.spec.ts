import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
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
  FAVORITES_LIMIT_REACHED,
  MAX_FAVORITES_PER_USER,
} from '@elmasaif/shared';

describe('ListingsService — Buyer Favorites (Story 3.5 / FR-20)', () => {
  let service: ListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;

  const mockUserId = 'user-uuid-1';
  const mockListingId = '11111111-1111-1111-1111-111111111111';
  const mockDate = new Date('2026-11-04T12:00:00.000Z');

  const favoritedListingRow = (
    id: string,
    overrides: Partial<any> = {},
  ) => ({
    id,
    title: `فيلا ${id}`,
    description: 'وصف',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'dist-1',
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
    totalFavorites: 2,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    clockService = { now: jest.fn(() => mockDate) };

    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      listingFavorite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      listingDailyMetric: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (key: string) =>
        `https://s3.local/${key}?signed=true`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: {} },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  describe('getBuyerFavorites', () => {
    it('AC#3/#5: queries favorites by userId, newest-saved first (createdAt desc + listingId asc) with the live listing joined — NO status filter', async () => {
      prisma.listingFavorite.findMany.mockResolvedValue([
        { listing: favoritedListingRow('b') },
        { listing: favoritedListingRow('a', { status: ListingStatus.SOLD }) },
      ]);

      const result = await service.getBuyerFavorites(mockUserId);

      expect(prisma.listingFavorite.findMany).toHaveBeenCalledTimes(1);
      const arg = prisma.listingFavorite.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: mockUserId });
      // AC#5 — no status filtering: SOLD/RESERVED/ARCHIVED favorites must come back.
      expect(arg.where).not.toHaveProperty('status');
      expect(arg.where.listing).toBeUndefined();
      expect(arg.orderBy).toEqual([{ createdAt: 'desc' }, { listingId: 'asc' }]);
      expect(arg.include).toHaveProperty('listing');
    });

    it('AC#3/#5: maps joined listings through toSummaryItems with presigned photos and isFavorited=true on every row', async () => {
      prisma.listingFavorite.findMany.mockResolvedValue([
        { listing: favoritedListingRow('x1') },
        { listing: favoritedListingRow('x2', { status: ListingStatus.RESERVED }) },
      ]);

      const { items } = await service.getBuyerFavorites(mockUserId);

      expect(items).toHaveLength(2);
      expect(items.map((i: any) => i.id)).toEqual(['x1', 'x2']);
      // Every favorite is favorited by definition — built from the joined ids, not a re-query.
      expect(items.every((i: any) => i.isFavorited === true)).toBe(true);
      // Live status preserved so the grid can render the current badge (AC#5).
      expect(items[1].status).toBe(ListingStatus.RESERVED);
      // Photos presigned through the shared mapper.
      expect(storageService.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'listings/u1/x1.jpg',
        300,
      );
      expect(items[0].photos[0]).toContain('?signed=true');
    });

    it('AC#3: returns { items: [] } when the buyer has no favorites', async () => {
      prisma.listingFavorite.findMany.mockResolvedValue([]);

      await expect(service.getBuyerFavorites(mockUserId)).resolves.toEqual({
        items: [],
      });
    });

    it('drops a favorite whose joined listing is null (defensive filter)', async () => {
      prisma.listingFavorite.findMany.mockResolvedValue([
        { listing: favoritedListingRow('ok') },
        { listing: null },
      ]);

      const { items } = await service.getBuyerFavorites(mockUserId);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('ok');
    });
  });

  describe('toggleFavorite — 100-cap enforcement (AC#4)', () => {
    it('rejects with FAVORITES_LIMIT_REACHED at the cap and performs no writes', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: mockListingId, totalFavorites: 5 });
      prisma.listingFavorite.findUnique.mockResolvedValue(null); // not yet favorited → create branch
      prisma.listingFavorite.count.mockResolvedValue(MAX_FAVORITES_PER_USER);

      await expect(
        service.toggleFavorite(mockListingId, mockUserId),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.toggleFavorite(mockListingId, mockUserId),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: FAVORITES_LIMIT_REACHED }),
      });

      expect(prisma.listingFavorite.count).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(prisma.listingFavorite.create).not.toHaveBeenCalled();
      expect(prisma.listing.update).not.toHaveBeenCalled();
      expect(prisma.listingDailyMetric.upsert).not.toHaveBeenCalled();
    });

    it('creates normally under the cap (99) and leaves the un-favorite path untouched', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: mockListingId, totalFavorites: 99 });
      prisma.listingFavorite.findUnique.mockResolvedValue(null);
      prisma.listingFavorite.count.mockResolvedValue(99);
      prisma.listingFavorite.create.mockResolvedValue({ id: 'fav-1' });
      prisma.listing.update.mockResolvedValue({ totalFavorites: 100 });
      prisma.listingDailyMetric.upsert.mockResolvedValue({});

      const result = await service.toggleFavorite(mockListingId, mockUserId);

      expect(result).toEqual({ isFavorited: true, totalFavorites: 100 });
      expect(prisma.listingFavorite.create).toHaveBeenCalled();
    });

    it('never blocks a removal when already at the cap (un-favorite path skips the count check)', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: mockListingId, totalFavorites: MAX_FAVORITES_PER_USER });
      prisma.listingFavorite.findUnique.mockResolvedValue({ id: 'fav-1' }); // already favorited → delete branch
      prisma.listingFavorite.delete.mockResolvedValue({});
      prisma.listing.update.mockResolvedValue({ totalFavorites: MAX_FAVORITES_PER_USER - 1 });

      const result = await service.toggleFavorite(mockListingId, mockUserId);

      expect(result).toEqual({ isFavorited: false, totalFavorites: MAX_FAVORITES_PER_USER - 1 });
      // Count guard must NOT run on the delete branch.
      expect(prisma.listingFavorite.count).not.toHaveBeenCalled();
    });
  });
});
