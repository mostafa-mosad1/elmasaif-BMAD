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
      count: jest.fn(),
    },
    deal: {
      count: jest.fn(),
    },
    listing: {
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    adminUser: {
      findMany: jest.fn(),
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

  describe('Story 8.4: Review Moderation Queue, Detail & Hide/Restore Actions (AC: #2, #3, #5)', () => {
    const mockAdminQueueRow1 = {
      id: 'rating-1',
      dealId: 'deal-1',
      raterUserId: 'user-buyer-1',
      targetUserId: 'user-marketer-1',
      score: 5,
      comment: 'وسيط ممتاز وسريع في الإفراغ',
      isHidden: false,
      hiddenByAdminId: null,
      hiddenAt: null,
      hiddenReason: null,
      createdAt: new Date('2026-10-10T12:00:00.000Z'),
      deal: {
        id: 'deal-1',
        dealNumber: 'ELM-2026-00010',
        dealReferenceCode: 'REF-00010',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          title: 'فيلا فاخرة للبيع في حي النرجس',
        },
      },
      raterUser: {
        id: 'user-buyer-1',
        fullName: 'طارق الشمري',
      },
      targetUser: {
        id: 'user-marketer-1',
        fullName: 'محمد بن سالم الشمري',
        profiles: [
          {
            id: 'profile-marketer-1',
            role: UserRole.MARKETER,
            falLicense: {
              licenseNumber: '1200012345',
              commercialName: 'مؤسسة الأفق العقارية',
              status: ProfileStatus.ACTIVE,
            },
          },
        ],
      },
    };

    const mockAdminQueueRowHidden = {
      id: 'rating-3',
      dealId: 'deal-3',
      raterUserId: 'user-buyer-3',
      targetUserId: 'user-marketer-1',
      score: 1,
      comment: 'ملاحظات مسيئة تم حجبها',
      isHidden: true,
      hiddenByAdminId: 'admin-1',
      hiddenAt: new Date('2026-10-16T09:00:00.000Z'),
      hiddenReason: 'ألفاظ مسيئة أو تشهير غير نظامي',
      createdAt: new Date('2026-10-15T15:00:00.000Z'),
      deal: {
        id: 'deal-3',
        dealNumber: 'ELM-2026-00019',
        dealReferenceCode: 'REF-00019',
        listingId: 'listing-1',
        listing: {
          id: 'listing-1',
          title: 'فيلا فاخرة للبيع في حي النرجس',
        },
      },
      raterUser: {
        id: 'user-buyer-3',
        fullName: 'سالم الدوسري',
      },
      targetUser: {
        id: 'user-marketer-1',
        fullName: 'محمد بن سالم الشمري',
        profiles: [
          {
            id: 'profile-marketer-1',
            role: UserRole.MARKETER,
            falLicense: {
              licenseNumber: '1200012345',
              commercialName: 'مؤسسة الأفق العقارية',
              status: ProfileStatus.ACTIVE,
            },
          },
        ],
      },
    };

    it('lists admin reviews with KPI counts, resolved admin names, masked + full rater names, and live broker public stats (AC-2)', async () => {
      mockPrismaService.rating.findMany
        .mockResolvedValueOnce([mockAdminQueueRow1, mockAdminQueueRowHidden]) // paginated items
        .mockResolvedValueOnce([
          { id: 'rating-1', targetUserId: 'user-marketer-1', score: 5, isHidden: false },
          { id: 'rating-2', targetUserId: 'user-marketer-1', score: 4, isHidden: false },
          { id: 'rating-3', targetUserId: 'user-marketer-1', score: 1, isHidden: true },
        ]); // global stats & broker public ratings
      mockPrismaService.rating.count.mockResolvedValue(2);
      mockPrismaService.adminUser.findMany.mockResolvedValue([
        { id: 'admin-1', fullName: 'سعد القحطاني' },
      ]);

      const response = await adminReviewsController.listReviews({
        visibility: 'ALL',
        page: 1,
        limit: 20,
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.counts).toEqual({
        totalReviews: 3,
        visibleReviews: 2,
        hiddenReviews: 1,
        lowScoreVisibleReviews: 0,
      });
      expect(response.data.items).toHaveLength(2);

      // Visible review item
      const item1 = response.data.items[0];
      expect(item1.id).toBe('rating-1');
      expect(item1.dealNumber).toBe('ELM-2026-00010');
      expect(item1.rater.fullName).toBe('طارق الشمري');
      expect(item1.rater.maskedName).toBe('ط*** ش***');
      expect(item1.targetBroker.commercialName).toBe('مؤسسة الأفق العقارية');
      expect(item1.targetBroker.publicAverageRating).toBe(4.5);
      expect(item1.targetBroker.publicVisibleReviewsCount).toBe(2);

      // Hidden review item with resolved admin name
      const itemHidden = response.data.items[1];
      expect(itemHidden.id).toBe('rating-3');
      expect(itemHidden.isHidden).toBe(true);
      expect(itemHidden.hiddenByAdminName).toBe('سعد القحطاني');
      expect(itemHidden.hiddenReason).toBe('ألفاظ مسيئة أو تشهير غير نظامي');
    });

    it('retrieves single review detail with immutable AuditLog trail (AC-2)', async () => {
      mockPrismaService.rating.findUnique.mockResolvedValue(mockAdminQueueRowHidden);
      mockPrismaService.rating.findMany.mockResolvedValue([
        { id: 'rating-1', targetUserId: 'user-marketer-1', score: 5, isHidden: false },
        { id: 'rating-2', targetUserId: 'user-marketer-1', score: 4, isHidden: false },
      ]);
      mockPrismaService.auditLog.findMany.mockResolvedValue([
        {
          id: 'audit-entry-1',
          action: 'REVIEW_HIDDEN',
          actorId: 'admin-1',
          entityType: 'Rating',
          entityId: 'rating-3',
          ipAddress: '10.0.0.15',
          createdAt: new Date('2026-10-16T09:00:00.000Z'),
          payload: {
            reason: 'ألفاظ مسيئة أو تشهير غير نظامي',
            previousIsHidden: false,
            isHidden: true,
          },
        },
      ]);
      mockPrismaService.adminUser.findMany.mockResolvedValue([
        { id: 'admin-1', fullName: 'سعد القحطاني' },
      ]);

      const response = await adminReviewsController.getReviewDetail('rating-3');

      expect(response.statusCode).toBe(200);
      expect(response.data.id).toBe('rating-3');
      expect(response.data.auditTrail).toHaveLength(1);
      expect(response.data.auditTrail[0]).toEqual(
        expect.objectContaining({
          id: 'audit-entry-1',
          action: 'REVIEW_HIDDEN',
          actorId: 'admin-1',
          actorName: 'سعد القحطاني',
          reason: 'ألفاظ مسيئة أو تشهير غير نظامي',
          previousIsHidden: false,
          isHidden: true,
        }),
      );
    });

    it('executes explicit hideReview and restoreReview semantic endpoints, preserves physical rows, emits AuditLog, and recalculates updatedBrokerStats (AC-3)', async () => {
      const existingVisible = {
        id: 'rating-2',
        dealId: 'deal-2',
        targetUserId: 'user-marketer-1',
        raterUserId: 'user-buyer-2',
        score: 2,
        comment: 'تأخر في الرد مع ألفاظ غير مناسبة',
        isHidden: false,
      };

      mockPrismaService.rating.findUnique.mockResolvedValueOnce(existingVisible);
      mockPrismaService.rating.update.mockResolvedValueOnce({
        ...existingVisible,
        isHidden: true,
        hiddenByAdminId: 'admin-1',
        hiddenAt: mockNow,
        hiddenReason: 'ألفاظ مسيئة أو تشهير غير نظامي',
      });
      // Remaining visible rating is only rating-1 (score 5)
      mockPrismaService.rating.findMany.mockResolvedValueOnce([
        { id: 'rating-1', score: 5, isHidden: false },
      ]);
      mockPrismaService.auditLog.create.mockResolvedValueOnce({ id: 'audit-hide-2' });

      const hideRes = await adminReviewsController.hideReview(
        'rating-2',
        { reason: 'ألفاظ مسيئة أو تشهير غير نظامي' },
        { admin: { id: 'admin-1', username: 'mod_saad' }, ip: '127.0.0.1' } as any,
      );

      expect(hideRes.statusCode).toBe(200);
      expect(hideRes.data.isHidden).toBe(true);
      expect(hideRes.data.updatedBrokerStats.averageRating).toBe(5);
      expect(hideRes.data.updatedBrokerStats.totalReviews).toBe(1);

      // Now restore rating-2
      mockPrismaService.rating.findUnique.mockResolvedValueOnce({
        ...existingVisible,
        isHidden: true,
      });
      mockPrismaService.rating.update.mockResolvedValueOnce({
        ...existingVisible,
        isHidden: false,
        hiddenByAdminId: 'admin-1',
        hiddenAt: mockNow,
        hiddenReason: 'تم التحقق من سلامة التقييم ومطابقته للضوابط',
      });
      // Now both rating-1 (5) and rating-2 (2) are visible -> average (5+2)/2 = 3.5
      mockPrismaService.rating.findMany.mockResolvedValueOnce([
        { id: 'rating-1', score: 5, isHidden: false },
        { id: 'rating-2', score: 2, isHidden: false },
      ]);
      mockPrismaService.auditLog.create.mockResolvedValueOnce({ id: 'audit-restore-2' });

      const restoreRes = await adminReviewsController.restoreReview(
        'rating-2',
        { reason: 'تم التحقق من سلامة التقييم ومطابقته للضوابط' },
        { admin: { id: 'admin-1', username: 'mod_saad' }, ip: '127.0.0.1' } as any,
      );

      expect(restoreRes.statusCode).toBe(200);
      expect(restoreRes.data.isHidden).toBe(false);
      expect(restoreRes.data.updatedBrokerStats.averageRating).toBe(3.5);
      expect(restoreRes.data.updatedBrokerStats.totalReviews).toBe(2);
      expect(mockPrismaService.auditLog.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          action: 'REVIEW_UNHIDDEN',
          entityType: 'Rating',
          entityId: 'rating-2',
          payload: expect.objectContaining({
            previousIsHidden: true,
            isHidden: false,
            reason: 'تم التحقق من سلامة التقييم ومطابقته للضوابط',
          }),
        }),
      });
    });
  });
});

