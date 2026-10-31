import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { AuthService } from '../auth.service';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ClockService } from '../../../common/clock/clock.service';
import {
  AUTH_PHONE_ALREADY_EXISTS,
  AUTH_NATIONAL_ID_ALREADY_EXISTS,
  AUTH_USERNAME_ALREADY_EXISTS,
  DEFAULT_TERMS_VERSION,
  DEFAULT_PRIVACY_VERSION,
  AUTH_INVALID_CREDENTIALS,
  AUTH_ACCOUNT_LOCKED,
  AUTH_ACCOUNT_DEACTIVATED,
  AUTH_ACCOUNT_DISABLED,
  AUTH_RESET_INITIATED,
  AUTH_RESET_OTP_VERIFIED,
  AUTH_PASSWORD_SAME_AS_CURRENT,
  AUTH_PASSWORD_RESET_SUCCESS,
  AUTH_PASSWORD_CHANGE_SUCCESS,
  ProfileStatus
} from '@elmasaif/shared';

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed_argon2id_password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2
}));

describe('AuthService (AC: 1, 4, 5)', () => {
  let service: AuthService;
  let mockPrismaService: any;
  let mockOtpService: any;
  let mockClockService: any;

  const fixedNow = new Date('2026-10-29T11:00:00.000Z');

  beforeEach(async () => {
    mockClockService = {
      now: jest.fn().mockReturnValue(new Date(fixedNow))
    };

    mockOtpService = {
      generateAndSendOtp: jest.fn().mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      }),
      verifyOtp: jest.fn(),
      cleanupOtp: jest.fn().mockResolvedValue(undefined)
    };

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      knownDevice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn()
      },
      otpVerification: {
        findFirst: jest.fn()
      },
      session: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
      },
      auditLog: {
        create: jest.fn()
      },
      $transaction: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: ClockService, useValue: mockClockService }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validDto = {
      fullName: 'خالد عبدالله',
      mobileNumber: '+966501234567',
      nationalId: '1023456789',
      username: 'u_966501234567',
      password: 'Password123',
      termsAccepted: true as const,
      privacyAccepted: true as const
    };

    it('rejects registration if mobile number already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.mobileNumber) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_PHONE_ALREADY_EXISTS }));
      }
    });

    it('rejects registration if national ID already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.nationalId) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_NATIONAL_ID_ALREADY_EXISTS }));
      }
    });

    it('rejects registration if username already exists', async () => {
      mockPrismaService.user.findFirst.mockImplementation(({ where }: any) => {
        if (where.username) return Promise.resolve({ id: 'existing-user' });
        return Promise.resolve(null);
      });

      try {
        await service.register(validDto, '127.0.0.1', 'test-agent');
        throw new Error('Expected register to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_USERNAME_ALREADY_EXISTS }));
      }
    });

    it('hashes password and dispatches OTP when inputs are unique', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.register(validDto, '127.0.0.1', 'test-agent');

      expect(argon2.hash).toHaveBeenCalledWith('Password123', { type: argon2.argon2id });
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalledWith(
        '+966501234567',
        'REGISTRATION',
        expect.objectContaining({
          fullName: 'خالد عبدالله',
          mobileNumber: '+966501234567',
          nationalId: '1023456789',
          username: 'u_966501234567',
          passwordHash: 'hashed_argon2id_password',
          termsVersion: DEFAULT_TERMS_VERSION,
          privacyVersion: DEFAULT_PRIVACY_VERSION,
          ip: '127.0.0.1',
          userAgent: 'test-agent'
        })
      );
      expect(result.success).toBe(true);
      expect(result.mobileNumber).toBe('+966501234567');
      expect(result.resendAvailableInSeconds).toBe(60);
    });
  });

  describe('verifyRegistrationOtp', () => {
    it('creates User, UserProfile, ConsentRecord and Session inside transaction', async () => {
      const mockOtpRecord = {
        id: 'otp-id-123',
        mobileNumber: '+966501234567',
        metadata: {
          fullName: 'خالد عبدالله',
          mobileNumber: '+966501234567',
          nationalId: '1023456789',
          username: 'u_966501234567',
          passwordHash: 'hashed_argon2id_password',
          termsVersion: '1.0',
          privacyVersion: '1.0'
        }
      };

      mockOtpService.verifyOtp.mockResolvedValue(mockOtpRecord);

      const mockCreatedUser = {
        id: 'new-user-uuid',
        fullName: 'خالد عبدالله',
        mobileNumber: '+966501234567',
        nationalId: '1023456789',
        username: 'u_966501234567',
        status: 'ACTIVE'
      };

      const mockSession = {
        id: 'session-uuid',
        token: 'session-token-32-bytes',
        expiresAt: new Date(fixedNow.getTime() + 30 * 24 * 60 * 60 * 1000)
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockCreatedUser)
          },
          userProfile: {
            create: jest.fn().mockResolvedValue({ id: 'profile-uuid', role: 'BUYER' })
          },
          consentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'consent-uuid' })
          },
          session: {
            create: jest.fn().mockResolvedValue(mockSession)
          }
        };
        return callback(tx);
      });

      const result = await service.verifyRegistrationOtp(
        { mobileNumber: '+966501234567', code: '123456' },
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(mockOtpService.verifyOtp).toHaveBeenCalledWith('+966501234567', 'REGISTRATION', '123456');
      expect(mockOtpService.cleanupOtp).toHaveBeenCalledWith('otp-id-123');
      expect(result.user).toEqual(
        expect.objectContaining({
          id: 'new-user-uuid',
          fullName: 'خالد عبدالله',
          mobileNumber: '+966501234567',
          username: 'u_966501234567',
          role: 'BUYER',
          activeRole: 'BUYER'
        })
      );
      expect(result.sessionToken).toBeDefined();
    });
  });

  describe('login (AC: 1, 2, 3, 4, 5)', () => {
    const mockUser = {
      id: 'user-uuid-1',
      fullName: 'عبدالله محمد',
      mobileNumber: '+966501234567',
      username: 'abdullah',
      passwordHash: 'hashed_password',
      status: ProfileStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      profiles: [{ id: 'profile-1', role: 'BUYER', status: 'ACTIVE' }],
      knownDevices: []
    };

    it('rejects with 401 AUTH_INVALID_CREDENTIALS if user is not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      try {
        await service.login({ identifier: 'unknown_user', password: 'Password123' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_INVALID_CREDENTIALS }));
        expect(argon2.verify).toHaveBeenCalled(); // Constant-time dummy verify
      }
    });

    it('rejects with 423 AUTH_ACCOUNT_LOCKED immediately if account is currently locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(fixedNow.getTime() + 10 * 60 * 1000), // locked for 10 more minutes
        failedLoginAttempts: 5
      };
      mockPrismaService.user.findFirst.mockResolvedValue(lockedUser);

      try {
        await service.login({ identifier: '0501234567', password: 'Password123' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(423);
        expect(err.getResponse()).toEqual(expect.objectContaining({
          code: AUTH_ACCOUNT_LOCKED
        }));
      }
    });

    it('increments failedLoginAttempts and returns 401 on incorrect password (1st to 4th attempt)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 2
      });
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      try {
        await service.login({ identifier: '0501234567', password: 'WrongPassword' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_INVALID_CREDENTIALS }));
        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: 'user-uuid-1' },
          data: { failedLoginAttempts: 3 }
        });
      }
    });

    it('locks account for 15 minutes and returns 423 on 5th consecutive failed attempt', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4
      });
      (argon2.verify as jest.Mock).mockResolvedValueOnce(false);

      try {
        await service.login({ identifier: '0501234567', password: 'WrongPassword' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(423);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_ACCOUNT_LOCKED }));
        expect(mockPrismaService.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'user-uuid-1' },
            data: expect.objectContaining({
              failedLoginAttempts: 5,
              lockedUntil: new Date(fixedNow.getTime() + 15 * 60 * 1000)
            })
          })
        );
      }
    });

    it('cancels pending deletion and restores ACTIVE status if user status is DELETION_PENDING', async () => {
      const pendingUser = {
        ...mockUser,
        status: ProfileStatus.DELETION_PENDING,
        deletionRequestedAt: new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000),
        deletionDueAt: new Date(fixedNow.getTime() + 13 * 24 * 60 * 60 * 1000)
      };
      mockPrismaService.user.findFirst.mockResolvedValue(pendingUser);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      mockPrismaService.knownDevice.findUnique.mockResolvedValue({ id: 'kd-1', userId: pendingUser.id });
      mockPrismaService.session.create.mockResolvedValue({ id: 'sess-1' });

      const result = await service.login({ identifier: '0501234567', password: 'Password123' }, '127.0.0.1', 'agent', 'device-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({
          status: ProfileStatus.ACTIVE,
          deletionRequestedAt: null,
          deletionDueAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null
        })
      }));
      expect(result.stepUpRequired).toBe(false);
      if (result.stepUpRequired === false) {
        expect(result.deletionCancelled).toBe(true);
      }
    });

    it('rejects login with 403 AUTH_ACCOUNT_DEACTIVATED if user is DEACTIVATED', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: ProfileStatus.DEACTIVATED
      });
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);

      try {
        await service.login({ identifier: '0501234567', password: 'Password123' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_ACCOUNT_DEACTIVATED }));
      }
    });

    it('rejects login with 403 AUTH_ACCOUNT_DISABLED if user is DISABLED or SOFT_DELETED', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: ProfileStatus.DISABLED
      });
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);

      try {
        await service.login({ identifier: '0501234567', password: 'Password123' }, '127.0.0.1', 'agent');
        throw new Error('Expected login to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.getResponse()).toEqual(expect.objectContaining({ code: AUTH_ACCOUNT_DISABLED }));
      }
    });

    it('triggers step-up OTP if device is unrecognized', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      mockPrismaService.knownDevice.findUnique.mockResolvedValue(null);

      const result = await service.login(
        { identifier: '0501234567', password: 'Password123', deviceId: 'new-device-id' },
        '10.0.0.1',
        'Mozilla/Chrome'
      );

      expect(result.stepUpRequired).toBe(true);
      if (result.stepUpRequired === true) {
        expect(result.mobileNumber).toContain('+966');
        expect(result.stepUpToken).toBeDefined();
      }
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalledWith(
        mockUser.mobileNumber,
        'LOGIN_STEP_UP',
        expect.objectContaining({ userId: mockUser.id })
      );
    });

    it('logs in immediately without OTP if device is recognized', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValueOnce(true);
      mockPrismaService.knownDevice.findUnique.mockResolvedValue({
        id: 'kd-1',
        userId: mockUser.id,
        deviceHash: 'hash'
      });
      mockPrismaService.session.create.mockResolvedValue({
        id: 'sess-1',
        token: 'session-token'
      });

      const result = await service.login(
        { identifier: '0501234567', password: 'Password123', deviceId: 'known-device-id' },
        '10.0.0.1',
        'Mozilla/Chrome'
      );

      expect(result.stepUpRequired).toBe(false);
      if (result.stepUpRequired === false) {
        expect(result.sessionToken).toBeDefined();
      }
      expect(mockPrismaService.knownDevice.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'kd-1' }
      }));
    });
  });

  describe('verifyStepUpOtp (AC: 4, 5)', () => {
    const mockUser = {
      id: 'user-uuid-1',
      fullName: 'عبدالله محمد',
      mobileNumber: '+966501234567',
      username: 'abdullah',
      profiles: [{ role: 'BUYER' }]
    };

    it('verifies step-up OTP, upserts known device, and establishes session', async () => {
      mockOtpService.verifyOtp.mockResolvedValue({ id: 'otp-id' });
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.session.create.mockResolvedValue({ id: 'sess-1' });

      // Create a valid stepUpToken using the internal helper or format
      const payload = {
        userId: mockUser.id,
        mobileNumber: mockUser.mobileNumber,
        deviceHash: 'device-hash-123',
        deviceId: 'device-id-1',
        exp: fixedNow.getTime() + 300 * 1000
      };
      const secret = process.env.SESSION_SECRET || 'super-secret-session-key-for-elmasaif-2026-development';
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      const stepUpToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

      const result = await service.verifyStepUpOtp(
        {
          mobileNumber: mockUser.mobileNumber,
          code: '123456',
          stepUpToken,
          deviceId: 'device-id-1'
        },
        '127.0.0.1',
        'test-agent'
      );

      expect(mockOtpService.verifyOtp).toHaveBeenCalledWith(mockUser.mobileNumber, 'LOGIN_STEP_UP', '123456');
      expect(mockPrismaService.knownDevice.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          userId_deviceHash: {
            userId: mockUser.id,
            deviceHash: 'device-hash-123'
          }
        }
      }));
      expect(result.user.id).toBe(mockUser.id);
      expect(result.sessionToken).toBeDefined();
    });
  });

  describe('forgotPassword (AC: 1)', () => {
    it('returns generic success envelope with anti-enumeration protection when user does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword({ mobileNumber: '+966501234567' }, '127.0.0.1', 'test-agent');

      expect(result).toEqual({
        code: AUTH_RESET_INITIATED,
        message: 'إذا كان رقم الجوال مسجلاً، فسيصلك رمز التحقق لإعادة تعيين كلمة المرور',
        data: {
          resendAvailableInSeconds: 60
        }
      });
      expect(argon2.verify).toHaveBeenCalled();
      expect(mockOtpService.generateAndSendOtp).not.toHaveBeenCalled();
    });

    it('silently suppresses OTP and returns generic envelope if user status is DEACTIVATED or DISABLED', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'u-deactivated',
        mobileNumber: '+966501234567',
        status: ProfileStatus.DEACTIVATED
      });

      const result = await service.forgotPassword({ mobileNumber: '+966501234567' }, '127.0.0.1', 'test-agent');

      expect(result.code).toBe(AUTH_RESET_INITIATED);
      expect(mockOtpService.generateAndSendOtp).not.toHaveBeenCalled();
    });

    it('dispatches PASSWORD_RESET OTP if user is ACTIVE', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'u-active',
        mobileNumber: '+966501234567',
        status: ProfileStatus.ACTIVE
      });
      mockOtpService.generateAndSendOtp.mockResolvedValue({
        success: true,
        resendAvailableInSeconds: 60
      });

      const result = await service.forgotPassword({ mobileNumber: '+966501234567' }, '127.0.0.1', 'test-agent');

      expect(result.code).toBe(AUTH_RESET_INITIATED);
      expect(mockOtpService.generateAndSendOtp).toHaveBeenCalledWith('+966501234567', 'PASSWORD_RESET');
    });
  });

  describe('verifyResetOtp (AC: 2)', () => {
    it('verifies OTP, cleans it up, and returns signed resetToken valid for 15 minutes', async () => {
      mockOtpService.verifyOtp.mockResolvedValue({ id: 'otp-rec-1' });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'u-active-1',
        mobileNumber: '+966501234567'
      });

      const result = await service.verifyResetOtp({
        mobileNumber: '+966501234567',
        code: '123456'
      });

      expect(mockOtpService.verifyOtp).toHaveBeenCalledWith('+966501234567', 'PASSWORD_RESET', '123456');
      expect(mockOtpService.cleanupOtp).toHaveBeenCalledWith('otp-rec-1');
      expect(result.code).toBe(AUTH_RESET_OTP_VERIFIED);
      expect(result.data.resetToken).toBeDefined();
      expect(result.data.expiresInSeconds).toBe(900);
    });
  });

  describe('resetPassword (AC: 3)', () => {
    const mockUser = {
      id: 'u-active-1',
      mobileNumber: '+966501234567',
      passwordHash: 'old_hashed_password',
      failedLoginAttempts: 3,
      lockedUntil: new Date('2026-10-31T18:00:00Z')
    };

    it('rejects with AUTH_PASSWORD_SAME_AS_CURRENT if new password matches existing password', async () => {
      const secret = process.env.SESSION_SECRET || 'super-secret-session-key-for-elmasaif-2026-development';
      const payload = {
        userId: mockUser.id,
        mobileNumber: mockUser.mobileNumber,
        exp: fixedNow.getTime() + 900 * 1000
      };
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      const resetToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.resetPassword({ resetToken, newPassword: 'OldPassword123' }, '127.0.0.1', 'test-agent')
      ).rejects.toThrow(expect.objectContaining({
        response: expect.objectContaining({ code: AUTH_PASSWORD_SAME_AS_CURRENT })
      }));
    });

    it('atomically hashes new password, resets user lock/attempts, deletes all sessions, and logs audit', async () => {
      const secret = process.env.SESSION_SECRET || 'super-secret-session-key-for-elmasaif-2026-development';
      const payload = {
        userId: mockUser.id,
        mobileNumber: mockUser.mobileNumber,
        exp: fixedNow.getTime() + 900 * 1000
      };
      const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      const resetToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      (argon2.hash as jest.Mock).mockResolvedValue('new_argon2id_hash');

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(mockPrismaService));

      const result = await service.resetPassword(
        { resetToken, newPassword: 'BrandNewPassword123' },
        '127.0.0.1',
        'test-agent'
      );

      expect(argon2.hash).toHaveBeenCalledWith('BrandNewPassword123', { type: argon2.argon2id });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: 'new_argon2id_hash',
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id }
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: mockUser.id,
          actorType: 'USER',
          action: 'AUTH_PASSWORD_RESET',
          entityType: 'User',
          entityId: mockUser.id,
          ipAddress: '127.0.0.1',
          payload: { source: 'forgot_password_recovery' }
        }
      });
      expect(result.code).toBe(AUTH_PASSWORD_RESET_SUCCESS);
    });
  });

  describe('changePassword (AC: 4)', () => {
    const mockUser = {
      id: 'u-authenticated-1',
      mobileNumber: '+966501234567',
      passwordHash: 'current_password_hash',
      failedLoginAttempts: 0,
      lockedUntil: null
    };

    it('rejects with AUTH_ACCOUNT_LOCKED if user is locked', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(fixedNow.getTime() + 10 * 60 * 1000)
      });

      await expect(
        service.changePassword(
          mockUser.id,
          'sess-token-1',
          { currentPassword: 'WrongPassword1', newPassword: 'NewPassword123' },
          '127.0.0.1',
          'test-agent'
        )
      ).rejects.toThrow(expect.objectContaining({
        response: expect.objectContaining({ code: AUTH_ACCOUNT_LOCKED })
      }));
    });

    it('increments failedLoginAttempts and locks on 5th failed attempt', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          mockUser.id,
          'sess-token-1',
          { currentPassword: 'WrongPassword1', newPassword: 'NewPassword123' },
          '127.0.0.1',
          'test-agent'
        )
      ).rejects.toThrow(expect.objectContaining({
        response: expect.objectContaining({ code: AUTH_ACCOUNT_LOCKED })
      }));

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date)
        })
      }));
    });

    it('rejects with AUTH_PASSWORD_SAME_AS_CURRENT if new password matches current password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(
          mockUser.id,
          'sess-token-1',
          { currentPassword: 'CurrentPassword123', newPassword: 'CurrentPassword123' },
          '127.0.0.1',
          'test-agent'
        )
      ).rejects.toThrow(expect.objectContaining({
        response: expect.objectContaining({ code: AUTH_PASSWORD_SAME_AS_CURRENT })
      }));
    });

    it('revokes all OTHER sessions while preserving the requesting session', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (argon2.hash as jest.Mock).mockResolvedValue('new_argon2id_hash');
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(mockPrismaService));

      const result = await service.changePassword(
        mockUser.id,
        'current-session-token-to-keep',
        { currentPassword: 'CurrentPassword123', newPassword: 'BrandNewPassword123' },
        '127.0.0.1',
        'test-agent'
      );

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          token: { not: 'current-session-token-to-keep' }
        }
      });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: mockUser.id,
          actorType: 'USER',
          action: 'AUTH_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: mockUser.id,
          ipAddress: '127.0.0.1',
          payload: { sessionPreserved: true }
        }
      });
      expect(result.code).toBe(AUTH_PASSWORD_CHANGE_SUCCESS);
    });
  });

});
