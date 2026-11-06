import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from '../listings.service';
import { AdminListingsService } from '../admin-listings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import { QuarantineService } from '../../storage/quarantine.service';
import { EmailTransportService } from '../../auth/email/email-transport.service';
import {
  DealStatus,
  ListingStatus,
  OfferStatus,
  ProfileStatus,
  PropertyType,
  SuspensionCategory,
  UserRole,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL,
  LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS,
  LISTING_ARCHIVE_BLOCKED_RESERVED,
  LISTING_ALREADY_BLOCKED,
  LISTING_NOT_ARCHIVED,
  LISTING_NOT_SUSPENDED,
  LISTING_PERMANENTLY_BLOCKED,
  LISTING_COMPLIANCE_SUSPENDED,
  LISTING_ROLE_UNAUTHORIZED,
  LISTING_NOT_FOUND,
} from '@elmasaif/shared';

describe('Story 2.6: Listing Archiving, Suspension & Compliance Blocking', () => {
  let listingsService: ListingsService;
  let adminListingsService: AdminListingsService;
  let prisma: any;
  let clockService: any;
  let storageService: any;
  let emailTransportService: any;

  const baseNow = new Date('2026-11-03T12:00:00.000Z');
  const sellerUserId = 'seller-user-1';
  const otherUserId = 'unrelated-user-2';
  const listingId = 'listing-uuid-100';

  const mockAdminComplianceOfficer = {
    id: 'admin-compliance-1',
    username: 'mona_compliance',
    email: 'mona@elmasaif.sa',
    fullName: 'منى الرقابة والامتثال',
    role: 'COMPLIANCE_OFFICER',
    isActive: true,
    permissions: ['Listings.Review', 'Listings.Compliance'],
  };

  const makeMockListing = (overrides: Record<string, any> = {}) => ({
    id: listingId,
    title: 'فيلا فاخرة بحي حطين',
    description: 'فيلا بتشطيبات عالية الجودة',
    propertyType: PropertyType.VILLA,
    cityId: 'city-1',
    districtId: 'district-1',
    askPrice: 5000000,
    areaSquareMeters: 500,
    status: ListingStatus.ACTIVE,
    sellerProfileId: 'profile-1',
    payoutIban: 'SA0380000000608010167519',
    version: 1,
    archivedAt: null,
    archiveReason: null,
    complianceReason: null,
    complianceCategory: null,
    complianceActionAt: null,
    complianceOfficerId: null,
    lockedByAdminId: null,
    lockedAt: null,
    lockExpiresAt: null,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    city: { id: 'city-1', nameAr: 'الرياض', nameEn: 'Riyadh' },
    district: { id: 'district-1', nameAr: 'حطين', nameEn: 'Hittin' },
    documents: [],
    deals: [],
    offers: [],
    sellerProfile: {
      id: 'profile-1',
      userId: sellerUserId,
      role: UserRole.MARKETER,
      status: ProfileStatus.ACTIVE,
      falLicense: {
        id: 'fal-1',
        licenseNumber: '1200001234',
      },
      user: {
        id: sellerUserId,
        fullName: 'سلطان المسوق',
        username: 'sultan_marketer',
        email: 'sultan@marketer.sa',
        mobileNumber: '+966551234567',
        nationalId: '1088776655',
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      listing: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      offer: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      adminUser: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    clockService = {
      now: jest.fn(() => new Date(baseNow)),
    };

    storageService = {
      getPresignedDownloadUrl: jest.fn(async (key: string) => `https://s3.local/${key}`),
    };

    emailTransportService = {
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        AdminListingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: StorageService, useValue: storageService },
        { provide: QuarantineService, useValue: {} },
        { provide: EmailTransportService, useValue: emailTransportService },
      ],
    }).compile();

    listingsService = module.get<ListingsService>(ListingsService);
    adminListingsService = module.get<AdminListingsService>(AdminListingsService);
  });

  describe('Seller Listing Archiving (AC #1)', () => {
    it('rejects archiving when caller is not the listing author (403 Forbidden)', async () => {
      prisma.listing.findUnique.mockResolvedValue(makeMockListing());

      await expect(
        listingsService.archiveListing(listingId, otherUserId, { reason: 'لم تعد متاحة' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects archiving when listing is in RESERVED status (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.RESERVED }),
      );

      await expect(
        listingsService.archiveListing(listingId, sellerUserId),
      ).rejects.toThrow(ConflictException);

      try {
        await listingsService.archiveListing(listingId, sellerUserId);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(LISTING_ARCHIVE_BLOCKED_RESERVED);
      }
    });

    it('rejects archiving when listing is attached to an active Deal (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          deals: [
            {
              id: 'deal-1',
              status: DealStatus.AWAITING_PAYMENT_PROOF,
            },
          ],
        }),
      );

      try {
        await listingsService.archiveListing(listingId, sellerUserId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(LISTING_ARCHIVE_BLOCKED_ACTIVE_DEAL);
      }
    });

    it('rejects archiving when listing has active unexpired approved offers (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({
          offers: [
            {
              id: 'offer-1',
              status: OfferStatus.ACCEPTED_BY_SELLER,
              expiresAt: new Date(baseNow.getTime() + 86400000), // unexpired
            },
          ],
        }),
      );

      try {
        await listingsService.archiveListing(listingId, sellerUserId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(LISTING_ARCHIVE_BLOCKED_ACTIVE_OFFERS);
      }
    });

    it('successfully archives listing, withdraws open offers, clears locks, and writes audit log', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.ACTIVE,
        offers: [
          {
            id: 'offer-open',
            status: OfferStatus.SUBMITTED,
            expiresAt: new Date(baseNow.getTime() + 86400000),
          },
        ],
      });
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ARCHIVED,
        version: 2,
        archivedAt: baseNow,
        archiveReason: 'رغبة المالك في تأجيل البيع',
      });

      const result = await listingsService.archiveListing(listingId, sellerUserId, {
        reason: 'رغبة المالك في تأجيل البيع',
      });

      expect(result.status).toBe(ListingStatus.ARCHIVED);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: expect.objectContaining({
            status: ListingStatus.ARCHIVED,
            archivedAt: baseNow,
            archiveReason: 'رغبة المالك في تأجيل البيع',
            lockedByAdminId: null,
          }),
        }),
      );

      expect(prisma.offer.updateMany).toHaveBeenCalledWith({
        where: {
          listingId,
          status: {
            in: [
              OfferStatus.PENDING_ADMIN_REVIEW,
              OfferStatus.SUBMITTED,
              OfferStatus.IN_REVIEW,
              OfferStatus.RELAYED_TO_SELLER,
              OfferStatus.COUNTER_OFFERED,
            ],
          },
        },
        data: {
          status: OfferStatus.WITHDRAWN,
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LISTING_ARCHIVED',
            actorId: sellerUserId,
            entityId: listingId,
            payload: expect.objectContaining({
              previousStatus: ListingStatus.ACTIVE,
              newStatus: ListingStatus.ARCHIVED,
            }),
          }),
        }),
      );
    });
  });

  describe('Seller Listing Unarchiving & Reactivation (AC #2)', () => {
    it('rejects unarchiving when listing is not in ARCHIVED status (400 Bad Request)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.ACTIVE }),
      );

      try {
        await listingsService.unarchiveListing(listingId, sellerUserId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe(LISTING_NOT_ARCHIVED);
      }
    });

    it('rejects unarchiving when listing is BLOCKED by compliance (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.BLOCKED }),
      );

      try {
        await listingsService.unarchiveListing(listingId, sellerUserId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(LISTING_PERMANENTLY_BLOCKED);
      }
    });

    it('rejects unarchiving when listing is SUSPENDED by compliance (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.SUSPENDED }),
      );

      try {
        await listingsService.unarchiveListing(listingId, sellerUserId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(LISTING_COMPLIANCE_SUSPENDED);
      }
    });

    it('successfully unarchives listing, transitions to ACTIVE, and logs audit', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.ARCHIVED,
        archivedAt: new Date('2026-11-02T10:00:00.000Z'),
        archiveReason: 'تأجيل مؤقت',
      });
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ACTIVE,
        version: 2,
        archivedAt: null,
        archiveReason: null,
      });

      const result = await listingsService.unarchiveListing(listingId, sellerUserId);

      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: expect.objectContaining({
            status: ListingStatus.ACTIVE,
            archivedAt: null,
            archiveReason: null,
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LISTING_UNARCHIVED',
            actorId: sellerUserId,
          }),
        }),
      );
    });
  });

  describe('Administrative Compliance Suspension (AC #3)', () => {
    it('suspends listing, withdraws pending offers, writes audit log, and emails seller', async () => {
      const mockListing = makeMockListing({ status: ListingStatus.ACTIVE });
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.SUSPENDED,
        version: 2,
        complianceReason: 'مخالفة توثيق رخصة فال',
        complianceCategory: SuspensionCategory.INVALID_FAL_LICENSE,
        complianceActionAt: baseNow,
        complianceOfficerId: mockAdminComplianceOfficer.id,
      });

      const result = await adminListingsService.suspendListing(
        listingId,
        mockAdminComplianceOfficer as any,
        {
          complianceReason: 'مخالفة توثيق رخصة فال وتجاوز الصلاحيات',
          suspensionCategory: SuspensionCategory.INVALID_FAL_LICENSE,
        },
      );

      expect(result.status).toBe(ListingStatus.SUSPENDED);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: expect.objectContaining({
            status: ListingStatus.SUSPENDED,
            complianceReason: 'مخالفة توثيق رخصة فال وتجاوز الصلاحيات',
            complianceOfficerId: mockAdminComplianceOfficer.id,
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LISTING_COMPLIANCE_SUSPENDED',
            actorId: mockAdminComplianceOfficer.id,
          }),
        }),
      );

      expect(emailTransportService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sultan@marketer.sa',
          subject: expect.stringContaining('إشعار إيقاف مؤقت للإعلان العقاري'),
        }),
      );
    });

    it('rejects suspension if listing is already BLOCKED (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.BLOCKED }),
      );

      await expect(
        adminListingsService.suspendListing(
          listingId,
          mockAdminComplianceOfficer as any,
          { complianceReason: 'محاولة إيقاف إعلان محظور' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Administrative Compliance Permanent Blocking (AC #4)', () => {
    it('permanently blocks listing, sets BLOCKED status, and dispatches email', async () => {
      const mockListing = makeMockListing({ status: ListingStatus.ACTIVE });
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.BLOCKED,
        version: 2,
        complianceReason: 'احتيال عقاري وتزوير في وثائق الملكية',
        complianceActionAt: baseNow,
        complianceOfficerId: mockAdminComplianceOfficer.id,
      });

      const result = await adminListingsService.blockListing(
        listingId,
        mockAdminComplianceOfficer as any,
        {
          blockingReason: 'احتيال عقاري وتزوير في وثائق الملكية',
          violationCode: 'VIO-FRAUD-001',
        },
      );

      expect(result.status).toBe(ListingStatus.BLOCKED);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: expect.objectContaining({
            status: ListingStatus.BLOCKED,
            complianceReason: 'احتيال عقاري وتزوير في وثائق الملكية',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LISTING_COMPLIANCE_BLOCKED',
          }),
        }),
      );

      expect(emailTransportService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sultan@marketer.sa',
          subject: expect.stringContaining('إشعار حظر نهائي للإعلان العقاري'),
        }),
      );
    });

    it('rejects blocking if listing is already BLOCKED (409 Conflict)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.BLOCKED }),
      );

      await expect(
        adminListingsService.blockListing(
          listingId,
          mockAdminComplianceOfficer as any,
          { blockingReason: 'محاولة حظر مكرر' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Administrative Compliance Unsuspend / Restoration (AC #5)', () => {
    it('restores SUSPENDED listing back to ACTIVE, clears compliance data, and emails seller', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.SUSPENDED,
        complianceReason: 'سابق',
        complianceOfficerId: 'admin-old',
      });
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      prisma.listing.update.mockResolvedValue({
        ...mockListing,
        status: ListingStatus.ACTIVE,
        version: 2,
        complianceReason: null,
        complianceActionAt: null,
        complianceOfficerId: null,
      });

      const result = await adminListingsService.unsuspendListing(
        listingId,
        mockAdminComplianceOfficer as any,
        {
          resolutionNotes: 'تم تقديم تفويض إلكتروني صحيح ومعتمد عبر منصة إيجار/فال',
        },
      );

      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: listingId },
          data: expect.objectContaining({
            status: ListingStatus.ACTIVE,
            complianceReason: null,
            complianceOfficerId: null,
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LISTING_COMPLIANCE_UNSUSPENDED',
            payload: expect.objectContaining({
              resolutionNotes: 'تم تقديم تفويض إلكتروني صحيح ومعتمد عبر منصة إيجار/فال',
            }),
          }),
        }),
      );

      expect(emailTransportService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sultan@marketer.sa',
          subject: expect.stringContaining('إشعار رفع الإيقاف وإعادة تنشيط الإعلان العقاري'),
        }),
      );
    });

    it('rejects unsuspend if listing is not currently SUSPENDED (400 Bad Request)', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.ACTIVE }),
      );

      await expect(
        adminListingsService.unsuspendListing(
          listingId,
          mockAdminComplianceOfficer as any,
          { resolutionNotes: 'محاولة رفع إيقاف عن إعلان نشط' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Search & Direct Access Privacy Isolation (AC #6)', () => {
    it('returns 404 for public visitor when listing is ARCHIVED', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.ARCHIVED }),
      );

      await expect(
        listingsService.getListingById(listingId, undefined, false),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 for public visitor when listing is SUSPENDED or BLOCKED', async () => {
      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.SUSPENDED }),
      );

      await expect(
        listingsService.getListingById(listingId, undefined, false),
      ).rejects.toThrow(NotFoundException);

      prisma.listing.findUnique.mockResolvedValue(
        makeMockListing({ status: ListingStatus.BLOCKED }),
      );

      await expect(
        listingsService.getListingById(listingId, otherUserId, false),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows author seller to inspect their own ARCHIVED, SUSPENDED, or BLOCKED listing', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.SUSPENDED,
        complianceReason: 'مطلوب تعديل الصك',
      });
      prisma.listing.findUnique.mockResolvedValue(mockListing);

      const result = await listingsService.getListingById(listingId, sellerUserId, false);
      expect(result.id).toBe(listingId);
      expect(result.status).toBe(ListingStatus.SUSPENDED);
      expect(result.complianceReason).toBe('مطلوب تعديل الصك');
    });

    it('allows admin to inspect ARCHIVED, SUSPENDED, or BLOCKED listing', async () => {
      const mockListing = makeMockListing({
        status: ListingStatus.BLOCKED,
        complianceReason: 'مخالفة جسيمة',
      });
      prisma.listing.findUnique.mockResolvedValue(mockListing);

      const result = await listingsService.getListingById(listingId, undefined, true);
      expect(result.id).toBe(listingId);
      expect(result.status).toBe(ListingStatus.BLOCKED);
    });
  });
});

