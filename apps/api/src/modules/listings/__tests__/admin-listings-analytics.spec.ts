import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AdminListingsService } from '../admin-listings.service';
import { AdminListingsController } from '../admin-listings.controller';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { EmailTransportService } from '../../auth/email/email-transport.service';
import { ListingStatus, PropertyType } from '@elmasaif/shared';

describe('Admin Listings Engagement Analytics', () => {
  let service: AdminListingsService;
  let controller: AdminListingsController;
  let prisma: any;
  let clockService: any;

  const mockDate = new Date('2026-11-03T12:00:00.000Z');

  beforeEach(async () => {
    clockService = {
      now: jest.fn().mockReturnValue(mockDate),
    };

    prisma = {
      listing: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      offer: {
        count: jest.fn(),
      },
      listingDailyMetric: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminListingsController],
      providers: [
        AdminListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: EmailTransportService, useValue: { sendMail: jest.fn() } },
        { provide: ListingsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminListingsService>(AdminListingsService);
    controller = module.get<AdminListingsController>(AdminListingsController);
  });

  describe('getGlobalEngagementAnalytics', () => {
    it('aggregates platform counters, top 10 listings, and daily trends', async () => {
      prisma.listing.count.mockResolvedValue(42);
      prisma.listing.aggregate.mockResolvedValue({
        _sum: {
          totalImpressions: 50000,
          totalViews: 8000,
          totalFavorites: 400,
        },
      });
      prisma.offer.count.mockResolvedValue(160);
      prisma.listing.findMany.mockResolvedValue([
        {
          id: 'listing-1',
          title: 'فيلا فاخرة',
          propertyType: PropertyType.VILLA,
          city: { nameAr: 'الرياض' },
          askPrice: 3500000,
          totalViews: 1200,
          totalFavorites: 85,
        },
      ]);
      prisma.listingDailyMetric.findMany.mockResolvedValue([
        {
          date: new Date('2026-11-03'),
          impressions: 1500,
          detailViews: 300,
          favoriteAdds: 20,
        },
      ]);

      const result = await service.getGlobalEngagementAnalytics(30);

      expect(result.totalActiveListings).toBe(42);
      expect(result.totalLifetimeImpressions).toBe(50000);
      expect(result.totalLifetimeViews).toBe(8000);
      expect(result.totalLifetimeFavorites).toBe(400);
      expect(result.averageConversionRatio).toBe(2); // (160 / 8000) * 100 = 2%
      expect(result.topListings).toHaveLength(1);
      expect(result.topListings[0].title).toBe('فيلا فاخرة');
      expect(result.dailyTrends).toHaveLength(1);
      expect(result.dailyTrends[0].detailViews).toBe(300);
    });
  });

  describe('AdminListingsController Analytics Route', () => {
    it('GET /admin/listings/analytics/overview calls service and returns data', async () => {
      jest.spyOn(service, 'getGlobalEngagementAnalytics').mockResolvedValue({
        totalActiveListings: 10,
        totalLifetimeImpressions: 1000,
        totalLifetimeViews: 200,
        totalLifetimeFavorites: 20,
        averageConversionRatio: 5,
        topListings: [],
        dailyTrends: [],
      });

      const res = await controller.getGlobalEngagementAnalytics({ days: 30 });

      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.data.totalActiveListings).toBe(10);
    });
  });
});
