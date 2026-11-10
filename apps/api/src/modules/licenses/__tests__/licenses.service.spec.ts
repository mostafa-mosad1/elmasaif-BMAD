import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LicensesService } from '../licenses.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import { StorageService } from '../../storage/storage.service';
import {
  FAL_EXPIRED_DATE,
  FAL_LICENSE_ALREADY_EXISTS,
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
});
