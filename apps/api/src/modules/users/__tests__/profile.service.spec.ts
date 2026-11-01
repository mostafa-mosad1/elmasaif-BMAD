import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProfileService } from '../profile.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  UserRole,
  AUTH_EMAIL_IN_USE,
  AUTH_EMAIL_SAME_AS_CURRENT,
  AUTH_EMAIL_VERIFICATION_INITIATED,
  AUTH_EMAIL_VERIFICATION_EXPIRED,
  AUTH_EMAIL_VERIFICATION_INVALID,
  AUTH_EMAIL_VERIFICATION_STALE,
  AUTH_EMAIL_VERIFIED_SUCCESS,
  AUTH_EMAIL_VERIFICATION_RESENT,
  AUTH_EMAIL_PENDING_CANCELLED,
  AUTH_NO_PENDING_EMAIL,
  AUTH_OTP_THROTTLED,
} from '@elmasaif/shared';

describe('ProfileService (Story 1.8 Profile Editing & Mandatory Email Verification) (AC: 1, 2, 3, 4, 5)', () => {
  let service: ProfileService;
  let prisma: any;
  let clockService: any;
  let configService: any;

  const mockNow = new Date('2026-11-01T12:00:00.000Z');

  const baseUser = {
    id: 'usr-123',
    username: 'u_966501234567',
    fullName: 'خالد بن عبدالعزيز الشمري',
    mobileNumber: '+966501234567',
    nationalId: '1088776655',
    email: 'khaled.old@example.com',
    pendingEmail: null,
    emailVerifiedAt: new Date('2026-10-01T10:00:00.000Z'),
    status: 'ACTIVE',
    profiles: []
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma))
    };

    clockService = {
      now: jest.fn().mockReturnValue(new Date(mockNow.getTime()))
    };

    configService = {
      get: jest.fn().mockReturnValue('test-session-secret-key-for-hmac')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: clockService },
        { provide: ConfigService, useValue: configService }
      ]
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe('updateProfile - Full Name Changes (AC: 1, 5)', () => {
    it('updates fullName and records immutable USER_PROFILE_UPDATED audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        fullName: 'خالد بن عبدالعزيز بن فهد الشمري'
      });

      const result = await service.updateProfile(
        'usr-123',
        { fullName: 'خالد بن عبدالعزيز بن فهد الشمري' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: expect.objectContaining({ fullName: 'خالد بن عبدالعزيز بن فهد الشمري' })
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-123',
          actorType: 'USER',
          action: 'USER_PROFILE_UPDATED',
          entityType: 'User',
          entityId: 'usr-123',
          ipAddress: '192.168.1.1',
          payload: {
            field: 'fullName',
            oldValue: 'خالد بن عبدالعزيز الشمري',
            newValue: 'خالد بن عبدالعزيز بن فهد الشمري'
          }
        })
      });

      expect(result.data.fullName).toBe('خالد بن عبدالعزيز بن فهد الشمري');
      expect(result.data.hasCommercialNameMismatch).toBe(false);
    });

    it('flags commercial name mismatch warning when Marketer name diverges from Fal commercialName (AC: 5)', async () => {
      const marketerUser = {
        ...baseUser,
        profiles: [
          {
            id: 'prof-marketer-1',
            role: UserRole.MARKETER,
            falLicense: {
              licenseNumber: '1100001234',
              commercialName: 'مؤسسة الشمري العقارية'
            }
          }
        ]
      };

      prisma.user.findUnique.mockResolvedValue(marketerUser);
      prisma.user.update.mockResolvedValue({
        ...marketerUser,
        fullName: 'خالد الشمري للخدمات العامة'
      });

      const result = await service.updateProfile(
        'usr-123',
        { fullName: 'خالد الشمري للخدمات العامة' },
        '10.0.0.5'
      );

      expect(result.data.hasCommercialNameMismatch).toBe(true);
      expect(result.data.commercialNameMismatchNotice).toContain('رخصة فال');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-123',
          action: 'PROFILE_NAME_MISMATCH_WARNING',
          payload: expect.objectContaining({
            commercialName: 'مؤسسة الشمري العقارية',
            falLicenseNumber: '1100001234'
          })
        })
      });
    });
  });

  describe('updateProfile - Email Changes & Pending State (AC: 2)', () => {
    it('stores pendingEmail without changing active email and creates audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.user.findFirst.mockResolvedValue(null); // uniqueness check
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        pendingEmail: 'khaled.new@example.com'
      });

      const result = await service.updateProfile(
        'usr-123',
        { email: 'khaled.new@example.com' },
        '127.0.0.1'
      );

      expect(result.code).toBe(AUTH_EMAIL_VERIFICATION_INITIATED);
      expect(result.data.email).toBe('khaled.old@example.com'); // retains active email
      expect(result.data.pendingEmail).toBe('khaled.new@example.com');
      expect(result.data.isEmailPending).toBe(true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: expect.objectContaining({
          pendingEmail: 'khaled.new@example.com'
        })
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-123',
          action: 'USER_EMAIL_CHANGE_REQUESTED',
          payload: expect.objectContaining({
            currentEmail: 'khaled.old@example.com',
            pendingEmail: 'khaled.new@example.com',
            expiresInSeconds: 86400
          })
        })
      });
    });

    it('rejects if new email is identical to current email', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });

      await expect(
        service.updateProfile('usr-123', { email: 'khaled.old@example.com' })
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_SAME_AS_CURRENT
        },
        status: HttpStatus.BAD_REQUEST
      });
    });

    it('rejects with 409 Conflict if new email is already in use by another user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.user.findFirst.mockResolvedValue({ id: 'other-user', email: 'taken@example.com' });

      await expect(
        service.updateProfile('usr-123', { email: 'taken@example.com' })
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_IN_USE
        },
        status: HttpStatus.CONFLICT
      });
    });
  });

  describe('verifyEmail - Confirmation & Atomic Re-binding (AC: 3)', () => {
    it('verifies valid token and atomically updates email in transaction', async () => {
      const token = service.generateEmailVerificationToken('usr-123', 'new.verified@example.com');

      const userWithPending = {
        ...baseUser,
        pendingEmail: 'new.verified@example.com'
      };

      prisma.user.findUnique.mockResolvedValue(userWithPending);
      prisma.user.findFirst.mockResolvedValue(null); // not taken by other user

      const result = await service.verifyEmail(
        { token },
        '10.10.10.10'
      );

      expect(result.code).toBe(AUTH_EMAIL_VERIFIED_SUCCESS);
      expect(result.data.email).toBe('new.verified@example.com');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: expect.objectContaining({
          email: 'new.verified@example.com',
          pendingEmail: null,
          emailVerifiedAt: expect.any(Date)
        })
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-123',
          action: 'USER_EMAIL_VERIFIED',
          payload: expect.objectContaining({
            oldEmail: 'khaled.old@example.com',
            newEmail: 'new.verified@example.com'
          })
        })
      });
    });

    it('rejects tampered or invalid token with AUTH_EMAIL_VERIFICATION_INVALID', async () => {
      await expect(
        service.verifyEmail({ token: 'invalid.tampered.token' }, '1.2.3.4')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_VERIFICATION_INVALID
        },
        status: HttpStatus.BAD_REQUEST
      });
    });

    it('rejects expired token with AUTH_EMAIL_VERIFICATION_EXPIRED', async () => {
      const token = service.generateEmailVerificationToken('usr-123', 'expired@example.com');

      // Fast forward time by 25 hours (86400s + 3600s)
      clockService.now.mockReturnValue(new Date(mockNow.getTime() + 25 * 3600 * 1000));

      await expect(
        service.verifyEmail({ token }, '1.2.3.4')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_VERIFICATION_EXPIRED
        },
        status: HttpStatus.BAD_REQUEST
      });
    });

    it('rejects with AUTH_EMAIL_VERIFICATION_STALE if user pendingEmail does not match token', async () => {
      const token = service.generateEmailVerificationToken('usr-123', 'old.pending@example.com');

      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        pendingEmail: 'different.pending@example.com' // changed in interim
      });

      await expect(
        service.verifyEmail({ token }, '1.2.3.4')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_VERIFICATION_STALE
        },
        status: HttpStatus.BAD_REQUEST
      });
    });

    it('rejects with 409 Conflict if pending email was registered by another user in the interim', async () => {
      const token = service.generateEmailVerificationToken('usr-123', 'raced@example.com');

      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        pendingEmail: 'raced@example.com'
      });

      prisma.user.findFirst.mockResolvedValue({ id: 'third-party-user', email: 'raced@example.com' });

      await expect(
        service.verifyEmail({ token }, '1.2.3.4')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_EMAIL_IN_USE
        },
        status: HttpStatus.CONFLICT
      });
    });
  });

  describe('resendVerificationEmail & Cooldown Throttle (AC: 4)', () => {
    it('rejects with AUTH_NO_PENDING_EMAIL if user has no pending email', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, pendingEmail: null });

      await expect(
        service.resendVerificationEmail('usr-123', '1.1.1.1')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_NO_PENDING_EMAIL
        },
        status: HttpStatus.BAD_REQUEST
      });
    });

    it('dispatches fresh token and enforces 60-second cooldown throttle', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        pendingEmail: 'cooldown@example.com'
      });

      // First call succeeds
      const firstResend = await service.resendVerificationEmail('usr-123', '1.1.1.1');
      expect(firstResend.code).toBe(AUTH_EMAIL_VERIFICATION_RESENT);
      expect(firstResend.data.resendAvailableInSeconds).toBe(60);

      // Second call immediately within 60s is throttled
      await expect(
        service.resendVerificationEmail('usr-123', '1.1.1.1')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_OTP_THROTTLED
        },
        status: HttpStatus.TOO_MANY_REQUESTS
      });

      // Advance clock by 61 seconds
      clockService.now.mockReturnValue(new Date(mockNow.getTime() + 61 * 1000));

      // Third call after cooldown succeeds
      const thirdResend = await service.resendVerificationEmail('usr-123', '1.1.1.1');
      expect(thirdResend.code).toBe(AUTH_EMAIL_VERIFICATION_RESENT);
    });
  });

  describe('cancelPendingEmail (AC: 4)', () => {
    it('cancels pendingEmail, logs audit event, and returns confirmation', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        pendingEmail: 'to.cancel@example.com'
      });
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        pendingEmail: null
      });

      const result = await service.cancelPendingEmail('usr-123', '1.1.1.1');

      expect(result.code).toBe(AUTH_EMAIL_PENDING_CANCELLED);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-123' },
        data: { pendingEmail: null }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'usr-123',
          action: 'USER_EMAIL_CHANGE_CANCELLED',
          payload: { cancelledPendingEmail: 'to.cancel@example.com' }
        })
      });
    });

    it('rejects with AUTH_NO_PENDING_EMAIL if there is no pending email to cancel', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, pendingEmail: null });

      await expect(
        service.cancelPendingEmail('usr-123', '1.1.1.1')
      ).rejects.toMatchObject({
        response: {
          code: AUTH_NO_PENDING_EMAIL
        },
        status: HttpStatus.BAD_REQUEST
      });
    });
  });
});
