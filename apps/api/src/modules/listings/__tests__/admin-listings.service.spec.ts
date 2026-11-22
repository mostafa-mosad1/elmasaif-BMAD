import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminListingsService } from '../admin-listings.service';
import { ListingsService } from '../listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { EmailTransportService } from '../../auth/email/email-transport.service';
import {
  AdminRole,
  ListingStatus,
  OwnerContractStatus,
  PriceSuggestionStatus,
  PropertyType,
  UserRole,
  LISTING_LOCK_CONFLICT,
  LISTING_LOCK_EXPIRED,
  LISTING_LOCK_REQUIRED,
  LISTING_VERSION_CONFLICT,
  LISTING_INVALID_STATE_TRANSITION,
  LISTING_NOT_FOUND,
  LISTING_LOCK_DURATION_MS,
  PRICE_SUGGESTION_SAME_AS_CURRENT,
} from '@elmasaif/shared';

describe('AdminListingsService (Story 2.4)', () => {
  let service: AdminListingsService;
  let prisma: any;
  let clockService: any;
  let listingsService: any;
  let emailTransportService: any;

  const baseNow = new Date('2026-11-03T10:00:00.000Z');

  const adminA = {
    id: 'admin-a-uuid',
    username: 'moderator.ahmed',
    email: 'ahmed@elmasaif.sa',
    fullName: 'أحمد المراجع',
    role: AdminRole.MODERATOR,
    isActive: true,
    permissions: ['Listings.Review'],
  };

  const adminB = {
    id: 'admin-b-uuid',
    username: 'moderator.khalid',
    email: 'khalid@elmasaif.sa',
    fullName: 'خالد المشرف',
    role: AdminRole.MODERATOR,
    isActive: true,
    permissions: ['Listings.Review'],
  };

  const superAdmin = {
    id: 'super-admin-uuid',
    username: 'super.admin',
    email: 'super@elmasaif.sa',
    fullName: 'المشرف العام',
    role: AdminRole.SUPER_ADMIN,
    isActive: true,
    permissions: ['Listings.Review', 'Tasks.ForceUnlock'],
  };

  const mockListingId = 'listing-uuid-100';

  const makeMockListing = (overrides: Record<string, any> = {}) => ({
    id: mockListingId,
    title: 'فيلا مودرن في حي الملقا',
    description: 'فيلا فاخرة مطابقة للكود السعودي',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'district-1',
    askPrice: 4200000,
    areaSquareMeters: 420,
    status: ListingStatus.PENDING_REVIEW,
    sellerProfileId: 'profile-1',
    payoutIban: 'SA0380000000608010167519',
    version: 1,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    rejectionReason: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    createdAt: new Date('2026-11-03T08:00:00.000Z'),
    updatedAt: new Date('2026-11-03T08:00:00.000Z'),
    city: { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh' },
    district: { id: 'district-1', nameAr: 'الملقا', nameEn: 'Al Malqa' },
    sellerProfile: {
      id: 'profile-1',
      role: UserRole.MARKETER,
      user: {
        id: 'user-1',
        fullName: 'عبدالله العقاري',
        username: 'abdullah_broker',
      },
    },
    documents: [
      { id: 'doc-1', documentType: 'PHOTO', visibility: 'PUBLIC' },
      { id: 'doc-2', documentType: 'PHOTO', visibility: 'PUBLIC' },
      { id: 'doc-3', documentType: 'PHOTO', visibility: 'PUBLIC' },
      { id: 'doc-4', documentType: 'OWNER_AUTHORIZATION', visibility: 'ADMIN_ONLY' },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      adminUser: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      priceSuggestion: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    clockService = {
      now: jest.fn(() => new Date(baseNow.getTime())),
      nowIso: jest.fn(() => baseNow.toISOString()),
    };

    listingsService = {
      getListingById: jest.fn(),
    };

    emailTransportService = {
      sendEmail: jest.fn().mockResolvedValue({ delivered: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: ListingsService, useValue: listingsService },
        { provide: EmailTransportService, useValue: emailTransportService },
      ],
    }).compile();

    service = module.get<AdminListingsService>(AdminListingsService);
  });

  describe('getModerationQueue (AC #1)', () => {
    it('returns paginated PENDING_REVIEW listings ordered by oldest first with resolved lock states', async () => {
      const activeExpiry = new Date(baseNow.getTime() + 10 * 60 * 1000); // +10m
      const expiredTime = new Date(baseNow.getTime() - 60 * 1000); // -1m

      const listingUnlocked = makeMockListing({ id: 'l-1' });
      const listingLockedByA = makeMockListing({
        id: 'l-2',
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: activeExpiry,
      });
      const listingExpiredLock = makeMockListing({
        id: 'l-3',
        lockedByAdminId: adminB.id,
        lockedAt: new Date(baseNow.getTime() - 16 * 60 * 1000),
        lockExpiresAt: expiredTime,
      });

      prisma.listing.findMany.mockResolvedValue([
        listingUnlocked,
        listingLockedByA,
        listingExpiredLock,
      ]);
      prisma.listing.count.mockResolvedValue(3);
      prisma.adminUser.findMany.mockResolvedValue([
        { id: adminA.id, fullName: adminA.fullName, username: adminA.username },
      ]);

      const result = await service.getModerationQueue(
        { status: ListingStatus.PENDING_REVIEW, page: 1, limit: 20 },
        adminA.id,
      );

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ListingStatus.PENDING_REVIEW },
          orderBy: { createdAt: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.total).toBe(3);
      expect(result.items).toHaveLength(3);

      // Item 1: unlocked
      expect(result.items[0].lockInfo.isLocked).toBe(false);
      expect(result.items[0].photoCount).toBe(3);
      expect(result.items[0].documentCount).toBe(1);

      // Item 2: actively locked by Admin A
      expect(result.items[1].lockInfo.isLocked).toBe(true);
      expect(result.items[1].lockInfo.isLockedByCurrentAdmin).toBe(true);
      expect(result.items[1].lockInfo.lockedByAdminName).toBe(adminA.fullName);
      expect(result.items[1].lockInfo.remainingSeconds).toBe(600);

      // Item 3: expired lock treated as unlocked (lazy expiry AD-10)
      expect(result.items[2].lockInfo.isLocked).toBe(false);
      expect(result.items[2].lockInfo.lockedByAdminId).toBeNull();
      expect(result.items[2].lockInfo.remainingSeconds).toBe(0);
    });
  });

  describe('getAdminListingDetail (AC #4)', () => {
    it('returns full listing details with ADMIN_ONLY signed URLs and lockInfo', async () => {
      const activeExpiry = new Date(baseNow.getTime() + 12 * 60 * 1000);
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: activeExpiry,
        }),
      );
      prisma.adminUser.findUnique.mockResolvedValue({
        id: adminA.id,
        fullName: adminA.fullName,
        username: adminA.username,
      });
      listingsService.getListingById.mockResolvedValue({
        id: mockListingId,
        title: 'فيلا مودرن في حي الملقا',
        status: ListingStatus.PENDING_REVIEW,
        version: 1,
        photos: [{ id: 'doc-1', fileUrl: 'https://signed/p1' }],
        documents: [{ id: 'doc-4', documentType: 'OWNER_AUTHORIZATION', fileUrl: 'https://signed/auth.pdf', visibility: 'ADMIN_ONLY' }],
      });

      const detailForB = await service.getAdminListingDetail(mockListingId, adminB.id);

      expect(listingsService.getListingById).toHaveBeenCalledWith(mockListingId, undefined, true);
      expect(detailForB.lockInfo.isLocked).toBe(true);
      expect(detailForB.lockInfo.isLockedByCurrentAdmin).toBe(false);
      expect(detailForB.lockInfo.lockedByAdminName).toBe(adminA.fullName);
      expect(detailForB.lockInfo.remainingSeconds).toBe(720);
    });
  });

  describe('claimListing (AC #2)', () => {
    it('acquires a 15-minute lock on an unlocked PENDING_REVIEW listing and logs LISTING_MODERATION_CLAIMED', async () => {
      const unlocked = makeMockListing();
      const expectedExpiry = new Date(baseNow.getTime() + LISTING_LOCK_DURATION_MS);

      prisma.listing.findUnique.mockResolvedValue(unlocked);
      prisma.listing.update.mockResolvedValue({
        ...unlocked,
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: expectedExpiry,
      });

      const res = await service.claimListing(mockListingId, adminA);

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: mockListingId },
        data: {
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: expectedExpiry,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminA.id,
          actorType: 'ADMIN',
          action: 'LISTING_MODERATION_CLAIMED',
          entityType: 'Listing',
          entityId: mockListingId,
        }),
      });
      expect(res.lockInfo.isLocked).toBe(true);
      expect(res.lockInfo.isLockedByCurrentAdmin).toBe(true);
      expect(res.lockInfo.remainingSeconds).toBe(900);
    });

    it('allows claiming when previous lock by another admin has expired (lazy expiry)', async () => {
      const expiredListing = makeMockListing({
        lockedByAdminId: adminB.id,
        lockedAt: new Date(baseNow.getTime() - 20 * 60 * 1000),
        lockExpiresAt: new Date(baseNow.getTime() - 5 * 60 * 1000),
      });
      const expectedExpiry = new Date(baseNow.getTime() + LISTING_LOCK_DURATION_MS);

      prisma.listing.findUnique.mockResolvedValue(expiredListing);
      prisma.listing.update.mockResolvedValue({
        ...expiredListing,
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: expectedExpiry,
      });

      const res = await service.claimListing(mockListingId, adminA);
      expect(res.lockInfo.lockedByAdminId).toBe(adminA.id);
      expect(res.lockInfo.isLockedByCurrentAdmin).toBe(true);
    });

    it('rejects with 409 LISTING_LOCK_CONFLICT when actively locked by another admin', async () => {
      const activeExpiry = new Date(baseNow.getTime() + 10 * 60 * 1000);
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: activeExpiry,
        }),
      );
      prisma.adminUser.findUnique.mockResolvedValue({
        id: adminA.id,
        fullName: adminA.fullName,
        username: adminA.username,
      });

      await expect(service.claimListing(mockListingId, adminB)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.claimListing(mockListingId, adminB);
      } catch (err: any) {
        const response = err.getResponse();
        expect(response.code).toBe(LISTING_LOCK_CONFLICT);
        expect(response.lockInfo.lockedByAdminId).toBe(adminA.id);
        expect(response.lockInfo.lockedByAdminName).toBe(adminA.fullName);
      }
    });
  });

  describe('heartbeatListingLock (AC #3)', () => {
    it('extends lockExpiresAt by 15 minutes from ClockService.now() when held by caller', async () => {
      const currentExpiry = new Date(baseNow.getTime() + 10 * 60 * 1000);
      const newNow = new Date(baseNow.getTime() + 5 * 60 * 1000);
      clockService.now.mockReturnValue(newNow);

      const expectedNewExpiry = new Date(newNow.getTime() + LISTING_LOCK_DURATION_MS);

      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: currentExpiry,
        }),
      );
      prisma.listing.update.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: expectedNewExpiry,
        }),
      );

      const res = await service.heartbeatListingLock(mockListingId, adminA);
      expect(res.lockInfo.lockExpiresAt).toBe(expectedNewExpiry.toISOString());
      expect(res.lockInfo.remainingSeconds).toBe(900);
    });

    it('throws 409 LISTING_LOCK_EXPIRED if lock has already expired', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: new Date(baseNow.getTime() - 20 * 60 * 1000),
          lockExpiresAt: new Date(baseNow.getTime() - 1000),
        }),
      );

      await expect(
        service.heartbeatListingLock(mockListingId, adminA),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_LOCK_EXPIRED }),
      });
    });
  });

  describe('releaseListingLock (AC #3)', () => {
    it('clears lock fields and records LISTING_MODERATION_RELEASED audit log', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: new Date(baseNow.getTime() + 600_000),
        }),
      );
      prisma.listing.update.mockResolvedValue(makeMockListing());

      const res = await service.releaseListingLock(mockListingId, adminA);

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: mockListingId },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminA.id,
          action: 'LISTING_MODERATION_RELEASED',
        }),
      });
      expect(res.lockInfo.isLocked).toBe(false);
    });
  });

  describe('forceUnlockListing (AC #5)', () => {
    it('allows Super Admin to force unlock a listing locked by another admin and logs AuditLog', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: new Date(baseNow.getTime() + 600_000),
        }),
      );
      prisma.listing.update.mockResolvedValue(makeMockListing());

      const res = await service.forceUnlockListing(mockListingId, superAdmin, {
        reason: 'انتهاء مناوبة المشرف دون تحرير المهمة',
      });

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: mockListingId },
        data: {
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: superAdmin.id,
          actorType: 'ADMIN',
          action: 'LISTING_MODERATION_FORCE_UNLOCKED',
          entityId: mockListingId,
          payload: expect.objectContaining({
            previousLockHolderId: adminA.id,
            superAdminId: superAdmin.id,
            reason: 'انتهاء مناوبة المشرف دون تحرير المهمة',
          }),
        }),
      });
      expect(res.lockInfo.isLocked).toBe(false);
    });
  });

  describe('approveListing (AC #6)', () => {
    it('transitions listing to ACTIVE, increments version, clears lock, and writes LISTING_APPROVED audit log', async () => {
      const lockedListing = makeMockListing({
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: new Date(baseNow.getTime() + 600_000),
        version: 1,
      });

      prisma.listing.findUnique.mockResolvedValue(lockedListing);
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });
      prisma.listing.findUnique
        .mockResolvedValueOnce(lockedListing)
        .mockResolvedValueOnce({
          ...lockedListing,
          status: ListingStatus.ACTIVE,
          version: 2,
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          reviewedByAdminId: adminA.id,
          reviewedAt: baseNow,
        });

      const res = await service.approveListing(mockListingId, adminA, {
        version: 1,
        notes: 'المستندات مكتملة ومطابقة',
      });

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockListingId,
          version: 1,
          status: ListingStatus.PENDING_REVIEW,
        },
        data: {
          status: ListingStatus.ACTIVE,
          version: { increment: 1 },
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          rejectionReason: null,
          reviewedByAdminId: adminA.id,
          reviewedAt: baseNow,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminA.id,
          actorType: 'ADMIN',
          action: 'LISTING_APPROVED',
          entityId: mockListingId,
        }),
      });
      expect(res.status).toBe(ListingStatus.ACTIVE);
      expect(res.version).toBe(2);
    });

    it('transitions owner listing with pending contract/request to PENDING_FEE rather than ACTIVE', async () => {
      const lockedOwnerListing = makeMockListing({
        version: 1,
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: new Date(baseNow.getTime() + 15 * 60 * 1000),
        ownerListingRequest: { id: 'req-1', status: 'PENDING' },
        ownerContract: { id: 'contract-1', status: OwnerContractStatus.PENDING_SIGNATURE },
      });
      prisma.listing.findUnique
        .mockResolvedValueOnce(lockedOwnerListing)
        .mockResolvedValueOnce({
          ...lockedOwnerListing,
          status: ListingStatus.PENDING_FEE,
          version: 2,
        });
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.approveListing(mockListingId, adminA, {
        version: 1,
        notes: 'موافقة أولية وبانتظار سداد رسوم العقد',
      });

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockListingId,
          version: 1,
          status: ListingStatus.PENDING_REVIEW,
        },
        data: expect.objectContaining({
          status: ListingStatus.PENDING_FEE,
        }),
      });
      expect(res.status).toBe(ListingStatus.PENDING_FEE);
    });

    it('rejects approval with 409 LISTING_LOCK_REQUIRED when caller does not hold active lock', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());

      await expect(
        service.approveListing(mockListingId, adminA, { version: 1 }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_LOCK_REQUIRED }),
      });
    });

    it('rejects approval with 409 LISTING_VERSION_CONFLICT when version does not match', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminA.id,
          lockedAt: baseNow,
          lockExpiresAt: new Date(baseNow.getTime() + 600_000),
          version: 3,
        }),
      );

      await expect(
        service.approveListing(mockListingId, adminA, { version: 1 }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_VERSION_CONFLICT }),
      });
    });
  });

  describe('rejectListing (AC #6)', () => {
    it('transitions listing to REJECTED, stores rejectionReason, increments version, clears lock, and writes LISTING_REJECTED audit log', async () => {
      const lockedListing = makeMockListing({
        lockedByAdminId: adminA.id,
        lockedAt: baseNow,
        lockExpiresAt: new Date(baseNow.getTime() + 600_000),
        version: 1,
      });

      prisma.listing.findUnique
        .mockResolvedValueOnce(lockedListing)
        .mockResolvedValueOnce({
          ...lockedListing,
          status: ListingStatus.REJECTED,
          version: 2,
          rejectionReason: 'صورة صك الملكية غير واضحة ولا يظهر رقم الصك بالكامل',
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          reviewedByAdminId: adminA.id,
          reviewedAt: baseNow,
        });
      prisma.listing.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.rejectListing(mockListingId, adminA, {
        version: 1,
        rejectionReason: 'صورة صك الملكية غير واضحة ولا يظهر رقم الصك بالكامل',
      });

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockListingId,
          version: 1,
          status: ListingStatus.PENDING_REVIEW,
        },
        data: {
          status: ListingStatus.REJECTED,
          version: { increment: 1 },
          rejectionReason: 'صورة صك الملكية غير واضحة ولا يظهر رقم الصك بالكامل',
          lockedByAdminId: null,
          lockedAt: null,
          lockExpiresAt: null,
          reviewedByAdminId: adminA.id,
          reviewedAt: baseNow,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminA.id,
          actorType: 'ADMIN',
          action: 'LISTING_REJECTED',
          entityId: mockListingId,
          payload: expect.objectContaining({
            rejectionReason: 'صورة صك الملكية غير واضحة ولا يظهر رقم الصك بالكامل',
          }),
        }),
      });
      expect(res.status).toBe(ListingStatus.REJECTED);
      expect(res.rejectionReason).toBe('صورة صك الملكية غير واضحة ولا يظهر رقم الصك بالكامل');
    });
  });

  describe('suggestListingPrice (Story 2.5 - AC #1, #2)', () => {
    it('creates a PENDING PriceSuggestion, supersedes prior PENDING suggestions, never modifies askPrice (BR-16), logs LISTING_PRICE_SUGGESTED, and notifies seller', async () => {
      const listingWithEmail = makeMockListing({
        askPrice: 4200000,
        status: ListingStatus.PENDING_REVIEW,
        sellerProfile: {
          id: 'profile-1',
          role: UserRole.MARKETER,
          user: {
            id: 'user-1',
            fullName: 'عبدالله العقاري',
            username: 'abdullah_broker',
            email: 'abdullah@broker.sa',
          },
        },
      });

      prisma.listing.findUnique.mockResolvedValue(listingWithEmail);
      prisma.priceSuggestion.updateMany.mockResolvedValue({ count: 1 });
      prisma.priceSuggestion.create.mockResolvedValue({
        id: 'suggestion-uuid-1',
        listingId: mockListingId,
        currentAskPrice: 4200000,
        suggestedPrice: 3850000,
        reason: 'متوسط سعر الفلل المماثلة في حي الملقا هو 3,850,000 ريال بناءً على الصفقات المعتمدة',
        status: PriceSuggestionStatus.PENDING,
        suggestedByAdminId: adminA.id,
        suggestedByAdminName: adminA.fullName,
        sellerResponseNote: null,
        respondedAt: null,
        createdAt: baseNow,
      });

      const result = await service.suggestListingPrice(mockListingId, adminA, {
        suggestedPrice: 3850000,
        reason: 'متوسط سعر الفلل المماثلة في حي الملقا هو 3,850,000 ريال بناءً على الصفقات المعتمدة',
      });

      // Verify prior PENDING suggestions are marked SUPERSEDED
      expect(prisma.priceSuggestion.updateMany).toHaveBeenCalledWith({
        where: {
          listingId: mockListingId,
          status: PriceSuggestionStatus.PENDING,
        },
        data: {
          status: PriceSuggestionStatus.SUPERSEDED,
          respondedAt: baseNow,
        },
      });

      // Verify BR-16: listing.update is NEVER called to alter askPrice
      expect(prisma.listing.update).not.toHaveBeenCalled();
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();

      // Verify PriceSuggestion creation
      expect(prisma.priceSuggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId: mockListingId,
          status: PriceSuggestionStatus.PENDING,
          suggestedByAdminId: adminA.id,
          suggestedByAdminName: adminA.fullName,
          reason: 'متوسط سعر الفلل المماثلة في حي الملقا هو 3,850,000 ريال بناءً على الصفقات المعتمدة',
          createdAt: baseNow,
        }),
      });

      // Verify AuditLog entry
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: adminA.id,
          actorType: 'ADMIN',
          action: 'LISTING_PRICE_SUGGESTED',
          entityType: 'Listing',
          entityId: mockListingId,
          payload: expect.objectContaining({
            currentAskPrice: 4200000,
            suggestedPrice: 3850000,
            suggestedByAdminId: adminA.id,
          }),
        }),
      });

      // Verify seller email notification dispatched
      expect(emailTransportService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'abdullah@broker.sa',
        }),
      );

      expect(result.id).toBe('suggestion-uuid-1');
      expect(result.suggestedPrice).toBe(3850000);
      expect(result.currentAskPrice).toBe(4200000);
      expect(result.status).toBe(PriceSuggestionStatus.PENDING);
    });

    it('rejects with 400 PRICE_SUGGESTION_SAME_AS_CURRENT when suggestedPrice equals current askPrice', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing({ askPrice: 4200000 }));

      await expect(
        service.suggestListingPrice(mockListingId, adminA, {
          suggestedPrice: 4200000,
          reason: 'اقتراح مطابق للسعر الحالي لاختبار التحقق',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: PRICE_SUGGESTION_SAME_AS_CURRENT }),
      });
    });

    it('rejects with 409 LISTING_LOCK_CONFLICT when listing is actively locked by another admin', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          lockedByAdminId: adminB.id,
          lockedAt: baseNow,
          lockExpiresAt: new Date(baseNow.getTime() + 10 * 60 * 1000),
        }),
      );
      prisma.adminUser.findUnique.mockResolvedValue({
        id: adminB.id,
        fullName: adminB.fullName,
        username: adminB.username,
      });

      await expect(
        service.suggestListingPrice(mockListingId, adminA, {
          suggestedPrice: 3900000,
          reason: 'اقتراح سعر أثناء قفل الإعلان من قبل مشرف آخر',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_LOCK_CONFLICT }),
      });
    });

    it('rejects with 409 LISTING_INVALID_STATE_TRANSITION when listing is in REJECTED or SOLD status', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.REJECTED }),
      );

      await expect(
        service.suggestListingPrice(mockListingId, adminA, {
          suggestedPrice: 3900000,
          reason: 'اقتراح سعر لإعلان مرفوض غير مسموح',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: LISTING_INVALID_STATE_TRANSITION }),
      });
    });
  });
});

