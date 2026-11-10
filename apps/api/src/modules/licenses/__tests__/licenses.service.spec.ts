import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LicensesService } from '../licenses.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED,
  FAL_EXPIRED_DATE,
  FAL_LICENSE_ALREADY_EXISTS,
  FAL_RENEWAL_DATE_NOT_EXTENDED,
  LICENSE_NOT_FOUND,
  ProfileStatus,
  UserRole,
} from '@elmasaif/shared';

describe('LicensesService', () => {
  let service: LicensesService;
  let prisma: any;
  let clock: any;
  let storage: any;

  const mockNow = new Date('2026-11-09T12:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      falLicense: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      userProfile: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
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
        LicensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clock },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);
  });

  describe('submitFalLicense', () => {
    const validDto = {
      licenseNumber: '1234567890',
      certificateUrl: 'fal/cert.pdf',
      expiryDate: '2028-12-31T00:00:00.000Z',
      commercialName: 'مكتب الرياض للوساطة',
      crNumber: '1010123456',
      supportingDocumentUrls: ['fal/doc1.pdf'],
    };

    it('rejects expiration dates in the past or equal to current time', async () => {
      const pastDto = {
        ...validDto,
        expiryDate: '2026-11-08T00:00:00.000Z',
      };

      await expect(service.submitFalLicense('user-1', pastDto)).rejects.toThrow(
        BadRequestException,
      );

      try {
        await service.submitFalLicense('user-1', pastDto);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(FAL_EXPIRED_DATE);
      }
    });

    it('rejects duplicate Fal license number already claimed by another user', async () => {
      prisma.falLicense.findFirst.mockResolvedValue({
        id: 'fal-existing',
        licenseNumber: '1234567890',
        profile: {
          userId: 'user-different',
        },
      });

      await expect(service.submitFalLicense('user-1', validDto)).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.submitFalLicense('user-1', validDto);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(FAL_LICENSE_ALREADY_EXISTS);
      }
    });

    it('successfully submits Fal license, upserting profile and license and logging audit', async () => {
      prisma.falLicense.findFirst.mockResolvedValueOnce(null); // uniqueness check passed
      prisma.userProfile.upsert.mockResolvedValueOnce({
        id: 'profile-marketer-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        status: ProfileStatus.UNDER_REVIEW,
      });

      const mockCreatedFal = {
        id: 'fal-license-1',
        profileId: 'profile-marketer-1',
        licenseNumber: validDto.licenseNumber,
        status: ProfileStatus.UNDER_REVIEW,
        expiryDate: new Date(validDto.expiryDate),
        version: 1,
      };

      prisma.falLicense.upsert.mockResolvedValueOnce(mockCreatedFal);
      prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' });

      const result = await service.submitFalLicense('user-1', validDto);

      expect(result.statusCode).toBe(201);
      expect(result.data).toEqual(mockCreatedFal);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-1',
          actorType: 'USER',
          action: 'FAL_LICENSE_SUBMITTED',
          entityType: 'FalLicense',
          entityId: 'fal-license-1',
        }),
      });
    });
  });

  describe('getMyFalLicense', () => {
    it('returns nulls when user has no marketer profile', async () => {
      prisma.userProfile.findFirst.mockResolvedValueOnce(null);

      const res = await service.getMyFalLicense('user-1');
      expect(res.profile).toBeNull();
      expect(res.falLicense).toBeNull();
    });

    it('returns marketer profile and Fal license with presigned download URLs', async () => {
      prisma.userProfile.findFirst.mockResolvedValueOnce({
        id: 'profile-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        status: ProfileStatus.UNDER_REVIEW,
        falLicense: {
          id: 'fal-1',
          licenseNumber: '1234567890',
          certificateUrl: 'cert-1',
          supportingDocumentUrls: ['doc-1'],
          status: ProfileStatus.UNDER_REVIEW,
          expiryDate: new Date('2028-01-01'),
          version: 1,
        },
      });

      const res = await service.getMyFalLicense('user-1');
      expect(res.falLicense).toBeDefined();
      expect(res.falLicense.certificateDownloadUrl).toContain('https://s3.local/signed/cert-1');
      expect(res.falLicense.supportingDocumentDownloadUrls).toHaveLength(1);
      expect(res.falLicense.daysRemaining).toBeDefined();
      expect(typeof res.falLicense.daysRemaining).toBe('number');
      expect(res.falLicense.isExpired).toBe(false);
    });
  });

  describe('renewFalLicense', () => {
    const renewalDto = {
      certificateUrl: 'fal/renewals/cert-2029.pdf',
      expiryDate: '2029-12-31T23:59:59.000Z',
      commercialName: 'شركة مسايف المجددة',
      crNumber: '1010998877',
      supportingDocumentUrls: ['fal/supporting/doc-new.pdf'],
    };

    it('rejects if user has no marketer profile or no falLicense', async () => {
      prisma.userProfile.findFirst.mockResolvedValueOnce(null);

      await expect(service.renewFalLicense('user-1', renewalDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects if new expiry date is in the past or equal to current time', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
        falLicense: {
          id: 'fal-1',
          licenseNumber: '1234567890',
          expiryDate: new Date('2026-11-01T00:00:00.000Z'),
          status: ProfileStatus.COMPLIANCE_RESTRICTED,
          version: 2,
        },
      });

      const pastDto = {
        ...renewalDto,
        expiryDate: '2026-11-08T00:00:00.000Z', // before mockNow (2026-11-09)
      };

      await expect(service.renewFalLicense('user-1', pastDto)).rejects.toThrow(BadRequestException);
      try {
        await service.renewFalLicense('user-1', pastDto);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(FAL_EXPIRED_DATE);
      }
    });

    it('rejects if renewing an active license with equal or earlier expiry date', async () => {
      prisma.userProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        falLicense: {
          id: 'fal-1',
          licenseNumber: '1234567890',
          expiryDate: new Date('2028-12-31T00:00:00.000Z'),
          status: ProfileStatus.ACTIVE,
          version: 2,
        },
      });

      const earlierDto = {
        ...renewalDto,
        expiryDate: '2028-06-01T00:00:00.000Z', // earlier than current 2028-12-31
      };

      await expect(service.renewFalLicense('user-1', earlierDto)).rejects.toThrow(BadRequestException);
      try {
        await service.renewFalLicense('user-1', earlierDto);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(FAL_RENEWAL_DATE_NOT_EXTENDED);
      }
    });

    it('successfully submits renewal for restricted account, transitioning profile to RENEWAL_UNDER_REVIEW', async () => {
      const mockLicense = {
        id: 'fal-1',
        profileId: 'profile-1',
        licenseNumber: '1234567890',
        commercialName: 'شركة مسايف',
        crNumber: '1010123456',
        expiryDate: new Date('2026-11-01T00:00:00.000Z'),
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
        version: 1,
      };

      prisma.userProfile.findFirst.mockResolvedValueOnce({
        id: 'profile-1',
        userId: 'user-1',
        role: UserRole.MARKETER,
        status: ProfileStatus.COMPLIANCE_RESTRICTED,
        falLicense: mockLicense,
      });

      const updatedLicense = {
        ...mockLicense,
        certificateUrl: renewalDto.certificateUrl,
        expiryDate: new Date(renewalDto.expiryDate),
        commercialName: renewalDto.commercialName,
        crNumber: renewalDto.crNumber,
        supportingDocumentUrls: renewalDto.supportingDocumentUrls,
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
        version: 2,
      };

      prisma.falLicense.update.mockResolvedValueOnce(updatedLicense);
      prisma.userProfile.update.mockResolvedValueOnce({
        id: 'profile-1',
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
      });
      prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-renew-1' });

      const res = await service.renewFalLicense('user-1', renewalDto);

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe(ProfileStatus.RENEWAL_UNDER_REVIEW);
      expect(prisma.falLicense.update).toHaveBeenCalledWith({
        where: { id: 'fal-1' },
        data: expect.objectContaining({
          status: ProfileStatus.RENEWAL_UNDER_REVIEW,
          version: { increment: 1 },
        }),
      });
      expect(prisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: { status: ProfileStatus.RENEWAL_UNDER_REVIEW },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-1',
          action: AUDIT_ACTION_FAL_LICENSE_RENEWAL_SUBMITTED,
          entityType: 'FalLicense',
          entityId: 'fal-1',
        }),
      });
    });

    it('successfully submits early renewal for ACTIVE account, preserving userProfile as ACTIVE', async () => {
      const mockLicense = {
        id: 'fal-2',
        profileId: 'profile-2',
        licenseNumber: '1234567890',
        commercialName: 'شركة مسايف',
        crNumber: '1010123456',
        expiryDate: new Date('2026-11-20T00:00:00.000Z'),
        status: ProfileStatus.ACTIVE,
        version: 1,
      };

      prisma.userProfile.findFirst.mockResolvedValueOnce({
        id: 'profile-2',
        userId: 'user-2',
        role: UserRole.MARKETER,
        status: ProfileStatus.ACTIVE,
        falLicense: mockLicense,
      });

      const updatedLicense = {
        ...mockLicense,
        status: ProfileStatus.RENEWAL_UNDER_REVIEW,
        version: 2,
      };

      prisma.falLicense.update.mockResolvedValueOnce(updatedLicense);
      prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-renew-2' });

      const res = await service.renewFalLicense('user-2', renewalDto);

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe(ProfileStatus.RENEWAL_UNDER_REVIEW);
      // Profile update should NOT change status from ACTIVE to RENEWAL_UNDER_REVIEW
      expect(prisma.userProfile.update).not.toHaveBeenCalled();
    });
  });
});
