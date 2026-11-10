import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminLicensesService } from '../admin-licenses.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED,
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED,
  AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED,
  COMPLIANCE_CATEGORY_FAL_EXPIRED,
  FAL_LOCK_DURATION_MS,
  LICENSE_INVALID_STATE,
  LICENSE_LOCK_CONFLICT,
  LICENSE_LOCK_EXPIRED,
  LICENSE_LOCK_REQUIRED,
  LICENSE_NOT_FOUND,
  LICENSE_REJECTION_REASON_REQUIRED,
  LICENSE_VERSION_CONFLICT,
  ListingStatus,
  ProfileStatus,
} from '@elmasaif/shared';

describe('AdminLicensesService', () => {
  let service: AdminLicensesService;
  let prisma: any;
  let clock: any;
  let storage: any;

  const mockNow = new Date('2026-11-09T14:00:00.000Z');
  const mockAdmin = {
    id: 'admin-1',
    username: 'mod1',
    email: 'mod1@elmasaif.sa',
    fullName: 'أحمد المشرف',
    role: 'MODERATOR',
    isActive: true,
    permissions: ['Licenses.Review'],
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      falLicense: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      userProfile: {
        update: jest.fn(),
      },
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin-2', fullName: 'سارة الإدارية' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'admin-1', fullName: 'أحمد المشرف' },
          { id: 'admin-2', fullName: 'سارة الإدارية' },
        ]),
      },
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    clock = {
      now: jest.fn(() => mockNow),
    };

    storage = {
      getVerifiedDownloadUrl: jest.fn(async (key: string) => `https://s3.local/signed/${key}`),
      getPresignedDownloadUrl: jest.fn(async (key: string) => `https://s3.local/signed/${key}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminLicensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clock },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<AdminLicensesService>(AdminLicensesService);
  });

  describe('claimLicense', () => {
    it('throws NotFoundException when license does not exist', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce(null);

      await expect(service.claimLicense('missing-id', mockAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when license is actively leased by another admin', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce({
        id: 'fal-1',
        lockedByAdminId: 'admin-2',
        lockedAt: mockNow,
        lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000), // active lease
      });

      try {
        await service.claimLicense('fal-1', mockAdmin);
        expect(true).toBe(false); // should not reach
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(LICENSE_LOCK_CONFLICT);
      }
    });

    it('successfully acquires 15-minute claim lease when unlocked', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce({
        id: 'fal-1',
        lockedByAdminId: null,
        lockExpiresAt: null,
      });

      const updatedRecord = {
        id: 'fal-1',
        lockedByAdminId: 'admin-1',
        lockedAt: mockNow,
        lockExpiresAt: new Date(mockNow.getTime() + FAL_LOCK_DURATION_MS),
      };
      prisma.falLicense.update.mockResolvedValueOnce(updatedRecord);

      const result = await service.claimLicense('fal-1', mockAdmin);

      expect(prisma.falLicense.update).toHaveBeenCalledWith({
        where: { id: 'fal-1' },
        data: {
          lockedByAdminId: 'admin-1',
          lockedAt: mockNow,
          lockExpiresAt: new Date(mockNow.getTime() + FAL_LOCK_DURATION_MS),
        },
      });

      expect(result.lockInfo.isLocked).toBe(true);
      expect(result.lockInfo.isLockedByCurrentAdmin).toBe(true);
      expect(result.lockInfo.remainingSeconds).toBe(15 * 60);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'FAL_LICENSE_CLAIMED',
          actorId: 'admin-1',
          entityType: 'FalLicense',
          entityId: 'fal-1',
        }),
      });
    });
  });

  describe('heartbeatLicenseLock', () => {
    it('throws ConflictException if lease is expired or not held by calling admin', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce({
        id: 'fal-1',
        lockedByAdminId: 'admin-2',
        lockExpiresAt: new Date(mockNow.getTime() + 5000),
      });

      await expect(service.heartbeatLicenseLock('fal-1', mockAdmin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('extends lease by 15 minutes when valid', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce({
        id: 'fal-1',
        lockedByAdminId: 'admin-1',
        lockExpiresAt: new Date(mockNow.getTime() + 5 * 60 * 1000),
      });

      prisma.falLicense.update.mockResolvedValueOnce({
        id: 'fal-1',
        lockedByAdminId: 'admin-1',
        lockExpiresAt: new Date(mockNow.getTime() + FAL_LOCK_DURATION_MS),
      });

      const res = await service.heartbeatLicenseLock('fal-1', mockAdmin);
      expect(res.remainingSeconds).toBe(15 * 60);
    });
  });

  describe('approveLicense', () => {
    const validLicense = {
      id: 'fal-1',
      profileId: 'profile-1',
      status: ProfileStatus.UNDER_REVIEW,
      version: 2,
      lockedByAdminId: 'admin-1',
      lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
    };

    it('rejects approval if caller does not hold active claim lock', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce({
        ...validLicense,
        lockedByAdminId: 'admin-2',
      });

      await expect(
        service.approveLicense('fal-1', mockAdmin, { version: 2 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects approval on version conflict', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce(validLicense);

      await expect(
        service.approveLicense('fal-1', mockAdmin, { version: 1 }), // expected 2
      ).rejects.toThrow(ConflictException);
    });

    it('successfully approves license, activating profile and incrementing version', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce(validLicense);
      prisma.falLicense.update.mockResolvedValueOnce({
        ...validLicense,
        status: ProfileStatus.ACTIVE,
        version: 3,
        lockedByAdminId: null,
      });

      const res = await service.approveLicense('fal-1', mockAdmin, { version: 2 });

      expect(res.statusCode).toBe(200);
      expect(prisma.falLicense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fal-1' },
          data: expect.objectContaining({
            status: ProfileStatus.ACTIVE,
            reviewedByAdminId: 'admin-1',
            lockedByAdminId: null,
            version: { increment: 1 },
          }),
        }),
      );
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { status: ProfileStatus.ACTIVE },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'FAL_LICENSE_APPROVED',
          actorId: 'admin-1',
        }),
      });
    });

    it('approves renewal, activates profile, logs FAL_LICENSE_RENEWAL_APPROVED and automatically reinstates eligible suspended listings', async () => {
      const renewalLicense = {
        ...validLicense,
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
      };

      prisma.falLicense.findUnique.mockResolvedValueOnce(renewalLicense);

      // Marketer has 2 listings: 1 suspended due to FAL_LICENSE_EXPIRED, 1 suspended due to FRAUD
      const eligibleListing = {
        id: 'listing-1',
        title: 'شقة فاخرة بحي النرجس',
        sellerProfileId: 'profile-1',
        status: ListingStatus.UNDER_COMPLIANCE_REVIEW,
        complianceCategory: COMPLIANCE_CATEGORY_FAL_EXPIRED,
      };

      prisma.listing.findMany.mockResolvedValueOnce([eligibleListing]);
      prisma.listing.update.mockResolvedValueOnce({
        ...eligibleListing,
        status: ListingStatus.ACTIVE,
      });

      const res = await service.approveLicense('fal-1', mockAdmin, { version: 2 });

      expect(res.statusCode).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.reinstatedListingsCount).toBe(1);

      // Verify listing update
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: expect.objectContaining({
          status: ListingStatus.ACTIVE,
          complianceReason: null,
          complianceCategory: null,
          complianceActionAt: null,
          complianceOfficerId: null,
          version: { increment: 1 },
        }),
      });

      // Verify listing audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AUDIT_ACTION_LISTING_REINSTATED_FAL_RENEWED,
          entityType: 'Listing',
          entityId: 'listing-1',
          actorId: 'admin-1',
          actorType: 'ADMIN',
        }),
      });

      // Verify license approval audit log has FAL_LICENSE_RENEWAL_APPROVED
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AUDIT_ACTION_FAL_LICENSE_RENEWAL_APPROVED,
          entityType: 'FalLicense',
          entityId: 'fal-1',
        }),
      });
    });
  });

  describe('rejectLicense', () => {
    const validLicense = {
      id: 'fal-1',
      profileId: 'profile-1',
      status: ProfileStatus.UNDER_REVIEW,
      version: 2,
      lockedByAdminId: 'admin-1',
      lockExpiresAt: new Date(mockNow.getTime() + 10 * 60 * 1000),
    };

    it('rejects if rejectionReason is too short', async () => {
      await expect(
        service.rejectLicense('fal-1', mockAdmin, {
          version: 2,
          rejectionReason: 'قصير',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully rejects license and suspends profile', async () => {
      prisma.falLicense.findUnique.mockResolvedValueOnce(validLicense);
      prisma.falLicense.update.mockResolvedValueOnce({
        ...validLicense,
        status: ProfileStatus.REJECTED,
        version: 3,
        rejectionReason: 'شهادة الترخيص غير واضحة ويجب إعادة رفعها',
      });

      const res = await service.rejectLicense('fal-1', mockAdmin, {
        version: 2,
        rejectionReason: 'شهادة الترخيص غير واضحة ويجب إعادة رفعها',
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.falLicense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fal-1' },
          data: expect.objectContaining({
            status: ProfileStatus.REJECTED,
            rejectionReason: 'شهادة الترخيص غير واضحة ويجب إعادة رفعها',
            reviewedByAdminId: 'admin-1',
          }),
        }),
      );
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { status: ProfileStatus.SUSPENDED },
      });
    });

    it('rejects renewal when expired: sets COMPLIANCE_RESTRICTED and logs FAL_LICENSE_RENEWAL_REJECTED', async () => {
      const expiredRenewalLicense = {
        ...validLicense,
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
        expiryDate: new Date('2026-11-01T00:00:00.000Z'), // in past relative to mockNow (2026-11-09)
      };

      prisma.falLicense.findUnique.mockResolvedValueOnce(expiredRenewalLicense);
      prisma.falLicense.update.mockResolvedValueOnce({
        ...expiredRenewalLicense,
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
      });

      const res = await service.rejectLicense('fal-1', mockAdmin, {
        version: 2,
        rejectionReason: 'شهادة الترخيص المرفقة غير مطابقة للبيانات الرسمية',
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.falLicense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fal-1' },
          data: expect.objectContaining({
            status: ProfileStatus.COMPLIANCE_RESTRICTED,
            rejectionReason: 'شهادة الترخيص المرفقة غير مطابقة للبيانات الرسمية',
          }),
        }),
      );
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { status: ProfileStatus.COMPLIANCE_RESTRICTED },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED,
          entityType: 'FalLicense',
          entityId: 'fal-1',
        }),
      });
    });

    it('rejects early renewal when not yet expired: sets ACTIVE and logs FAL_LICENSE_RENEWAL_REJECTED', async () => {
      const activeRenewalLicense = {
        ...validLicense,
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
        expiryDate: new Date('2026-11-25T00:00:00.000Z'), // still in future relative to mockNow (2026-11-09)
      };

      prisma.falLicense.findUnique.mockResolvedValueOnce(activeRenewalLicense);
      prisma.falLicense.update.mockResolvedValueOnce({
        ...activeRenewalLicense,
        status: ProfileStatus.ACTIVE,
      });

      const res = await service.rejectLicense('fal-1', mockAdmin, {
        version: 2,
        rejectionReason: 'الشهادة المرفقة منتهية الصلاحية وليست جديدة',
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.falLicense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fal-1' },
          data: expect.objectContaining({
            status: ProfileStatus.ACTIVE,
            rejectionReason: 'الشهادة المرفقة منتهية الصلاحية وليست جديدة',
          }),
        }),
      );
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { status: ProfileStatus.ACTIVE },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AUDIT_ACTION_FAL_LICENSE_RENEWAL_REJECTED,
          entityType: 'FalLicense',
          entityId: 'fal-1',
        }),
      });
    });
  });
});

