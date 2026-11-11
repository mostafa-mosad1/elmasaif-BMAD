import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserRole, ProfileStatus, DealStatus, ListingStatus } from '@elmasaif/shared';
import { BrokersService } from '../brokers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { BrokersController } from '../brokers.controller';
import { AdminReviewsController } from '../admin-reviews.controller';

describe('BrokersService & AdminReviewsController (Story 6.5 / AC: #1, #2, #5, #6, #8)', () => {
  let brokersService: BrokersService;
  let brokersController: BrokersController;
  let adminReviewsController: AdminReviewsController;

  const mockNow = new Date('2026-11-11T10:00:00.000Z');

  const mockClockService = {
    now: jest.fn().mockReturnValue(mockNow),
    nowIso: jest.fn().mockReturnValue(mockNow.toISOString()),
  };

  const mockStorageService = {
    getPresignedDownloadUrl: jest.fn().mockImplementation(async (key: string) => `https://signed.example.com/${key}`),
  };

  const mockMarketerUser = {
    id: 'user-marketer-1',
    fullName: 'محمد بن سالم الشمري',
    mobileNumber: '0551234567',
    nationalId: '1098765432',
    email: 'marketer@example.com',
    status: ProfileStatus.ACTIVE,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
  };

  const mockMarketerProfile = {
    id: 'profile-marketer-1',
    userId: 'user-marketer-1',
    role: UserRole.MARKETER,
    status: ProfileStatus.ACTIVE,
    payoutIban: 'SA0380000000608010167519',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    user: mockMarketerUser,
    falLicense: {
      id: 'fal-1',
      licenseNumber: '1200012345',
      commercialName: 'مؤسسة الأفق العقارية',
      status: ProfileStatus.ACTIVE,
      expiryDate: new Date('2027-05-20T00:00:00.000Z'),
    },
    listings: [
      {
        id: 'listing-1',
        title: 'فيلا فاخرة للبيع في حي النرجس',
        description: 'فيلا بتشطيبات سوبر ديلوكس',
        propertyType: 'VILLA',
        cityId: 'city-1',
        districtId: 'dist-1',
        city: { nameAr: 'الرياض' },
        district: { nameAr: 'النرجس' },
        askPrice: 2500000,
        areaSquareMeters: 375,
        bedrooms: 5,
        yearBuilt: 2024,
        status: ListingStatus.ACTIVE,
        totalViews: 120,
        totalImpressions: 1500,
        totalFavorites: 14,
        createdAt: new Date('2026-10-01T08:00:00.000Z'),
        documents: [{ fileUrl: 'listings/photo-1.jpg' }],
      },
    ],
  };

  const mockRatings = [
    {
      id: 'rating-1',
      dealId: 'deal-1',
      raterUserId: 'user-buyer-1',
      targetUserId: 'user-marketer-1',
      score: 5,
      comment: 'وسيط ممتاز وسريع في الإفراغ',
      isHidden: false,
      createdAt: new Date('2026-10-10T12:00:00.000Z'),
      raterUser: { fullName: 'طارق الشمري' },
    },
    {
      id: 'rating-2',
      dealId: 'deal-2',
      raterUserId: 'user-buyer-2',
      targetUserId: 'user-marketer-1',
      score: 4,
      comment: 'تجربة جيدة جداً',
      isHidden: false,
      createdAt: new Date('2026-10-12T14:00:00.000Z'),
      raterUser: { fullName: 'فهد المطيري' },
    },
    {
      id: 'rating-3',
      dealId: 'deal-3',
      raterUserId: 'user-buyer-3',
      targetUserId: 'user-marketer-1',
      score: 1,
      comment: 'ملاحظات مسيئة تم حجبها',
      isHidden: true,
      createdAt: new Date('2026-10-15T15:00:00.000Z'),
      raterUser: { fullName: 'سالم الدوسري' },
    },
  ];

  const mockPrismaService = {
    userProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    rating: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deal: {
      count: jest.fn(),
    },
    listing: {
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrokersController, AdminReviewsController],
      providers: [
        BrokersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ClockService, useValue: mockClockService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    brokersService = module.get<BrokersService>(BrokersService);
    brokersController = module.get<BrokersController>(BrokersController);
    adminReviewsController = module.get<AdminReviewsController>(AdminReviewsController);
  });

  describe('BrokersService.getBrokerPublicProfile (AC: #1, #2, #5, #6)', () => {
    it('returns complete public broker profile and strictly conceals private contact data (AC-1, AC-6, BR-06)', async () => {
      mockPrismaService.userProfile.findFirst.mockResolvedValue(mockMarketerProfile);
      // Prisma query for ratings filters isHidden: false
      mockPrismaService.rating.findMany.mockResolvedValue([mockRatings[0], mockRatings[1]]);
      mockPrismaService.deal.count.mockResolvedValue(12);

      const profile = await brokersService.getBrokerPublicProfile('profile-marketer-1');

      expect(profile).toBeDefined();
      expect(profile.id).toBe('profile-marketer-1');
      expect(profile.userId).toBe('user-marketer-1');
      expect(profile.commercialName).toBe('مؤسسة الأفق العقارية');
      expect(profile.fullName).toBe('محمد بن سالم الشمري');
      expect(profile.isFalVerified).toBe(true);
      expect(profile.falLicense?.licenseNumber).toBe('1200012345');
      expect(profile.falLicense?.status).toBe('ACTIVE');

      // Check stats: 5 and 4 stars -> average 4.5
      expect(profile.stats.totalReviews).toBe(2);
      expect(profile.stats.averageRating).toBe(4.5);
      expect(profile.stats.completedDealsCount).toBe(12);
      expect(profile.stats.activeListingsCount).toBe(1);
      expect(profile.stats.ratingDistribution).toEqual({
        '5': 1,
        '4': 1,
        '3': 0,
        '2': 0,
        '1': 0,
      });

      // Reviews check and masking
      expect(profile.reviews).toHaveLength(2);
      expect(profile.reviews[0].rater.maskedName).toBe('ط*** ش***');
      expect(profile.reviews[1].rater.maskedName).toBe('ف*** م***');

      // Active listings check
      expect(profile.activeListings).toHaveLength(1);
      expect(profile.activeListings[0].title).toBe('فيلا فاخرة للبيع في حي النرجس');

      // BR-06 Guardrail: Sensitive fields MUST NOT exist in payload
      const serialized = JSON.stringify(profile);
      expect(serialized).not.toContain('0551234567');
      expect(serialized).not.toContain('1098765432');
      expect(serialized).not.toContain('marketer@example.com');
      expect(serialized).not.toContain('SA0380000000608010167519');
      expect((profile as any).mobileNumber).toBeUndefined();
      expect((profile as any).email).toBeUndefined();
      expect((profile as any).nationalId).toBeUndefined();
      expect((profile as any).payoutIban).toBeUndefined();
    });

    it('resolves broker profile when query parameter is user ID instead of profile ID', async () => {
      // First try by profileId returns null, second by userId returns mockMarketerProfile
      mockPrismaService.userProfile.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockMarketerProfile);
      mockPrismaService.rating.findMany.mockResolvedValue([mockRatings[0]]);
      mockPrismaService.deal.count.mockResolvedValue(5);

      const profile = await brokersService.getBrokerPublicProfile('user-marketer-1');
      expect(profile.id).toBe('profile-marketer-1');
      expect(mockPrismaService.userProfile.findFirst).toHaveBeenCalledTimes(2);
    });

    it('throws 404 BROKER_NOT_FOUND when profile does not exist', async () => {
      mockPrismaService.userProfile.findFirst.mockResolvedValue(null);

      await expect(brokersService.getBrokerPublicProfile('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('excludes hidden reviews from average score and distribution breakdown (AC-2, AC-5)', async () => {
      mockPrismaService.userProfile.findFirst.mockResolvedValue(mockMarketerProfile);
      // Simulate database returning only non-hidden reviews as required by query
      mockPrismaService.rating.findMany.mockResolvedValue([mockRatings[0]]); // only 5-star
      mockPrismaService.deal.count.mockResolvedValue(3);

      const profile = await brokersService.getBrokerPublicProfile('profile-marketer-1');
      expect(profile.stats.totalReviews).toBe(1);
      expect(profile.stats.averageRating).toBe(5);
      expect(profile.stats.ratingDistribution).toEqual({
        '5': 1,
        '4': 0,
        '3': 0,
        '2': 0,
        '1': 0,
      });
      expect(profile.reviews.some((r) => r.id === 'rating-3')).toBe(false);
    });

    it('returns averageRating null when broker has 0 reviews', async () => {
      mockPrismaService.userProfile.findFirst.mockResolvedValue(mockMarketerProfile);
      mockPrismaService.rating.findMany.mockResolvedValue([]);
      mockPrismaService.deal.count.mockResolvedValue(0);

      const profile = await brokersService.getBrokerPublicProfile('profile-marketer-1');
      expect(profile.stats.totalReviews).toBe(0);
      expect(profile.stats.averageRating).toBeNull();
      expect(profile.reviews).toEqual([]);
    });
  });

  describe('AdminReviewsController.moderateReview (AC: #5, #8)', () => {
    it('updates rating isHidden status, records admin metadata, and emits AuditLog (AC-8)', async () => {
      const existingRating = {
        id: 'rating-1',
        dealId: 'deal-1',
        targetUserId: 'user-marketer-1',
        raterUserId: 'user-buyer-1',
        score: 1,
        comment: 'تعليق غير لائق',
        isHidden: false,
      };

      mockPrismaService.rating.findUnique.mockResolvedValue(existingRating);
      mockPrismaService.rating.update.mockResolvedValue({
        ...existingRating,
        isHidden: true,
        hiddenByAdminId: 'admin-1',
        hiddenAt: mockNow,
        hiddenReason: 'محتوى مخالف لشروط الاستخدام',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await adminReviewsController.moderateReview(
        'rating-1',
        {
          isHidden: true,
          reason: 'محتوى مخالف لشروط الاستخدام',
        },
        { admin: { id: 'admin-1', username: 'admin_audit' } as any },
      );

      expect(mockPrismaService.rating.update).toHaveBeenCalledWith({
        where: { id: 'rating-1' },
        data: {
          isHidden: true,
          hiddenByAdminId: 'admin-1',
          hiddenAt: mockNow,
          hiddenReason: 'محتوى مخالف لشروط الاستخدام',
        },
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-1',
          actorType: 'ADMIN',
          action: 'REVIEW_HIDDEN',
          entityType: 'Rating',
          entityId: 'rating-1',
          payload: expect.objectContaining({
            dealId: 'deal-1',
            previousIsHidden: false,
            isHidden: true,
            reason: 'محتوى مخالف لشروط الاستخدام',
          }),
        }),
      });

      expect(result.data.isHidden).toBe(true);
    });

    it('throws 404 when review is not found for moderation', async () => {
      mockPrismaService.rating.findUnique.mockResolvedValue(null);

      await expect(
        adminReviewsController.moderateReview(
          'non-existent',
          { isHidden: true, reason: 'مخالف' },
          { admin: { id: 'admin-1' } as any },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

