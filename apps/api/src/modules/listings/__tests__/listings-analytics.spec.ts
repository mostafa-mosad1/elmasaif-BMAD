import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { ListingsService } from '../listings.service';
import { ListingsController } from '../listings.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import { ListingEngagementEventType } from '@elmasaif/shared';

describe('Listings Analytics & Engagement', () => {
  let service: ListingsService;
  let controller: ListingsController;
  let prisma: any;
  let clockService: any;

  const mockListingId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = 'user-uuid-1';
  const mockDate = new Date('2026-11-03T12:00:00.000Z');

  beforeEach(async () => {
    clockService = {
      now: jest.fn().mockReturnValue(mockDate),
    };

    prisma = {
      listing: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      listingDailyMetric: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      listingFavorite: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
      adminSession: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: { getPresignedDownloadUrl: jest.fn() } },
        { provide: QuarantineService, useValue: {} },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    controller = module.get<ListingsController>(ListingsController);
  });

  describe('recordBatchEngagement', () => {
    it('aggregates events and updates metrics & lifetime counters atomically', async () => {
      prisma.listing.findMany.mockResolvedValue([{ id: mockListingId }]);
      prisma.listingDailyMetric.upsert.mockResolvedValue({});
      prisma.listing.update.mockResolvedValue({});

      const result = await service.recordBatchEngagement({
        events: [
          { listingId: mockListingId, eventType: ListingEngagementEventType.IMPRESSION, count: 1 },
          { listingId: mockListingId, eventType: ListingEngagementEventType.IMPRESSION, count: 2 },
          { listingId: mockListingId, eventType: ListingEngagementEventType.DETAIL_VIEW, count: 1 },
        ],
      });

      expect(result).toEqual({ processed: 3 });
      expect(prisma.listingDailyMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            listingId_date: {
              listingId: mockListingId,
              date: new Date(Date.UTC(2026, 10, 3)),
            },
          },
          create: expect.objectContaining({
            impressions: 3,
            detailViews: 1,
          }),
          update: expect.objectContaining({
            impressions: { increment: 3 },
            detailViews: { increment: 1 },
          }),
        }),
      );
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: mockListingId },
        data: {
          totalImpressions: { increment: 3 },
          totalViews: { increment: 1 },
        },
      });
    });

    it('gracefully skips nonexistent listing IDs without throwing', async () => {
      prisma.listing.findMany.mockResolvedValue([]); // No listings found

      const result = await service.recordBatchEngagement({
        events: [
          { listingId: 'non-existent-uuid', eventType: ListingEngagementEventType.IMPRESSION, count: 1 },
        ],
      });

      expect(result).toEqual({ processed: 1 });
      expect(prisma.listingDailyMetric.upsert).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavorite', () => {
    it('creates favorite and increments totalFavorites and favoriteAdds when not favorited', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: mockListingId, totalFavorites: 0 });
      prisma.listingFavorite.findUnique.mockResolvedValue(null);
      prisma.listingFavorite.create.mockResolvedValue({ id: 'fav-1' });
      prisma.listing.update.mockResolvedValue({ id: mockListingId, totalFavorites: 1 });
      prisma.listingDailyMetric.upsert.mockResolvedValue({});

      const result = await service.toggleFavorite(mockListingId, mockUserId);

      expect(result).toEqual({ isFavorited: true, totalFavorites: 1 });
      expect(prisma.listingFavorite.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          listingId: mockListingId,
          createdAt: mockDate,
        },
      });
      expect(prisma.listingDailyMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ favoriteAdds: 1 }),
          update: expect.objectContaining({ favoriteAdds: { increment: 1 } }),
        }),
      );
    });

    it('removes favorite and decrements totalFavorites when already favorited', async () => {
      prisma.listing.findUnique.mockResolvedValue({ id: mockListingId, totalFavorites: 3 });
      prisma.listingFavorite.findUnique.mockResolvedValue({ id: 'fav-1' });
      prisma.listingFavorite.delete.mockResolvedValue({});
      prisma.listing.update.mockResolvedValue({ id: mockListingId, totalFavorites: 2 });

      const result = await service.toggleFavorite(mockListingId, mockUserId);

      expect(result).toEqual({ isFavorited: false, totalFavorites: 2 });
      expect(prisma.listingFavorite.delete).toHaveBeenCalledWith({ where: { id: 'fav-1' } });
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: mockListingId },
        data: { totalFavorites: 2 },
      });
    });

    it('throws NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.toggleFavorite(mockListingId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getListingAnalytics', () => {
    it('returns seller engagement metrics and conversion ratio for authorized owner', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: mockListingId,
        totalViews: 200,
        totalImpressions: 1000,
        totalFavorites: 15,
        sellerProfile: { userId: mockUserId },
        _count: { offers: 10 },
      });
      prisma.listingDailyMetric.findMany.mockResolvedValue([
        {
          date: new Date('2026-11-03'),
          impressions: 50,
          detailViews: 10,
          favoriteAdds: 2,
        },
      ]);

      const analytics = await service.getListingAnalytics(mockListingId, mockUserId, 30);

      expect(analytics.listingId).toBe(mockListingId);
      expect(analytics.totalViews).toBe(200);
      expect(analytics.totalImpressions).toBe(1000);
      expect(analytics.totalFavorites).toBe(15);
      expect(analytics.offersCount).toBe(10);
      expect(analytics.conversionRatio).toBe(5); // (10 / 200) * 100 = 5%
      expect(analytics.dailyMetrics).toHaveLength(1);
      expect(analytics.dailyMetrics[0].impressions).toBe(50);
    });

    it('forbids access if caller is not the listing seller and not admin', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: mockListingId,
        sellerProfile: { userId: 'different-user' },
      });

      await expect(service.getListingAnalytics(mockListingId, mockUserId, 30)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('ListingsController Endpoints', () => {
    it('recordAnalyticsEvents returns 202 Accepted', async () => {
      jest.spyOn(service, 'recordBatchEngagement').mockResolvedValue({ processed: 2 });

      const res = await controller.recordAnalyticsEvents({
        events: [
          { listingId: mockListingId, eventType: ListingEngagementEventType.IMPRESSION, count: 1 },
          { listingId: mockListingId, eventType: ListingEngagementEventType.DETAIL_VIEW, count: 1 },
        ],
      });

      expect(res).toEqual({ processed: 2 });
    });

    it('toggleFavorite returns favorite state', async () => {
      jest.spyOn(service, 'toggleFavorite').mockResolvedValue({ isFavorited: true, totalFavorites: 5 });

      const res = await controller.toggleFavorite(mockListingId, { user: { id: mockUserId } });

      expect(res.data).toEqual({ isFavorited: true, totalFavorites: 5 });
    });

    it('getListingAnalytics returns seller analytics', async () => {
      jest.spyOn(service, 'getListingAnalytics').mockResolvedValue({
        listingId: mockListingId,
        totalViews: 100,
        totalImpressions: 500,
        totalFavorites: 5,
        offersCount: 2,
        conversionRatio: 2,
        dailyMetrics: [],
      });

      const res = await controller.getListingAnalytics(
        mockListingId,
        { days: 30 },
        { user: { id: mockUserId } },
      );

      expect(res.data.totalViews).toBe(100);
    });
  });
});

